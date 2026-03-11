/*
  # Add Dark Mode Support to Companies

  1. Changes
    - Add `dark_mode` column to companies table (boolean, default false)
    - This allows persisting the dark mode preference per company

  2. Notes
    - All existing companies will default to light mode (false)
    - The theme context will load and save this value automatically
*/

-- Add dark_mode column to companies table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'companies' AND column_name = 'dark_mode'
  ) THEN
    ALTER TABLE companies ADD COLUMN dark_mode boolean DEFAULT false;
  END IF;
END $$;
