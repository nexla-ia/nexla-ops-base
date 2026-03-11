import React, { useState } from 'react';
import { useTransferencia } from '../hooks/useTransferencia';
import { formatarMensagemTransferencia } from '../lib/mensagemTransferencia';

interface TransferenciaComponentProps {
  apiKey: string;
  departamentos: string[];
}

export function TransferenciaComponent({ apiKey, departamentos }: TransferenciaComponentProps) {
  const [numeroContato, setNumeroContato] = useState('');
  const [nomeContato, setNomeContato] = useState('');
  const [departamentoOrigem, setDepartamentoOrigem] = useState('');
  const [departamentoDestino, setDepartamentoDestino] = useState('');
  const [carregandoTransferencia, setCarregandoTransferencia] = useState(false);

  const { transferencias, adicionarTransferencia, carregando, erro } = useTransferencia(apiKey);

  const handleTransferencia = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!numeroContato || !nomeContato || !departamentoOrigem || !departamentoDestino) {
      alert('Preencha todos os campos!');
      return;
    }

    setCarregandoTransferencia(true);

    // ✅ Garantir que só envia dígitos
    const numero = Number(String(numeroContato).replace(/\D/g, ''));
    
    if (isNaN(numero) || numero <= 0) {
      alert('❌ Número de contato inválido! Use apenas dígitos.');
      setCarregandoTransferencia(false);
      return;
    }

    const resultado = await adicionarTransferencia({
      api_key: apiKey,
      numero_contato: numero,
      nome_contato: nomeContato,
      departamento_origem: departamentoOrigem,
      departamento_destino: departamentoDestino
    });

    if (resultado.sucesso) {
      // Limpar formulário
      setNumeroContato('');
      setNomeContato('');
      setDepartamentoOrigem('');
      setDepartamentoDestino('');
      alert('✅ Transferência registrada com sucesso!');
    } else {
      // ✅ Mostra erro real do backend
      console.error('Erro na transferência:', resultado.erro);
      alert(`❌ Erro: ${resultado.erro || 'Erro desconhecido'}`);
    }

    setCarregandoTransferencia(false);
  };

  return (
    <div className="p-6 bg-gray-50 rounded-lg">
      <h2 className="text-2xl font-bold mb-6 text-gray-800">📞 Transferência de Contato</h2>

      {/* Formulário de Transferência */}
      <form onSubmit={handleTransferencia} className="bg-white p-6 rounded-lg shadow-md mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Número do Contato
            </label>
            <input
              type="number"
              value={numeroContato}
              onChange={(e) => setNumeroContato(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Ex: 12345"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Nome do Contato
            </label>
            <input
              type="text"
              value={nomeContato}
              onChange={(e) => setNomeContato(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Ex: João Silva"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Departamento de Origem
            </label>
            <select
              value={departamentoOrigem}
              onChange={(e) => setDepartamentoOrigem(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="">Selecione...</option>
              {departamentos.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Departamento de Destino
            </label>
            <select
              value={departamentoDestino}
              onChange={(e) => setDepartamentoDestino(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="">Selecione...</option>
              {departamentos.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
          </div>
        </div>

        <button
          type="submit"
          disabled={carregandoTransferencia}
          className="w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 transition disabled:bg-gray-400"
        >
          {carregandoTransferencia ? 'Processando...' : '📤 Registrar Transferência'}
        </button>
      </form>

      {/* Mensagem de Erro */}
      {erro && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">{erro}</div>}

      {/* Lista de Transferências */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-800">
            📋 Histórico de Transferências {carregando && '(carregando...)'}
          </h3>
        </div>

        {transferencias.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            Nenhuma transferência registrada ainda.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-100 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Contato</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Nome</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">De</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Para</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Data/Hora</th>
                </tr>
              </thead>
              <tbody>
                {transferencias.map((t) => (
                  <tr key={t.id} className="border-b border-gray-200 hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">#{t.numero_contato}</td>
                    <td className="px-6 py-4 text-sm text-gray-700">{t.nome_contato}</td>
                    <td className="px-6 py-4 text-sm text-gray-700">{t.departamento_origem}</td>
                    <td className="px-6 py-4 text-sm text-gray-700">{t.departamento_destino}</td>
                    <td className="px-6 py-4 text-sm text-gray-700">
                      {new Date(t.data_transferencia).toLocaleString('pt-BR')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Amostra de Mensagem */}
      {numeroContato && nomeContato && departamentoOrigem && departamentoDestino && (
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm font-semibold text-gray-700 mb-2">📨 Mensagem de Transferência:</p>
          <pre className="bg-white p-3 rounded text-xs whitespace-pre-wrap text-gray-800">
            {formatarMensagemTransferencia(
              parseInt(numeroContato),
              nomeContato,
              departamentoOrigem,
              departamentoDestino
            )}
          </pre>
        </div>
      )}
    </div>
  );
}
