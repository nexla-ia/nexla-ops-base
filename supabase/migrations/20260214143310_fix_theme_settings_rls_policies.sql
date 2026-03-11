/*
  # Fix Theme Settings RLS Policies

  1. Changes
    - Drop old RLS policies that use api_key authentication
    - Create new RLS policies that use user_id based authentication
    - Add policies for companies to manage their theme settings
    - Add policies for attendants to read their company's theme settings
    - Add policies for super admins to manage all theme settings

  2. Security
    - Companies can read/insert/update their own theme settings via user_id
    - Attendants can read their company's theme settings via user_id
    - Super admins can read all theme settings
*/

-- Drop all existing policies on theme_settings
DROP POLICY IF EXISTS "Companies can read own theme settings" ON theme_settings;
DROP POLICY IF EXISTS "Companies can insert own theme settings" ON theme_settings;
DROP POLICY IF EXISTS "Companies can update own theme settings" ON theme_settings;
DROP POLICY IF EXISTS "Attendants can read company theme settings" ON theme_settings;
DROP POLICY IF EXISTS "Super admins can read all theme settings" ON theme_settings;

-- Companies can read their own theme settings
CREATE POLICY "Companies can read own theme settings"
  ON theme_settings
  FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT id FROM companies WHERE user_id = auth.uid()
    )
  );

-- Companies can insert their own theme settings
CREATE POLICY "Companies can insert own theme settings"
  ON theme_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT id FROM companies WHERE user_id = auth.uid()
    )
  );

-- Companies can update their own theme settings
CREATE POLICY "Companies can update own theme settings"
  ON theme_settings
  FOR UPDATE
  TO authenticated
  USING (
    company_id IN (
      SELECT id FROM companies WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT id FROM companies WHERE user_id = auth.uid()
    )
  );

-- Attendants can read their company's theme settings
CREATE POLICY "Attendants can read company theme settings"
  ON theme_settings
  FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM attendants WHERE user_id = auth.uid()
    )
  );

-- Super admins can read all theme settings
CREATE POLICY "Super admins can read all theme settings"
  ON theme_settings
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM super_admins WHERE user_id = auth.uid()
    )
  );

-- Super admins can update all theme settings
CREATE POLICY "Super admins can update all theme settings"
  ON theme_settings
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM super_admins WHERE user_id = auth.uid()
    )
  );