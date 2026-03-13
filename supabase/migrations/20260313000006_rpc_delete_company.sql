-- RPC para deletar empresa inteira

CREATE OR REPLACE FUNCTION public.rpc_delete_company(p_company_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_company_user_id uuid;
BEGIN

  -- habilita modo limpeza
  PERFORM set_config('app.deleting_company', 'true', true);

  SELECT user_id
  INTO v_company_user_id
  FROM public.companies
  WHERE id = p_company_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Empresa não encontrada');
  END IF;

  DELETE FROM public.contact_tags
  WHERE contact_id IN (
    SELECT id FROM public.contacts WHERE company_id = p_company_id
  );

  DELETE FROM public.messages
  WHERE company_id = p_company_id;

  DELETE FROM public.notifications
  WHERE company_id = p_company_id;

  DELETE FROM public.transferencias
  WHERE company_id = p_company_id;

  DELETE FROM public.attendants
  WHERE company_id = p_company_id;

  DELETE FROM public.sectors
  WHERE company_id = p_company_id;

  DELETE FROM public.tags
  WHERE company_id = p_company_id;

  DELETE FROM public.departments
  WHERE company_id = p_company_id;

  DELETE FROM public.contacts
  WHERE company_id = p_company_id;

  DELETE FROM public.companies
  WHERE id = p_company_id;

  -- remove usuário auth vinculado
  IF v_company_user_id IS NOT NULL THEN

    DELETE FROM auth.identities
    WHERE user_id = v_company_user_id;

    DELETE FROM auth.users
    WHERE id = v_company_user_id;

  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'message', 'Empresa deletada com sucesso'
  );

END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_delete_company(uuid)
TO authenticated;
