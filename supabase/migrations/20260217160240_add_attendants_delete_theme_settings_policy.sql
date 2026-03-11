/*
  # Add Attendants DELETE Policy for Theme Settings

  ## Changes
  - Add DELETE policy for attendants on theme_settings table
  - Allows attendants to delete theme settings for their company
  
  ## Security
  - Attendants can only delete settings for their own company
  - Proper company_id verification through attendants table
*/

-- Add DELETE policy for attendants
CREATE POLICY "Attendants can delete company theme settings"
  ON theme_settings
  FOR DELETE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM attendants WHERE user_id = auth.uid()
    )
  );
