/*
  # Add Theme Colors to Companies

  1. Changes
    - Add display_name column to companies
    - Add logo_url column to companies
    - Add incoming_message_color column to companies
    - Add outgoing_message_color column to companies
    - Add incoming_text_color column to companies
    - Add outgoing_text_color column to companies
    - Add primary_color column to companies
    - Add accent_color column to companies
  
  2. Details
    - All color columns have default values matching the current theme
    - Colors are stored as hex strings (#RRGGBB)
    - Display name and logo URL are optional text fields
    - These settings apply to all attendants of the company
*/

-- Add display_name column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'companies' AND column_name = 'display_name'
  ) THEN
    ALTER TABLE companies ADD COLUMN display_name TEXT DEFAULT '';
  END IF;
END $$;

-- Add logo_url column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'companies' AND column_name = 'logo_url'
  ) THEN
    ALTER TABLE companies ADD COLUMN logo_url TEXT DEFAULT '';
  END IF;
END $$;

-- Add incoming_message_color column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'companies' AND column_name = 'incoming_message_color'
  ) THEN
    ALTER TABLE companies ADD COLUMN incoming_message_color TEXT DEFAULT '#f1f5f9';
  END IF;
END $$;

-- Add outgoing_message_color column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'companies' AND column_name = 'outgoing_message_color'
  ) THEN
    ALTER TABLE companies ADD COLUMN outgoing_message_color TEXT DEFAULT '#3b82f6';
  END IF;
END $$;

-- Add incoming_text_color column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'companies' AND column_name = 'incoming_text_color'
  ) THEN
    ALTER TABLE companies ADD COLUMN incoming_text_color TEXT DEFAULT '#1e293b';
  END IF;
END $$;

-- Add outgoing_text_color column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'companies' AND column_name = 'outgoing_text_color'
  ) THEN
    ALTER TABLE companies ADD COLUMN outgoing_text_color TEXT DEFAULT '#ffffff';
  END IF;
END $$;

-- Add primary_color column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'companies' AND column_name = 'primary_color'
  ) THEN
    ALTER TABLE companies ADD COLUMN primary_color TEXT DEFAULT '#3b82f6';
  END IF;
END $$;

-- Add accent_color column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'companies' AND column_name = 'accent_color'
  ) THEN
    ALTER TABLE companies ADD COLUMN accent_color TEXT DEFAULT '#06b6d4';
  END IF;
END $$;

-- Add comments for documentation
COMMENT ON COLUMN companies.display_name IS 'Display name shown in the UI for this company';
COMMENT ON COLUMN companies.logo_url IS 'URL to the company logo image';
COMMENT ON COLUMN companies.incoming_message_color IS 'Background color for incoming messages (hex)';
COMMENT ON COLUMN companies.outgoing_message_color IS 'Background color for outgoing messages (hex)';
COMMENT ON COLUMN companies.incoming_text_color IS 'Text color for incoming messages (hex)';
COMMENT ON COLUMN companies.outgoing_text_color IS 'Text color for outgoing messages (hex)';
COMMENT ON COLUMN companies.primary_color IS 'Primary brand color for the company (hex)';
COMMENT ON COLUMN companies.accent_color IS 'Accent color for highlights and CTAs (hex)';