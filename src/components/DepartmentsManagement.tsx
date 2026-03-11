import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, Trash2, Edit2, X, Loader2, Bot, ChevronDown, ChevronUp } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import Modal from './Modal';

interface AgentConfig {
  id: string;
  company_id: string;
  name: string;
  role: string;
  instructions: string;
  attendance_modes: string[];
  behavior: string;
  created_at: string;
  updated_at: string;
}

const ATTENDANCE_MODES = [
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'chat', label: 'Chat' },
  { value: 'email', label: 'E-mail' },
  { value: 'phone', label: 'Telefone' },
  { value: 'presencial', label: 'Presencial' },
];

const BEHAVIOR_OPTIONS = [
  { value: 'formal', label: '🎩 Formal', desc: 'Linguagem profissional e técnica' },
  { value: 'amigavel', label: '😊 Amigável', desc: 'Tom leve e próximo ao cliente' },
  { value: 'direto', label: '⚡ Direto', desc: 'Respostas curtas e objetivas' },
  { value: 'consultivo', label: '🧠 Consultivo', desc: 'Faz perguntas e orienta o cliente' },
];

const EMPTY_FORM = {
  name: '',
  role: '',
  instructions: '',
  attendance_modes: [] as string[],
  behavior: 'amigavel',
};

export default function AgentConfig() {
  const { company } = useAuth();
  const [agents, setAgents] = useState<AgentConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; agent: AgentConfig | null }>({
    isOpen: false,
    agent: null,
  });
  const [deleting, setDeleting] = useState(false);
  const [formData, setFormData] = useState({ ...EMPTY_FORM });

  useEffect(() => {
    fetchAgents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company?.id]);

  const fetchAgents = async () => {
    if (!company?.id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('agent_configs')
        .select('*')
        .eq('company_id', company.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAgents(data || []);
    } catch (err) {
      console.error('Erro ao carregar agentes:', err);
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
    if (!formData.name.trim() || !formData.role.trim() || !formData.instructions.trim()) {
      alert('Preencha todos os campos obrigatórios.');
      return;
    }

    setSaving(true);
    try {
      if (editingId) {
        const { error } = await supabase
          .from('agent_configs')
          .update({
            name: formData.name.trim(),
            role: formData.role.trim(),
            instructions: formData.instructions.trim(),
            attendance_modes: formData.attendance_modes,
            behavior: formData.behavior,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingId);

        if (error) throw error;
      } else {
        const { error } = await supabase.from('agent_configs').insert([
          {
            company_id: company.id,
            name: formData.name.trim(),
            role: formData.role.trim(),
            instructions: formData.instructions.trim(),
            attendance_modes: formData.attendance_modes,
            behavior: formData.behavior,
          },
        ]);

        if (error) throw error;
      }

      setFormData({ ...EMPTY_FORM });
      setShowForm(false);
      setEditingId(null);
      fetchAgents();
    } catch (err: any) {
      console.error('Erro ao salvar agente:', err);
      alert(err?.message || 'Erro ao salvar agente.');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (agent: AgentConfig) => {
    setFormData({
      name: agent.name,
      role: agent.role,
      instructions: agent.instructions,
      attendance_modes: agent.attendance_modes || [],
      behavior: agent.behavior || 'amigavel',
    });
    setEditingId(agent.id);
    setShowForm(true);
    setExpandedId(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancel = () => {
    setFormData({ ...EMPTY_FORM });
    setShowForm(false);
    setEditingId(null);
  };

  const handleDelete = (agent: AgentConfig) => {
    setDeleteModal({ isOpen: true, agent });
  };

  const confirmDelete = async () => {
    if (!deleteModal.agent) return;
    setDeleting(true);
    try {
      const { error } = await supabase
        .from('agent_configs')
        .delete()
        .eq('id', deleteModal.agent.id);

      if (error) throw error;
      setDeleteModal({ isOpen: false, agent: null });
      fetchAgents();
    } catch (err: any) {
      console.error('Erro ao excluir agente:', err);
      alert(err?.message || 'Erro ao excluir agente.');
    } finally {
      setDeleting(false);
    }
  };

  const getBehaviorLabel = (value: string) =>
    BEHAVIOR_OPTIONS.find((b) => b.value === value)?.label || value;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Configuração do Agente</h2>
          <p className="text-sm text-gray-500 dark:text-slate-300 mt-1">
            Defina o comportamento, instruções e formas de atendimento do agente IA
          </p>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-xl hover:scale-105 transition-all shadow-md"
          >
            <Plus className="w-5 h-5" />
            Novo Agente
          </button>
        )}
      </div>

      {/* Formulário */}
      {showForm && (
        <div className="bg-white/70 dark:bg-slate-900 backdrop-blur-xl border border-gray-200/50 dark:border-slate-600 rounded-2xl p-6 mb-6 shadow-md">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {editingId ? 'Editar Agente' : 'Novo Agente'}
            </h3>
            <button
              onClick={handleCancel}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Nome */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-2">
                Nome do Agente *
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ex: Assistente de Vendas, Suporte Técnico"
                className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 dark:text-white border border-gray-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 transition-all"
              />
            </div>

            {/* Função / Papel */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-2">
                Função / Papel *
              </label>
              <input
                type="text"
                required
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                placeholder="Ex: Atendente de suporte ao cliente, Consultor de vendas"
                className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 dark:text-white border border-gray-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 transition-all"
              />
            </div>

            {/* Instruções */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-2">
                O que ele deve fazer *
                <span className="ml-2 text-xs text-gray-400 font-normal">
                  Descreva as instruções e responsabilidades do agente
                </span>
              </label>
              <textarea
                required
                rows={4}
                value={formData.instructions}
                onChange={(e) => setFormData({ ...formData, instructions: e.target.value })}
                placeholder="Ex: Responder dúvidas sobre produtos, registrar reclamações, encaminhar para o setor responsável quando necessário..."
                className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 dark:text-white border border-gray-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 transition-all resize-none"
              />
            </div>

            {/* Formas de atendimento */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-3">
                Formas de Atendimento
              </label>
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

            {/* Comportamento */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-3">
                Como ele deve se comportar *
              </label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {BEHAVIOR_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setFormData({ ...formData, behavior: opt.value })}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      formData.behavior === opt.value
                        ? 'bg-blue-50 dark:bg-blue-500/20 border-blue-400 ring-2 ring-blue-400 ring-offset-1'
                        : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-600 hover:border-blue-300'
                    }`}
                  >
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">{opt.label}</p>
                    <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">{opt.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Botões */}
            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="flex-1 px-4 py-2.5 bg-gradient-to-br from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-xl transition-all disabled:opacity-50 shadow-md font-medium"
              >
                {saving ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Salvando...
                  </span>
                ) : editingId ? (
                  'Atualizar Agente'
                ) : (
                  'Criar Agente'
                )}
              </button>
              <button
                type="button"
                onClick={handleCancel}
                className="px-4 py-2.5 bg-gray-100 dark:bg-slate-700 dark:text-white text-gray-700 rounded-xl hover:bg-gray-200 dark:hover:bg-slate-600 transition-all font-medium"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Lista vazia */}
      {agents.length === 0 ? (
        <div className="bg-white/70 dark:bg-slate-900 backdrop-blur-xl border border-gray-200/50 dark:border-slate-600 rounded-2xl p-12 text-center shadow-md">
          <div className="w-20 h-20 bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-900/40 dark:to-blue-800/40 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Bot className="w-10 h-10 text-blue-500" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Nenhum agente configurado
          </h3>
          <p className="text-sm text-gray-500 dark:text-slate-300">
            Comece criando o primeiro agente para o seu atendimento
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {agents.map((agent) => {
            const isExpanded = expandedId === agent.id;
            return (
              <div
                key={agent.id}
                className="bg-white/70 dark:bg-slate-900 backdrop-blur-xl border border-gray-200/50 dark:border-slate-600 rounded-2xl p-6 shadow-md hover:shadow-lg transition-all group hover:-translate-y-1"
              >
                {/* Topo: ícone + ações */}
                <div className="flex justify-between items-start mb-4">
                  <div className="w-14 h-14 bg-gradient-to-br from-blue-400 to-blue-600 rounded-xl flex items-center justify-center shadow-md">
                    <Bot className="w-7 h-7 text-white" />
                  </div>
                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleEdit(agent)}
                      className="p-2 text-gray-400 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/20 rounded-lg transition-all"
                      title="Editar"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(agent)}
                      className="p-2 text-gray-400 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/20 rounded-lg transition-all"
                      title="Excluir"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Nome */}
                <h3 className="font-bold text-gray-900 dark:text-white truncate">{agent.name}</h3>

                {/* Função */}
                <p className="text-sm text-blue-600 dark:text-blue-400 font-medium mt-1 truncate">
                  {agent.role}
                </p>

                {/* Comportamento */}
                <div className="mt-3">
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300">
                    {getBehaviorLabel(agent.behavior)}
                  </span>
                </div>

                {/* Formas de atendimento */}
                {agent.attendance_modes?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {agent.attendance_modes.map((m) => (
                      <span
                        key={m}
                        className="px-2 py-0.5 rounded-lg text-xs bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300"
                      >
                        {ATTENDANCE_MODES.find((a) => a.value === m)?.label || m}
                      </span>
                    ))}
                  </div>
                )}

                {/* Instruções expansíveis */}
                <div className="mt-4 border-t border-gray-100 dark:border-slate-700 pt-3">
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : agent.id)}
                    className="flex items-center gap-1 text-xs text-gray-500 dark:text-slate-400 hover:text-blue-500 transition-colors w-full"
                  >
                    {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    {isExpanded ? 'Ocultar instruções' : 'Ver instruções'}
                  </button>
                  {isExpanded && (
                    <p className="mt-2 text-sm text-gray-600 dark:text-slate-300 whitespace-pre-wrap">
                      {agent.instructions}
                    </p>
                  )}
                </div>

                {/* Data */}
                <p className="text-xs text-gray-400 dark:text-slate-500 mt-3">
                  Criado em {new Date(agent.created_at).toLocaleDateString('pt-BR')}
                </p>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de exclusão */}
      <Modal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, agent: null })}
        onConfirm={confirmDelete}
        title="Excluir Agente"
        message={`Tem certeza que deseja excluir o agente "${deleteModal.agent?.name}"?\n\nTodas as instruções e configurações serão removidas permanentemente. Esta ação não pode ser desfeita.`}
        confirmText="Excluir"
        cancelText="Cancelar"
        confirmColor="red"
        loading={deleting}
      />
    </div>
  );
}