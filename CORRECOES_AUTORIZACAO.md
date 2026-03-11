# Correções no Sistema de Cadastro de Empresas

## PROBLEMA CRÍTICO IDENTIFICADO

A **ordem de validação** na Edge Function estava incorreta, causando:
- Usuários órfãos no `auth.users` quando havia email duplicado
- Erro genérico "non-2xx status code"
- Necessidade de limpeza manual do banco

## CORREÇÃO APLICADA

### Mudança na Ordem de Validação

**ANTES (INCORRETO):**
```
1. Validar API Key duplicada ✅
2. Criar usuário no auth.users ← CRIA AQUI
3. Verificar email duplicado ← TARDE DEMAIS!
4. Se duplicado → Delete user e retorna erro
```

**DEPOIS (CORRETO):**
```
1. Verificar email duplicado ← ANTES DE CRIAR
2. Verificar API Key duplicada
3. Criar usuário no auth.users ← SÓ DEPOIS
4. Inserir empresa na tabela companies
```

### Arquivo Modificado

`supabase/functions/create-company/index.ts` (linhas 185-254)

**Código Corrigido:**
```typescript
// ✅ VALIDAÇÃO 1: Email duplicado (ANTES de criar usuário)
console.log("Checking if email already exists:", email);
const { data: existingEmail } = await supabaseAdmin
  .from("companies")
  .select("id")
  .eq("email", email)
  .maybeSingle();

if (existingEmail) {
  return new Response(
    JSON.stringify({
      error: "Email já está em uso por outra empresa",
    }),
    { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

// ✅ VALIDAÇÃO 2: API Key duplicada
const { data: existingApiKey } = await supabaseAdmin
  .from("companies")
  .select("id")
  .eq("api_key", api_key)
  .maybeSingle();

if (existingApiKey) {
  return new Response(
    JSON.stringify({
      error: "API Key já está em uso por outra empresa",
    }),
    { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

// ✅ AGORA SIM: Cria usuário (só depois das validações)
const { data: newUser, error: createUserError } =
  await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
```

## ESTRUTURA DE AUTORIZAÇÃO

### Quem Pode Criar Empresas?

Apenas usuários na tabela `super_admins`:

```sql
CREATE TABLE super_admins (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id)
);
```

### RLS Policies da Tabela Companies

```sql
-- Apenas super admins podem inserir
CREATE POLICY "super_admins_insert"
ON companies FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (SELECT 1 FROM super_admins WHERE user_id = auth.uid())
);

-- Super admins veem todas as empresas
CREATE POLICY "super_admins_select_all"
ON companies FOR SELECT
TO authenticated
USING (
  EXISTS (SELECT 1 FROM super_admins WHERE user_id = auth.uid())
);
```

## FLUXO COMPLETO DE CRIAÇÃO

```
1. Frontend: Usuário preenche formulário
   ↓
2. Frontend: Valida campos obrigatórios
   ↓
3. Frontend: Verifica se está na tabela super_admins
   ↓
4. Frontend: Chama Edge Function create-company
   ↓
5. Backend: Verifica token JWT
   ↓
6. Backend: Verifica se está na tabela super_admins
   ↓
7. Backend: Valida campos obrigatórios
   ↓
8. Backend: ✅ VERIFICA EMAIL DUPLICADO (NOVO)
   ↓
9. Backend: ✅ VERIFICA API KEY DUPLICADA
   ↓
10. Backend: Cria usuário no auth.users
   ↓
11. Backend: Insere empresa na tabela companies
   ↓
12. Backend: Retorna sucesso
   ↓
13. Frontend: Exibe mensagem de sucesso
```

## VALIDAÇÕES IMPLEMENTADAS

### Frontend (SuperAdminDashboard.tsx)

