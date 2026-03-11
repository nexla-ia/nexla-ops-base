/*
  # Remove Dark Mode Column

  1. Changes
    - Remove `dark_mode` column from companies table
*/

-- Remove dark_mode column if exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'companies' AND column_name = 'dark_mode'
  ) THEN
    ALTER TABLE companies DROP COLUMN dark_mode;
  END IF;
END $$;
