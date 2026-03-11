/*
  # Fix Performance and Security Issues - Corrected Version

  ## Changes Made
  
  ### 1. Missing Indexes on Foreign Keys
  - Added indexes for all foreign key columns without covering indexes
  - Improves JOIN performance and foreign key constraint checking
  
  ### 2. RLS Performance Optimization
  - Fixed all RLS policies that re-evaluate auth functions for each row
  - Wrapped auth.uid() calls with (select auth.uid()) for better performance
  - This allows PostgreSQL to evaluate the function once per query instead of per row
  
  ### 3. Removed Unused Indexes
  - Dropped indexes that are not being used by queries
  - Reduces storage overhead and improves write performance
  
  ## Impact
  - Significant performance improvement for queries with large datasets
  - Enhanced security posture
  - Reduced storage overhead
*/

-- ============================================================================
-- PART 1: Add Missing Indexes on Foreign Keys
-- ============================================================================

-- Attendants table
CREATE INDEX IF NOT EXISTS idx_attendants_department_id ON public.attendants(department_id);
CREATE INDEX IF NOT EXISTS idx_attendants_sector_id ON public.attendants(sector_id);

-- Contacts table
CREATE INDEX IF NOT EXISTS idx_contacts_sector_id ON public.contacts(sector_id);
CREATE INDEX IF NOT EXISTS idx_contacts_tag_id ON public.contacts(tag_id);
CREATE INDEX IF NOT EXISTS idx_contacts_ticket_closed_by ON public.contacts(ticket_closed_by);

-- Message tags table
CREATE INDEX IF NOT EXISTS idx_message_tags_tag_id ON public.message_tags(tag_id);

-- Sent messages table
CREATE INDEX IF NOT EXISTS idx_sent_messages_department_id ON public.sent_messages(department_id);
CREATE INDEX IF NOT EXISTS idx_sent_messages_sector_id ON public.sent_messages(sector_id);
CREATE INDEX IF NOT EXISTS idx_sent_messages_tag_id ON public.sent_messages(tag_id);

-- Theme settings table
CREATE INDEX IF NOT EXISTS idx_theme_settings_last_modified_by ON public.theme_settings(last_modified_by);

-- ============================================================================
-- PART 2: Drop Unused Indexes
-- ============================================================================

DROP INDEX IF EXISTS public.idx_plans_ai_enabled;
DROP INDEX IF EXISTS public.idx_contacts_pinned;
DROP INDEX IF EXISTS public.idx_contacts_ia_ativada;
DROP INDEX IF EXISTS public.idx_theme_settings_updated_at;
DROP INDEX IF EXISTS public.idx_theme_settings_agent_interface_config;
DROP INDEX IF EXISTS public.idx_theme_settings_customer_display_config;
DROP INDEX IF EXISTS public.idx_theme_settings_system_config;
DROP INDEX IF EXISTS public.idx_theme_settings_integration_config;
DROP INDEX IF EXISTS public.idx_theme_settings_version;
DROP INDEX IF EXISTS public.idx_companies_user_id;
DROP INDEX IF EXISTS public.idx_contacts_ticket_status;
DROP INDEX IF EXISTS public.idx_contacts_ticket_opened_at;
DROP INDEX IF EXISTS public.idx_plans_is_active;
DROP INDEX IF EXISTS public.idx_plans_billing_period;
DROP INDEX IF EXISTS public.idx_companies_plan_id;

-- ============================================================================
-- PART 3: Fix RLS Policies for Performance
-- ============================================================================

-- Messages table policies
DROP POLICY IF EXISTS "attendant_can_read_messages" ON public.messages;
CREATE POLICY "attendant_can_read_messages"
  ON public.messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.attendants
      WHERE attendants.user_id = (select auth.uid())
      AND attendants.company_id = messages.company_id
    )
  );

DROP POLICY IF EXISTS "messages_update_tagid_null" ON public.messages;
CREATE POLICY "messages_update_tagid_null"
  ON public.messages FOR UPDATE
  TO authenticated
  USING (company_id IN (
    SELECT id FROM public.companies 
    WHERE user_id = (select auth.uid())
  ));

-- Sent messages table policies
DROP POLICY IF EXISTS "Attendants can insert company sent messages" ON public.sent_messages;
CREATE POLICY "Attendants can insert company sent messages"
  ON public.sent_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM public.attendants 
      WHERE user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Attendants can update company sent messages" ON public.sent_messages;
CREATE POLICY "Attendants can update company sent messages"
  ON public.sent_messages FOR UPDATE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM public.attendants 
      WHERE user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "attendant_can_read_sent_messages" ON public.sent_messages;
