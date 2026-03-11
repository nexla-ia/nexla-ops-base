/*
  # Update Theme Settings Structure

  1. Changes
    - Remove dark_mode_enabled column
    - Add display_name column
    - Add logo_url column
    - Add incoming_message_color column
    - Add outgoing_message_color column
    - Add incoming_text_color column
    - Add outgoing_text_color column
*/

-- Remove dark_mode_enabled
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'theme_settings' AND column_name = 'dark_mode_enabled'
  ) THEN
    ALTER TABLE theme_settings DROP COLUMN dark_mode_enabled;
  END IF;
END $$;

-- Add display_name
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'theme_settings' AND column_name = 'display_name'
  ) THEN
    ALTER TABLE theme_settings ADD COLUMN display_name text;
  END IF;
END $$;

-- Add logo_url
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'theme_settings' AND column_name = 'logo_url'
  ) THEN
    ALTER TABLE theme_settings ADD COLUMN logo_url text;
  END IF;
END $$;

-- Add incoming_message_color
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'theme_settings' AND column_name = 'incoming_message_color'
  ) THEN
    ALTER TABLE theme_settings ADD COLUMN incoming_message_color text DEFAULT '#f1f5f9';
  END IF;
END $$;

-- Add outgoing_message_color
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'theme_settings' AND column_name = 'outgoing_message_color'
  ) THEN
    ALTER TABLE theme_settings ADD COLUMN outgoing_message_color text DEFAULT '#3b82f6';
  END IF;
END $$;

-- Add incoming_text_color
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'theme_settings' AND column_name = 'incoming_text_color'
  ) THEN
    ALTER TABLE theme_settings ADD COLUMN incoming_text_color text DEFAULT '#1e293b';
  END IF;
END $$;

-- Add outgoing_text_color
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'theme_settings' AND column_name = 'outgoing_text_color'
  ) THEN
    ALTER TABLE theme_settings ADD COLUMN outgoing_text_color text DEFAULT '#ffffff';
  END IF;
END $$;
