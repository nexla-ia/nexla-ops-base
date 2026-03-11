/*
  # Remove UNIQUE constraint from transferencias table
  
  The constraint was preventing multiple transfers of the same contact on the same day.
*/

-- Simply drop the table and recreate without the constraint
DROP TABLE IF EXISTS public.transferencias CASCADE;

CREATE TABLE public.transferencias (
  id bigserial PRIMARY KEY,
  api_key varchar NOT NULL,
  contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  departamento_origem_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  departamento_destino_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  data_transferencia timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
  -- NO UNIQUE CONSTRAINT - allows multiple transfers per contact per day
);

-- Enable RLS
ALTER TABLE public.transferencias ENABLE ROW LEVEL SECURITY;

-- Recreate indexes
CREATE INDEX IF NOT EXISTS idx_transferencias_api_key ON public.transferencias(api_key);
CREATE INDEX IF NOT EXISTS idx_transferencias_contact_id ON public.transferencias(contact_id);
CREATE INDEX IF NOT EXISTS idx_transferencias_data ON public.transferencias(data_transferencia DESC);

-- Recreate RLS policies
CREATE POLICY "Companies can view transfers of their own contacts"
  ON public.transferencias FOR SELECT
  TO authenticated
  USING (
    api_key IN (
      SELECT api_key FROM public.companies
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Allow RPC insert transfers"
  ON public.transferencias FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow RPC update transfers"
  ON public.transferencias FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Super admins view all transfers"
  ON public.transferencias FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.super_admins
      WHERE user_id = auth.uid()
    )
  );

SELECT 'Table transferencias recreated without UNIQUE constraint' as resultado;
