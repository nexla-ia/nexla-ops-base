-- Add RPC to update contact tags atomically and with proper permission checks

CREATE OR REPLACE FUNCTION public.update_contact_tags(
  p_contact_id uuid,
  p_tag_ids uuid[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_company_id uuid;
  v_current_tags uuid[] := ARRAY[]::uuid[];
  v_to_remove uuid[] := ARRAY[]::uuid[];
  v_to_add uuid[] := ARRAY[]::uuid[];
  v_existing_count int;
BEGIN
  -- Verify contact exists and get company
  SELECT company_id INTO v_company_id FROM contacts WHERE id = p_contact_id;
  IF v_company_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'contact_not_found');
  END IF;

  -- Permission check: attendant of company or super admin
  IF NOT (
    EXISTS (SELECT 1 FROM attendants WHERE user_id = auth.uid() AND company_id = v_company_id)
    OR is_super_admin()
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;

  -- Current tags
  SELECT COALESCE(array_agg(tag_id), ARRAY[]::uuid[]) INTO v_current_tags FROM contact_tags WHERE contact_id = p_contact_id;

  -- Compute diffs
  v_to_remove := ARRAY(SELECT unnest(v_current_tags) EXCEPT SELECT unnest(COALESCE(p_tag_ids, ARRAY[]::uuid[])));
  v_to_add := ARRAY(SELECT unnest(COALESCE(p_tag_ids, ARRAY[]::uuid[])) EXCEPT SELECT unnest(v_current_tags));

  -- Delete removed tags
  IF array_length(v_to_remove, 1) IS NOT NULL THEN
    DELETE FROM contact_tags WHERE contact_id = p_contact_id AND tag_id = ANY(v_to_remove);
  END IF;

  -- Enforce max 5 tags per contact
  SELECT COUNT(*) INTO v_existing_count FROM contact_tags WHERE contact_id = p_contact_id;
  IF v_existing_count + coalesce(array_length(v_to_add,1),0) > 5 THEN
    RETURN jsonb_build_object('success', false, 'error', 'max_tags_exceeded');
  END IF;

  -- Insert new tags (no-op if empty)
  IF array_length(v_to_add, 1) IS NOT NULL THEN
    INSERT INTO contact_tags (contact_id, tag_id)
    SELECT p_contact_id, unnest(v_to_add)
    ON CONFLICT DO NOTHING;
  END IF;

  -- Update legacy column contacts.tag_id to first tag or null
  UPDATE contacts
  SET tag_id = (
    SELECT tag_id FROM contact_tags WHERE contact_id = p_contact_id ORDER BY created_at LIMIT 1
  )
  WHERE id = p_contact_id;

  RETURN jsonb_build_object('success', true, 'removed', v_to_remove, 'added', v_to_add);
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_contact_tags(uuid, uuid[]) TO authenticated;
