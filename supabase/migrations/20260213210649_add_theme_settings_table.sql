/*
  # Create theme settings table

  1. New Tables
    - `theme_settings`
      - `id` (uuid, primary key)
      - `company_id` (uuid, foreign key to companies)
      - `primary_color` (text) - Cor primária do tema
      - `secondary_color` (text) - Cor secundária do tema
      - `accent_color` (text) - Cor de destaque
      - `background_color` (text) - Cor de fundo
      - `text_color` (text) - Cor do texto
      - `dark_mode_enabled` (boolean) - Se dark mode está habilitado por padrão
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `theme_settings` table
    - Add policies for companies and attendants to read their theme settings
    - Add policy for companies to update their theme settings
*/

-- Create theme_settings table
CREATE TABLE IF NOT EXISTS theme_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  primary_color text DEFAULT '#3b82f6',
  secondary_color text DEFAULT '#1e40af',
  accent_color text DEFAULT '#60a5fa',
  background_color text DEFAULT '#ffffff',
  text_color text DEFAULT '#1e293b',
  dark_mode_enabled boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(company_id)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_theme_settings_company_id ON theme_settings(company_id);

-- Enable RLS
ALTER TABLE theme_settings ENABLE ROW LEVEL SECURITY;

-- Policy for companies to read their own theme settings
CREATE POLICY "Companies can read own theme settings"
  ON theme_settings
  FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT id FROM companies WHERE api_key = current_setting('request.jwt.claims', true)::json->>'api_key'
    )
  );

-- Policy for companies to insert their theme settings
CREATE POLICY "Companies can insert own theme settings"
  ON theme_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT id FROM companies WHERE api_key = current_setting('request.jwt.claims', true)::json->>'api_key'
    )
  );

-- Policy for companies to update their own theme settings
CREATE POLICY "Companies can update own theme settings"
  ON theme_settings
  FOR UPDATE
  TO authenticated
  USING (
    company_id IN (
      SELECT id FROM companies WHERE api_key = current_setting('request.jwt.claims', true)::json->>'api_key'
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT id FROM companies WHERE api_key = current_setting('request.jwt.claims', true)::json->>'api_key'
    )
  );

-- Policy for attendants to read their company's theme settings
CREATE POLICY "Attendants can read company theme settings"
  ON theme_settings
  FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM attendants WHERE api_key = current_setting('request.jwt.claims', true)::json->>'api_key'
    )
  );

-- Policy for super admins to read all theme settings
CREATE POLICY "Super admins can read all theme settings"
  ON theme_settings
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM super_admins WHERE user_id = auth.uid()
    )
  );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_theme_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
DROP TRIGGER IF EXISTS update_theme_settings_updated_at_trigger ON theme_settings;
CREATE TRIGGER update_theme_settings_updated_at_trigger
  BEFORE UPDATE ON theme_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_theme_settings_updated_at();