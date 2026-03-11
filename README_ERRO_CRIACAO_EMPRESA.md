# 🔍 Diagnóstico Completo - Erro de Criação de Empresa

## ❌ PROBLEMA IDENTIFICADO

Você está tentando criar uma empresa com um **email que já existe no banco de dados**.

### Detalhes Técnicos

**Erro no Console:**
```
FunctionsHttpError: Edge Function returned a non-2xx status code
Response.data: null
```

**Causa Real:**
```
Email: nexla@nexla.com.br
Status: ❌ JÁ EXISTE na tabela companies
Empresa existente: Nexla (ID: b556fa35-7418-41ea-aba3-289b3a348838)
```

---

## ✅ O SISTEMA ESTÁ FUNCIONANDO CORRETAMENTE

Todas as validações estão corretas:

### 1. Autorização ✅
- Usuário está na tabela `super_admins`
- Token JWT válido
- Permissões corretas

### 2. Validações Backend ✅
- API Key única (verifica duplicatas)
- **Email único (verifica duplicatas)** ← Bloqueando aqui
- Telefone válido
- Campos obrigatórios

### 3. Estrutura do Banco ✅
- Constraint `UNIQUE(email)` na tabela companies
- Constraint `UNIQUE(api_key)` na tabela companies
- RLS policies configuradas corretamente

---

## 🎯 SOLUÇÃO IMEDIATA

### Use um email DIFERENTE para criar a empresa

**❌ NÃO USE:**
```
Email: nexla@nexla.com.br (JÁ EXISTE)
```

**✅ USE:**
```
Email: nova-empresa@exemplo.com
Nome: Nova Empresa Teste
Telefone: 11999998888
API Key: api-nova-empresa-001
Senha: senha123456
```

---

## 📋 PASSO A PASSO PARA CRIAR EMPRESA COM SUCESSO

### Passo 1: Verificar emails disponíveis

Execute no Supabase SQL Editor:

```sql
-- Ver emails já cadastrados
SELECT email, name
FROM companies
ORDER BY email;
```

### Passo 2: Escolher email único

Certifique-se que o email escolhido NÃO aparece na lista acima.

### Passo 3: Preencher formulário

```
Nome da Empresa: Minha Nova Empresa
Email: minha-nova-empresa@exemplo.com  ← ÚNICO
Telefone: (11) 98888-7777
API Key: api-minha-empresa-001  ← ÚNICO
Senha: senha123456
Plano: (opcional)
```

### Passo 4: Criar empresa

Clique em "Criar Empresa" e aguarde a confirmação.

### Passo 5: Verificar criação

```sql
-- Confirmar que foi criada
SELECT id, name, email
FROM companies
WHERE email = 'minha-nova-empresa@exemplo.com';
```

---

## 🔧 COMANDOS ÚTEIS

### Verificar se email está disponível

```sql
-- Substitua 'SEU-EMAIL' pelo email desejado
SELECT
    CASE
        WHEN EXISTS (SELECT 1 FROM companies WHERE email = 'SEU-EMAIL@exemplo.com')
        THEN '❌ EMAIL JÁ ESTÁ EM USO'
        ELSE '✅ EMAIL DISPONÍVEL - PODE USAR'
    END as status;
```

### Gerar API Key única

```sql
-- Gera 5 sugestões de API keys únicas
SELECT 'api-' || substr(md5(random()::text), 1, 16) as api_key_sugerida
FROM generate_series(1, 5);
```

### Ver todas as empresas

```sql
SELECT
    name as empresa,
    email,
    api_key,
    created_at::date as cadastrada_em
FROM companies
ORDER BY created_at DESC;
```

---

## 📊 ESTRUTURA DO SISTEMA

### Tabela: companies

```sql
CREATE TABLE companies (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  email text NOT NULL UNIQUE,      ← Bloqueia emails duplicados
  phone_number text NOT NULL,
  api_key text NOT NULL UNIQUE,    ← Bloqueia API keys duplicadas
  user_id uuid REFERENCES auth.users(id),
  is_super_admin boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  ...
);
```

### Tabela: super_admins

```sql
CREATE TABLE super_admins (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id)
);
```

---

## 🚨 MENSAGENS DE ERRO POSSÍVEIS

| Erro | Causa | Solução |
|------|-------|---------|
| "Email já está em uso por outra empresa" | Email duplicado | Use outro email |
| "API Key já está em uso por outra empresa" | API Key duplicada | Use outra API key |
| "Já existe uma empresa com estes dados" | Chave duplicada (email ou API key) | Verifique ambos |
| "User is not a super admin" | Usuário não autorizado | Adicione na tabela super_admins |
| "Preencha todos os campos" | Campos vazios | Complete o formulário |
| "Telefone deve ter pelo menos 10 dígitos" | Telefone inválido | Use formato completo |
| "Senha deve ter no mínimo 6 caracteres" | Senha curta | Senha com 6+ caracteres |

---

## 🎓 ENTENDENDO O FLUXO

