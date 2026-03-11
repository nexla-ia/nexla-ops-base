/*
  # Fix Cascade Delete Rules for Companies and Attendants

  ## Changes Made

  1. Drop and recreate delete_company_cascade function with comprehensive cleanup:
     - Delete all attendant auth users BEFORE deleting the company
     - Delete orphaned messages (apikey_instancia but no company_id)
     - Delete orphaned sent_messages (apikey_instancia but no company_id)
     - Let CASCADE handle: contacts, contact_tags, attendants, departments, sectors, tags, message_tags, notifications, transferencias, theme_settings
     - Delete the company itself
     - Delete the company auth user after company deletion

  2. Function returns statistics of all deleted records

  3. Add verification checks for CASCADE rules on all foreign keys

  ## Security
  - Only super admins can execute (verified internally)
  - Function is SECURITY DEFINER to delete auth users
  - Granted EXECUTE to authenticated users
*/

-- ============================================================================
-- PART 1: Drop and recreate delete_company_cascade function
-- ============================================================================

-- Drop the old function
DROP FUNCTION IF EXISTS delete_company_cascade(uuid);

-- Create comprehensive function that handles ALL related data
CREATE OR REPLACE FUNCTION delete_company_cascade(company_uuid uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_attendants int := 0;
  deleted_attendant_users int := 0;
  deleted_departments int := 0;
  deleted_sectors int := 0;
  deleted_tags int := 0;
  deleted_messages int := 0;
  deleted_sent_messages int := 0;
  deleted_contacts int := 0;
  deleted_contact_tags int := 0;
  deleted_notifications int := 0;
  deleted_transferencias int := 0;
  deleted_theme_settings int := 0;
  deleted_message_tags int := 0;
  company_api_key text;
  company_user_id uuid;
BEGIN
  -- Check if user is super admin
  IF NOT EXISTS (
    SELECT 1 FROM super_admins
    WHERE super_admins.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Only super admins can delete companies';
  END IF;

  -- Get company data before deletion
  SELECT api_key, user_id INTO company_api_key, company_user_id
  FROM companies
  WHERE id = company_uuid;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Company not found';
  END IF;

  -- Count records that will be deleted (for statistics)
  SELECT COUNT(*) INTO deleted_attendants
  FROM attendants
  WHERE company_id = company_uuid;

  SELECT COUNT(*) INTO deleted_departments
  FROM departments
  WHERE company_id = company_uuid;

  SELECT COUNT(*) INTO deleted_sectors
  FROM sectors
  WHERE company_id = company_uuid;

  SELECT COUNT(*) INTO deleted_tags
  FROM tags
  WHERE company_id = company_uuid;

  SELECT COUNT(*) INTO deleted_messages
  FROM messages
  WHERE apikey_instancia = company_api_key;

  SELECT COUNT(*) INTO deleted_sent_messages
  FROM sent_messages
  WHERE company_id = company_uuid;

  SELECT COUNT(*) INTO deleted_contacts
  FROM contacts
  WHERE company_id = company_uuid;

  SELECT COUNT(*) INTO deleted_contact_tags
  FROM contact_tags
  WHERE contact_id IN (SELECT id FROM contacts WHERE company_id = company_uuid);

  SELECT COUNT(*) INTO deleted_message_tags
  FROM message_tags
  WHERE message_id IN (SELECT id FROM messages WHERE company_id = company_uuid);

  SELECT COUNT(*) INTO deleted_notifications
  FROM notifications
  WHERE company_id = company_uuid;

  SELECT COUNT(*) INTO deleted_transferencias
  FROM transferencias
  WHERE company_id = company_uuid;

  SELECT COUNT(*) INTO deleted_theme_settings
  FROM theme_settings
  WHERE company_id = company_uuid;

  -- Step 1: Delete auth users for all attendants of this company BEFORE deleting the company
  IF deleted_attendants > 0 THEN
    DELETE FROM auth.users
    WHERE id IN (
      SELECT user_id FROM attendants WHERE company_id = company_uuid AND user_id IS NOT NULL
    );

    GET DIAGNOSTICS deleted_attendant_users = ROW_COUNT;
  END IF;

  -- Step 2: Delete orphaned messages (have apikey_instancia but no company_id)
  -- These are messages that were created before company_id was properly set
  DELETE FROM messages
  WHERE apikey_instancia = company_api_key
  AND company_id IS NULL;

  -- Step 3: Delete orphaned sent_messages (have apikey_instancia but no company_id)
  DELETE FROM sent_messages
  WHERE apikey_instancia = company_api_key
  AND company_id IS NULL;

  -- Step 4: Delete the company
  -- CASCADE will automatically handle:
  -- - contacts (and their contact_tags via CASCADE)
  -- - attendants (remaining records)
  -- - departments
  -- - sectors
  -- - tags (and their message_tags via CASCADE)
  -- - messages (where company_id is set)
  -- - sent_messages (where company_id is set)
  -- - notifications
  -- - transferencias
  -- - theme_settings
  DELETE FROM companies WHERE id = company_uuid;

  -- Step 5: Delete the company's auth user if it exists
  IF company_user_id IS NOT NULL THEN
    DELETE FROM auth.users WHERE id = company_user_id;
  END IF;

  -- Return comprehensive statistics
  RETURN jsonb_build_object(
    'success', true,
    'deleted', jsonb_build_object(
      'attendants', deleted_attendants,
      'attendant_users', deleted_attendant_users,
      'departments', deleted_departments,
      'sectors', deleted_sectors,
      'tags', deleted_tags,
      'messages', deleted_messages,
      'sent_messages', deleted_sent_messages,
      'contacts', deleted_contacts,
      'contact_tags', deleted_contact_tags,
      'message_tags', deleted_message_tags,
      'notifications', deleted_notifications,
      'transferencias', deleted_transferencias,
      'theme_settings', deleted_theme_settings,
      'company_user', CASE WHEN company_user_id IS NOT NULL THEN 1 ELSE 0 END
    )
  );
END;
$$;

-- Grant execute permission to authenticated users (function checks super admin internally)
GRANT EXECUTE ON FUNCTION delete_company_cascade(uuid) TO authenticated;

-- ============================================================================
-- PART 2: Verify and fix CASCADE rules on all foreign keys
-- ============================================================================

-- Messages table - ensure company_id has CASCADE
DO $$
BEGIN
  -- Drop existing constraint if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'messages_company_id_fkey'
    AND table_name = 'messages'
  ) THEN
    ALTER TABLE messages DROP CONSTRAINT messages_company_id_fkey;
  END IF;

  -- Recreate with ON DELETE CASCADE
  ALTER TABLE messages
  ADD CONSTRAINT messages_company_id_fkey
  FOREIGN KEY (company_id)
  REFERENCES companies(id)
  ON DELETE CASCADE;
END $$;

-- Sent messages table - ensure company_id has CASCADE
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'sent_messages_company_id_fkey'
    AND table_name = 'sent_messages'
  ) THEN
    ALTER TABLE sent_messages DROP CONSTRAINT sent_messages_company_id_fkey;
  END IF;

  ALTER TABLE sent_messages
  ADD CONSTRAINT sent_messages_company_id_fkey
  FOREIGN KEY (company_id)
  REFERENCES companies(id)
  ON DELETE CASCADE;
