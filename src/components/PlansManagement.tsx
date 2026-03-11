import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Check, X, DollarSign, Calendar, Users, UserPlus } from 'lucide-react';
import { supabase } from '../lib/supabase';
import Modal from './Modal';
import Notification from './Notification';

type BillingPeriod = 'monthly' | 'annual';

interface Plan {
  id: string;
  name: string;
  description: string | null;
  price: number;
  billing_period: BillingPeriod;
  max_attendants: number | null;
  max_contacts: number | null;
  features: string[];
  is_active: boolean;
  ai_enabled: boolean;
  created_at: string;
  updated_at: string;
}

interface PlanFormData {
  name: string;
  description: string;
  price: string;
  billing_period: BillingPeriod;
  max_attendants: string;
  max_contacts: string;
  is_active: boolean;
  ai_enabled: boolean;
}

export default function PlansManagement() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; planId: string; planName: string }>({
    isOpen: false,
    planId: '',
    planName: ''
  });
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const [formData, setFormData] = useState<PlanFormData>({
    name: '',
    description: '',
    price: '',
    billing_period: 'monthly',
    max_attendants: '',
    max_contacts: '',
    is_active: true,
    ai_enabled: true
  });

  useEffect(() => {
    loadPlans();
  }, []);

  const loadPlans = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('plans')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPlans(data || []);
    } catch (error) {
      console.error('Error loading plans:', error);
      setNotification({ type: 'error', message: 'Erro ao carregar planos' });
    } finally {
      setLoading(false);
    }
  };

  const openModal = (plan?: Plan) => {
    if (plan) {
      setEditingPlan(plan);
      setFormData({
        name: plan.name,
        description: plan.description || '',
        price: plan.price.toString(),
        billing_period: plan.billing_period,
        max_attendants: plan.max_attendants?.toString() || '',
        max_contacts: plan.max_contacts?.toString() || '',
        is_active: plan.is_active,
        ai_enabled: plan.ai_enabled
      });
    } else {
      setEditingPlan(null);
      setFormData({
        name: '',
        description: '',
        price: '',
        billing_period: 'monthly',
        max_attendants: '',
        max_contacts: '',
        is_active: true,
        ai_enabled: true
      });
    }
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingPlan(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim() || !formData.price) {
      setNotification({ type: 'error', message: 'Nome e preço são obrigatórios' });
      return;
    }

    try {
      setSubmitting(true);

      const planData = {
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        price: parseFloat(formData.price),
        billing_period: formData.billing_period,
        max_attendants: formData.max_attendants ? parseInt(formData.max_attendants) : null,
        max_contacts: formData.max_contacts ? parseInt(formData.max_contacts) : null,
        is_active: formData.is_active,
        ai_enabled: formData.ai_enabled
      };

      if (editingPlan) {
        const { error } = await supabase
          .from('plans')
          .update(planData)
          .eq('id', editingPlan.id);

        if (error) throw error;
        setNotification({ type: 'success', message: 'Plano atualizado com sucesso!' });
      } else {
        const { error } = await supabase
          .from('plans')
          .insert([planData]);

        if (error) throw error;
        setNotification({ type: 'success', message: 'Plano criado com sucesso!' });
      }

      closeModal();
      loadPlans();
    } catch (error) {
      console.error('Error saving plan:', error);
      setNotification({ type: 'error', message: 'Erro ao salvar plano' });
    } finally {
      setSubmitting(false);
    }
  };

  const openDeleteModal = (plan: Plan) => {
    setDeleteModal({
      isOpen: true,
      planId: plan.id,
      planName: plan.name
    });
  };

  const closeDeleteModal = () => {
    setDeleteModal({ isOpen: false, planId: '', planName: '' });
  };

  const handleDelete = async () => {
    try {
      const { error } = await supabase
        .from('plans')
        .delete()
        .eq('id', deleteModal.planId);

      if (error) throw error;

      setNotification({ type: 'success', message: 'Plano deletado com sucesso!' });
      closeDeleteModal();
      loadPlans();
    } catch (error) {
      console.error('Error deleting plan:', error);
      setNotification({ type: 'error', message: 'Erro ao deletar plano' });
    }
  };

  const toggleActive = async (plan: Plan) => {
    try {
      const { error } = await supabase
        .from('plans')
        .update({ is_active: !plan.is_active })
        .eq('id', plan.id);

      if (error) throw error;

      setNotification({
        type: 'success',
        message: `Plano ${!plan.is_active ? 'ativado' : 'desativado'} com sucesso!`
      });
      loadPlans();
    } catch (error) {
      console.error('Error toggling plan status:', error);
      setNotification({ type: 'error', message: 'Erro ao alterar status do plano' });
    }
  };

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="flex-none border-b border-slate-200 bg-white/80 backdrop-blur-sm">
        <div className="flex items-center justify-between px-8 py-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Gestão de Planos</h1>
            <p className="text-slate-600 mt-1">Configure e gerencie os planos de assinatura</p>
          </div>
          <button
            onClick={() => openModal()}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all shadow-lg hover:shadow-xl font-medium"
          >
            <Plus size={20} />
            Adicionar Plano
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-8">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : plans.length === 0 ? (
          <div className="max-w-4xl mx-auto">
            <div className="bg-white rounded-2xl p-12 text-center shadow-lg border border-slate-200">
              <DollarSign size={64} className="mx-auto mb-4 text-slate-300" />
              <h3 className="text-2xl font-bold text-slate-900 mb-2">Nenhum plano cadastrado</h3>
              <p className="text-slate-600 mb-6">Comece criando seu primeiro plano de assinatura</p>
              <button
                onClick={() => openModal()}
                className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all shadow-lg font-medium"
              >
                <Plus size={20} />
                Criar Primeiro Plano
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
            {plans.map((plan) => (
              <div
                key={plan.id}
                className={`bg-white rounded-2xl p-6 shadow-lg border-2 transition-all hover:shadow-xl ${
                  plan.is_active ? 'border-blue-200' : 'border-slate-200 opacity-60'
                }`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-slate-900 mb-1">{plan.name}</h3>
                    <div className="flex items-center gap-2 text-sm">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        plan.is_active
                          ? 'bg-green-100 text-green-700'
                          : 'bg-slate-100 text-slate-600'
                      }`}>
                        {plan.is_active ? 'Ativo' : 'Inativo'}
                      </span>
                      <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                        {plan.billing_period === 'monthly' ? 'Mensal' : 'Anual'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mb-4">
                  <div className="flex items-baseline gap-1 mb-2">
                    <span className="text-3xl font-bold text-slate-900">
                      R$ {plan.price.toFixed(2)}
                    </span>
                    <span className="text-slate-600 text-sm">
                      /{plan.billing_period === 'monthly' ? 'mês' : 'ano'}
                    </span>
                  </div>
                  {plan.description && (
                    <p className="text-sm text-slate-600 line-clamp-2">{plan.description}</p>
                  )}
                </div>

                <div className="space-y-2 mb-4 pb-4 border-b border-slate-200">
                  {plan.max_attendants && (
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <Users size={16} className="text-blue-600" />
                      <span>Até {plan.max_attendants} atendentes</span>
                    </div>
                  )}
                  {plan.max_contacts && (
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <UserPlus size={16} className="text-blue-600" />
                      <span>Até {plan.max_contacts} contatos</span>
                    </div>
                  )}
                  {!plan.max_attendants && !plan.max_contacts && (
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <Check size={16} className="text-green-600" />
                      <span>Recursos ilimitados</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleActive(plan)}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                      plan.is_active
                        ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        : 'bg-green-100 text-green-700 hover:bg-green-200'
                    }`}
                    title={plan.is_active ? 'Desativar' : 'Ativar'}
                  >
                    {plan.is_active ? <X size={16} /> : <Check size={16} />}
                    {plan.is_active ? 'Desativar' : 'Ativar'}
                  </button>
                  <button
                    onClick={() => openModal(plan)}
                    className="p-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-all"
                    title="Editar"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button
                    onClick={() => openDeleteModal(plan)}
                    className="p-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-all"
                    title="Deletar"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200">
              <h2 className="text-2xl font-bold text-slate-900">
                {editingPlan ? 'Editar Plano' : 'Novo Plano'}
              </h2>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Nome do Plano *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                  placeholder="Ex: Plano Básico"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Descrição
                </label>
                <div className="relative">
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all resize-none bg-white shadow-sm hover:border-slate-400 font-medium text-slate-700 placeholder:text-slate-400"
                    placeholder="Descreva os benefícios e recursos inclusos neste plano..."
                    rows={4}
                    maxLength={200}
                  />
                  <div className="absolute bottom-2 right-3 text-xs text-slate-400 font-medium">
                    {formData.description.length}/200
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Preço (R$) *
                  </label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                      className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                      placeholder="0.00"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Periodicidade *
                  </label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <select
                      value={formData.billing_period}
                      onChange={(e) => setFormData({ ...formData, billing_period: e.target.value as BillingPeriod })}
                      className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all appearance-none bg-white"
                      required
                    >
                      <option value="monthly">Mensal</option>
                      <option value="annual">Anual</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Máx. Atendentes
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formData.max_attendants}
                    onChange={(e) => setFormData({ ...formData, max_attendants: e.target.value })}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                    placeholder="Ilimitado"
                  />
                  <p className="text-xs text-slate-500 mt-1">Deixe vazio para ilimitado</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Máx. Contatos
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formData.max_contacts}
                    onChange={(e) => setFormData({ ...formData, max_contacts: e.target.value })}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                    placeholder="Ilimitado"
                  />
                  <p className="text-xs text-slate-500 mt-1">Deixe vazio para ilimitado</p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="is_active"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="w-5 h-5 text-blue-600 border-slate-300 rounded focus:ring-2 focus:ring-blue-500"
                  />
                  <label htmlFor="is_active" className="text-sm font-medium text-slate-700">
                    Plano ativo e disponível para contratação
                  </label>
                </div>

                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="ai_enabled"
                    checked={formData.ai_enabled}
                    onChange={(e) => setFormData({ ...formData, ai_enabled: e.target.checked })}
                    className="w-5 h-5 text-blue-600 border-slate-300 rounded focus:ring-2 focus:ring-blue-500"
                  />
                  <label htmlFor="ai_enabled" className="text-sm font-medium text-slate-700">
                    IA ativada (recursos de inteligência artificial disponíveis)
                  </label>
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 px-4 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-all font-medium"
                  disabled={submitting}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all font-medium disabled:opacity-50"
                >
                  {submitting ? 'Salvando...' : editingPlan ? 'Salvar Alterações' : 'Criar Plano'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <Modal
        isOpen={deleteModal.isOpen}
        onClose={closeDeleteModal}
        onConfirm={handleDelete}
        title="Confirmar exclusão"
        message={`Tem certeza que deseja deletar o plano "${deleteModal.planName}"? Esta ação não pode ser desfeita.`}
        confirmText="Sim, deletar"
        cancelText="Cancelar"
        confirmColor="red"
      />

      {notification && (
        <Notification
          type={notification.type}
          message={notification.message}
          onClose={() => setNotification(null)}
        />
      )}
    </div>
  );
}