CREATE POLICY "attendant_can_read_sent_messages"
  ON public.sent_messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.attendants
      WHERE attendants.user_id = (select auth.uid())
      AND attendants.company_id = sent_messages.company_id
    )
  );

-- Departments table policies
DROP POLICY IF EXISTS "Attendants can view company departments" ON public.departments;
CREATE POLICY "Attendants can view company departments"
  ON public.departments FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM public.attendants 
      WHERE user_id = (select auth.uid())
    )
  );

-- Sectors table policies
DROP POLICY IF EXISTS "Attendants can view company sectors" ON public.sectors;
CREATE POLICY "Attendants can view company sectors"
  ON public.sectors FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM public.attendants 
      WHERE user_id = (select auth.uid())
    )
  );

-- Tags table policies
DROP POLICY IF EXISTS "tags_access" ON public.tags;
CREATE POLICY "tags_access"
  ON public.tags FOR ALL
  TO authenticated
  USING (
    company_id IN (
      SELECT id FROM public.companies 
      WHERE user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "tags_attendant_delete" ON public.tags;
CREATE POLICY "tags_attendant_delete"
  ON public.tags FOR DELETE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM public.attendants 
      WHERE user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "tags_attendant_insert" ON public.tags;
CREATE POLICY "tags_attendant_insert"
  ON public.tags FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM public.attendants 
      WHERE user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "tags_attendant_select" ON public.tags;
CREATE POLICY "tags_attendant_select"
  ON public.tags FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM public.attendants 
      WHERE user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "tags_attendant_update" ON public.tags;
CREATE POLICY "tags_attendant_update"
  ON public.tags FOR UPDATE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM public.attendants 
      WHERE user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "tags_rw_company_owner_or_attendant" ON public.tags;
CREATE POLICY "tags_rw_company_owner_or_attendant"
  ON public.tags FOR ALL
  TO authenticated
  USING (
    company_id IN (
      SELECT id FROM public.companies 
      WHERE user_id = (select auth.uid())
    )
    OR
    company_id IN (
      SELECT company_id FROM public.attendants 
      WHERE user_id = (select auth.uid())
    )
  );

-- Message tags table policies (uses JOIN to messages table)
DROP POLICY IF EXISTS "Companies can delete own message tags" ON public.message_tags;
CREATE POLICY "Companies can delete own message tags"
  ON public.message_tags FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.messages
      WHERE messages.id = message_tags.message_id
      AND messages.company_id IN (
        SELECT id FROM public.companies 
        WHERE user_id = (select auth.uid())
      )
    )
  );

DROP POLICY IF EXISTS "Companies can insert own message tags" ON public.message_tags;
CREATE POLICY "Companies can insert own message tags"
  ON public.message_tags FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.messages
      WHERE messages.id = message_tags.message_id
      AND messages.company_id IN (
        SELECT id FROM public.companies 
        WHERE user_id = (select auth.uid())
      )
    )
  );

DROP POLICY IF EXISTS "Companies can view own message tags" ON public.message_tags;
CREATE POLICY "Companies can view own message tags"
  ON public.message_tags FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.messages
      WHERE messages.id = message_tags.message_id
      AND messages.company_id IN (
        SELECT id FROM public.companies 
        WHERE user_id = (select auth.uid())
      )
    )
  );

DROP POLICY IF EXISTS "Super admins can manage all message tags" ON public.message_tags;
CREATE POLICY "Super admins can manage all message tags"
  ON public.message_tags FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.super_admins 
      WHERE user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Super admins can view all message tags" ON public.message_tags;
CREATE POLICY "Super admins can view all message tags"
  ON public.message_tags FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.super_admins 
      WHERE user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "message_tags_access" ON public.message_tags;
CREATE POLICY "message_tags_access"
  ON public.message_tags FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.messages
      WHERE messages.id = message_tags.message_id
      AND messages.company_id IN (
        SELECT id FROM public.companies 
        WHERE user_id = (select auth.uid())
      )
    )
  );

DROP POLICY IF EXISTS "message_tags_attendant_delete" ON public.message_tags;
CREATE POLICY "message_tags_attendant_delete"
  ON public.message_tags FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.messages
      WHERE messages.id = message_tags.message_id
      AND messages.company_id IN (
        SELECT company_id FROM public.attendants 
        WHERE user_id = (select auth.uid())
      )
    )
  );

