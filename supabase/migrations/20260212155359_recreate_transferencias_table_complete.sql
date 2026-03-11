/*
  # Recreate transferencias table with complete schema

  1. Changes
    - Drop existing transferencias table and recreate with correct schema
    - Add company_id field for easier filtering
    - Add proper foreign keys and indexes
    - Add correct RLS policies

  2. Table Structure
    - id (bigserial) - Primary key
    - company_id (uuid) - Foreign key to companies
    - api_key (varchar) - Company API key
    - contact_id (uuid) - Foreign key to contacts
    - from_department_id (uuid) - Source department (can be NULL = Recepção)
    - to_department_id (uuid) - Destination department (can be NULL = Recepção)
    - created_at (timestamptz) - When transfer occurred

  3. Security
    - Companies can view and insert their own transfers
    - Attendants can view and insert transfers from their company
    - Super admins can view all transfers
*/

-- Drop existing table and recreate
DROP TABLE IF EXISTS public.transferencias CASCADE;

-- Create transferencias table with complete schema
CREATE TABLE IF NOT EXISTS public.transferencias (
  id bigserial PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  api_key varchar NOT NULL,
  contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  from_department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  to_department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.transferencias ENABLE ROW LEVEL SECURITY;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_transferencias_company_id ON public.transferencias(company_id);
CREATE INDEX IF NOT EXISTS idx_transferencias_api_key ON public.transferencias(api_key);
CREATE INDEX IF NOT EXISTS idx_transferencias_contact_id ON public.transferencias(contact_id);
CREATE INDEX IF NOT EXISTS idx_transferencias_created_at ON public.transferencias(created_at DESC);

-- Policy: Companies can view their own transfers
CREATE POLICY "Companies can view own transfers"
  ON public.transferencias FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT id FROM public.companies WHERE user_id = auth.uid()
    )
  );

-- Policy: Attendants can view transfers from their company
CREATE POLICY "Attendants can view company transfers"
  ON public.transferencias FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM public.attendants WHERE user_id = auth.uid()
    )
  );

-- Policy: Super admins can view all transfers
CREATE POLICY "Super admins can view all transfers"
  ON public.transferencias FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.super_admins WHERE user_id = auth.uid()
    )
  );

-- Policy: Companies can insert their own transfers
CREATE POLICY "Companies can insert own transfers"
  ON public.transferencias FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT id FROM public.companies WHERE user_id = auth.uid()
    )
  );

-- Policy: Attendants can insert transfers from their company
CREATE POLICY "Attendants can insert company transfers"
  ON public.transferencias FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM public.attendants WHERE user_id = auth.uid()
    )
  );
