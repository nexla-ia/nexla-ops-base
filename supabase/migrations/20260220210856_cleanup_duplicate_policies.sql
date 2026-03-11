/*
  # Clean up duplicate RLS policies

  1. Changes
    - Remove duplicate policies from tags, contact_tags tables
    - Keep only the most specific and efficient policies
    - Improve performance by reducing policy overhead
  
  2. Security
    - Maintains same security level
    - Ensures proper access control for companies, attendants, and super admins
*/

-- Drop duplicate tags policies
DROP POLICY IF EXISTS "tags_access" ON tags;
DROP POLICY IF EXISTS "tags_rw_company_owner_or_attendant" ON tags;

-- Drop duplicate contact_tags policies  
DROP POLICY IF EXISTS "contact_tags_access" ON contact_tags;
DROP POLICY IF EXISTS "contact_tags_delete" ON contact_tags;
DROP POLICY IF EXISTS "contact_tags_insert" ON contact_tags;
DROP POLICY IF EXISTS "contact_tags_select" ON contact_tags;