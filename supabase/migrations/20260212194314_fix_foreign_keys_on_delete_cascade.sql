/*
  # Fix Foreign Keys ON DELETE behavior for departments and sectors
  
  1. Changes
    - Drop existing foreign key constraints without ON DELETE behavior
    - Recreate foreign keys with ON DELETE SET NULL for messages table
    - This allows departments and sectors to be deleted without breaking messages
  
  2. Tables affected
    - messages: sector_id foreign key updated to SET NULL on delete
    
  3. Security
    - No RLS changes, only constraint modifications
*/

-- Fix messages.sector_id foreign key
DO $$
BEGIN
  -- Drop existing constraint if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'messages_sector_id_fkey' 
    AND table_name = 'messages'
  ) THEN
    ALTER TABLE messages DROP CONSTRAINT messages_sector_id_fkey;
  END IF;
  
  -- Recreate with ON DELETE SET NULL
  ALTER TABLE messages 
  ADD CONSTRAINT messages_sector_id_fkey 
  FOREIGN KEY (sector_id) 
  REFERENCES sectors(id) 
  ON DELETE SET NULL;
END $$;
