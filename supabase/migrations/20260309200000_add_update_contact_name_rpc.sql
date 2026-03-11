
CREATE OR REPLACE FUNCTION public.update_contact_name(p_contact_id uuid, p_new_name text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_company_id uuid;
  v_user_id uuid;
  v_requester_company_id uuid;
BEGIN
  -- Get the user ID from the session
  v_user_id := auth.uid();

  -- Check if the new name is empty or just whitespace
  IF p_new_name IS NULL OR trim(p_new_name) = '' THEN
    RETURN json_build_object('success', false, 'error', 'O nome não pode estar em branco.');
  END IF;

  -- Get the company_id of the contact being updated
  SELECT company_id INTO v_company_id
  FROM public.contacts
  WHERE id = p_contact_id;

  -- If the contact doesn't exist, return an error
  IF v_company_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Contato não encontrado.');
  END IF;

  -- Get the company_id of the user making the request
  SELECT company_id INTO v_requester_company_id
  FROM public.attendants
  WHERE user_id = v_user_id
  LIMIT 1;

  -- Check if the user's company matches the contact's company
  IF v_requester_company_id != v_company_id THEN
    RETURN json_build_object('success', false, 'error', 'Acesso negado. Você não tem permissão para editar este contato.');
  END IF;

  -- Update the contact's name
  UPDATE public.contacts
  SET name = trim(p_new_name),
      updated_at = now()
  WHERE id = p_contact_id;

  -- Return success
  RETURN json_build_object('success', true);
END;
$$;

-- Grant execute permission to the authenticated role
GRANT EXECUTE ON FUNCTION public.update_contact_name(uuid, text) TO authenticated;
