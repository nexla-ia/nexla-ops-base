/*
  # Fix Remaining Security Issues - Consolidate Duplicate Policies

  1. Remove Duplicate Policies
    - Remove redundant permissive policies that overlap
    - Keep the most specific and efficient policies
    - Reduces policy evaluation overhead

  2. Security Notes
    - Multiple permissive policies are evaluated with OR logic
    - Having fewer, well-designed policies improves performance
    - Security model remains the same
*/

-- ============================================================================
-- CONTACT_TAGS - Remove older duplicate policies, keep new optimized ones
-- ============================================================================

DROP POLICY IF EXISTS "Attendants can view company contact tags" ON contact_tags;
DROP POLICY IF EXISTS "Attendants can insert company contact tags" ON contact_tags;
DROP POLICY IF EXISTS "Attendants can delete company contact tags" ON contact_tags;
DROP POLICY IF EXISTS attendant_select_contact_tags ON contact_tags;
DROP POLICY IF EXISTS attendant_delete_contact_tags ON contact_tags;

-- Keep: contact_tags_access, contact_tags_attendant_select, contact_tags_attendant_insert, 
--       contact_tags_attendant_delete, contact_tags_select, contact_tags_insert, contact_tags_delete

-- ============================================================================
-- MESSAGE_TAGS - Remove older duplicate policies
-- ============================================================================

DROP POLICY IF EXISTS "Attendants can view tags from their company" ON message_tags;
DROP POLICY IF EXISTS "Attendants can add tags to messages" ON message_tags;
DROP POLICY IF EXISTS "Attendants can remove tags from messages" ON message_tags;
DROP POLICY IF EXISTS "Company admins can view their message tags" ON message_tags;
DROP POLICY IF EXISTS "Company admins can manage their message tags" ON message_tags;
DROP POLICY IF EXISTS attendant_select_message_tags ON message_tags;
DROP POLICY IF EXISTS attendant_delete_message_tags ON message_tags;

-- Keep: message_tags_access, message_tags_attendant_select, message_tags_attendant_insert,
--       message_tags_attendant_delete, message_tags_delete

-- ============================================================================
-- TAGS - Remove older duplicate policies
-- ============================================================================

DROP POLICY IF EXISTS "Attendants can view company tags" ON tags;
DROP POLICY IF EXISTS "Attendants can view tags from their company" ON tags;
DROP POLICY IF EXISTS attendant_select_tags ON tags;
DROP POLICY IF EXISTS attendant_delete_tags ON tags;

-- Keep: tags_access, tags_rw_company_owner_or_attendant, tags_attendant_select,
--       tags_attendant_insert, tags_attendant_update, tags_attendant_delete

-- ============================================================================
-- CONTACTS - Remove duplicate attendant policies
-- ============================================================================

DROP POLICY IF EXISTS "Attendants can view company contacts" ON contacts;
DROP POLICY IF EXISTS "Attendants can insert company contacts" ON contacts;
DROP POLICY IF EXISTS "Attendants can update company contacts" ON contacts;

-- Keep: attendant_can_read_contacts and company policies

-- ============================================================================
-- MESSAGES - Remove duplicate policies
-- ============================================================================

DROP POLICY IF EXISTS "Attendants can read company messages" ON messages;
DROP POLICY IF EXISTS attendant_select_messages ON messages;
DROP POLICY IF EXISTS attendant_update_messages_tag_null ON messages;

-- Keep: messages_select_simple, attendant_can_read_messages, messages_update_tagid_null

-- ============================================================================
-- SENT_MESSAGES - Remove duplicate policies
-- ============================================================================

DROP POLICY IF EXISTS "Attendants can read company sent messages" ON sent_messages;
DROP POLICY IF EXISTS "Attendants can view company sent messages" ON sent_messages;
DROP POLICY IF EXISTS "Attendants can insert company sent messages" ON sent_messages;
DROP POLICY IF EXISTS attendant_select_sent_messages ON sent_messages;
DROP POLICY IF EXISTS attendant_update_sent_messages_tag_null ON sent_messages;

-- Keep: attendant_can_read_sent_messages and company/super_admin policies

-- ============================================================================
-- SECTORS - Remove duplicate attendant policy
-- ============================================================================

DROP POLICY IF EXISTS "Attendants can read company sectors" ON sectors;
DROP POLICY IF EXISTS "Attendants can view company sectors" ON sectors;

-- Keep the most recent one

-- ============================================================================
-- DEPARTMENTS - Remove duplicate attendant policy
-- ============================================================================

DROP POLICY IF EXISTS "Attendants can view company departments" ON departments;

-- Keep company and super_admin policies

-- ============================================================================
-- TRANSFERENCIAS - Remove duplicate attendant policy
-- ============================================================================

DROP POLICY IF EXISTS "Attendants can view company transfers" ON transferencias;
DROP POLICY IF EXISTS "Attendants can insert company transfers" ON transferencias;

-- Keep company and super_admin policies
