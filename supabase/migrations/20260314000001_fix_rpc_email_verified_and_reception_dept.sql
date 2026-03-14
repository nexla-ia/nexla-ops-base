-- Fix: raw_user_meta_data deve incluir email_verified=true para que GoTrue aceite o login
-- Fix: rpc_create_company criava departamento com coluna is_default inexistente
-- Garante: toda empresa nova recebe departamento "Recepção" automaticamente

CREATE OR REPLACE FUNCTION public.rpc_create_company(
  p_email                    text,
  p_password                 text,
  p_name                     text,
  p_phone_number             text,
  p_api_key                  text,
  p_plan_id                  uuid    DEFAULT NULL,
  p_additional_attendants    integer DEFAULT 0,
  p_payment_notification_day integer DEFAULT 5,
  p_payment_day              integer DEFAULT 10
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_caller_id    uuid := auth.uid();
  v_user_id      uuid;
  v_company_id   uuid;
  v_phone        text;
  v_max_att      integer;
  v_plan_max     integer;
BEGIN
  -- Autorização
  IF NOT EXISTS (SELECT 1 FROM public.super_admins WHERE user_id = v_caller_id) THEN
    RETURN jsonb_build_object('error', 'Access denied: caller is not a super admin');
  END IF;

  -- Validações
  v_phone := regexp_replace(p_phone_number, '\D', '', 'g');
  IF length(v_phone) < 10 THEN
    RETURN jsonb_build_object('error', 'Telefone inválido. Deve ter pelo menos 10 dígitos.');
  END IF;

  IF EXISTS (SELECT 1 FROM auth.users WHERE email = lower(trim(p_email))) THEN
    RETURN jsonb_build_object('error', 'Email já está em uso por outro usuário');
  END IF;

  IF EXISTS (SELECT 1 FROM public.companies WHERE email = lower(trim(p_email))) THEN
    RETURN jsonb_build_object('error', 'Email já está em uso por outra empresa');
  END IF;

  IF EXISTS (SELECT 1 FROM public.companies WHERE api_key = trim(p_api_key)) THEN
    RETURN jsonb_build_object('error', 'API Key já está em uso por outra empresa');
  END IF;

  -- Calcular max_attendants baseado no plano
  IF p_plan_id IS NOT NULL THEN
    SELECT max_attendants INTO v_plan_max FROM public.plans WHERE id = p_plan_id;
    v_max_att := CASE WHEN COALESCE(v_plan_max, 0) = 0 THEN 0
                      ELSE v_plan_max + COALESCE(p_additional_attendants, 0)
                 END;
  ELSE
    v_max_att := 1 + COALESCE(p_additional_attendants, 0);
  END IF;

  -- Criar usuário no auth
  v_user_id := extensions.gen_random_uuid();

  INSERT INTO auth.users (
    instance_id, id, aud, role,
    email, encrypted_password, email_confirmed_at,
    created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data,
    is_super_admin,
    confirmation_token, recovery_token,
    email_change_token_new, email_change_token_current
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    v_user_id,
    'authenticated', 'authenticated',
    lower(trim(p_email)),
    extensions.crypt(p_password, extensions.gen_salt('bf', 10)),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}',
    '{"email_verified": true}',
    false,
    '', '', '', ''
  );

  INSERT INTO auth.identities (
    id, provider_id, user_id,
    identity_data,
    provider, last_sign_in_at, created_at, updated_at
  ) VALUES (
    extensions.gen_random_uuid(),
    lower(trim(p_email)),
    v_user_id,
    jsonb_build_object('sub', v_user_id::text, 'email', lower(trim(p_email))),
    'email', now(), now(), now()
  );

  -- Inserir empresa
  INSERT INTO public.companies (
    name, phone_number, api_key, email, user_id,
    is_super_admin, plan_id,
    additional_attendants, payment_notification_day, payment_day, max_attendants
  ) VALUES (
    trim(p_name), v_phone, trim(p_api_key), lower(trim(p_email)), v_user_id,
    false, p_plan_id,
    COALESCE(p_additional_attendants, 0),
    COALESCE(p_payment_notification_day, 5),
    COALESCE(p_payment_day, 10),
    v_max_att
  )
  RETURNING id INTO v_company_id;

  -- Departamento "Recepção" é criado automaticamente pelo trigger
  -- trigger_create_reception_department (AFTER INSERT ON companies)

  RETURN jsonb_build_object(
    'ok', true,
    'user_id',    v_user_id,
    'company_id', v_company_id,
    'message',    'Empresa e usuário criados com sucesso'
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('error', SQLERRM, 'detail', SQLSTATE);
END;
$$;

-- Fix rpc_create_attendant: raw_user_meta_data também precisa de email_verified=true
CREATE OR REPLACE FUNCTION public.rpc_create_attendant(
  p_api_key       text,
  p_name          text,
  p_email         text,
  p_password      text,
  p_phone         text    DEFAULT '',
  p_function      text    DEFAULT '',
  p_department_id uuid    DEFAULT NULL,
  p_sector_id     uuid    DEFAULT NULL,
  p_is_active     boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_caller_id         uuid := auth.uid();
  v_is_super_admin    boolean;
  v_caller_company_id uuid;
  v_target_company_id uuid;
  v_user_id           uuid;
BEGIN
  -- Verificar permissão
  v_is_super_admin := EXISTS (SELECT 1 FROM public.super_admins WHERE user_id = v_caller_id);

  IF NOT v_is_super_admin THEN
    SELECT id INTO v_caller_company_id
      FROM public.companies WHERE user_id = v_caller_id;
    IF v_caller_company_id IS NULL THEN
      RETURN jsonb_build_object('error', 'Access denied: only super admins or company admins can create attendants');
    END IF;
  END IF;

  -- Buscar empresa pelo api_key
  SELECT id INTO v_target_company_id
    FROM public.companies WHERE api_key = p_api_key;
  IF v_target_company_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Empresa não encontrada com esta API key');
  END IF;

  -- Company admin só pode criar para a própria empresa
  IF NOT v_is_super_admin AND v_caller_company_id != v_target_company_id THEN
    RETURN jsonb_build_object('error', 'Company admins can only create attendants for their own company');
  END IF;

  -- Email duplicado
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = lower(trim(p_email))) THEN
    RETURN jsonb_build_object('error', 'Email já está em uso');
  END IF;

  -- Criar auth user
  v_user_id := extensions.gen_random_uuid();

  INSERT INTO auth.users (
    instance_id, id, aud, role,
    email, encrypted_password, email_confirmed_at,
    created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data,
    is_super_admin,
    confirmation_token, recovery_token,
    email_change_token_new, email_change_token_current
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    v_user_id,
    'authenticated', 'authenticated',
    lower(trim(p_email)),
    extensions.crypt(p_password, extensions.gen_salt('bf', 10)),
    now(), now(), now(),
    jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email'), 'role', 'attendant'),
    jsonb_build_object('email_verified', true, 'name', p_name, 'role', 'attendant'),
    false,
    '', '', '', ''
  );

  INSERT INTO auth.identities (
    id, provider_id, user_id, identity_data,
    provider, last_sign_in_at, created_at, updated_at
  ) VALUES (
    extensions.gen_random_uuid(),
    lower(trim(p_email)),
    v_user_id,
    jsonb_build_object('sub', v_user_id::text, 'email', lower(trim(p_email))),
    'email', now(), now(), now()
  );

  -- Inserir atendente
  INSERT INTO public.attendants (
    user_id, company_id, name, email, phone,
    function, api_key, department_id, sector_id, is_active
  ) VALUES (
    v_user_id, v_target_company_id,
    trim(p_name), lower(trim(p_email)), COALESCE(p_phone, ''),
    COALESCE(p_function, ''), p_api_key,
    p_department_id, p_sector_id,
    COALESCE(p_is_active, true)
  );

  RETURN jsonb_build_object(
    'ok', true,
    'user_id',    v_user_id,
    'company_id', v_target_company_id,
    'message',    'Atendente criado com sucesso'
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('error', SQLERRM, 'detail', SQLSTATE);
END;
$$;
