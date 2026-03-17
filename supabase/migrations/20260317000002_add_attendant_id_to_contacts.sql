/*
  # Add attendant_id to contacts

  1. Changes
    - Adds `attendant_id` (nullable UUID) to contacts table, referencing auth.users(id)
    - This allows tracking which attendant is currently handling a conversation

  2. Logic
    - When an attendant sends the first message to an 'aberto' contact,
      the app sets ticket_status = 'em_processo' and attendant_id = user.id
    - This removes the contact from the "Abertos" queue for all other attendants
    - When a conversation is reopened, attendant_id is cleared → contact returns to queue
*/

ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS attendant_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_contacts_attendant_id ON contacts(attendant_id);
