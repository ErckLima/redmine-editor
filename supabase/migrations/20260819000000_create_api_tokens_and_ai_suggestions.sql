-- Migração: tokens de API pessoais (para integrações externas, ex: uma IA)
-- e sugestões de IA pendentes de revisão para as demandas do Redmine.

-- ═══════════════════════════════════════════════════════════════
-- api_tokens: tokens de longa duração para chamadas externas (fora do
-- fluxo de login do navegador). Apenas o hash do token é armazenado.
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.api_tokens (
    id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id      UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
    name         TEXT NOT NULL,
    token_hash   TEXT NOT NULL UNIQUE,
    token_prefix TEXT NOT NULL,
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    last_used_at TIMESTAMPTZ,
    revoked_at   TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_api_tokens_user_id ON public.api_tokens(user_id);

ALTER TABLE public.api_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tokens"
    ON public.api_tokens
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create own tokens"
    ON public.api_tokens
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own tokens"
    ON public.api_tokens
    FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all tokens"
    ON public.api_tokens
    FOR ALL
    USING (auth.role() = 'service_role');

COMMENT ON TABLE public.api_tokens IS 'Tokens pessoais para integrações externas (ex: IA). Só o hash SHA-256 do token é armazenado.';
COMMENT ON COLUMN public.api_tokens.token_hash IS 'SHA-256 hex do token bruto. O token em si nunca é persistido.';
COMMENT ON COLUMN public.api_tokens.token_prefix IS 'Primeiros caracteres do token bruto, só para identificação na UI.';

-- ═══════════════════════════════════════════════════════════════
-- ai_suggestions: sugestão pendente de revisão para uma demanda.
-- Uma linha por (usuário, issue) — uma nova sugestão substitui a
-- anterior; a linha existir já é o estado de "pendente".
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.ai_suggestions (
    id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    issue_id    INTEGER NOT NULL,
    subject     TEXT,
    description TEXT,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (user_id, issue_id)
);

ALTER TABLE public.ai_suggestions ENABLE ROW LEVEL SECURITY;

-- Sem política de INSERT/UPDATE para 'authenticated': só a Edge Function
-- (via service_role) grava aqui, já que a IA se autentica por token
-- próprio, não por sessão do Supabase.
CREATE POLICY "Users can view own suggestions"
    ON public.ai_suggestions
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own suggestions"
    ON public.ai_suggestions
    FOR DELETE
    USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all suggestions"
    ON public.ai_suggestions
    FOR ALL
    USING (auth.role() = 'service_role');

CREATE TRIGGER update_ai_suggestions_updated_at
    BEFORE UPDATE ON public.ai_suggestions
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.ai_suggestions IS 'Sugestão de conteúdo pendente de revisão humana antes de ir para o Redmine. Nunca escrita diretamente no Redmine.';
