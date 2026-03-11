-- =====================================================
-- SCRIPT PARA VERIFICAR EMAILS DISPONÍVEIS
-- =====================================================

-- 1. VER TODOS OS EMAILS JÁ CADASTRADOS
-- Execute este comando ANTES de criar uma empresa
-- para verificar quais emails já estão em uso
SELECT
    email,
    name as empresa,
    api_key,
    created_at::date as data_cadastro
FROM companies
ORDER BY created_at DESC;

-- =====================================================

-- 2. VERIFICAR SE UM EMAIL ESPECÍFICO ESTÁ DISPONÍVEL
-- Substitua 'seu-email@exemplo.com' pelo email que quer usar
SELECT
    CASE
        WHEN EXISTS (SELECT 1 FROM companies WHERE email = 'seu-email@exemplo.com')
        THEN '❌ EMAIL JÁ ESTÁ EM USO'
        ELSE '✅ EMAIL DISPONÍVEL'
    END as status,
    CASE
        WHEN EXISTS (SELECT 1 FROM companies WHERE email = 'seu-email@exemplo.com')
        THEN (SELECT name FROM companies WHERE email = 'seu-email@exemplo.com')
        ELSE 'N/A'
    END as empresa_que_usa;

-- =====================================================

-- 3. VERIFICAR SE UMA API KEY ESTÁ DISPONÍVEL
-- Substitua 'sua-api-key' pela API key que quer usar
SELECT
    CASE
        WHEN EXISTS (SELECT 1 FROM companies WHERE api_key = 'sua-api-key')
        THEN '❌ API KEY JÁ ESTÁ EM USO'
        ELSE '✅ API KEY DISPONÍVEL'
    END as status,
    CASE
        WHEN EXISTS (SELECT 1 FROM companies WHERE api_key = 'sua-api-key')
        THEN (SELECT name FROM companies WHERE api_key = 'sua-api-key')
        ELSE 'N/A'
    END as empresa_que_usa;

-- =====================================================

-- 4. GERAR SUGESTÕES DE EMAILS DISPONÍVEIS
-- Este comando mostra sugestões de emails que você pode usar
SELECT
    'empresa-' || generate_series(1, 10) || '@exemplo.com' as email_sugerido,
    CASE
        WHEN EXISTS (
            SELECT 1 FROM companies
            WHERE email = 'empresa-' || generate_series(1, 10) || '@exemplo.com'
        )
        THEN '❌ Em uso'
        ELSE '✅ Disponível'
    END as status;

-- =====================================================

-- 5. VER EMPRESAS E SEUS USUÁRIOS (para debug)
SELECT
    c.name as empresa,
    c.email as email_empresa,
    c.api_key,
    au.email as email_usuario_dono,
    c.created_at::date
FROM companies c
LEFT JOIN auth.users au ON au.id = c.user_id
ORDER BY c.created_at DESC;

-- =====================================================

-- 6. CONTAR EMPRESAS CADASTRADAS
SELECT
    COUNT(*) as total_empresas,
    COUNT(DISTINCT email) as emails_unicos,
    COUNT(DISTINCT api_key) as api_keys_unicas
FROM companies;

-- =====================================================

-- 7. VERIFICAR MÚLTIPLOS EMAILS DE UMA VEZ
-- Adicione os emails que quer verificar
SELECT
    email_teste,
    CASE
        WHEN EXISTS (SELECT 1 FROM companies WHERE email = email_teste)
        THEN '❌ EM USO'
        ELSE '✅ DISPONÍVEL'
    END as status
FROM (
    VALUES
        ('teste1@exemplo.com'),
        ('teste2@exemplo.com'),
        ('teste3@exemplo.com'),
        ('minha-empresa@exemplo.com'),
        ('nova-empresa@exemplo.com')
) AS t(email_teste);

-- =====================================================

-- 8. SUGESTÕES DE API KEYS DISPONÍVEIS
SELECT
    'api-key-' || md5(random()::text) as api_key_sugerida,
    'Pode usar esta API key' as observacao
FROM generate_series(1, 5);

-- =====================================================

-- 9. LIMPAR EMPRESAS DE TESTE (CUIDADO!)
-- Descomente apenas se quiser deletar empresas de teste
-- ATENÇÃO: Isso vai deletar PERMANENTEMENTE

-- Ver empresas de teste primeiro:
SELECT id, name, email, api_key
FROM companies
WHERE
    email LIKE '%teste%'
    OR email LIKE '%exemplo%'
    OR email LIKE '%test%'
    OR name LIKE '%Teste%'
    OR name LIKE '%Test%';

-- Para deletar (descomente):
-- DELETE FROM companies
-- WHERE
--     email LIKE '%teste%'
--     OR email LIKE '%exemplo%'
--     OR email LIKE '%test%';

-- =====================================================

-- 10. VERIFICAR SE VOCÊ É SUPER ADMIN
SELECT
    au.email,
    sa.user_id,
    'Você é super admin ✅' as status
FROM super_admins sa
JOIN auth.users au ON au.id = sa.user_id
WHERE au.id = auth.uid();  -- Seu user ID atual

-- =====================================================
-- FIM DO SCRIPT
-- =====================================================

-- EXEMPLO DE USO PRÁTICO:
--
-- 1. Execute o comando #1 para ver emails em uso
-- 2. Execute o comando #2 substituindo pelo email desejado
-- 3. Se estiver disponível, use no formulário de criação
-- 4. Execute o comando #8 para gerar uma API key única
