/*
  # Create RPC Function for Automatic Transfers Registration
  
  This RPC function is called AUTOMATICALLY when a contact's department changes
  It registers the transfer comparing old and new departments
*/

-- ✅ NEW: RPC for automatic transfer registration
-- When a contact is moved to a new department, this registers it
-- IMPORTANT: Both origin and destination can be NULL (representing "Recepção")
CREATE OR REPLACE FUNCTION registrar_transferencia_automatica(
  p_api_key VARCHAR,
  p_contact_id UUID,
  p_departamento_origem_id UUID,  -- NULL = Recepção
  p_departamento_destino_id UUID  -- NULL = Recepção (allowed)
)
RETURNS TABLE (
  id BIGINT,
  api_key VARCHAR,
  contact_id UUID,
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
DECLARE
  v_company_id UUID;
BEGIN
  -- Validate API key and get company_id
  SELECT id INTO v_company_id FROM public.companies WHERE api_key = p_api_key;
  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'API key inválida: %', p_api_key;
  END IF;

  -- Validate that destination department exists (if not NULL) and belongs to this company
  IF p_departamento_destino_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.departments 
      WHERE id = p_departamento_destino_id AND company_id = v_company_id
    ) THEN
      RAISE EXCEPTION 'Departamento destino inválido ou não pertence a esta empresa';
    END IF;
  END IF;

  -- Validate that origin and destination are different (allows NULL = Recepção)
  -- NULL and NULL are considered the same (no transfer)
  IF p_departamento_origem_id IS NOT DISTINCT FROM p_departamento_destino_id THEN
    RAISE EXCEPTION 'Departamento de origem e destino são iguais (nenhuma transferência)';
  END IF;

  -- ✅ INSERT transfer record and return with department names
  RETURN QUERY
  INSERT INTO public.transferencias (
    api_key,
    contact_id,
    departamento_origem_id,
    departamento_destino_id
  )
  VALUES (
    p_api_key,
    p_contact_id,
    p_departamento_origem_id,
    p_departamento_destino_id
  )
  RETURNING 
    public.transferencias.id,
    public.transferencias.api_key,
    public.transferencias.contact_id,
    public.transferencias.departamento_origem_id,
    COALESCE((SELECT name FROM public.departments WHERE departments.id = p_departamento_origem_id), 'Recepção'),
    public.transferencias.departamento_destino_id,
    COALESCE((SELECT name FROM public.departments WHERE departments.id = p_departamento_destino_id), 'Recepção'),
    public.transferencias.data_transferencia;

END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION registrar_transferencia_automatica(VARCHAR, UUID, UUID, UUID) TO authenticated;

-- Also keep the old function for backward compatibility
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

-- Grant execute permission
GRANT EXECUTE ON FUNCTION registrar_transferencia(VARCHAR, VARCHAR, UUID) TO authenticated;
