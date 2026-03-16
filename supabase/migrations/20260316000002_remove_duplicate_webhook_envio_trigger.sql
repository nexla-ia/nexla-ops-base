-- ============================================================
-- Remove trigger de webhook_envio que causava envio duplicado.
-- O webhook de envio já é disparado diretamente pelo código da
-- aplicação (AttendantDashboard, CompanyDashboard, SuperAdminDashboard)
-- com payload customizado. O trigger do banco gerava uma segunda
-- chamada com o row bruto da tabela sent_messages.
-- ============================================================

DROP TRIGGER IF EXISTS trg_dispatch_webhook_envio ON public.sent_messages;
DROP FUNCTION IF EXISTS dispatch_webhook_envio();