-- ============================================================
-- NEXLA OPS — DIAGNÓSTICO COMPLETO DO BANCO
-- Execute este arquivo no SQL Editor do Supabase
-- ============================================================

-- ============================================================
-- 1. TABELAS — RLS habilitado ou não
-- ============================================================
SELECT
  schemaname                        AS schema,
  tablename                         AS tabela,
  rowsecurity                       AS rls_habilitado,
  forcerowsecurity                  AS rls_forcado
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- ============================================================
-- 2. TODAS AS POLICIES RLS (por tabela + comando)
-- ============================================================
SELECT
  schemaname                        AS schema,
  tablename                         AS tabela,
  policyname                        AS policy,
  roles                             AS roles,
  cmd                               AS comando,
  qual                              AS using_expr,
  with_check                        AS with_check_expr
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, cmd, policyname;

-- ============================================================
-- 3. TRIGGERS — todos os triggers nas tabelas public
-- ============================================================
SELECT
  trigger_schema                    AS schema,
  event_object_table                AS tabela,
  trigger_name                      AS trigger,
  event_manipulation                AS evento,
  action_timing                     AS timing,
  action_orientation                AS por,
  action_statement                  AS acao
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY event_object_table, trigger_name;

-- ============================================================
-- 4. FUNÇÕES CUSTOM no schema public
-- ============================================================
SELECT
  n.nspname                         AS schema,
  p.proname                         AS funcao,
  pg_get_function_arguments(p.oid)  AS argumentos,
  CASE p.prosecdef WHEN true THEN 'SECURITY DEFINER' ELSE 'SECURITY INVOKER' END AS seguranca,
  CASE p.provolatile
    WHEN 'i' THEN 'IMMUTABLE'
    WHEN 's' THEN 'STABLE'
    WHEN 'v' THEN 'VOLATILE'
  END                               AS volatilidade,
  pg_get_functiondef(p.oid)         AS definicao
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.prokind = 'f'
ORDER BY p.proname;

-- ============================================================
-- 5. FOREIGN KEYS — relacionamentos entre tabelas
-- ============================================================
SELECT
  tc.table_name                     AS tabela,
  kcu.column_name                   AS coluna,
  ccu.table_name                    AS tabela_ref,
  ccu.column_name                   AS coluna_ref,
  rc.delete_rule                    AS on_delete,
  rc.update_rule                    AS on_update
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.referential_constraints AS rc
  ON tc.constraint_name = rc.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = rc.unique_constraint_name
  AND ccu.table_schema = rc.unique_constraint_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
ORDER BY tc.table_name, kcu.column_name;

-- ============================================================
-- 6. INDEXES nas tabelas public
-- ============================================================
SELECT
  schemaname                        AS schema,
  tablename                         AS tabela,
  indexname                         AS indice,
  indexdef                          AS definicao
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;

-- ============================================================
-- 7. COLUNAS de cada tabela (tipo + nullable + default)
-- ============================================================
SELECT
  table_name                        AS tabela,
  column_name                       AS coluna,
  ordinal_position                  AS posicao,
  data_type                         AS tipo,
  character_maximum_length          AS tamanho,
  is_nullable                       AS nullable,
  column_default                    AS valor_padrao
FROM information_schema.columns
WHERE table_schema = 'public'
ORDER BY table_name, ordinal_position;

-- ============================================================
-- 8. CONTAGEM DE LINHAS por tabela (útil para saber o que tem dados)
-- ============================================================
SELECT
  'super_admins'   AS tabela, COUNT(*) AS linhas FROM super_admins
UNION ALL SELECT 'plans',          COUNT(*) FROM plans
UNION ALL SELECT 'companies',      COUNT(*) FROM companies
UNION ALL SELECT 'attendants',     COUNT(*) FROM attendants
UNION ALL SELECT 'departments',    COUNT(*) FROM departments
UNION ALL SELECT 'sectors',        COUNT(*) FROM sectors
UNION ALL SELECT 'tags',           COUNT(*) FROM tags
UNION ALL SELECT 'contacts',       COUNT(*) FROM contacts
UNION ALL SELECT 'messages',       COUNT(*) FROM messages
UNION ALL SELECT 'sent_messages',  COUNT(*) FROM sent_messages
UNION ALL SELECT 'notifications',  COUNT(*) FROM notifications
UNION ALL SELECT 'transferencias', COUNT(*) FROM transferencias
ORDER BY tabela;

-- ============================================================
-- 9. VERIFICAÇÃO RÁPIDA — super_admins registrados
-- ============================================================
SELECT
  sa.user_id,
  au.email,
  sa.created_at
FROM super_admins sa
LEFT JOIN auth.users au ON au.id = sa.user_id
ORDER BY sa.created_at;

-- ============================================================
-- 10. VERIFICAÇÃO — is_super_admin() funciona para cada usuário auth?
-- (Rode como postgres/service_role para ver todos)
-- ============================================================
SELECT
  au.id                             AS user_id,
  au.email,
  EXISTS (
    SELECT 1 FROM super_admins WHERE user_id = au.id
  )                                 AS is_super_admin,
  EXISTS (
    SELECT 1 FROM companies WHERE user_id = au.id
  )                                 AS is_company
FROM auth.users au
ORDER BY au.email;
