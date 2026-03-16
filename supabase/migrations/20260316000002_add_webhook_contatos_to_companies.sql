-- Adiciona campo webhook_contatos na tabela companies
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS webhook_contatos text;
