# Solução do Erro de Registro de Empresa

## PROBLEMA IDENTIFICADO

O erro `FunctionsHttpError: Edge Function returned a non-2xx status code` ocorre porque você está tentando criar uma empresa com um **email que já existe** no banco de dados.

### Detalhes do Problema

**Usuário logado:**
- Email: `nexla@nexla.com.br`
- User ID: `832c651b-bcf1-452d-b3b9-68e50b2af491`
- Status: ✅ Super Admin (na tabela `super_admins`)

**Empresa existente:**
- ID: `b556fa35-7418-41ea-aba3-289b3a348838`
- Nome: Nexla
- Email: `nexla@nexla.com.br` ← **MESMO EMAIL**
- User ID: `832c651b-bcf1-452d-b3b9-68e50b2af491`

### Por que o erro ocorre?

A tabela `companies` tem uma constraint `UNIQUE(email)`. Quando você tenta criar uma nova empresa usando o email `nexla@nexla.com.br`, o sistema detecta que esse email já está associado à empresa "Nexla" e bloqueia a operação com a mensagem:

> "Email já está em uso por outra empresa"

---

## SOLUÇÃO

### Opção 1: Usar Email Diferente (RECOMENDADO)

Para testar a criação de empresas, use um email NOVO que não exista no banco:

```
Email: teste-empresa-2@exemplo.com
Nome: Empresa Teste 2
Telefone: (11) 98888-8888
API Key: teste-api-key-002
```

### Opção 2: Deletar Empresa Existente (CUIDADO)

Se você quer reutilizar o email `nexla@nexla.com.br`, precisa deletar a empresa existente primeiro:

```sql
-- ATENÇÃO: Isso vai deletar a empresa e todos os dados relacionados!
DELETE FROM companies WHERE id = 'b556fa35-7418-41ea-aba3-289b3a348838';
```

**⚠️ IMPORTANTE:** Isso vai deletar:
- A empresa
- Todos os atendentes
- Todos os contatos
- Todas as mensagens
- Todos os departamentos/setores/tags

### Opção 3: Atualizar a Empresa Existente

Se você quer modificar a empresa "Nexla" ao invés de criar uma nova:

1. Vá para o painel de super admin
2. Procure a empresa "Nexla" na lista
3. Clique em editar
4. Faça as modificações necessárias

---

## COMO O SISTEMA FUNCIONA

### Fluxo Correto de Criação de Empresa

```
1. Super admin faz login
   ↓
2. Frontend verifica se é super admin
   ✅ User está na tabela super_admins
   ↓
3. Frontend chama Edge Function create-company
   ↓
4. Backend verifica autorização
   ✅ User está na tabela super_admins
   ↓
5. Backend verifica API Key duplicada
   ✅ API Key é única
   ↓
6. Backend verifica Email duplicado ← VOCÊ ESTÁ AQUI
   ❌ Email já existe!
   ↓
   ERRO: "Email já está em uso por outra empresa"
```

### Validações Ativas

O sistema valida:
- ✅ Usuário está autenticado
- ✅ Usuário é super admin (tabela `super_admins`)
- ✅ API Key não está em uso
- ✅ **Email não está em uso** ← Bloqueando aqui
- ✅ Telefone tem mínimo 10 dígitos
- ✅ Senha tem mínimo 6 caracteres

---

## TESTE PASSO A PASSO

### 1. Verificar Empresas Existentes

```sql
-- Ver todas as empresas cadastradas
SELECT id, name, email, api_key
FROM companies
ORDER BY created_at DESC;
```

### 2. Verificar Email Disponível

```sql
-- Verificar se email está disponível
SELECT email
FROM companies
WHERE email = 'novo-email@exemplo.com';

-- Resultado esperado: 0 linhas (email disponível)
```

### 3. Criar Nova Empresa

Use dados únicos:

**Formulário:**
- Nome: `Empresa Teste Nova`
- Email: `empresa-teste-nova@exemplo.com` ← NOVO
- Telefone: `11999998888`
- API Key: `api-teste-nova-123` ← NOVO
- Senha: `senha123`

### 4. Verificar Criação

```sql
-- Confirmar que a empresa foi criada
SELECT id, name, email, user_id
FROM companies
WHERE email = 'empresa-teste-nova@exemplo.com';
```

---

## EMAILS JÁ CADASTRADOS NO SISTEMA

⚠️ **NÃO USE estes emails** (já existem no banco):

```sql
-- Ver emails em uso
SELECT email, name
FROM companies
ORDER BY email;
```

Provavelmente você verá:
- `nexla@nexla.com.br` (Nexla)
- Outros emails de empresas já criadas

---

## MENSAGENS DE ERRO E SIGNIFICADOS

| Mensagem | Causa | Solução |
|----------|-------|---------|
| "Email já está em uso por outra empresa" | Email duplicado | Use outro email |
| "API Key já está em uso por outra empresa" | API Key duplicada | Use outra API key |
| "User is not a super admin" | Usuário não está na tabela super_admins | Adicione o usuário como super admin |
| "Preencha todos os campos" | Campos obrigatórios vazios | Preencha todos os campos |
| "Telefone deve ter pelo menos 10 dígitos" | Telefone inválido | Digite telefone completo |

---

## SCRIPT PARA LIMPAR DADOS DE TESTE

Se você criou muitas empresas de teste e quer limpar:

```sql
-- CUIDADO: Isso vai deletar TODAS as empresas de teste
-- Ajuste o filtro conforme necessário

-- Ver empresas de teste
SELECT id, name, email
FROM companies
WHERE email LIKE '%teste%' OR email LIKE '%exemplo%';

-- Deletar empresas de teste (descomente para executar)
-- DELETE FROM companies
-- WHERE email LIKE '%teste%' OR email LIKE '%exemplo%';
```

---

## COMANDOS ÚTEIS PARA DEBUG

### Verificar se usuário é super admin

```sql
SELECT sa.user_id, au.email
FROM super_admins sa
JOIN auth.users au ON au.id = sa.user_id;
```

### Verificar empresas e seus donos

```sql
SELECT
    c.id,
    c.name,
    c.email,
    c.api_key,
    au.email as owner_email
FROM companies c
LEFT JOIN auth.users au ON au.id = c.user_id
ORDER BY c.created_at DESC;
```

### Verificar usuários sem empresa

```sql
SELECT u.id, u.email
FROM auth.users u
LEFT JOIN companies c ON c.user_id = u.id
WHERE c.id IS NULL AND u.email NOT IN (SELECT email FROM super_admins sa JOIN auth.users au ON au.id = sa.user_id);
```

---

## RESUMO DA SOLUÇÃO

**O QUE ESTAVA ERRADO:**
- Nada! O sistema está funcionando corretamente
- A validação de email duplicado está CORRETA
- O erro ocorre porque você tentou usar um email já cadastrado

**O QUE FAZER:**
1. Use um email DIFERENTE para criar a nova empresa
2. Verifique se o email está disponível antes de tentar criar
3. Use a query acima para ver emails já em uso

**TESTE COM SUCESSO:**
```
Email: minha-nova-empresa@exemplo.com
Nome: Minha Nova Empresa
API Key: api-nova-empresa-001
Telefone: 11988887777
Senha: senha123456
```

Resultado esperado: ✅ Empresa criada com sucesso!

---

## PRÓXIMOS PASSOS

1. Escolha um email único
2. Preencha o formulário com dados válidos
3. Clique em "Criar Empresa"
4. Verifique a mensagem de sucesso
5. Confirme que a empresa aparece na lista

O sistema está funcionando perfeitamente. Você só precisa usar emails únicos! 🎉
