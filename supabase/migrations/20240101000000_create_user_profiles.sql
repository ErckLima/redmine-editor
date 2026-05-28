-- Migração: Criar tabela user_profiles para armazenar perfis dos usuários
-- e suas chaves API do Redmine de forma segura.

-- Habilitar extensão pgcrypto para criptografia
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Tabela de perfis de usuário
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    login TEXT NOT NULL,
    redmine_user_id INTEGER,
    redmine_api_key TEXT NOT NULL,  -- Armazenada com RLS: apenas o próprio usuário acessa
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índice para busca rápida por user_id
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON public.user_profiles(user_id);

-- Habilitar Row Level Security (RLS) - segurança a nível de linha
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Política: usuário só pode ver e editar seu próprio perfil
CREATE POLICY "Users can view own profile"
    ON public.user_profiles
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can update own profile"
    ON public.user_profiles
    FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all profiles"
    ON public.user_profiles
    FOR ALL
    USING (auth.role() = 'service_role');

-- Função para atualizar o updated_at automaticamente
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para atualizar updated_at
CREATE TRIGGER update_user_profiles_updated_at
    BEFORE UPDATE ON public.user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Comentários para documentação
COMMENT ON TABLE public.user_profiles IS 'Perfis de usuários com chaves API do Redmine armazenadas com segurança via RLS';
COMMENT ON COLUMN public.user_profiles.redmine_api_key IS 'Chave API do Redmine. Protegida por RLS - apenas o próprio usuário e o service_role têm acesso.';
