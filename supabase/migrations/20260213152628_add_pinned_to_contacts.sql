/*
  # Add pinned field to contacts table

  1. Changes
    - Add `pinned` boolean column to contacts table
    - Default value is false
    - Allows attendants to pin important contacts

  2. Security
    - No RLS changes needed - existing UPDATE policies cover this field
*/

-- Add pinned column to contacts
ALTER TABLE contacts
ADD COLUMN IF NOT EXISTS pinned BOOLEAN DEFAULT false NOT NULL;

-- Create index for better performance when filtering by pinned status
CREATE INDEX IF NOT EXISTS idx_contacts_pinned ON contacts(company_id, pinned) WHERE pinned = true;
