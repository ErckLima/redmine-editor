// Supabase Edge Function: auth-validate
// Valida a chave API do Redmine informada pelo usuário,
// obtém o login do usuário e salva a chave criptografada no banco.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const REDMINE_BASE = "http://177.69.209.157:65080/redmine";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { api_key } = await req.json();
    if (!api_key || typeof api_key !== "string" || api_key.trim() === "") {
      return new Response(JSON.stringify({ error: "Chave API inválida ou ausente." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validar a chave API consultando o usuário atual no Redmine
    const redmineResponse = await fetch(`${REDMINE_BASE}/users/current.json`, {
      headers: {
        "Content-Type": "application/json",
        "X-Redmine-API-Key": api_key.trim(),
      },
    });

    if (!redmineResponse.ok) {
      return new Response(JSON.stringify({ error: "Chave API do Redmine inválida ou sem permissão." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const redmineData = await redmineResponse.json();
    const login = redmineData?.user?.login;
    const redmineUserId = redmineData?.user?.id;

    if (!login) {
      return new Response(JSON.stringify({ error: "Não foi possível obter o login do usuário no Redmine." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Criar/atualizar o usuário no Supabase Auth usando o login como identificador
    // Usamos o Supabase Admin para criar a sessão
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Email fictício baseado no login para o Supabase Auth
    const fakeEmail = `${login}@redmine.internal`;

    // Tentar criar o usuário; se já existir, buscar
    let userId: string;
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find((u) => u.email === fakeEmail);

    if (existingUser) {
      userId = existingUser.id;
    } else {
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: fakeEmail,
        password: api_key.trim(), // senha = própria chave API (nunca exposta ao cliente)
        email_confirm: true,
        user_metadata: { login, redmine_user_id: redmineUserId },
      });
      if (createError || !newUser?.user) {
        return new Response(JSON.stringify({ error: "Erro ao criar usuário.", detail: createError?.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      userId = newUser.user.id;
    }

    // Salvar/atualizar a chave API no perfil do usuário
    const { error: upsertError } = await supabaseAdmin
      .from("user_profiles")
      .upsert({
        user_id: userId,
        login,
        redmine_user_id: redmineUserId,
        redmine_api_key: api_key.trim(),
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });

    if (upsertError) {
      return new Response(JSON.stringify({ error: "Erro ao salvar perfil.", detail: upsertError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Gerar token de sessão para o usuário
    const { data: session, error: signInError } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email: fakeEmail,
    });

    // Retornar token de acesso via sign in com senha
    const { data: signInData, error: signInErr } = await supabaseAdmin.auth.signInWithPassword({
      email: fakeEmail,
      password: api_key.trim(),
    });

    if (signInErr || !signInData?.session) {
      return new Response(JSON.stringify({ error: "Erro ao gerar sessão.", detail: signInErr?.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      success: true,
      login,
      access_token: signInData.session.access_token,
      refresh_token: signInData.session.refresh_token,
      expires_at: signInData.session.expires_at,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: "Erro interno.", detail: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
