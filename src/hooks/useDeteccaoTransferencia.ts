import { useCallback } from 'react';
import { registrarTransferencia } from '../lib/mensagemTransferencia';

export interface DeteccaoTransferencia {
  contact_id: string;
  departamento_origem_id: string | null;
  departamento_destino_id: string;
  nome_contato: string;
}

/**
 * Hook para detectar e registrar automaticamente transferências de contato
 * Quando um contato muda de departamento, registra automaticamente na tabela transferencias
 */
export function useDeteccaoTransferencia(apiKey: string) {
  
  /**
   * Detecta mudança de departamento comparando antigo vs novo
   * Se mudou, registra automaticamente na tabela transferencias
   */
  const registrarMudancaDepartamento = useCallback(
    async (
      contact_id: string,
      departamento_antigo_id: string | null,
      departamento_novo_id: string | null,
      nome_contato: string
    ) => {
      try {
        // Se não há mudança, não faz nada
        if (departamento_antigo_id === departamento_novo_id) {
          console.log('ℹ️ [TRANSF] Departamento não mudou, ignorando');
          return { sucesso: true };
        }

        // Se está passando para NULL, também ignora (não é transferência válida)
        if (!departamento_novo_id) {
          console.log('ℹ️ [TRANSF] Novo departamento está vazio, ignorando');
          return { sucesso: true };
        }

        console.log('🔄 [TRANSF] Detectada mudança de departamento!', {
          contato: nome_contato,
          id: contact_id,
          de: departamento_antigo_id || 'Recepção',
          para: departamento_novo_id
        });

        // ✅ Registrar a transferência automaticamente
        const resultado = await registrarTransferencia({
          api_key: apiKey,
          contact_id,
          departamento_origem_id: departamento_antigo_id,  // Pode ser NULL = Recepção
          departamento_destino_id: departamento_novo_id
        });

        if (resultado.sucesso) {
          console.log('✅ [TRANSF] Transferência registrada automaticamente:', resultado.data);
          return resultado;
        } else {
          console.error('❌ [TRANSF] Erro ao registrar transferência:', resultado.erro);
          return resultado;
        }

      } catch (erro) {
        console.error('❌ [TRANSF] Erro exceção ao detectar transferência:', erro);
        return { sucesso: false, erro: String(erro) };
      }
    },
    [apiKey]
  );

  return {
    registrarMudancaDepartamento
  };
}
