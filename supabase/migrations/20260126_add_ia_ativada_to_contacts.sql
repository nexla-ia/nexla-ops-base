-- Add ia_ativada column to contacts table
ALTER TABLE contacts ADD COLUMN ia_ativada BOOLEAN DEFAULT false;

-- Create index for faster queries
CREATE INDEX idx_contacts_ia_ativada ON contacts(ia_ativada);

-- Add comment
COMMENT ON COLUMN contacts.ia_ativada IS 'Indica se a IA está ativada para este contato (padrão: false/desativada)';
