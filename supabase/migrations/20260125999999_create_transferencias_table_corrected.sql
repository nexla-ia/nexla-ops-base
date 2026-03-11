/*
  # Create transferencias (Transfers) Table - CORRECTED
  
  This migration should run BEFORE create_transfer_rpc_functions.sql
  
  1. New Table
    - `transferencias`
      - `id` (bigint, primary key with auto-increment)
      - `api_key` (varchar) - Company API key for filtering
      - `contact_id` (uuid) - Foreign key to contacts table
      - `departamento_origem_id` (uuid) - Source department ID (FK to departments)
      - `departamento_destino_id` (uuid) - Destination department ID (FK to departments)
      - `data_transferencia` (timestamptz) - Transfer timestamp

  2. Security
    - Enable RLS on transferencias table
    - Add policies for companies to view their own transfers

  3. Indexes
    - Index on api_key for filtering transfers
    - Index on contact_id for quick lookup
    - Index on data_transferencia for sorting
*/

-- ✅ DROP old transferencias if it has wrong schema (from previous migrations)
DROP TABLE IF EXISTS public.transferencias CASCADE;

-- Create transferencias table with correct schema
CREATE TABLE public.transferencias (
  id bigserial PRIMARY KEY,
  api_key varchar NOT NULL,
  contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  departamento_origem_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  departamento_destino_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  data_transferencia timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
  -- ✅ Removido UNIQUE constraint - permite múltiplas transferências do mesmo contato
);

-- Enable RLS
ALTER TABLE public.transferencias ENABLE ROW LEVEL SECURITY;

-- Index for fast filtering by api_key
CREATE INDEX IF NOT EXISTS idx_transferencias_api_key ON public.transferencias(api_key);

-- Index for fast lookup by contact
CREATE INDEX IF NOT EXISTS idx_transferencias_contact_id ON public.transferencias(contact_id);

-- Index for sorting by date
CREATE INDEX IF NOT EXISTS idx_transferencias_data ON public.transferencias(data_transferencia DESC);

-- Policy: Companies can view transfers of their own contacts
CREATE POLICY "Companies can view own transfers"
  ON public.transferencias FOR SELECT
  TO authenticated
  USING (
    api_key IN (
      SELECT api_key FROM public.companies
      WHERE user_id = auth.uid()
    )
  );

-- Policy: Allow RPC functions to insert
CREATE POLICY "Allow RPC insert transfers"
  ON public.transferencias FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Policy: Allow RPC functions to update
CREATE POLICY "Allow RPC update transfers"
  ON public.transferencias FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Policy: Super admins can view all transfers
CREATE POLICY "Super admins view all transfers"
  ON public.transferencias FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.super_admins
      WHERE user_id = auth.uid()
    )
  );
