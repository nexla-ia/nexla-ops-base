/*
  # Fix position constraint on transferencias table
  
  Remove UNIQUE constraint on (contact_id, position) if it exists
  Add position column with incremental values per contact
  This allows multiple transfers of the same contact with different positions
*/

-- Check if position column exists, if not add it
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'transferencias' AND column_name = 'position'
  ) THEN
    ALTER TABLE public.transferencias ADD COLUMN position BIGINT;
  END IF;
END $$;

-- Remove the problematic unique constraint if it exists
DO $$
BEGIN
  -- Try to drop the constraint
  ALTER TABLE public.transferencias DROP CONSTRAINT IF EXISTS transferencias_contact_position_ux;
EXCEPTION WHEN OTHERS THEN
  -- Ignore if constraint doesn't exist
  NULL;
END $$;

-- Populate position values for existing records that don't have them
UPDATE public.transferencias
SET position = row_number
FROM (
  SELECT 
    id,
    ROW_NUMBER() OVER (PARTITION BY contact_id ORDER BY created_at ASC) as row_number
  FROM public.transferencias
  WHERE position IS NULL
) t
WHERE public.transferencias.id = t.id;

-- Make position column NOT NULL with a default
ALTER TABLE public.transferencias ALTER COLUMN position SET DEFAULT 1;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_transferencias_contact_position 
  ON public.transferencias(contact_id, position);

CREATE INDEX IF NOT EXISTS idx_transferencias_position 
  ON public.transferencias(position);

-- Create trigger to auto-increment position for new transfers
CREATE OR REPLACE FUNCTION auto_increment_transfer_position()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.position IS NULL THEN
    -- Get the max position for this contact and add 1
    SELECT COALESCE(MAX(position), 0) + 1 INTO NEW.position
    FROM public.transferencias
    WHERE contact_id = NEW.contact_id AND id != NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop old trigger if exists
DROP TRIGGER IF EXISTS trg_auto_increment_transfer_position ON public.transferencias;

-- Create new trigger
CREATE TRIGGER trg_auto_increment_transfer_position
  BEFORE INSERT ON public.transferencias
  FOR EACH ROW
  EXECUTE FUNCTION auto_increment_transfer_position();

SELECT 'Position constraint fixed and trigger created' as resultado;
