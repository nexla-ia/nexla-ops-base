-- Corrige problemas da rpc_create_company
-- garantindo uso correto de pgcrypto

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.hash_password(p_password text)
RETURNS text
LANGUAGE sql
AS $$
SELECT crypt(p_password, gen_salt('bf', 10));
$$;