```typescript
// 1. Campos obrigatórios
if (!name || !phone_number || !api_key || !email || !password) {
  setErrorMsg("Preencha todos os campos.");
  return;
}

// 2. Telefone válido
const phoneNumbers = phone_number.replace(/\D/g, "");
if (phoneNumbers.length < 10) {
  setErrorMsg("Telefone deve ter pelo menos 10 dígitos.");
  return;
}

// 3. Senha segura
if (password.length < 6) {
  setErrorMsg("Senha deve ter no mínimo 6 caracteres.");
  return;
}

// 4. Usuário é super admin
const { data: adminCheck } = await supabase
  .from("super_admins")
  .select("user_id")
  .eq("user_id", user.id)
  .maybeSingle();

if (!adminCheck) {
  throw new Error("Você não está cadastrado como super admin.");
}
```

### Backend (Edge Function)

```typescript
// 1. Autorização
const { data: adminData } = await supabaseAdmin
  .from("super_admins")
  .select("user_id")
  .eq("user_id", callerId)
  .maybeSingle();

if (!adminData) {
  return error(403, "Access denied");
}

// 2. Campos obrigatórios
if (!email || !password || !name || !phone_number || !api_key) {
  return error(400, "Campos obrigatórios faltando");
}

// 3. Telefone válido
if (phone_number.length < 10) {
  return error(400, "Telefone inválido");
}

// 4. Email duplicado (NOVO)
const { data: existingEmail } = await supabaseAdmin
  .from("companies")
  .select("id")
  .eq("email", email)
  .maybeSingle();

if (existingEmail) {
  return error(400, "Email já está em uso");
}

// 5. API Key duplicada
const { data: existingApiKey } = await supabaseAdmin
  .from("companies")
  .select("id")
  .eq("api_key", api_key)
  .maybeSingle();

if (existingApiKey) {
  return error(400, "API Key já está em uso");
}
```

## MENSAGENS DE ERRO

| Mensagem | Causa | Solução |
|----------|-------|---------|
| "Email já está em uso por outra empresa" | Email duplicado | Use outro email |
| "API Key já está em uso por outra empresa" | API Key duplicada | Use outra API key |
| "Você não está cadastrado como super admin" | Não autorizado | Adicione na tabela super_admins |
| "Preencha todos os campos" | Campos vazios | Complete o formulário |
| "Telefone deve ter pelo menos 10 dígitos" | Telefone inválido | Digite telefone completo |
| "Senha deve ter no mínimo 6 caracteres" | Senha curta | Use senha com 6+ caracteres |

## COMO ADICIONAR SUPER ADMIN

```sql
-- 1. Ver usuários existentes
SELECT id, email FROM auth.users;

-- 2. Adicionar como super admin
INSERT INTO super_admins (user_id)
VALUES ('ID-DO-USUARIO')
ON CONFLICT (user_id) DO NOTHING;

-- 3. Verificar
SELECT sa.user_id, au.email
FROM super_admins sa
JOIN auth.users au ON au.id = sa.user_id;
```

## TESTES PARA VALIDAR

### Teste 1: Email Duplicado
```
1. Crie empresa: teste@exemplo.com
2. Tente criar outra: teste@exemplo.com
3. Resultado: "Email já está em uso"
4. Verifique: Não deve ter usuário órfão no auth.users
```

### Teste 2: API Key Duplicada
```
1. Crie empresa: api-key-001
2. Tente criar outra: api-key-001
3. Resultado: "API Key já está em uso"
```

### Teste 3: Criação com Sucesso
```
1. Email único: nova-empresa@exemplo.com
2. API Key única: api-nova-001
3. Todos os campos preenchidos
4. Resultado: Empresa criada com sucesso
```

### Teste 4: Não Super Admin
```
1. Login com usuário comum
2. Tente criar empresa
3. Resultado: "Você não está cadastrado como super admin"
```

## STATUS FINAL

✅ Edge Function corrigida e deployada
✅ Ordem de validação corrigida
✅ Não cria mais usuários órfãos
✅ Mensagens de erro claras
✅ Build concluído com sucesso

## RESUMO

**O que estava errado:**
- Validação de email duplicado DEPOIS de criar usuário

**O que foi corrigido:**
- Validação de email duplicado ANTES de criar usuário

**Resultado:**
- Sistema limpo, sem usuários órfãos
- Mensagens de erro claras
- Processo mais eficiente