DROP POLICY IF EXISTS "message_tags_attendant_insert" ON public.message_tags;
CREATE POLICY "message_tags_attendant_insert"
  ON public.message_tags FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.messages
      WHERE messages.id = message_tags.message_id
      AND messages.company_id IN (
        SELECT company_id FROM public.attendants 
        WHERE user_id = (select auth.uid())
      )
    )
  );

DROP POLICY IF EXISTS "message_tags_attendant_select" ON public.message_tags;
CREATE POLICY "message_tags_attendant_select"
  ON public.message_tags FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.messages
      WHERE messages.id = message_tags.message_id
      AND messages.company_id IN (
        SELECT company_id FROM public.attendants 
        WHERE user_id = (select auth.uid())
      )
    )
  );

DROP POLICY IF EXISTS "message_tags_delete" ON public.message_tags;
CREATE POLICY "message_tags_delete"
  ON public.message_tags FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.messages
      WHERE messages.id = message_tags.message_id
      AND messages.company_id IN (
        SELECT id FROM public.companies 
        WHERE user_id = (select auth.uid())
      )
    )
  );

-- Contacts table policies
DROP POLICY IF EXISTS "Attendants can update company contacts" ON public.contacts;
CREATE POLICY "Attendants can update company contacts"
  ON public.contacts FOR UPDATE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM public.attendants 
      WHERE user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Companies can update own contacts" ON public.contacts;
CREATE POLICY "Companies can update own contacts"
  ON public.contacts FOR UPDATE
  TO authenticated
  USING (
    company_id IN (
      SELECT id FROM public.companies 
      WHERE user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "attendant_can_read_contacts" ON public.contacts;
CREATE POLICY "attendant_can_read_contacts"
  ON public.contacts FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.attendants
      WHERE attendants.user_id = (select auth.uid())
      AND attendants.company_id = contacts.company_id
    )
  );

-- Contact tags table policies (uses JOIN to contacts table)
DROP POLICY IF EXISTS "Companies can delete own contact tags" ON public.contact_tags;
CREATE POLICY "Companies can delete own contact tags"
  ON public.contact_tags FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.contacts
      WHERE contacts.id = contact_tags.contact_id
      AND contacts.company_id IN (
        SELECT id FROM public.companies 
        WHERE user_id = (select auth.uid())
      )
    )
  );

DROP POLICY IF EXISTS "Companies can insert own contact tags" ON public.contact_tags;
CREATE POLICY "Companies can insert own contact tags"
  ON public.contact_tags FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.contacts
      WHERE contacts.id = contact_tags.contact_id
      AND contacts.company_id IN (
        SELECT id FROM public.companies 
        WHERE user_id = (select auth.uid())
      )
    )
  );

DROP POLICY IF EXISTS "Companies can view own contact tags" ON public.contact_tags;
CREATE POLICY "Companies can view own contact tags"
  ON public.contact_tags FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.contacts
      WHERE contacts.id = contact_tags.contact_id
      AND contacts.company_id IN (
        SELECT id FROM public.companies 
        WHERE user_id = (select auth.uid())
      )
    )
  );

DROP POLICY IF EXISTS "Super admins can view all contact tags" ON public.contact_tags;
CREATE POLICY "Super admins can view all contact tags"
  ON public.contact_tags FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.super_admins 
      WHERE user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "contact_tags_access" ON public.contact_tags;
CREATE POLICY "contact_tags_access"
  ON public.contact_tags FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.contacts
      WHERE contacts.id = contact_tags.contact_id
      AND contacts.company_id IN (
        SELECT id FROM public.companies 
        WHERE user_id = (select auth.uid())
      )
    )
  );

DROP POLICY IF EXISTS "contact_tags_attendant_delete" ON public.contact_tags;
CREATE POLICY "contact_tags_attendant_delete"
  ON public.contact_tags FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.contacts
      WHERE contacts.id = contact_tags.contact_id
      AND contacts.company_id IN (
        SELECT company_id FROM public.attendants 
        WHERE user_id = (select auth.uid())
      )
    )
  );

DROP POLICY IF EXISTS "contact_tags_attendant_insert" ON public.contact_tags;
CREATE POLICY "contact_tags_attendant_insert"
  ON public.contact_tags FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.contacts
      WHERE contacts.id = contact_tags.contact_id
      AND contacts.company_id IN (
        SELECT company_id FROM public.attendants 
        WHERE user_id = (select auth.uid())
      )
    )
  );

