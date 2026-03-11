/*
  # Add message_type column for system messages

  1. New Columns
    - `message_type` (text) - Type of message: 'user' (default) or 'system_transfer' for department transfers
    - `contact_id` (uuid) - Foreign key to contacts table for system messages

  2. Purpose
    - Track department transfers as system messages
    - Display transfer notifications in the chat

  3. Indexes
    - Index on message_type for filtering system messages
*/

-- Add message_type and contact_id columns if they don't exist
ALTER TABLE messages 
ADD COLUMN IF NOT EXISTS message_type text DEFAULT 'user' CHECK (message_type IN ('user', 'system_transfer')),
ADD COLUMN IF NOT EXISTS contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL;

-- Create index for message_type
CREATE INDEX IF NOT EXISTS idx_messages_message_type ON messages(message_type);

-- Create index for contact_id
CREATE INDEX IF NOT EXISTS idx_messages_contact_id ON messages(contact_id);
