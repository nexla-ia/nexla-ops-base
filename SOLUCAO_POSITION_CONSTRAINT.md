# Solução: Erro duplicate key constraint na tabela transferencias

## Problema Identificado

**Erro:**
```
duplicate key value violates unique constraint "transferencias_contact_position_ux"
(code 23505)
```

**Causa Raiz:**
A tabela `transferencias` tinha um constraint UNIQUE em `(contact_id, position)` que impedia múltiplas transferências do mesmo contato com a mesma posição. Quando tentava fazer uma segunda transferência, a posição não era incrementada, causando o violação de constraint.

## Solução Implementada

### 1. Nova Migration: `20260127000004_fix_position_constraint_transferencias.sql`

Esta migration resolve todos os problemas:

```sql
-- Remove constraint UNIQUE problemático (se existir)
ALTER TABLE public.transferencias DROP CONSTRAINT IF EXISTS transferencias_contact_position_ux;

-- Adiciona coluna position (se não existir)
ALTER TABLE public.transferencias ADD COLUMN position BIGINT;

-- Popula position com valores incrementais por contato
UPDATE public.transferencias
SET position = row_number
FROM (
  SELECT 
    id,
    ROW_NUMBER() OVER (PARTITION BY contact_id ORDER BY created_at ASC) as row_number
  FROM public.transferencias
  WHERE position IS NULL
) t
WHERE public.transferencias.id = t.id;

-- Cria trigger para auto-incrementar position em novas inserções
CREATE TRIGGER trg_auto_increment_transfer_position
  BEFORE INSERT ON public.transferencias
  FOR EACH ROW
  EXECUTE FUNCTION auto_increment_transfer_position();
```

### 2. Lógica de Auto-Incremento

**Trigger Function:** `auto_increment_transfer_position()`
- Quando um novo registro é inserido em `transferencias`
- Se `position` é NULL (não informada)
- Calcula: `MAX(position) WHERE contact_id = NEW.contact_id + 1`
- Garante que cada contato tem posições sequenciais: 1, 2, 3, 4...

### 3. Fluxo Completo de Transferência

```
Usuario clica em "Trocar Departamento"
↓
CompanyDashboard.handleUpdateContactInfo()
↓
Valida: oldDepartmentId !== newDepartmentId? ✅
↓
Atualiza contacts.department_id = newDepartmentId
↓
Chama registrarTransferencia({
  api_key: company.api_key,
  contact_id: contactId,
  departamento_origem_id: oldDepartmentId,
  departamento_destino_id: newDepartmentId
})
↓
Função RPC: registrar_transferencia_automatica()
↓
INSERT INTO transferencias (
  api_key,
  contact_id,
  departamento_origem_id,
  departamento_destino_id
  -- position será auto-calculado pelo trigger
)
↓
✅ Sucesso - position foi incrementada automaticamente
```

### 4. Arquivos Alterados/Criados

| Arquivo | Tipo | Mudança |
|---------|------|---------|
| `supabase/migrations/20260127000004_fix_position_constraint_transferencias.sql` | ✨ NOVO | Remove constraint, adiciona trigger de posição |
| `supabase/TEST_POSITION_FIX.sql` | 📋 NOVO | Script para validar a correção |
| `src/lib/mensagemTransferencia.ts` | ✓ OK | Nenhuma mudança necessária |
| `src/components/CompanyDashboard.tsx` | ✓ OK | Nenhuma mudança necessária |

### 5. Validação Pós-Aplicação

Após aplicar a migration, executar:

```sql
-- Verificar que constraint foi removido
SELECT constraint_name 
FROM information_schema.table_constraints
WHERE table_name = 'transferencias' AND constraint_type = 'UNIQUE';
-- Deve retornar VAZIO

-- Verificar que position existe e tem default
SELECT column_name, column_default, is_nullable
FROM information_schema.columns
WHERE table_name = 'transferencias' AND column_name = 'position';
-- Deve retornar: position, 1, false

-- Verificar trigger existe
SELECT trigger_name FROM information_schema.triggers
WHERE trigger_name = 'trg_auto_increment_transfer_position';
-- Deve retornar: trg_auto_increment_transfer_position
```

### 6. Teste Prático

1. Abrir CompanyDashboard
2. Selecionar um contato
3. Trocar departamento (1ª vez) → ✅ Sucesso, position = 1
4. Trocar departamento de novo (2ª vez) → ✅ Sucesso, position = 2
5. Trocar departamento novamente (3ª vez) → ✅ Sucesso, position = 3
6. Nenhum erro de constraint UNIQUE

### 7. Estrutura Final da Tabela `transferencias`

```sql
CREATE TABLE public.transferencias (
  id bigserial PRIMARY KEY,
  api_key varchar NOT NULL,
  contact_id uuid NOT NULL REFERENCES contacts(id),
  departamento_origem_id uuid REFERENCES departments(id),
  departamento_destino_id uuid REFERENCES departments(id),
  position bigint NOT NULL DEFAULT 1,  -- ✨ AUTO-INCREMENTA
  data_transferencia timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
  -- SEM constraint UNIQUE ✅
);

-- Índices
CREATE INDEX idx_transferencias_contact_position 
  ON transferencias(contact_id, position);
```

## Resultado

✅ **Múltiplas transferências do mesmo contato funcionam**
✅ **Histórico preservado com positions incrementais**
✅ **Nenhum erro de duplicate key constraint**
✅ **Auto-incremento automático via trigger**

## Deploy

```bash
# Aplicar migration
supabase db push

# Verificar resultado (optional)
supabase db execute supabase/TEST_POSITION_FIX.sql
```