END $$;

-- Contacts table - verify CASCADE (should already exist)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'contacts_company_id_fkey'
    AND table_name = 'contacts'
  ) THEN
    ALTER TABLE contacts DROP CONSTRAINT contacts_company_id_fkey;
  END IF;

  ALTER TABLE contacts
  ADD CONSTRAINT contacts_company_id_fkey
  FOREIGN KEY (company_id)
  REFERENCES companies(id)
  ON DELETE CASCADE;
END $$;

-- Attendants table - verify CASCADE (should already exist)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'attendants_company_id_fkey'
    AND table_name = 'attendants'
  ) THEN
    ALTER TABLE attendants DROP CONSTRAINT attendants_company_id_fkey;
  END IF;

  ALTER TABLE attendants
  ADD CONSTRAINT attendants_company_id_fkey
  FOREIGN KEY (company_id)
  REFERENCES companies(id)
  ON DELETE CASCADE;
END $$;

-- Departments table - verify CASCADE (should already exist)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'departments_company_id_fkey'
    AND table_name = 'departments'
  ) THEN
    ALTER TABLE departments DROP CONSTRAINT departments_company_id_fkey;
  END IF;

  ALTER TABLE departments
  ADD CONSTRAINT departments_company_id_fkey
  FOREIGN KEY (company_id)
  REFERENCES companies(id)
  ON DELETE CASCADE;
END $$;

-- Sectors table - verify CASCADE (should already exist)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'sectors_company_id_fkey'
    AND table_name = 'sectors'
  ) THEN
    ALTER TABLE sectors DROP CONSTRAINT sectors_company_id_fkey;
  END IF;

  ALTER TABLE sectors
  ADD CONSTRAINT sectors_company_id_fkey
  FOREIGN KEY (company_id)
  REFERENCES companies(id)
  ON DELETE CASCADE;
END $$;

-- Tags table - verify CASCADE (should already exist)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'tags_company_id_fkey'
    AND table_name = 'tags'
  ) THEN
    ALTER TABLE tags DROP CONSTRAINT tags_company_id_fkey;
  END IF;

  ALTER TABLE tags
  ADD CONSTRAINT tags_company_id_fkey
  FOREIGN KEY (company_id)
  REFERENCES companies(id)
  ON DELETE CASCADE;
END $$;

-- Notifications table - verify CASCADE (should already exist)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'notifications_company_id_fkey'
    AND table_name = 'notifications'
  ) THEN
    ALTER TABLE notifications DROP CONSTRAINT notifications_company_id_fkey;
  END IF;

  ALTER TABLE notifications
  ADD CONSTRAINT notifications_company_id_fkey
  FOREIGN KEY (company_id)
  REFERENCES companies(id)
  ON DELETE CASCADE;
END $$;

-- Transferencias table - verify CASCADE (should already exist)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'transferencias_company_id_fkey'
    AND table_name = 'transferencias'
  ) THEN
    ALTER TABLE transferencias DROP CONSTRAINT transferencias_company_id_fkey;
  END IF;

  ALTER TABLE transferencias
  ADD CONSTRAINT transferencias_company_id_fkey
  FOREIGN KEY (company_id)
  REFERENCES companies(id)
  ON DELETE CASCADE;
END $$;

-- Theme settings table - verify CASCADE (should already exist)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'theme_settings_company_id_fkey'
    AND table_name = 'theme_settings'
  ) THEN
    ALTER TABLE theme_settings DROP CONSTRAINT theme_settings_company_id_fkey;
  END IF;

  ALTER TABLE theme_settings
  ADD CONSTRAINT theme_settings_company_id_fkey
  FOREIGN KEY (company_id)
  REFERENCES companies(id)
  ON DELETE CASCADE;
END $$;
