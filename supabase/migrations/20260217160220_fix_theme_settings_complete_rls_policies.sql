/*
  # Fix Theme Settings RLS Policies - Complete CRUD Operations

  ## Changes Made
  
  1. **Add Missing DELETE Policies**
     - Companies can delete their own theme settings
     - Super admins can delete any theme settings
  
  2. **Add Attendants UPDATE and INSERT Policies**
     - Attendants can update theme settings for their company
     - Attendants can insert theme settings for their company
  
  3. **Security**
     - All policies properly check company_id ownership
     - Attendants can only modify their own company's settings
     - Super admins have full access to all settings
  
  ## Notes
  - This enables full CRUD (Create, Read, Update, Delete) operations
  - Real-time updates will work automatically after these policies are in place
  - All changes respect the company isolation model
*/

-- Drop existing policies if they exist to avoid conflicts
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Companies can delete own theme settings" ON theme_settings;
  DROP POLICY IF EXISTS "Super admins can delete all theme settings" ON theme_settings;
  DROP POLICY IF EXISTS "Attendants can update company theme settings" ON theme_settings;
  DROP POLICY IF EXISTS "Attendants can insert company theme settings" ON theme_settings;
END $$;

-- Add DELETE policy for companies
CREATE POLICY "Companies can delete own theme settings"
  ON theme_settings
  FOR DELETE
  TO authenticated
  USING (
    company_id IN (
      SELECT id FROM companies WHERE user_id = auth.uid()
    )
  );

-- Add DELETE policy for super admins
CREATE POLICY "Super admins can delete all theme settings"
  ON theme_settings
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM super_admins WHERE user_id = auth.uid()
    )
  );

-- Add UPDATE policy for attendants
CREATE POLICY "Attendants can update company theme settings"
  ON theme_settings
  FOR UPDATE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM attendants WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM attendants WHERE user_id = auth.uid()
    )
  );

-- Add INSERT policy for attendants
CREATE POLICY "Attendants can insert company theme settings"
  ON theme_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM attendants WHERE user_id = auth.uid()
    )
  );

-- Ensure realtime is enabled for theme_settings table
DO $$
BEGIN
  EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE theme_settings';
EXCEPTION
  WHEN duplicate_object THEN
    NULL;
END $$;
