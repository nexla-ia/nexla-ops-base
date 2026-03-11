/*
  # Create delete_contact_and_messages function

  1. Changes
    - Create function to delete a contact and all associated messages
    - Deletes from message_tags, messages, sent_messages, and contacts tables
    - Returns status as jsonb

  2. Security
    - Only authenticated users can execute
    - Users can only delete contacts from their own companies
*/

CREATE OR REPLACE FUNCTION delete_contact_and_messages(p_contact_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id uuid;
  v_deleted_messages int := 0;
  v_deleted_sent_messages int := 0;
  v_deleted_message_tags int := 0;
  v_deleted_contact int := 0;
  v_tmp_deleted int := 0;
  v_user_company_id uuid;
BEGIN
  -- Get the company_id for this contact
  SELECT company_id INTO v_company_id
  FROM contacts
  WHERE id = p_contact_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Contact not found',
      'deleted_messages', 0,
      'deleted_sent_messages', 0,
      'deleted_contact', 0
    );
  END IF;

  -- Check if user has access to this company
  v_user_company_id := (
    SELECT id FROM companies
    WHERE user_id = auth.uid()
    LIMIT 1
  );

  IF v_user_company_id != v_company_id THEN
    RAISE EXCEPTION 'Unauthorized: You do not have access to this contact';
  END IF;

  -- Delete message_tags for messages from this contact
  -- and for messages that match the contact phone (numero, sender or phone_number),
  -- stripping JID suffixes like @s.whatsapp.net and normalizing digits.
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'messages' AND column_name = 'contact_id'
  ) THEN
    EXECUTE 'DELETE FROM message_tags mt WHERE mt.message_id IN (
      SELECT id FROM messages m WHERE m.contact_id = $1
    )' USING p_contact_id;
    GET DIAGNOSTICS v_deleted_message_tags = ROW_COUNT;
  ELSE
    v_deleted_message_tags := 0;
  END IF;

  -- Delete messages for this contact
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'messages' AND column_name = 'contact_id'
  ) THEN
    EXECUTE 'DELETE FROM messages WHERE contact_id = $1' USING p_contact_id;
    GET DIAGNOSTICS v_tmp_deleted = ROW_COUNT;
    v_deleted_messages := v_deleted_messages + v_tmp_deleted;
  END IF;

  -- Also delete messages where numero, sender or phone_number matches the contact's phone number
  -- Normalize by removing any JID suffix (@...), then non-digits, and accept exact or suffix matches
  EXECUTE
    'DELETE FROM messages m WHERE (
       regexp_replace(regexp_replace(coalesce(m.numero, ''''), ''@.*$'', ''''), ''\\D'', '''', ''g'') IN (SELECT regexp_replace(coalesce(c.phone_number, ''''), ''\\D'', '''', ''g'') FROM contacts c WHERE id = $1)
       OR regexp_replace(regexp_replace(coalesce(m.sender, ''''), ''@.*$'', ''''), ''\\D'', '''', ''g'') IN (SELECT regexp_replace(coalesce(c.phone_number, ''''), ''\\D'', '''', ''g'') FROM contacts c WHERE id = $1)
       OR regexp_replace(regexp_replace(coalesce(m.phone_number, ''''), ''@.*$'', ''''), ''\\D'', '''', ''g'') IN (SELECT regexp_replace(coalesce(c.phone_number, ''''), ''\\D'', '''', ''g'') FROM contacts c WHERE id = $1)
       OR right(regexp_replace(regexp_replace(coalesce(m.numero, ''''), ''@.*$'', ''''), ''\\D'', '''', ''g''), char_length((SELECT regexp_replace(coalesce(c.phone_number, ''''), ''\\D'', '''', ''g'') FROM contacts c WHERE id = $1))) = (SELECT regexp_replace(coalesce(c.phone_number, ''''), ''\\D'', '''', ''g'') FROM contacts c WHERE id = $1)
    )' USING p_contact_id;
  GET DIAGNOSTICS v_tmp_deleted = ROW_COUNT;
  v_deleted_messages := v_deleted_messages + v_tmp_deleted;

  -- Delete sent_messages for this contact
  -- sent_messages: try to delete by contact_id (if column exists) and also delete any rows
  -- where `numero` matches the contact phone_number.

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sent_messages' AND column_name = 'contact_id'
  ) THEN
    EXECUTE 'DELETE FROM sent_messages WHERE contact_id = $1' USING p_contact_id;
    GET DIAGNOSTICS v_tmp_deleted = ROW_COUNT;
    v_deleted_sent_messages := v_deleted_sent_messages + v_tmp_deleted;
  END IF;

  -- Also delete by phone number stored in `numero` (covers older rows that only have numero)
  EXECUTE
    'DELETE FROM sent_messages sm WHERE (
       regexp_replace(regexp_replace(coalesce(sm.numero, ''''), ''@.*$'', ''''), ''\\D'', '''', ''g'') IN (SELECT regexp_replace(coalesce(c.phone_number, ''''), ''\\D'', '''', ''g'') FROM contacts c WHERE id = $1)
       OR right(regexp_replace(regexp_replace(coalesce(sm.numero, ''''), ''@.*$'', ''''), ''\\D'', '''', ''g''), char_length((SELECT regexp_replace(coalesce(c.phone_number, ''''), ''\\D'', '''', ''g'') FROM contacts c WHERE id = $1))) = (SELECT regexp_replace(coalesce(c.phone_number, ''''), ''\\D'', '''', ''g'') FROM contacts c WHERE id = $1)
    )' USING p_contact_id;
  GET DIAGNOSTICS v_tmp_deleted = ROW_COUNT;
  v_deleted_sent_messages := v_deleted_sent_messages + v_tmp_deleted;

  -- Delete the contact itself
  DELETE FROM contacts
  WHERE id = p_contact_id;

  GET DIAGNOSTICS v_deleted_contact = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Contact and associated messages deleted successfully',
    'deleted_messages', v_deleted_messages,
    'deleted_sent_messages', v_deleted_sent_messages,
    'deleted_message_tags', v_deleted_message_tags,
    'deleted_contact', v_deleted_contact
  );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION delete_contact_and_messages(uuid) TO authenticated;
