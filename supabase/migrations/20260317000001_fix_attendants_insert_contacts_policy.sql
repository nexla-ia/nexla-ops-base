/*
  # Fix: Restore attendants INSERT policy on contacts

  1. Problem
    - Migration 20260212204051 dropped "Attendants can insert company contacts" policy
      as part of deduplication cleanup, but never created a replacement.
    - Attendants get "row-level security policy violation" when trying to add contacts.

  2. Solution
    - Recreate the INSERT policy for attendants using the optimized pattern.
*/

DROP POLICY IF EXISTS "attendants_insert_contacts" ON contacts;

CREATE POLICY "attendants_insert_contacts" ON contacts
  FOR INSERT TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM attendants
      WHERE user_id = (select auth.uid())
    )
  );
