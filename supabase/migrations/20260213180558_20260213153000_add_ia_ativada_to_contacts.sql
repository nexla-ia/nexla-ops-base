/*
  # Add IA activation column to contacts

  1. Changes to contacts table
    - Add `ia_ativada` (boolean, default false) - Indicates if AI is active for this contact
  
  2. Performance
    - Add index on ia_ativada for faster queries
  
  3. Documentation
    - Add column comment explaining the field
*/

-- Add ia_ativada column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contacts' AND column_name = 'ia_ativada'
  ) THEN
    ALTER TABLE contacts ADD COLUMN ia_ativada BOOLEAN DEFAULT false;
  END IF;
END $$;

-- Create index for faster queries (only if it doesn't exist)
CREATE INDEX IF NOT EXISTS idx_contacts_ia_ativada ON contacts(ia_ativada);

-- Add comment
COMMENT ON COLUMN contacts.ia_ativada IS 'Indica se a IA está ativada para este contato (padrão: false/desativada)';