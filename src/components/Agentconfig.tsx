import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Loader2, Bot, Save } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface AgentConfig {
  id: string;
  company_id: string;
  agent_name: string;
  company_description: string;
  tone: string;
  instructions: string;
  restrictions: string;
  fallback_message: string;
  attendance_modes: string[];
  created_at: string;
  updated_at: string;
}

const TONE_OPTIONS = [
  { value: 'formal',     label: '🎩 Formal',     desc: 'Profissional e técnico' },
  { value: 'amigavel',   label: '😊 Amigável',   desc: 'Leve e próximo' },
  { value: 'direto',     label: '⚡ Direto',     desc: 'Curto e objetivo' },
  { value: 'consultivo', label: '🧠 Consultivo', desc: 'Orienta e pergunta' },
];

const ATTENDANCE_MODES = [
  { value: 'whatsapp',   label: 'WhatsApp' },
  { value: 'chat',       label: 'Chat' },
  { value: 'email',      label: 'E-mail' },
  { value: 'phone',      label: 'Telefone' },
  { value: 'presencial', label: 'Presencial' },
];

const EMPTY_FORM = {
  agent_name: '',
  company_description: '',
  tone: 'amigavel',
  instructions: '',
  restrictions: '',
  fallback_message: '',
  attendance_modes: [] as string[],
};

