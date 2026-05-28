// Supabase Edge Function: redmine-proxy
// Proxy seguro para a API do Redmine.
// Recebe a chave API criptografada via header Authorization (Bearer <token_supabase>),
// descriptografa, e repassa a requisição ao Redmine.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const REDMINE_BASE = "http://177.69.209.157:65080/redmine";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
};

Deno.serve(async (req: Request) => {
  // Preflight CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Validar token Supabase e obter usuário
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

    // Verificar sessão do usuário
    const { data: { user }, error: userError } = await supabase.auth.getUser(supabaseToken);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Sessão inválida ou expirada." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Buscar chave API do Redmine do usuário no banco
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

    // Extrair o path e método da requisição
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

    const fetchOptions: RequestInit = {
      method,
      headers: {
        "Content-Type": "application/json",
        "X-Redmine-API-Key": redmineApiKey,
      },
    };

    if (method === "PUT") {
      const body = await req.text();
      fetchOptions.body = body;
    }

    const redmineResponse = await fetch(redmineUrl, fetchOptions);
    const responseText = await redmineResponse.text();

    return new Response(responseText, {
      status: redmineResponse.status,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Erro interno no proxy.", detail: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
