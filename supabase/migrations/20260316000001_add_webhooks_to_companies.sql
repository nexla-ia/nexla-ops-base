-- ============================================================
-- Migration: Adiciona campos de webhook por empresa e triggers
-- que disparam HTTP POST via pg_net quando mensagens chegam/saem
-- ============================================================

-- 1. Adiciona colunas na tabela companies
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS webhook_recebimento text,
  ADD COLUMN IF NOT EXISTS webhook_envio text;

-- ============================================================
-- 2. Função: dispara webhook de recebimento (messages)
-- ============================================================
CREATE OR REPLACE FUNCTION dispatch_webhook_recebimento()
RETURNS TRIGGER AS $$
DECLARE
  v_webhook_url text;
BEGIN
  -- Busca o webhook da empresa pelo company_id (já preenchido pelo trigger anterior)
  SELECT webhook_recebimento INTO v_webhook_url
  FROM public.companies
  WHERE id = NEW.company_id;

  IF v_webhook_url IS NOT NULL AND v_webhook_url <> '' THEN
    PERFORM net.http_post(
      url     := v_webhook_url,
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body    := row_to_json(NEW)::text::jsonb
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================================
-- 3. Função: dispara webhook de envio (sent_messages)
-- ============================================================
CREATE OR REPLACE FUNCTION dispatch_webhook_envio()
RETURNS TRIGGER AS $$
DECLARE
  v_webhook_url text;
BEGIN
  SELECT webhook_envio INTO v_webhook_url
  FROM public.companies
  WHERE id = NEW.company_id;

  IF v_webhook_url IS NOT NULL AND v_webhook_url <> '' THEN
    PERFORM net.http_post(
      url     := v_webhook_url,
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body    := row_to_json(NEW)::text::jsonb
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================================
-- 4. Triggers nas tabelas
-- ============================================================
DROP TRIGGER IF EXISTS trg_dispatch_webhook_recebimento ON public.messages;
CREATE TRIGGER trg_dispatch_webhook_recebimento
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION dispatch_webhook_recebimento();

DROP TRIGGER IF EXISTS trg_dispatch_webhook_envio ON public.sent_messages;
CREATE TRIGGER trg_dispatch_webhook_envio
  AFTER INSERT ON public.sent_messages
  FOR EACH ROW
  EXECUTE FUNCTION dispatch_webhook_envio();
