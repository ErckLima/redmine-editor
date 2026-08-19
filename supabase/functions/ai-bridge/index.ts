// Supabase Edge Function: ai-bridge
//
// Permite que uma IA externa (fora do fluxo de login do navegador) leia o
// conteúdo de uma demanda e grave uma sugestão de ajuste pendente de revisão.
//
// Autenticação: token pessoal (tabela api_tokens), não é sessão do Supabase.
// A sugestão gravada aqui NUNCA é escrita no Redmine por esta função — ela
// só fica pendente até o usuário aceitar manualmente dentro do editor e
// clicar em "Atualizar Redmine" (fluxo humano já existente).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { fetchRedmineIssue } from "../_shared/redmine-client.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function hashToken(rawToken: string): Promise<string> {
  const data = new TextEncoder().encode(rawToken);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return jsonResponse({ error: "Token de autenticação ausente." }, 401);
    }
    const rawToken = authHeader.replace("Bearer ", "").trim();
    if (!rawToken) {
      return jsonResponse({ error: "Token de autenticação ausente." }, 401);
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const tokenHash = await hashToken(rawToken);
    const { data: tokenRow, error: tokenError } = await supabaseAdmin
      .from("api_tokens")
      .select("id, user_id, revoked_at")
      .eq("token_hash", tokenHash)
      .is("revoked_at", null)
      .maybeSingle();

    if (tokenError || !tokenRow) {
      return jsonResponse({ error: "Token inválido ou revogado." }, 401);
    }

    const userId = tokenRow.user_id as string;

    // Fire-and-forget: não bloqueia a resposta.
    supabaseAdmin
      .from("api_tokens")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", tokenRow.id)
      .then(() => {}, () => {});

    if (req.method === "GET") {
      const url = new URL(req.url);
      const issueId = url.searchParams.get("issue_id");
      if (!issueId) {
        return jsonResponse({ error: "Parâmetro 'issue_id' ausente." }, 400);
      }

      const { data: profile, error: profileError } = await supabaseAdmin
        .from("user_profiles")
        .select("redmine_api_key")
        .eq("user_id", userId)
        .single();

      if (profileError || !profile?.redmine_api_key) {
        return jsonResponse({ error: "Chave API do Redmine não configurada." }, 400);
      }

      const result = await fetchRedmineIssue(issueId, profile.redmine_api_key);
      if (!result.ok) {
        return jsonResponse({ error: result.error, detail: result.detail }, result.status);
      }

      const issue = result.data.issue;
      return jsonResponse(
        {
          issue_id: issue.id,
          subject: issue.subject,
          description: issue.description,
        },
        200
      );
    }

    if (req.method === "POST") {
      const body = await req.json().catch(() => null);
      const issueId = Number(body?.issue_id);
      const subject = typeof body?.subject === "string" ? body.subject : null;
      const description = typeof body?.description === "string" ? body.description : null;

      if (!Number.isInteger(issueId) || issueId <= 0 || (!subject && !description)) {
        return jsonResponse(
          { error: "Informe 'issue_id' (inteiro) e ao menos 'subject' ou 'description'." },
          400
        );
      }
      if (description && description.length > 50000) {
        return jsonResponse({ error: "Descrição excede o limite de 50000 caracteres." }, 400);
      }

      const { error: upsertError } = await supabaseAdmin
        .from("ai_suggestions")
        .upsert(
          {
            user_id: userId,
            issue_id: issueId,
            subject,
            description,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id,issue_id" }
        );

      if (upsertError) {
        return jsonResponse({ error: "Erro ao salvar sugestão.", detail: upsertError.message }, 500);
      }

      return jsonResponse({ success: true, issue_id: issueId }, 200);
    }

    return jsonResponse({ error: "Método não suportado." }, 405);
  } catch (err) {
    return jsonResponse({ error: "Erro interno.", detail: String(err) }, 500);
  }
});
