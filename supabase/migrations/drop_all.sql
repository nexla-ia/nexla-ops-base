/*
  ============================================================
  DROP ALL - Apaga tudo para recriar do zero
  Execute no Supabase SQL Editor
  ============================================================
*/

-- Desabilita triggers temporariamente
SET session_replication_role = replica;

-- Remove tabelas (CASCADE cuida das FKs)
DROP TABLE IF EXISTS agent_configs        CASCADE;
DROP TABLE IF EXISTS system_settings      CASCADE;
DROP TABLE IF EXISTS theme_settings       CASCADE;
DROP TABLE IF EXISTS transferencias       CASCADE;
DROP TABLE IF EXISTS notifications        CASCADE;
DROP TABLE IF EXISTS message_tags         CASCADE;
DROP TABLE IF EXISTS contact_tags         CASCADE;
DROP TABLE IF EXISTS sent_messages        CASCADE;
DROP TABLE IF EXISTS messages             CASCADE;
DROP TABLE IF EXISTS contacts             CASCADE;
DROP TABLE IF EXISTS attendants           CASCADE;
DROP TABLE IF EXISTS tags                 CASCADE;
DROP TABLE IF EXISTS sectors              CASCADE;
DROP TABLE IF EXISTS departments          CASCADE;
DROP TABLE IF EXISTS companies            CASCADE;
DROP TABLE IF EXISTS plans                CASCADE;
DROP TABLE IF EXISTS super_admins         CASCADE;

-- Remove tipos
DROP TYPE IF EXISTS ticket_status_enum CASCADE;

-- Remove funções
DROP FUNCTION IF EXISTS is_super_admin() CASCADE;
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;
DROP FUNCTION IF EXISTS sync_attendant_api_key() CASCADE;
DROP FUNCTION IF EXISTS check_max_tags_per_contact() CASCADE;
DROP FUNCTION IF EXISTS track_theme_settings_changes() CASCADE;
DROP FUNCTION IF EXISTS update_system_settings_updated_at() CASCADE;
DROP FUNCTION IF EXISTS create_default_reception_department() CASCADE;
DROP FUNCTION IF EXISTS prevent_delete_default_department() CASCADE;
DROP FUNCTION IF EXISTS recalculate_max_attendants() CASCADE;
DROP FUNCTION IF EXISTS upsert_contact_from_message() CASCADE;
DROP FUNCTION IF EXISTS confirm_user_email(uuid) CASCADE;
DROP FUNCTION IF EXISTS transfer_contact_department(uuid, uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS delete_contact_and_messages(uuid) CASCADE;
DROP FUNCTION IF EXISTS registrar_transferencia_por_contact_id(varchar, uuid, uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS registrar_transferencia(varchar, varchar, uuid) CASCADE;
DROP FUNCTION IF EXISTS listar_transferencias(varchar) CASCADE;
DROP FUNCTION IF EXISTS listar_transferencias_contato(varchar, varchar) CASCADE;
DROP FUNCTION IF EXISTS update_contact_tags(uuid, uuid[]) CASCADE;
DROP FUNCTION IF EXISTS delete_company_cascade(uuid) CASCADE;
DROP FUNCTION IF EXISTS get_company_max_attendants(uuid) CASCADE;
DROP FUNCTION IF EXISTS can_add_attendant(uuid) CASCADE;

-- Remove policies de storage (se existirem)
DROP POLICY IF EXISTS "Authenticated users can upload message files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view message files"  ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete message files" ON storage.objects;

-- Reativa triggers
SET session_replication_role = DEFAULT;

SELECT 'Tudo apagado. Pode rodar o migration principal agora.' AS status;
