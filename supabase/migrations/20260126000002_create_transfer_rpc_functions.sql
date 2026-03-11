/*
  # Create RPC Functions for Transfers (Bypasses RLS)
  
  This functions use SECURITY DEFINER to bypass RLS and allow easy transfer creation
  
  Structure:
  - api_key: identifies company
  - phone_number: the contact phone number (text)
  - departamento_destino_id: destination department UUID (NOT name!)
*/

-- Create RPC function with SECURITY DEFINER (bypasses RLS)
-- ✅ FIXED: Now accepts phone_number and department UUIDs
CREATE OR REPLACE FUNCTION registrar_transferencia(
  p_api_key VARCHAR,
  p_phone_number VARCHAR,
  p_departamento_destino_id UUID
)
RETURNS TABLE (
  id BIGINT,
  api_key VARCHAR,
  contact_id UUID,
  phone_number VARCHAR,
  departamento_origem_id UUID,
  departamento_destino_id UUID,
  data_transferencia TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id UUID;
  v_contact_id UUID;
  v_current_dept_id UUID;
BEGIN
  -- Validate that api_key exists and get company_id
  SELECT id INTO v_company_id FROM public.companies WHERE api_key = p_api_key;
  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'API key inválida: %', p_api_key;
  END IF;

  -- Validate that destination department exists and belongs to this company
  IF NOT EXISTS (
    SELECT 1 FROM public.departments 
    WHERE id = p_departamento_destino_id AND company_id = v_company_id
  ) THEN
    RAISE EXCEPTION 'Departamento destino inválido ou não pertence a esta empresa';
  END IF;

  -- Find contact by phone number and company
  SELECT id, department_id INTO v_contact_id, v_current_dept_id
  FROM public.contacts 
  WHERE phone_number = p_phone_number AND company_id = v_company_id
  LIMIT 1;
  
  IF v_contact_id IS NULL THEN
    RAISE EXCEPTION 'Contato não encontrado: %', p_phone_number;
  END IF;

  -- Validate that source and destination are different
  IF v_current_dept_id = p_departamento_destino_id THEN
    RAISE EXCEPTION 'Contato já está neste departamento';
  END IF;

  -- ✅ STEP 1: Insert transfer log
  -- Insert transfer record and return it
  RETURN QUERY
  INSERT INTO public.transferencias (
    api_key,
    contact_id,
    departamento_origem_id,
    departamento_destino_id
  )
  VALUES (
    p_api_key,
    v_contact_id,
    v_current_dept_id,
    p_departamento_destino_id
  )
  RETURNING 
    public.transferencias.id,
    public.transferencias.api_key,
    public.transferencias.contact_id,
    (SELECT phone_number FROM public.contacts WHERE id = v_contact_id),
    public.transferencias.departamento_origem_id,
    public.transferencias.departamento_destino_id,
    public.transferencias.data_transferencia;

  -- ✅ STEP 2: Update contact.department_id (actually changes the department)
  UPDATE public.contacts 
  SET department_id = p_departamento_destino_id,
      updated_at = NOW()
  WHERE id = v_contact_id;

  -- Trigger will automatically create system message
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION registrar_transferencia(VARCHAR, VARCHAR, UUID) TO authenticated;

-- Create function to list transfers by api_key
-- ✅ FIXED: Returns UUID fields instead of names
CREATE OR REPLACE FUNCTION listar_transferencias(p_api_key VARCHAR)
RETURNS TABLE (
  id BIGINT,
  api_key VARCHAR,
  contact_id UUID,
  phone_number VARCHAR,
  departamento_origem_id UUID,
  departamento_origem_nome VARCHAR,
  departamento_destino_id UUID,
  departamento_destino_nome VARCHAR,
  data_transferencia TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.id,
    t.api_key,
    t.contact_id,
    c.phone_number,
    t.departamento_origem_id,
    COALESCE(d_orig.name, 'Sem departamento'),
    t.departamento_destino_id,
    COALESCE(d_dest.name, 'Sem departamento'),
    t.data_transferencia
  FROM public.transferencias t
  LEFT JOIN public.contacts c ON t.contact_id = c.id
  LEFT JOIN public.departments d_orig ON t.departamento_origem_id = d_orig.id
  LEFT JOIN public.departments d_dest ON t.departamento_destino_id = d_dest.id
  WHERE t.api_key = p_api_key
  ORDER BY t.data_transferencia DESC;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION listar_transferencias(VARCHAR) TO authenticated;

-- Create function to get transfers for a specific contact
-- ✅ FIXED: Uses contact phone_number and returns UUIDs
CREATE OR REPLACE FUNCTION listar_transferencias_contato(p_api_key VARCHAR, p_phone_number VARCHAR)
RETURNS TABLE (
  id BIGINT,
  api_key VARCHAR,
  contact_id UUID,
  phone_number VARCHAR,
  departamento_origem_id UUID,
  departamento_origem_nome VARCHAR,
  departamento_destino_id UUID,
  departamento_destino_nome VARCHAR,
  data_transferencia TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.id,
    t.api_key,
    t.contact_id,
    c.phone_number,
    t.departamento_origem_id,
    COALESCE(d_orig.name, 'Sem departamento'),
    t.departamento_destino_id,
    COALESCE(d_dest.name, 'Sem departamento'),
    t.data_transferencia
  FROM public.transferencias t
  LEFT JOIN public.contacts c ON t.contact_id = c.id
  LEFT JOIN public.departments d_orig ON t.departamento_origem_id = d_orig.id
  LEFT JOIN public.departments d_dest ON t.departamento_destino_id = d_dest.id
  WHERE t.api_key = p_api_key
    AND c.phone_number = p_phone_number
  ORDER BY t.data_transferencia DESC;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION listar_transferencias_contato(VARCHAR, VARCHAR) TO authenticated;