export default function AgentConfig() {
  const { company } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [existingId, setExistingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ ...EMPTY_FORM });

  useEffect(() => {
    fetchAgent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company?.id]);

  const fetchAgent = async () => {
    if (!company?.id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('agent_configs')
        .select('*')
        .eq('company_id', company.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setExistingId(data.id);
        setFormData({
          agent_name:          data.agent_name          || '',
          company_description: data.company_description || '',
          tone:                data.tone                || 'amigavel',
          instructions:        data.instructions        || '',
          restrictions:        data.restrictions        || '',
          fallback_message:    data.fallback_message    || '',
          attendance_modes:    data.attendance_modes    || [],
        });
      }
    } catch (err) {
      console.error('Erro ao carregar agente:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = (value: string) => {
    setFormData((prev) => ({
      ...prev,
      attendance_modes: prev.attendance_modes.includes(value)
        ? prev.attendance_modes.filter((m) => m !== value)
        : [...prev.attendance_modes, value],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company?.id) return;
    if (!formData.agent_name.trim() || !formData.instructions.trim()) {
      alert('Preencha pelo menos o nome do agente e as instruções.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        agent_name:          formData.agent_name.trim(),
        company_description: formData.company_description.trim(),
        tone:                formData.tone,
        instructions:        formData.instructions.trim(),
        restrictions:        formData.restrictions.trim(),
        fallback_message:    formData.fallback_message.trim(),
        attendance_modes:    formData.attendance_modes,
        updated_at:          new Date().toISOString(),
      };

      if (existingId) {
        const { error } = await supabase
          .from('agent_configs')
          .update(payload)
          .eq('id', existingId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('agent_configs')
          .insert([{ company_id: company.id, ...payload }])
          .select()
          .single();
        if (error) throw error;
        setExistingId(data.id);
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: any) {
      console.error('Erro ao salvar agente:', err);
      alert(err?.message || 'Erro ao salvar. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 animate-in fade-in duration-300 max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Configuração do Agente IA</h2>
        <p className="text-sm text-gray-500 dark:text-slate-300 mt-1">
          Configure como o agente deve se apresentar, responder e se comportar nos atendimentos
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="space-y-5">

          {/* ── IDENTIDADE ─────────────────────────────────── */}
          <div className="bg-white/70 dark:bg-slate-900 backdrop-blur-xl border border-gray-200/50 dark:border-slate-600 rounded-2xl p-6 shadow-md">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-md">
                <Bot className="w-4 h-4 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">Identidade do Agente</h3>
                <p className="text-xs text-gray-400 dark:text-slate-400">Como o agente se apresenta ao cliente</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-2">
                  Nome do Agente <span className="text-red-400">*</span>
                  <span className="ml-2 text-xs text-gray-400 font-normal">Como o agente se chama nas conversas</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.agent_name}
                  onChange={(e) => setFormData({ ...formData, agent_name: e.target.value })}
                  placeholder="Ex: Sofia, Max, Assistente Nexla"
                  className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 dark:text-white border border-gray-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-2">
                  Sobre a Empresa
                  <span className="ml-2 text-xs text-gray-400 font-normal">O que o agente sabe sobre o seu negócio</span>
                </label>
                <textarea
                  rows={3}
                  value={formData.company_description}
                  onChange={(e) => setFormData({ ...formData, company_description: e.target.value })}
                  placeholder="Ex: Somos uma loja de roupas femininas focada em moda sustentável, com atendimento de segunda a sábado das 9h às 18h..."
                  className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 dark:text-white border border-gray-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 transition-all resize-none"
                />
              </div>
            </div>
          </div>

          {/* ── TOM DE VOZ ─────────────────────────────────── */}
          <div className="bg-white/70 dark:bg-slate-900 backdrop-blur-xl border border-gray-200/50 dark:border-slate-600 rounded-2xl p-6 shadow-md">
            <div className="mb-4">
              <h3 className="font-semibold text-gray-900 dark:text-white">Tom de Voz</h3>
              <p className="text-xs text-gray-400 dark:text-slate-400 mt-0.5">Como o agente deve escrever e se comunicar</p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {TONE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setFormData({ ...formData, tone: opt.value })}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    formData.tone === opt.value
                      ? 'bg-blue-50 dark:bg-blue-500/20 border-blue-400 ring-2 ring-blue-400 ring-offset-1 dark:ring-offset-slate-900'
                      : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-600 hover:border-blue-300'
                  }`}
                >
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">{opt.label}</p>
                  <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">{opt.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* ── INSTRUÇÕES ─────────────────────────────────── */}
          <div className="bg-white/70 dark:bg-slate-900 backdrop-blur-xl border border-gray-200/50 dark:border-slate-600 rounded-2xl p-6 shadow-md">
            <div className="mb-4">
              <h3 className="font-semibold text-gray-900 dark:text-white">Instruções de Atendimento</h3>
              <p className="text-xs text-gray-400 dark:text-slate-400 mt-0.5">O que o agente deve fazer e como deve agir</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-2">
                  O que o agente deve fazer <span className="text-red-400">*</span>
                </label>
                <textarea
                  required
                  rows={4}
                  value={formData.instructions}
                  onChange={(e) => setFormData({ ...formData, instructions: e.target.value })}
                  placeholder="Ex: Receber o cliente com boas-vindas, identificar o motivo do contato, responder dúvidas sobre produtos e preços, registrar reclamações e encaminhar para o setor responsável, sempre perguntar se pode ajudar em mais alguma coisa antes de encerrar..."
                  className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 dark:text-white border border-gray-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 transition-all resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-2">
                  O que o agente NÃO deve fazer
                  <span className="ml-2 text-xs text-gray-400 font-normal">Restrições e limites do agente</span>
                </label>
                <textarea
                  rows={3}
                  value={formData.restrictions}
                  onChange={(e) => setFormData({ ...formData, restrictions: e.target.value })}
                  placeholder="Ex: Não informar preços sem antes confirmar disponibilidade, não prometer prazos de entrega, não discutir assuntos fora do contexto da empresa, não ofender ou rebater o cliente mesmo em situações de conflito..."
                  className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 dark:text-white border border-gray-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 transition-all resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-2">
                  Mensagem quando não souber responder
                  <span className="ml-2 text-xs text-gray-400 font-normal">Fallback para perguntas fora do escopo</span>
                </label>
                <input
                  type="text"
                  value={formData.fallback_message}
                  onChange={(e) => setFormData({ ...formData, fallback_message: e.target.value })}
                  placeholder="Ex: Não tenho essa informação no momento, mas vou acionar um atendente para te ajudar!"
                  className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 dark:text-white border border-gray-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 transition-all"
                />
              </div>
            </div>
          </div>

          {/* ── CANAIS ─────────────────────────────────────── */}
          <div className="bg-white/70 dark:bg-slate-900 backdrop-blur-xl border border-gray-200/50 dark:border-slate-600 rounded-2xl p-6 shadow-md">
            <div className="mb-4">
              <h3 className="font-semibold text-gray-900 dark:text-white">Canais de Atendimento</h3>
              <p className="text-xs text-gray-400 dark:text-slate-400 mt-0.5">Onde este agente vai atuar</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {ATTENDANCE_MODES.map((mode) => {
                const active = formData.attendance_modes.includes(mode.value);
                return (
                  <button
                    key={mode.value}
                    type="button"
                    onClick={() => toggleMode(mode.value)}
                    className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all ${
                      active
                        ? 'bg-blue-500 border-blue-500 text-white shadow-md scale-105'
                        : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-300 hover:border-blue-300'
                    }`}
                  >
                    {mode.label}
                  </button>
                );
              })}
            </div>
          </div>

        </div>

        {/* Botão salvar */}
        <div className="mt-6 flex items-center gap-4">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-br from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-xl transition-all disabled:opacity-50 shadow-md font-medium"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                {existingId ? 'Salvar Alterações' : 'Criar Agente'}
              </>
            )}
          </button>

          {saved && (
            <span className="text-sm text-green-600 dark:text-green-400 font-medium animate-in fade-in duration-300">
              ✓ Salvo com sucesso!
            </span>
          )}
        </div>
      </form>
    </div>
  );
}