/*
  # Create plans table

  1. New Tables
    - `plans`
      - `id` (uuid, primary key) - Unique identifier for the plan
      - `name` (text, not null) - Name of the plan (e.g., "Básico", "Profissional", "Enterprise")
      - `description` (text) - Detailed description of what the plan includes
      - `price` (decimal, not null) - Price of the plan
      - `billing_period` (text, not null) - Billing period: 'monthly' or 'annual'
      - `max_attendants` (integer) - Maximum number of attendants allowed (null = unlimited)
      - `max_contacts` (integer) - Maximum number of contacts allowed (null = unlimited)
      - `features` (jsonb) - Additional features included in the plan
      - `is_active` (boolean, default true) - Whether the plan is currently active/available
      - `created_at` (timestamptz) - When the plan was created
      - `updated_at` (timestamptz) - When the plan was last updated

  2. Security
    - Enable RLS on `plans` table
    - Add policies for super admins to manage plans
    - Add policy for authenticated users to read active plans
*/

CREATE TABLE IF NOT EXISTS plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  price decimal(10,2) NOT NULL,
  billing_period text NOT NULL CHECK (billing_period IN ('monthly', 'annual')),
  max_attendants integer,
  max_contacts integer,
  features jsonb DEFAULT '[]'::jsonb,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can do everything with plans"
  ON plans
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM super_admins
      WHERE super_admins.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM super_admins
      WHERE super_admins.user_id = auth.uid()
    )
  );

CREATE POLICY "Authenticated users can read active plans"
  ON plans
  FOR SELECT
  TO authenticated
  USING (is_active = true);

CREATE INDEX IF NOT EXISTS idx_plans_is_active ON plans(is_active);
CREATE INDEX IF NOT EXISTS idx_plans_billing_period ON plans(billing_period);

CREATE OR REPLACE FUNCTION update_plans_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER plans_updated_at
  BEFORE UPDATE ON plans
  FOR EACH ROW
  EXECUTE FUNCTION update_plans_updated_at();
