-- evita erro caso alguma tabela opcional não exista

DO $$
BEGIN

IF EXISTS (
   SELECT 1
   FROM information_schema.tables
   WHERE table_name = 'conversation_assignments'
) THEN

  EXECUTE '
    DELETE FROM conversation_assignments
    WHERE company_id IS NOT NULL
  ';

END IF;

END $$;
