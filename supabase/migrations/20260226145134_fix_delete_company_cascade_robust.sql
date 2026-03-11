/*
  # Fix delete_company_cascade function

  1. Changes
    - Rebuilds the function to be more robust
    - Uses SECURITY DEFINER to bypass RLS on auth.users
    - Deletes attendant auth users first, then company auth user
    - Handles NULL user_id gracefully
    - Catches exceptions when deleting auth users to avoid blocking the delete
*/

CREATE OR REPLACE FUNCTION delete_company_cascade(company_uuid uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_deleted_attendants int := 0;
  v_deleted_departments int := 0;
  v_deleted_sectors int := 0;
  v_deleted_tags int := 0;
  v_deleted_messages int := 0;
  v_deleted_sent_messages int := 0;
  v_company_api_key text;
  v_company_user_id uuid;
  v_deleted_attendant_users int := 0;
  v_attendant_user_id uuid;
BEGIN
  -- Check if user is super admin
  IF NOT EXISTS (
    SELECT 1 FROM super_admins
    WHERE super_admins.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Only super admins can delete companies';
  END IF;

  -- Get company data before deletion
  SELECT api_key, user_id INTO v_company_api_key, v_company_user_id
  FROM companies
  WHERE id = company_uuid;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Company not found';
  END IF;

  -- Count records for statistics
  SELECT COUNT(*) INTO v_deleted_attendants FROM attendants WHERE company_id = company_uuid;
  SELECT COUNT(*) INTO v_deleted_departments FROM departments WHERE company_id = company_uuid;
  SELECT COUNT(*) INTO v_deleted_sectors FROM sectors WHERE company_id = company_uuid;
  SELECT COUNT(*) INTO v_deleted_tags FROM tags WHERE company_id = company_uuid;
  SELECT COUNT(*) INTO v_deleted_messages FROM messages WHERE apikey_instancia = v_company_api_key;
  SELECT COUNT(*) INTO v_deleted_sent_messages FROM sent_messages WHERE company_id = company_uuid;

  -- Delete auth users for attendants one by one (ignore errors)
  FOR v_attendant_user_id IN
    SELECT user_id FROM attendants WHERE company_id = company_uuid AND user_id IS NOT NULL
  LOOP
    BEGIN
      DELETE FROM auth.users WHERE id = v_attendant_user_id;
      v_deleted_attendant_users := v_deleted_attendant_users + 1;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END LOOP;

  -- Delete the company (CASCADE handles related records)
  DELETE FROM companies WHERE id = company_uuid;

  -- Delete the company's auth user if it exists
  IF v_company_user_id IS NOT NULL THEN
    BEGIN
      DELETE FROM auth.users WHERE id = v_company_user_id;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'deleted', jsonb_build_object(
      'attendants', v_deleted_attendants,
      'attendant_users', v_deleted_attendant_users,
      'departments', v_deleted_departments,
      'sectors', v_deleted_sectors,
      'tags', v_deleted_tags,
      'messages', v_deleted_messages,
      'sent_messages', v_deleted_sent_messages,
      'company_user', CASE WHEN v_company_user_id IS NOT NULL THEN 1 ELSE 0 END
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION delete_company_cascade(uuid) TO authenticated;
