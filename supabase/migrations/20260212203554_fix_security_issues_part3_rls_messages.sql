/*
  # Fix Security Issues - Part 3: RLS Optimization for Messages

  1. RLS Policy Optimization
    - Optimize messages and sent_messages table RLS policies
    - Use `(select auth.uid())` pattern to prevent re-evaluation
    - These are the most queried tables, so optimization has highest impact

  2. Security Notes
    - Auth functions are now evaluated once per query instead of per row
    - Maintains same security model with better performance
*/

-- Optimize messages policies (most queried table)
DROP POLICY IF EXISTS messages_select_simple ON messages;
CREATE POLICY messages_select_simple ON messages
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM companies 
      WHERE companies.api_key = messages.apikey_instancia 
      AND companies.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Companies can update own messages" ON messages;
CREATE POLICY "Companies can update own messages" ON messages
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM companies 
      WHERE companies.api_key = messages.apikey_instancia 
      AND companies.user_id = (select auth.uid())
    )
  );

-- Optimize sent_messages policies
DROP POLICY IF EXISTS "Companies can view their own sent messages" ON sent_messages;
CREATE POLICY "Companies can view their own sent messages" ON sent_messages
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM companies 
      WHERE companies.api_key = sent_messages.apikey_instancia 
      AND companies.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Companies can insert their own sent messages" ON sent_messages;
CREATE POLICY "Companies can insert their own sent messages" ON sent_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM companies 
      WHERE companies.api_key = sent_messages.apikey_instancia 
      AND companies.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Companies can update their own sent messages" ON sent_messages;
CREATE POLICY "Companies can update their own sent messages" ON sent_messages
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM companies 
      WHERE companies.api_key = sent_messages.apikey_instancia 
      AND companies.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Super admins can view all sent messages" ON sent_messages;
CREATE POLICY "Super admins can view all sent messages" ON sent_messages
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM super_admins 
      WHERE super_admins.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Super admins can insert sent messages" ON sent_messages;
CREATE POLICY "Super admins can insert sent messages" ON sent_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM super_admins 
      WHERE super_admins.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Super admins can update sent messages" ON sent_messages;
CREATE POLICY "Super admins can update sent messages" ON sent_messages
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM super_admins 
      WHERE super_admins.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Super admins can delete sent messages" ON sent_messages;
CREATE POLICY "Super admins can delete sent messages" ON sent_messages
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM super_admins 
      WHERE super_admins.user_id = (select auth.uid())
    )
  );
