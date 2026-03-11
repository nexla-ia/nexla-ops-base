/*
  # Fix Security Issues - Part 5: RLS Optimization for Departments, Sectors and Tags

  1. RLS Policy Optimization
    - Optimize departments, sectors and tags table RLS policies
    - Use `(select auth.uid())` pattern to prevent re-evaluation
    - Improves performance for organizational data queries

  2. Security Notes
    - Auth functions are now evaluated once per query instead of per row
    - Maintains same security model with better performance
*/

-- Optimize departments policies
DROP POLICY IF EXISTS "Companies can view own departments" ON departments;
CREATE POLICY "Companies can view own departments" ON departments
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM companies 
      WHERE companies.id = departments.company_id 
      AND companies.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Companies can insert own departments" ON departments;
CREATE POLICY "Companies can insert own departments" ON departments
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM companies 
      WHERE companies.id = departments.company_id 
      AND companies.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Companies can update own departments" ON departments;
CREATE POLICY "Companies can update own departments" ON departments
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM companies 
      WHERE companies.id = departments.company_id 
      AND companies.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Companies can delete own departments" ON departments;
CREATE POLICY "Companies can delete own departments" ON departments
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM companies 
      WHERE companies.id = departments.company_id 
      AND companies.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Super admins can view all departments" ON departments;
CREATE POLICY "Super admins can view all departments" ON departments
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM super_admins 
      WHERE super_admins.user_id = (select auth.uid())
    )
  );

-- Optimize sectors policies
DROP POLICY IF EXISTS "Companies can view own sectors" ON sectors;
CREATE POLICY "Companies can view own sectors" ON sectors
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM companies 
      WHERE companies.id = sectors.company_id 
      AND companies.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Companies can insert own sectors" ON sectors;
CREATE POLICY "Companies can insert own sectors" ON sectors
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM companies 
      WHERE companies.id = sectors.company_id 
      AND companies.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Companies can update own sectors" ON sectors;
CREATE POLICY "Companies can update own sectors" ON sectors
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM companies 
      WHERE companies.id = sectors.company_id 
      AND companies.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Companies can delete own sectors" ON sectors;
CREATE POLICY "Companies can delete own sectors" ON sectors
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM companies 
      WHERE companies.id = sectors.company_id 
      AND companies.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Super admins can view all sectors" ON sectors;
CREATE POLICY "Super admins can view all sectors" ON sectors
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM super_admins 
      WHERE super_admins.user_id = (select auth.uid())
    )
  );

-- Optimize tags policies
DROP POLICY IF EXISTS "Companies can view own tags" ON tags;
CREATE POLICY "Companies can view own tags" ON tags
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM companies 
      WHERE companies.id = tags.company_id 
      AND companies.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Companies can insert own tags" ON tags;
CREATE POLICY "Companies can insert own tags" ON tags
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM companies 
      WHERE companies.id = tags.company_id 
      AND companies.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Companies can update own tags" ON tags;
CREATE POLICY "Companies can update own tags" ON tags
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM companies 
      WHERE companies.id = tags.company_id 
      AND companies.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Companies can delete own tags" ON tags;
CREATE POLICY "Companies can delete own tags" ON tags
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM companies 
      WHERE companies.id = tags.company_id 
      AND companies.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Super admins can view all tags" ON tags;
CREATE POLICY "Super admins can view all tags" ON tags
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM super_admins 
      WHERE super_admins.user_id = (select auth.uid())
    )
  );