```
┌─────────────────────────────────────────────────┐
│ 1. Super Admin faz login                        │
│    ✅ nexla@nexla.com.br (Super Admin)          │
└─────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────┐
│ 2. Preenche formulário de criação               │
│    Email: nexla@nexla.com.br                    │
│    Nome: Nova Empresa                           │
│    API Key: api-nova-001                        │
└─────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────┐
│ 3. Frontend valida campos                       │
│    ✅ Todos os campos preenchidos               │
│    ✅ Telefone válido                           │
│    ✅ Senha válida                              │
└─────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────┐
│ 4. Frontend verifica super admin                │
│    ✅ User está na tabela super_admins          │
└─────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────┐
│ 5. Chama Edge Function create-company           │
│    Com token JWT do usuário                     │
└─────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────┐
│ 6. Backend verifica autorização                 │
│    ✅ Token válido                              │
│    ✅ User é super admin                        │
└─────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────┐
│ 7. Backend valida campos                        │
│    ✅ Campos obrigatórios OK                    │
│    ✅ Telefone válido                           │
└─────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────┐
│ 8. Backend verifica API Key duplicada           │
│    ✅ api-nova-001 não existe                   │
└─────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────┐
│ 9. Backend verifica Email duplicado             │
│    ❌ nexla@nexla.com.br JÁ EXISTE!             │
│    → BLOQUEIA OPERAÇÃO                          │
│    → Retorna erro 400                           │
└─────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────┐
│ 10. Frontend exibe erro                         │
│     "Este email já está cadastrado no sistema." │
└─────────────────────────────────────────────────┘
```

---

## 💡 DICAS IMPORTANTES

### 1. Sempre verifique emails antes de criar
```sql
SELECT email FROM companies;
```

### 2. Use emails descritivos
```
✅ BOM: minha-empresa-teste@exemplo.com
❌ RUIM: teste@teste.com (genérico demais)
```

### 3. API Keys devem ser únicas
```
✅ BOM: api-minha-empresa-001
❌ RUIM: 123456 (muito simples)
```

### 4. Telefone com DDD
```
✅ BOM: 11999998888 (11 dígitos)
❌ RUIM: 999998888 (9 dígitos - falta DDD)
```

### 5. Senha segura
```
✅ BOM: senhaSegura123
❌ RUIM: 123 (menos de 6 caracteres)
```

---

## 📝 CHECKLIST ANTES DE CRIAR EMPRESA

- [ ] Email é único? (não existe em `companies`)
- [ ] API Key é única? (não existe em `companies`)
- [ ] Telefone tem 10+ dígitos?
- [ ] Senha tem 6+ caracteres?
- [ ] Todos os campos estão preenchidos?
- [ ] Você está logado como super admin?

Se todas as respostas forem SIM → ✅ Pode criar!

---

## 🔍 DEBUGGING

### Se ainda tiver erro, verifique:

1. **Console do navegador:**
   ```javascript
   // Procure por:
   console.log("Response.data:", ...)
   console.error("Error details from data:", ...)
   ```

2. **SQL no Supabase:**
   ```sql
   -- Verificar super admins
   SELECT * FROM super_admins WHERE user_id = auth.uid();

   -- Verificar empresas
   SELECT * FROM companies ORDER BY created_at DESC LIMIT 10;
   ```

3. **Logs da Edge Function:**
   - Acesse Supabase Dashboard
   - Functions → create-company → Logs
   - Procure por erros específicos

---

## 📚 ARQUIVOS DE REFERÊNCIA

1. **SOLUCAO_ERRO_REGISTRO_EMPRESA.md** - Explicação detalhada do problema
2. **VERIFICAR_EMAILS_DISPONIVEIS.sql** - Scripts SQL para verificar disponibilidade
3. **ANALISE_ERRO_DETALHADA.md** - Análise técnica completa
4. **CORRECOES_AUTORIZACAO.md** - Documentação de autorização

---

## ✅ RESUMO EXECUTIVO

**O que está acontecendo:**
- Sistema está funcionando PERFEITAMENTE
- Validação de email duplicado está CORRETA
- Você está tentando usar um email já cadastrado

**Solução:**
1. Use um email diferente
2. Verifique disponibilidade com SQL
3. Preencha formulário com dados únicos
4. Sucesso! ✅

**Não é necessário:**
- ❌ Alterar código
- ❌ Modificar banco de dados
- ❌ Ajustar permissões
- ❌ Reinstalar sistema

**É necessário apenas:**
- ✅ Usar email único
- ✅ Usar API key única

---

## 🎉 TESTE RÁPIDO

Execute este comando no SQL Editor:

```sql
-- 1. Ver emails em uso
SELECT email FROM companies;

-- 2. Usar um email que NÃO apareceu na lista acima
-- Exemplo: teste-final-empresa@exemplo.com

-- 3. Preencher formulário no frontend

-- 4. Verificar sucesso
SELECT * FROM companies WHERE email = 'teste-final-empresa@exemplo.com';
```

**Se aparecer uma linha no passo 4 → ✅ SUCESSO!**

---

**Última atualização:** 2026-02-21
**Status do Sistema:** ✅ Funcionando perfeitamente
**Ação necessária:** Usar email único
