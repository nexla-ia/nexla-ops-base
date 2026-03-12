/*
  ============================================================
  HELPER: Restaurar FK constraints após importação de dados
  ============================================================
  Execute APÓS importar todos os CSVs do banco anterior.

  ATENÇÃO: Este script só funciona se os user_ids importados
  existirem em auth.users. Se não existirem, deixe as FKs
  removidas e gerencie via aplicação.
  ============================================================
*/

-- Restaura FK de companies.user_id
-- ATENÇÃO: só execute se os user_ids existirem em auth.users
ALTER TABLE companies
  ADD CONSTRAINT companies_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Restaura FK de attendants.user_id
ALTER TABLE attendants
  ADD CONSTRAINT attendants_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Restaura FK de contacts.ticket_closed_by
ALTER TABLE contacts
  ADD CONSTRAINT contacts_ticket_closed_by_fkey
  FOREIGN KEY (ticket_closed_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- Restaura FK de theme_settings.last_modified_by (se a coluna existir)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'theme_settings' AND column_name = 'last_modified_by'
  ) THEN
    ALTER TABLE theme_settings
      ADD CONSTRAINT theme_settings_last_modified_by_fkey
      FOREIGN KEY (last_modified_by) REFERENCES auth.users(id);
  END IF;
END $$;

-- Restaura FK de message_tags.created_by
ALTER TABLE message_tags
  ADD CONSTRAINT message_tags_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES auth.users(id);

-- Restaura FK de super_admins.user_id
ALTER TABLE super_admins
  ADD CONSTRAINT super_admins_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
