-- Add ia_ativada column to companies table for global IA toggle
ALTER TABLE companies ADD COLUMN ia_ativada BOOLEAN DEFAULT true;

-- Create index for faster queries
CREATE INDEX idx_companies_ia_ativada ON companies(ia_ativada);

-- Add comment
COMMENT ON COLUMN companies.ia_ativada IS 'Indica se a IA está ativada globalmente para esta empresa (padrão: true/ativada)';
