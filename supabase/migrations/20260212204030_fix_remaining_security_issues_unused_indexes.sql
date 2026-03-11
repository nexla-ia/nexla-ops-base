/*
  # Fix Remaining Security Issues - Remove Unused Indexes

  1. Remove Unused Indexes
    - Drop indexes that are not being used by queries
    - Reduces database overhead and maintenance cost
    - Improves write performance

  2. Security Notes
    - Unused indexes consume resources without benefit
    - Removing them improves overall database performance
    - Indexes can be recreated if needed later
*/

-- Remove unused indexes on sent_messages
DROP INDEX IF EXISTS idx_sent_messages_apikey;
DROP INDEX IF EXISTS idx_sent_messages_created_at;
DROP INDEX IF EXISTS idx_sent_messages_numero_apikey;
DROP INDEX IF EXISTS idx_sent_messages_department_id;
DROP INDEX IF EXISTS idx_sent_messages_sector_id;
DROP INDEX IF EXISTS idx_sent_messages_tag_id;

-- Remove unused indexes on contacts
DROP INDEX IF EXISTS idx_contacts_sector_id;
DROP INDEX IF EXISTS idx_contacts_tag_id;

-- Remove unused indexes on contact_tags
DROP INDEX IF EXISTS idx_contact_tags_contact_id;

-- Remove unused indexes on companies
DROP INDEX IF EXISTS idx_companies_ia_ativada;

-- Remove unused indexes on transferencias
DROP INDEX IF EXISTS idx_transferencias_api_key;

-- Remove unused indexes on notifications
DROP INDEX IF EXISTS idx_notifications_is_read;
DROP INDEX IF EXISTS idx_notifications_created_at;

-- Remove unused indexes on message_tags
DROP INDEX IF EXISTS idx_message_tags_tag_id;

-- Remove unused indexes on attendants
DROP INDEX IF EXISTS idx_attendants_api_key;
DROP INDEX IF EXISTS idx_attendants_email;
DROP INDEX IF EXISTS idx_attendants_department_id;
DROP INDEX IF EXISTS idx_attendants_sector_id;

-- Remove unused index on super_admins
DROP INDEX IF EXISTS idx_super_admins_user_id;
