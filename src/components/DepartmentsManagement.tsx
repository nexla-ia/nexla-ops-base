import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, Trash2, Edit2, X, Loader2, Building2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import Modal from './Modal';

interface Department {
  id: string;
  company_id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

const EMPTY_FORM = {
  name: '',
  description: '',
};

export default function DepartmentsManagement() {
  const { company } = useAuth();

  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean;
    department: Department | null;
  }>({
    isOpen: false,
    department: null,
  });

  const [deleting, setDeleting] = useState(false);
  const [formData, setFormData] = useState({ ...EMPTY_FORM });

  useEffect(() => {
    fetchDepartments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company?.id]);

  const fetchDepartments = async () => {
    if (!company?.id) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('departments')
        .select('*')
        .eq('company_id', company.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDepartments(data || []);
    } catch (err) {
      console.error('Erro ao carregar departamentos:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company?.id) return;

    if (!formData.name.trim()) {
      alert('Preencha o nome do departamento.');
      return;
    }

    setSaving(true);
    try {
      if (editingId) {
        const { error } = await supabase
          .from('departments')
          .update({
            name: formData.name.trim(),
            description: formData.description.trim() || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingId);

        if (error) throw error;
      } else {
        const { error } = await supabase.from('departments').insert([
          {
            company_id: company.id,
            name: formData.name.trim(),
            description: formData.description.trim() || null,
          },
        ]);

        if (error) throw error;
      }

      setFormData({ ...EMPTY_FORM });
      setShowForm(false);
      setEditingId(null);
      fetchDepartments();
    } catch (err: any) {
      console.error('Erro ao salvar departamento:', err);
      alert(err?.message || 'Erro ao salvar departamento.');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (department: Department) => {
    setFormData({
      name: department.name || '',
      description: department.description || '',
    });
    setEditingId(department.id);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancel = () => {
    setFormData({ ...EMPTY_FORM });
    setEditingId(null);
    setShowForm(false);
  };

  const handleDelete = (department: Department) => {
    setDeleteModal({
      isOpen: true,
      department,
    });
  };

  const confirmDelete = async () => {
    if (!deleteModal.department) return;

    setDeleting(true);
    try {
      const { error } = await supabase
        .from('departments')
        .delete()
        .eq('id', deleteModal.department.id);

      if (error) throw error;

      setDeleteModal({
        isOpen: false,
        department: null,
      });

      fetchDepartments();
    } catch (err: any) {
      console.error('Erro ao excluir departamento:', err);
      alert(err?.message || 'Erro ao excluir departamento.');
    } finally {
      setDeleting(false);
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
    <div className="p-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Departamentos
          </h2>
          <p className="text-sm text-gray-500 dark:text-slate-300 mt-1">
            Gerencie os departamentos da empresa
          </p>
        </div>

        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-xl hover:scale-105 transition-all shadow-md"
          >
            <Plus className="w-5 h-5" />
            Novo Departamento
          </button>
        )}
      </div>

      {showForm && (
        <div className="bg-white/70 dark:bg-slate-900 backdrop-blur-xl border border-gray-200/50 dark:border-slate-600 rounded-2xl p-6 mb-6 shadow-md">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {editingId ? 'Editar Departamento' : 'Novo Departamento'}
            </h3>

            <button
              onClick={handleCancel}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-2">
                Nome do Departamento *
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ex: Recepção, Financeiro, Suporte"
                className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 dark:text-white border border-gray-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-2">
                Descrição
              </label>
              <textarea
                rows={4}
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Descreva a função deste departamento..."
                className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 dark:text-white border border-gray-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 transition-all resize-none"
              />
            </div>

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
                  'Atualizar Departamento'
                ) : (
                  'Criar Departamento'
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

      {departments.length === 0 ? (
        <div className="bg-white/70 dark:bg-slate-900 backdrop-blur-xl border border-gray-200/50 dark:border-slate-600 rounded-2xl p-12 text-center shadow-md">
          <div className="w-20 h-20 bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-900/40 dark:to-blue-800/40 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Building2 className="w-10 h-10 text-blue-500" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Nenhum departamento cadastrado
          </h3>
          <p className="text-sm text-gray-500 dark:text-slate-300">
            Crie o primeiro departamento da sua empresa
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {departments.map((department) => (
            <div
              key={department.id}
              className="bg-white/70 dark:bg-slate-900 backdrop-blur-xl border border-gray-200/50 dark:border-slate-600 rounded-2xl p-6 shadow-md hover:shadow-lg transition-all group hover:-translate-y-1"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="w-14 h-14 bg-gradient-to-br from-blue-400 to-blue-600 rounded-xl flex items-center justify-center shadow-md">
                  <Building2 className="w-7 h-7 text-white" />
                </div>

                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => handleEdit(department)}
                    className="p-2 text-gray-400 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/20 rounded-lg transition-all"
                    title="Editar"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => handleDelete(department)}
                    className="p-2 text-gray-400 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/20 rounded-lg transition-all"
                    title="Excluir"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <h3 className="font-bold text-gray-900 dark:text-white text-lg truncate">
                {department.name}
              </h3>

              <p className="text-sm text-gray-600 dark:text-slate-300 mt-3 line-clamp-3 min-h-[60px]">
                {department.description || 'Sem descrição cadastrada.'}
              </p>

              <p className="text-xs text-gray-400 dark:text-slate-500 mt-4">
                Criado em {new Date(department.created_at).toLocaleDateString('pt-BR')}
              </p>
            </div>
          ))}
        </div>
      )}

      <Modal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, department: null })}
        onConfirm={confirmDelete}
        title="Excluir Departamento"
        message={`Tem certeza que deseja excluir o departamento "${deleteModal.department?.name}"?\n\nEsta ação não pode ser desfeita.`}
        confirmText="Excluir"
        cancelText="Cancelar"
        confirmColor="red"
        loading={deleting}
      />
    </div>
  );
}