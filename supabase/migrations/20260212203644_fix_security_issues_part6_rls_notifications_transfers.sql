/*
  # Fix Security Issues - Part 6: RLS Optimization for Notifications and Transfers

  1. RLS Policy Optimization
    - Optimize notifications and transferencias table RLS policies
    - Use `(select auth.uid())` pattern to prevent re-evaluation
    - Completes optimization of main application tables

  2. Security Notes
    - Auth functions are now evaluated once per query instead of per row
    - Maintains same security model with better performance
*/

-- Optimize notifications policies
DROP POLICY IF EXISTS "Companies can read own notifications" ON notifications;
CREATE POLICY "Companies can read own notifications" ON notifications
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM companies 
      WHERE companies.id = notifications.company_id 
      AND companies.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Companies can update own notifications" ON notifications;
CREATE POLICY "Companies can update own notifications" ON notifications
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM companies 
      WHERE companies.id = notifications.company_id 
      AND companies.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Super admins can create notifications" ON notifications;
CREATE POLICY "Super admins can create notifications" ON notifications
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM super_admins 
      WHERE super_admins.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Super admins can read all notifications" ON notifications;
CREATE POLICY "Super admins can read all notifications" ON notifications
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM super_admins 
      WHERE super_admins.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Super admins can update all notifications" ON notifications;
CREATE POLICY "Super admins can update all notifications" ON notifications
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM super_admins 
      WHERE super_admins.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Super admins can delete notifications" ON notifications;
CREATE POLICY "Super admins can delete notifications" ON notifications
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM super_admins 
      WHERE super_admins.user_id = (select auth.uid())
    )
  );

-- Optimize transferencias policies
DROP POLICY IF EXISTS "Companies can view own transfers" ON transferencias;
CREATE POLICY "Companies can view own transfers" ON transferencias
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM companies 
      WHERE companies.id = transferencias.company_id 
      AND companies.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Companies can insert own transfers" ON transferencias;
CREATE POLICY "Companies can insert own transfers" ON transferencias
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM companies 
      WHERE companies.id = transferencias.company_id 
      AND companies.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Super admins can view all transfers" ON transferencias;
CREATE POLICY "Super admins can view all transfers" ON transferencias
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM super_admins 
      WHERE super_admins.user_id = (select auth.uid())
    )
  );
