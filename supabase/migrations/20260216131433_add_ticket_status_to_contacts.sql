/*
  # Adicionar Sistema de Status de Chamados

  1. Alterações
    - Adiciona campos de controle de ticket/chamado na tabela contacts:
      - `ticket_status` (enum): Status do chamado ('aberto', 'em_processo', 'finalizado')
      - `ticket_opened_at` (timestamp): Data/hora de abertura do chamado
      - `ticket_closed_at` (timestamp): Data/hora de finalização do chamado
      - `ticket_closed_by` (uuid): ID do atendente que finalizou o chamado

  2. Observações
    - Status padrão é 'aberto' quando um novo contato é criado
    - ticket_opened_at é preenchido automaticamente na criação
    - ticket_closed_at e ticket_closed_by são preenchidos apenas ao finalizar
*/

-- Criar tipo enum para status de ticket
DO $$ BEGIN
  CREATE TYPE ticket_status_enum AS ENUM ('aberto', 'em_processo', 'finalizado');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Adicionar campos de ticket à tabela contacts
DO $$
BEGIN
  -- ticket_status
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contacts' AND column_name = 'ticket_status'
  ) THEN
    ALTER TABLE contacts ADD COLUMN ticket_status ticket_status_enum DEFAULT 'aberto';
  END IF;

  -- ticket_opened_at
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contacts' AND column_name = 'ticket_opened_at'
  ) THEN
    ALTER TABLE contacts ADD COLUMN ticket_opened_at timestamptz DEFAULT now();
  END IF;

  -- ticket_closed_at
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contacts' AND column_name = 'ticket_closed_at'
  ) THEN
    ALTER TABLE contacts ADD COLUMN ticket_closed_at timestamptz;
  END IF;

  -- ticket_closed_by
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contacts' AND column_name = 'ticket_closed_by'
  ) THEN
    ALTER TABLE contacts ADD COLUMN ticket_closed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Criar índice para consultas de status
CREATE INDEX IF NOT EXISTS idx_contacts_ticket_status ON contacts(ticket_status);
CREATE INDEX IF NOT EXISTS idx_contacts_ticket_opened_at ON contacts(ticket_opened_at DESC);

-- Atualizar contatos existentes (marcar como 'em_processo')
UPDATE contacts
SET ticket_status = 'em_processo',
    ticket_opened_at = COALESCE(created_at, now())
WHERE ticket_status IS NULL;