DROP POLICY IF EXISTS "contact_tags_attendant_select" ON public.contact_tags;
CREATE POLICY "contact_tags_attendant_select"
  ON public.contact_tags FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.contacts
      WHERE contacts.id = contact_tags.contact_id
      AND contacts.company_id IN (
        SELECT company_id FROM public.attendants 
        WHERE user_id = (select auth.uid())
      )
    )
  );

DROP POLICY IF EXISTS "contact_tags_delete" ON public.contact_tags;
CREATE POLICY "contact_tags_delete"
  ON public.contact_tags FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.contacts
      WHERE contacts.id = contact_tags.contact_id
      AND contacts.company_id IN (
        SELECT id FROM public.companies 
        WHERE user_id = (select auth.uid())
      )
    )
  );

DROP POLICY IF EXISTS "contact_tags_insert" ON public.contact_tags;
CREATE POLICY "contact_tags_insert"
  ON public.contact_tags FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.contacts
      WHERE contacts.id = contact_tags.contact_id
      AND contacts.company_id IN (
        SELECT id FROM public.companies 
        WHERE user_id = (select auth.uid())
      )
    )
  );

DROP POLICY IF EXISTS "contact_tags_select" ON public.contact_tags;
CREATE POLICY "contact_tags_select"
  ON public.contact_tags FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.contacts
      WHERE contacts.id = contact_tags.contact_id
      AND contacts.company_id IN (
        SELECT id FROM public.companies 
        WHERE user_id = (select auth.uid())
      )
    )
  );

-- Transferencias table policies
DROP POLICY IF EXISTS "Attendants can insert company transfers" ON public.transferencias;
CREATE POLICY "Attendants can insert company transfers"
  ON public.transferencias FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM public.attendants 
      WHERE user_id = (select auth.uid())
    )
  );

-- Theme settings table policies
DROP POLICY IF EXISTS "Attendants can delete company theme settings" ON public.theme_settings;
CREATE POLICY "Attendants can delete company theme settings"
  ON public.theme_settings FOR DELETE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM public.attendants 
      WHERE user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Attendants can insert company theme settings" ON public.theme_settings;
CREATE POLICY "Attendants can insert company theme settings"
  ON public.theme_settings FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM public.attendants 
      WHERE user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Attendants can read company theme settings" ON public.theme_settings;
CREATE POLICY "Attendants can read company theme settings"
  ON public.theme_settings FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM public.attendants 
      WHERE user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Attendants can update company theme settings" ON public.theme_settings;
CREATE POLICY "Attendants can update company theme settings"
  ON public.theme_settings FOR UPDATE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM public.attendants 
      WHERE user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Companies can delete own theme settings" ON public.theme_settings;
CREATE POLICY "Companies can delete own theme settings"
  ON public.theme_settings FOR DELETE
  TO authenticated
  USING (
    company_id IN (
      SELECT id FROM public.companies 
      WHERE user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Companies can insert own theme settings" ON public.theme_settings;
CREATE POLICY "Companies can insert own theme settings"
  ON public.theme_settings FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT id FROM public.companies 
      WHERE user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Companies can read own theme settings" ON public.theme_settings;
CREATE POLICY "Companies can read own theme settings"
  ON public.theme_settings FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT id FROM public.companies 
      WHERE user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Companies can update own theme settings" ON public.theme_settings;
CREATE POLICY "Companies can update own theme settings"
  ON public.theme_settings FOR UPDATE
  TO authenticated
  USING (
    company_id IN (
      SELECT id FROM public.companies 
      WHERE user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Super admins can delete all theme settings" ON public.theme_settings;
CREATE POLICY "Super admins can delete all theme settings"
  ON public.theme_settings FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.super_admins 
      WHERE user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Super admins can insert all theme settings" ON public.theme_settings;
CREATE POLICY "Super admins can insert all theme settings"
  ON public.theme_settings FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.super_admins 
      WHERE user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Super admins can read all theme settings" ON public.theme_settings;
CREATE POLICY "Super admins can read all theme settings"
  ON public.theme_settings FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.super_admins 
      WHERE user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Super admins can update all theme settings" ON public.theme_settings;
CREATE POLICY "Super admins can update all theme settings"
  ON public.theme_settings FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.super_admins 
      WHERE user_id = (select auth.uid())
    )
  );

-- Plans table policies
DROP POLICY IF EXISTS "Companies can read their own plan" ON public.plans;
CREATE POLICY "Companies can read their own plan"
  ON public.plans FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT plan_id FROM public.companies 
      WHERE user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Super admins can do everything with plans" ON public.plans;
CREATE POLICY "Super admins can do everything with plans"
  ON public.plans FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.super_admins 
      WHERE user_id = (select auth.uid())
    )
  );