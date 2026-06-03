import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const REDMINE_BASE = "http://177.69.209.157:65080/redmine";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Token de autenticação ausente." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseToken = authHeader.replace("Bearer ", "");
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: `Bearer ${supabaseToken}` } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser(supabaseToken);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Sessão inválida ou expirada." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profile, error: profileError } = await supabase
      .from("user_profiles")
      .select("redmine_api_key")
      .eq("user_id", user.id)
      .single();

    if (profileError || !profile?.redmine_api_key) {
      return new Response(JSON.stringify({ error: "Chave API do Redmine não configurada." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const redmineApiKey = profile.redmine_api_key;
    const url = new URL(req.url);
    const redminePath = url.searchParams.get("path");

    if (!redminePath) {
      return new Response(JSON.stringify({ error: "Parâmetro 'path' ausente." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const redmineUrl = `${REDMINE_BASE}${redminePath}`;
    const method = req.method;

    const bodyText = method === "PUT" ? await req.text() : undefined;

    const fetchOptions: RequestInit = {
      method,
      headers: {
        "Content-Type": "application/json",
        "X-Redmine-API-Key": redmineApiKey,
      },
      signal: AbortSignal.timeout(15000),
    };

    if (bodyText !== undefined) {
      fetchOptions.body = bodyText;
    }

    let redmineResponse: Response;
    try {
      redmineResponse = await fetch(redmineUrl, fetchOptions);
    } catch (fetchErr) {
      const msg = String(fetchErr);
      const isTimeout = msg.includes("Timeout") || msg.includes("timeout") || msg.includes("AbortError");
      return new Response(
        JSON.stringify({
          error: isTimeout
            ? "Timeout ao conectar ao Redmine (servidor demorou mais de 15s para responder)."
            : "Não foi possível conectar ao Redmine. Verifique se o servidor está acessível.",
          detail: msg,
        }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    const redmineStatus = redmineResponse.status;

    // PUT bem-sucedido: Redmine retorna 200 ou 204 com corpo vazio.
    // HTTP proíbe corpo em respostas 204, então SEMPRE retornamos 200 com JSON de sucesso.
    if (method === "PUT") {
      if (redmineStatus >= 200 && redmineStatus < 300) {
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      // Erro no Redmine durante PUT
      let errBody = "";
      try { errBody = await redmineResponse.text(); } catch (_) { /* ignorar */ }
      return new Response(
        JSON.stringify({ error: "Erro no Redmine ao atualizar.", detail: errBody, status: redmineStatus }),
        {
          status: redmineStatus,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // GET: retornar o corpo da resposta normalmente
    const responseText = await redmineResponse.text();
    return new Response(responseText, {
      status: redmineStatus,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Erro interno no proxy.", detail: String(err) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
