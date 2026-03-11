-- Add RPC to update contact name with proper permission checks

CREATE OR REPLACE FUNCTION public.update_contact_name(
  p_contact_id uuid,
  p_new_name text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_company_id uuid;
BEGIN
  -- Verify contact exists and get company
  SELECT company_id INTO v_company_id FROM contacts WHERE id = p_contact_id;
  IF v_company_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'contact_not_found');
  END IF;

  -- Permission check: user must be an attendant of the company or a super admin
  IF NOT (
    is_attendant_of_company(v_company_id)
    OR is_super_admin()
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;

  -- Update the contact's name
  UPDATE contacts
  SET name = p_new_name
  WHERE id = p_contact_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_contact_name(uuid, text) TO authenticated;
