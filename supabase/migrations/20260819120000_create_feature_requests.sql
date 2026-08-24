-- Migração: quadro de sugestões/pedidos de melhoria do próprio editor
-- (não tem relação com o Redmine — é feedback dos usuários sobre o app).

CREATE TABLE IF NOT EXISTS public.feature_requests (
    id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id      UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
    author_login TEXT,
    title        TEXT NOT NULL,
    description  TEXT,
    status       TEXT NOT NULL DEFAULT 'pendente'
                 CHECK (status IN ('pendente', 'em_desenvolvimento', 'concluido', 'recusado')),
    admin_notes  TEXT,
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feature_requests_user_id ON public.feature_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_feature_requests_status ON public.feature_requests(status);

-- Preenche author_login a partir do perfil do próprio usuário no INSERT,
-- em vez de confiar no valor que o cliente mandar (evita spoof de nome).
CREATE OR REPLACE FUNCTION public.set_feature_request_author_login()
RETURNS TRIGGER AS $$
BEGIN
    SELECT login INTO NEW.author_login FROM public.user_profiles WHERE user_id = NEW.user_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER set_feature_request_author_login_trigger
    BEFORE INSERT ON public.feature_requests
    FOR EACH ROW
    EXECUTE FUNCTION public.set_feature_request_author_login();

CREATE TRIGGER update_feature_requests_updated_at
    BEFORE UPDATE ON public.feature_requests
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.feature_requests ENABLE ROW LEVEL SECURITY;

-- Quadro compartilhado: qualquer usuário autenticado vê todas as sugestões.
CREATE POLICY "Authenticated users can view all suggestions"
    ON public.feature_requests
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Users can create own suggestions"
    ON public.feature_requests
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own suggestions"
    ON public.feature_requests
    FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);

-- Só o admin (login 'erick.lima') pode mudar status/notas de qualquer sugestão.
CREATE POLICY "Admin can update any suggestion"
    ON public.feature_requests
    FOR UPDATE
    TO authenticated
    USING (
        auth.uid() IN (SELECT user_id FROM public.user_profiles WHERE login = 'erick.lima')
    );

CREATE POLICY "Service role can manage all suggestions"
    ON public.feature_requests
    FOR ALL
    USING (auth.role() = 'service_role');

COMMENT ON TABLE public.feature_requests IS 'Sugestões/pedidos de melhoria do editor feitos pelos usuários, com acompanhamento de status.';
COMMENT ON COLUMN public.feature_requests.status IS 'pendente | em_desenvolvimento | concluido | recusado';
