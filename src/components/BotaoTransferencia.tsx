import { useMemo, useState } from 'react';
import { useTransferencia } from '../hooks/useTransferencia';
import { supabase } from '../lib/supabase';

interface BotaoTransferenciaProps {
  /** Número do contato (pode vir como number ou string). */
  numeroContato: number | string;
  nomeContato: string;
  departamentoAtual: string;
  /** Lista de departamentos (apenas nomes) - modo legado */
  departamentos: string[];
  apiKey: string;

  /**
   * (Recomendado) IDs reais para gravar no banco.
   * Se estes campos existirem, o botão usa RPC `transfer_contact_department`
   * para atualizar `contacts.department_id` e inserir em `transferencias`.
   */
  companyId?: string;
  contactId?: string;
  departamentoAtualId?: string | null;
  departamentosMeta?: Array<{ id: string; name: string }>;

  onSucesso?: () => void;
}

export function BotaoTransferencia({
  numeroContato,
  nomeContato,
  departamentoAtual,
  departamentos,
  apiKey,
  companyId,
  contactId,
  departamentoAtualId,
  departamentosMeta,
  onSucesso
}: BotaoTransferenciaProps) {
  const [mostraOpcoes, setMostraOpcoes] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const { adicionarTransferencia } = useTransferencia(apiKey);

  const numeroNormalizado = useMemo(() => String(numeroContato ?? '').replace(/\D/g, ''), [numeroContato]);
  const podeUsarRpc = Boolean(companyId && contactId && departamentosMeta?.length);

  const handleTransferir = async (departamentoDestino: string) => {
    // Validações
    if (!apiKey || apiKey.trim() === '') {
      alert('❌ Erro: API Key não foi configurada!');
      console.error('API Key vazia:', apiKey);
      return;
    }

    if (!numeroNormalizado) {
      alert('❌ Erro: Número do contato inválido!');
      return;
    }

    if (!nomeContato || nomeContato.trim() === '') {
      alert('❌ Erro: Nome do contato inválido!');
      return;
    }

    if (!departamentoAtual || departamentoAtual.trim() === '') {
      alert('❌ Erro: Departamento atual não definido!');
      return;
    }

    if (departamentoDestino === departamentoAtual) {
      alert('⚠️ Selecione um departamento diferente!');
      return;
    }

    if (!departamentoDestino || departamentoDestino.trim() === '') {
      alert('❌ Erro: Departamento de destino inválido!');
      return;
    }

    setCarregando(true);

    try {
      // ✅ Caminho recomendado: usa IDs reais e faz tudo em 1 chamada (update + insert)
      if (podeUsarRpc) {
        const deptDestino = departamentosMeta!.find((d) => d.name === departamentoDestino);
        if (!deptDestino?.id) {
          alert('❌ Erro: não consegui resolver o ID do departamento de destino.');
          console.error('departamentosMeta sem match para:', departamentoDestino, departamentosMeta);
          return;
        }

        console.log('🔄 Transferência (RPC):', {
          companyId,
          contactId,
          fromDepartmentId: departamentoAtualId ?? null,
          toDepartmentId: deptDestino.id,
          numero: numeroNormalizado,
        });

        const { error } = await supabase.rpc('transfer_contact_department', {
          p_company_id: companyId,
          p_contact_id: contactId,
          p_to_department_id: deptDestino.id,
        });

        if (error) {
          console.error('❌ RPC transfer_contact_department falhou:', error);
          alert(`❌ Erro ao transferir (RPC): ${error.message}`);
          return;
        }

        setMostraOpcoes(false);
        alert(`✅ Contato #${numeroNormalizado} transferido com sucesso para ${departamentoDestino}!`);
        onSucesso?.();
        return;
      }

      // 🧩 Caminho legado: mantém seu hook (pode ser RPC antiga). Pelo menos agora loga e não quebra.
      const dados = {
        api_key: apiKey,
        numero_contato: numeroNormalizado,
        nome_contato: nomeContato,
        departamento_origem: departamentoAtual,
        departamento_destino: departamentoDestino,
      };

      console.log('🔄 Enviando transferência (legado):', dados);
      const resultado = await adicionarTransferencia(dados as any);
      console.log('📨 Resposta (legado):', resultado);

      if ((resultado as any)?.sucesso) {
        setMostraOpcoes(false);
        alert(`✅ Contato #${numeroNormalizado} transferido com sucesso para ${departamentoDestino}!`);
        onSucesso?.();
      } else {
        console.error('❌ Erro completo (legado):', resultado);
        alert(`❌ Erro ao transferir: ${(resultado as any)?.erro || 'desconhecido'}\n\nAbra o console (F12) para mais detalhes.`);
      }
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setMostraOpcoes(!mostraOpcoes)}
        disabled={carregando}
        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:bg-gray-400"
      >
        📤 Transferir
      </button>

      {mostraOpcoes && (
        <div className="absolute top-full left-0 mt-2 bg-white border border-gray-300 rounded-lg shadow-lg z-10 min-w-56">
          <div className="p-3 border-b border-gray-200 bg-gray-50">
            <p className="text-sm font-semibold text-gray-700">
              Contato: <strong>#{numeroContato}</strong> - {nomeContato}
            </p>
            <p className="text-xs text-gray-600 mt-1">Departamento atual: {departamentoAtual}</p>
          </div>

          <div className="max-h-60 overflow-y-auto">
            {departamentos.length === 0 ? (
              <div className="px-4 py-3 text-xs text-gray-500">Nenhum departamento disponível</div>
            ) : (
              departamentos
                .filter((d) => d !== departamentoAtual)
                .map((dept) => (
                  <button
                    key={dept}
                    onClick={() => {
                      console.log('🖱️ Clique em dept destino:', dept);
                      handleTransferir(dept);
                    }}
                    disabled={carregando}
                    className="w-full text-left px-4 py-2 hover:bg-blue-50 transition text-sm text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    → {dept}
                  </button>
                ))
            )}
          </div>

          <button
            onClick={() => setMostraOpcoes(false)}
            className="w-full px-4 py-2 border-t border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition"
          >
            Cancelar
          </button>
        </div>
      )}
    </div>
  );
}

export default BotaoTransferencia;
