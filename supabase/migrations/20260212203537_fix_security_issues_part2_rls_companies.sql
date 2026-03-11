/*
  # Fix Security Issues - Part 2: RLS Optimization for Companies

  1. RLS Policy Optimization
    - Optimize companies table RLS policies
    - Use `(select auth.uid())` pattern to prevent re-evaluation
    - This significantly improves performance at scale

  2. Security Notes
    - All changes improve query performance without changing security model
    - Auth functions are now evaluated once per query instead of per row
*/

-- Optimize companies policies
DROP POLICY IF EXISTS companies_select_own ON companies;
CREATE POLICY companies_select_own ON companies
  FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS companies_update_own ON companies;
CREATE POLICY companies_update_own ON companies
  FOR UPDATE TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS super_admins_select_all ON companies;
CREATE POLICY super_admins_select_all ON companies
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM super_admins 
      WHERE super_admins.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS super_admins_update_all ON companies;
CREATE POLICY super_admins_update_all ON companies
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM super_admins 
      WHERE super_admins.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS super_admins_insert ON companies;
CREATE POLICY super_admins_insert ON companies
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM super_admins 
      WHERE super_admins.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS super_admins_delete ON companies;
CREATE POLICY super_admins_delete ON companies
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM super_admins 
      WHERE super_admins.user_id = (select auth.uid())
    )
  );

-- Optimize super_admins policy
DROP POLICY IF EXISTS "Users can read own super admin record" ON super_admins;
CREATE POLICY "Users can read own super admin record" ON super_admins
  FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()));
