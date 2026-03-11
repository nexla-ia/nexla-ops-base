
CREATE OR REPLACE FUNCTION public.delete_contact_and_messages(p_contact_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_company_id uuid;
  v_phone_number text;
  v_user_id uuid;
  v_requester_company_id uuid;
  deleted_messages_count integer;
  deleted_sent_messages_count integer;
BEGIN
  -- Get the user ID from the session
  v_user_id := auth.uid();

  -- Get the company_id and phone_number of the contact being deleted
  SELECT company_id, phone_number INTO v_company_id, v_phone_number
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
  -- Also allow super admins
  IF v_requester_company_id != v_company_id AND NOT is_super_admin() THEN
    RETURN json_build_object('success', false, 'error', 'Acesso negado. Você não tem permissão para apagar este contato.');
  END IF;

  -- Delete from messages table
  DELETE FROM public.messages
  WHERE numero = v_phone_number AND company_id = v_company_id;
  GET DIAGNOSTICS deleted_messages_count = ROW_COUNT;

  -- Delete from sent_messages table
  DELETE FROM public.sent_messages
  WHERE numero = v_phone_number AND company_id = v_company_id;
  GET DIAGNOSTICS deleted_sent_messages_count = ROW_COUNT;

  -- Delete the contact
  DELETE FROM public.contacts
  WHERE id = p_contact_id;

  -- Return success with counts
  RETURN json_build_object(
    'success', true,
    'deleted_messages', deleted_messages_count,
    'deleted_sent_messages', deleted_sent_messages_count
  );
END;
$$;

-- Grant execute permission to the authenticated role
GRANT EXECUTE ON FUNCTION public.delete_contact_and_messages(uuid) TO authenticated;
