/*
  # Add AI feature flag to plans

  1. Changes
    - Add `ai_enabled` boolean field to plans table
    - Default value is true (AI enabled by default)
    - This controls whether companies on this plan have access to AI features

  2. Notes
    - When ai_enabled is false, all AI-related UI elements should be hidden
    - This includes IA toggle on contacts, AI settings, etc.
*/

-- Add ai_enabled column to plans
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'plans' AND column_name = 'ai_enabled'
  ) THEN
    ALTER TABLE plans ADD COLUMN ai_enabled boolean DEFAULT true NOT NULL;
  END IF;
END $$;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_plans_ai_enabled ON plans(ai_enabled);

-- Add comment to explain the column
COMMENT ON COLUMN plans.ai_enabled IS 'Whether companies on this plan have access to AI features';
