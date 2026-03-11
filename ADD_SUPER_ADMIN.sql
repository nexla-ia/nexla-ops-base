-- ========================================
-- ADICIONAR SUPER ADMIN
-- ========================================
--
-- Use este script para adicionar um usuário como super admin
--
-- PASSO 1: Descubra o user_id do usuário
-- Execute esta query para ver todos os usuários:

SELECT id, email, created_at
FROM auth.users
ORDER BY created_at DESC;

-- PASSO 2: Copie o ID do usuário que deseja tornar super admin
-- PASSO 3: Execute o INSERT abaixo substituindo 'SEU_USER_ID_AQUI' pelo ID copiado

-- Exemplo:
-- INSERT INTO super_admins (user_id)
-- VALUES ('832c651b-bcf1-452d-b3b9-68e50b2af491')
-- ON CONFLICT (user_id) DO NOTHING;

-- IMPORTANTE: Substitua 'SEU_USER_ID_AQUI' pelo ID real do usuário
INSERT INTO super_admins (user_id)
VALUES ('SEU_USER_ID_AQUI')
ON CONFLICT (user_id) DO NOTHING;

-- Para verificar se funcionou:
SELECT sa.user_id, au.email
FROM super_admins sa
JOIN auth.users au ON sa.user_id = au.id;

-- ========================================
-- REMOVER SUPER ADMIN (caso necessário)
-- ========================================
-- DELETE FROM super_admins WHERE user_id = 'SEU_USER_ID_AQUI';
