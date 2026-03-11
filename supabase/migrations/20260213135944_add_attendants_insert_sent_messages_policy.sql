/*
  # Add INSERT Policy for Attendants on sent_messages

  1. New Policy
    - Allow attendants to insert sent messages for their company
    - Attendants can only insert messages for the company they belong to
    - Validates that the attendant belongs to the company via company_id

  2. Security
    - Ensures attendants cannot insert messages for other companies
    - Uses EXISTS check with attendants table to verify ownership
    - Validates both user_id and company_id match
*/

-- Allow attendants to insert sent messages for their company
CREATE POLICY "Attendants can insert company sent messages"
  ON sent_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM attendants a
      WHERE a.user_id = auth.uid()
        AND a.company_id = sent_messages.company_id
    )
  );
