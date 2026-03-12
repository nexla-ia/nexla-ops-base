/*
  ============================================================
  HELPER: Remover FK constraints para permitir importação de dados
  ============================================================
  Execute ANTES de importar os CSVs do banco anterior.

  Após importar todos os dados, execute o script
  20260312000003_restore_fk_constraints.sql para restaurar.
  ============================================================
*/

-- Remove FK de companies.user_id (auth.users)
ALTER TABLE companies
  DROP CONSTRAINT IF EXISTS companies_user_id_fkey;

-- Remove FK de attendants.user_id (auth.users)
ALTER TABLE attendants
  DROP CONSTRAINT IF EXISTS attendants_user_id_fkey;

-- Remove FK de contacts.ticket_closed_by (auth.users)
ALTER TABLE contacts
  DROP CONSTRAINT IF EXISTS contacts_ticket_closed_by_fkey;

-- Remove FK de theme_settings.last_modified_by (auth.users)
ALTER TABLE theme_settings
  DROP CONSTRAINT IF EXISTS theme_settings_last_modified_by_fkey;

-- Remove FK de message_tags.created_by (auth.users)
ALTER TABLE message_tags
  DROP CONSTRAINT IF EXISTS message_tags_created_by_fkey;

-- Remove FK de super_admins.user_id (auth.users)
ALTER TABLE super_admins
  DROP CONSTRAINT IF EXISTS super_admins_user_id_fkey;
