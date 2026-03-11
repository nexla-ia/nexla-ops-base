/*
  # Fix Security Issues - Part 4: RLS Optimization for Contacts and Attendants

  1. RLS Policy Optimization
    - Optimize contacts and attendants table RLS policies
    - Use `(select auth.uid())` pattern to prevent re-evaluation
    - High-traffic tables that benefit from optimization

  2. Security Notes
    - Auth functions are now evaluated once per query instead of per row
    - Maintains same security model with better performance
*/

-- Optimize contacts policies
DROP POLICY IF EXISTS "Companies can view own contacts" ON contacts;
CREATE POLICY "Companies can view own contacts" ON contacts
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM companies 
      WHERE companies.id = contacts.company_id 
      AND companies.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Companies can insert own contacts" ON contacts;
CREATE POLICY "Companies can insert own contacts" ON contacts
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM companies 
      WHERE companies.id = contacts.company_id 
      AND companies.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Companies can update own contacts" ON contacts;
CREATE POLICY "Companies can update own contacts" ON contacts
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM companies 
      WHERE companies.id = contacts.company_id 
      AND companies.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Companies can delete own contacts" ON contacts;
CREATE POLICY "Companies can delete own contacts" ON contacts
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM companies 
      WHERE companies.id = contacts.company_id 
      AND companies.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Super admins can view all contacts" ON contacts;
CREATE POLICY "Super admins can view all contacts" ON contacts
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM super_admins 
      WHERE super_admins.user_id = (select auth.uid())
    )
  );

-- Optimize attendants policies
DROP POLICY IF EXISTS "Attendants read own profile" ON attendants;
CREATE POLICY "Attendants read own profile" ON attendants
  FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Attendants update own profile" ON attendants;
CREATE POLICY "Attendants update own profile" ON attendants
  FOR UPDATE TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Super admins read all attendants" ON attendants;
CREATE POLICY "Super admins read all attendants" ON attendants
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM super_admins 
      WHERE super_admins.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Super admins update attendants" ON attendants;
CREATE POLICY "Super admins update attendants" ON attendants
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM super_admins 
      WHERE super_admins.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Super admins delete attendants" ON attendants;
CREATE POLICY "Super admins delete attendants" ON attendants
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM super_admins 
      WHERE super_admins.user_id = (select auth.uid())
    )
  );
