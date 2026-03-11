/*
  # Add UPDATE Policy for Attendants on sent_messages

  1. New Policy
    - Allow attendants to update sent messages for their company
    - Attendants can only update messages for the company they belong to
    - Validates that the attendant belongs to the company via company_id

  2. Security
    - Ensures attendants cannot update messages for other companies
    - Uses EXISTS check with attendants table to verify ownership
    - Validates both user_id and company_id match
*/

-- Allow attendants to update sent messages for their company
CREATE POLICY "Attendants can update company sent messages"
  ON sent_messages
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM attendants a
      WHERE a.user_id = auth.uid()
        AND a.company_id = sent_messages.company_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM attendants a
      WHERE a.user_id = auth.uid()
        AND a.company_id = sent_messages.company_id
    )
  );
