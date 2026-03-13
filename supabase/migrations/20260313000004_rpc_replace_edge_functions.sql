/*
  ============================================================
  NEXLA OPS — RPCs substituindo Edge Functions
  ============================================================

  Como o banco está em VPS e as edge functions não são deployadas
  automaticamente, toda a lógica que estava em Deno/TypeScript
  foi convertida para funções PostgreSQL (SECURITY DEFINER).

  RPCs criadas:
  1. rpc_create_company       → substitui create-company
  2. rpc_create_attendant     → substitui create-attendant
  3. rpc_delete_attendant     → substitui delete-attendant
  4. rpc_check_payment_notifications → substitui check-payment-notifications

  Requisito: extensão pgcrypto (para crypt + gen_salt)
  ============================================================
*/

-- Extensão necessária para hash de senha (bcrypt)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
-- 1. rpc_create_company
-- ============================================================
-- Cria auth.user + empresa + departamento Recepção em uma transação.
-- Acesso: apenas super_admins.

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
    extensions.crypt(p_password, extensions.gen_salt('bf', 10))
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    false,
    '', '', '', ''
  );

  INSERT INTO auth.identities (
    id, user_id,
    identity_data,
    provider, last_sign_in_at, created_at, updated_at
  ) VALUES (
    extensions.gen_random_uuid()
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

  -- Criar departamento padrão
  INSERT INTO public.departments (company_id, name, is_default)
  VALUES (v_company_id, 'Recepção', true)
  ON CONFLICT DO NOTHING;

  RETURN jsonb_build_object(
    'ok', true,
    'user_id',    v_user_id,
    'company_id', v_company_id,
    'message',    'Empresa e usuário criados com sucesso'
  );

EXCEPTION WHEN OTHERS THEN
  -- O bloco BEGIN/EXCEPTION faz rollback automático dos INSERTs anteriores
  RETURN jsonb_build_object('error', SQLERRM, 'detail', SQLSTATE);
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_create_company(
  text, text, text, text, text, uuid, integer, integer, integer
) TO authenticated;

-- ============================================================
-- 2. rpc_create_attendant
-- ============================================================

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
    extensions.crypt(p_password, extensions.gen_salt('bf', 10))
    now(), now(), now(),
    jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email'), 'role', 'attendant'),
    jsonb_build_object('name', p_name, 'role', 'attendant'),
    false,
    '', '', '', ''
  );

  INSERT INTO auth.identities (
    id, user_id, identity_data,
    provider, last_sign_in_at, created_at, updated_at
  ) VALUES (
    extensions.gen_random_uuid()
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

GRANT EXECUTE ON FUNCTION public.rpc_create_attendant(
  text, text, text, text, text, text, uuid, uuid, boolean
) TO authenticated;

-- ============================================================
-- 3. rpc_delete_attendant
-- ============================================================

CREATE OR REPLACE FUNCTION public.rpc_delete_attendant(p_attendant_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_caller_id            uuid := auth.uid();
  v_is_super_admin       boolean;
  v_caller_company_id    uuid;
  v_attendant_user_id    uuid;
  v_attendant_company_id uuid;
BEGIN
  v_is_super_admin := EXISTS (SELECT 1 FROM public.super_admins WHERE user_id = v_caller_id);

  IF NOT v_is_super_admin THEN
    SELECT id INTO v_caller_company_id
      FROM public.companies WHERE user_id = v_caller_id;
    IF v_caller_company_id IS NULL THEN
      RETURN jsonb_build_object('error', 'Access denied');
    END IF;
  END IF;

  -- Buscar atendente
  SELECT user_id, company_id
    INTO v_attendant_user_id, v_attendant_company_id
    FROM public.attendants WHERE id = p_attendant_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Attendant not found');
  END IF;

  -- Company admin só pode deletar da própria empresa
  IF NOT v_is_super_admin AND v_caller_company_id != v_attendant_company_id THEN
    RETURN jsonb_build_object('error', 'Company admins can only delete attendants from their own company');
  END IF;

  -- Deletar atendente (FK cascade limpa registros dependentes)
  DELETE FROM public.attendants WHERE id = p_attendant_id;

  -- Deletar auth user (cascade limpa auth.identities)
  IF v_attendant_user_id IS NOT NULL THEN
    DELETE FROM auth.users WHERE id = v_attendant_user_id;
  END IF;

  RETURN jsonb_build_object('ok', true, 'message', 'Atendente deletado com sucesso');

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_delete_attendant(uuid) TO authenticated;

-- ============================================================
-- 4. rpc_check_payment_notifications
-- ============================================================

CREATE OR REPLACE FUNCTION public.rpc_check_payment_notifications()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_caller_id   uuid := auth.uid();
  v_company     record;
  v_today       date := CURRENT_DATE;
  v_current_day integer := EXTRACT(DAY FROM v_today)::integer;
  v_payment_day integer;
  v_start_day   integer;
  v_in_period   boolean := false;
  v_days_left   integer := 0;
  v_days_in_prev_month integer;
  v_title       text;
  v_msg         text;
BEGIN
  -- Buscar empresa do usuário logado
  SELECT id, name, payment_notification_day
    INTO v_company
    FROM public.companies
   WHERE user_id = v_caller_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Company not found');
  END IF;

  v_payment_day := COALESCE(v_company.payment_notification_day, 5);

  -- Limpar notificações antigas no dia 27
  IF v_current_day = 27 THEN
    DELETE FROM public.notifications
     WHERE company_id = v_company.id AND type = 'payment';
  END IF;

  -- Calcular período de notificação (5 dias antes do vencimento)
  v_start_day := v_payment_day - 4; -- 5 dias: start até payment_day inclusive

  IF v_start_day > 0 THEN
    v_in_period := v_current_day BETWEEN v_start_day AND v_payment_day;
    v_days_left := v_payment_day - v_current_day;
  ELSE
    v_days_in_prev_month := EXTRACT(DAY FROM (date_trunc('month', v_today) - interval '1 day'))::integer;
    IF v_current_day >= (v_days_in_prev_month + v_start_day) THEN
      v_in_period := true;
      v_days_left := (v_days_in_prev_month - v_current_day) + v_payment_day;
    ELSIF v_current_day <= v_payment_day THEN
      v_in_period := true;
      v_days_left := v_payment_day - v_current_day;
    END IF;
  END IF;

  IF v_in_period THEN
    -- Verificar se já existe notificação hoje
    IF NOT EXISTS (
      SELECT 1 FROM public.notifications
       WHERE company_id = v_company.id
         AND type = 'payment'
         AND created_at::date = v_today
    ) THEN
      IF v_days_left = 0 THEN
        v_title := '🚨 AVISO FINAL - Pagamento Vence Hoje!';
        v_msg   := format('Hoje é o último dia para realizar o pagamento! Dia %s. Por favor, efetue o pagamento para evitar interrupções no serviço.', v_payment_day);
      ELSIF v_days_left = 1 THEN
        v_title := '⚠️ Lembrete de Pagamento - Vence Amanhã';
        v_msg   := format('Seu pagamento vence amanhã, dia %s. Faltam apenas 1 dia. Não esqueça de efetuar o pagamento.', v_payment_day);
      ELSE
        v_title := '💰 Lembrete de Pagamento';
        v_msg   := format('Seu pagamento vence no dia %s. Faltam %s dias. Lembre-se de efetuar o pagamento em dia.', v_payment_day, v_days_left);
      END IF;

      INSERT INTO public.notifications (company_id, title, message, type, is_read)
      VALUES (v_company.id, v_title, v_msg, 'payment', false);
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'ok',                  true,
    'current_day',         v_current_day,
    'payment_day',         v_payment_day,
    'is_in_period',        v_in_period,
    'days_until_payment',  v_days_left
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_check_payment_notifications() TO authenticated;
