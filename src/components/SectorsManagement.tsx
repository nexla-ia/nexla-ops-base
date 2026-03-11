import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, Trash2, Edit2, X, Loader2, FolderTree } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import Modal from './Modal';

interface Department {
  id: string;
  name: string;
}

interface Sector {
  id: string;
  department_id: string;
  company_id: string;
  name: string;
  description: string;
  created_at: string;
  department?: Department;
}

export default function SectorsManagement() {
  const { company } = useAuth();
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; sector: Sector | null }>({
    isOpen: false,
    sector: null,
  });
  const [deleting, setDeleting] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    department_id: '',
  });

  useEffect(() => {
    fetchData();
  }, [company]);

  const fetchData = async () => {
    if (!company?.id) return;

    setLoading(true);
    try {
      const [sectorsResult, departmentsResult] = await Promise.all([
        supabase
          .from('sectors')
          .select('*, departments(id, name)')
          .eq('company_id', company.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('departments')
          .select('id, name')
          .eq('company_id', company.id)
          .order('name', { ascending: true })
      ]);

      if (sectorsResult.error) throw sectorsResult.error;
      if (departmentsResult.error) throw departmentsResult.error;

      const sectorsWithDepartments = (sectorsResult.data || []).map(sector => ({
        ...sector,
        department: Array.isArray(sector.departments) ? sector.departments[0] : sector.departments
      }));

      setSectors(sectorsWithDepartments);
      setDepartments(departmentsResult.data || []);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company?.id) return;

    setSaving(true);
    try {
      if (editingId) {
        const { error } = await supabase
          .from('sectors')
          .update({
            name: formData.name,
            description: formData.description,
            department_id: formData.department_id,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingId);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('sectors')
          .insert([{
            company_id: company.id,
            department_id: formData.department_id,
            name: formData.name,
            description: formData.description,
          }]);

        if (error) throw error;
      }

      setFormData({ name: '', description: '', department_id: '' });
      setShowForm(false);
      setEditingId(null);
      fetchData();
    } catch (error) {
      console.error('Erro ao salvar setor:', error);
      alert('Erro ao salvar setor');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (sector: Sector) => {
    setFormData({
      name: sector.name,
      description: sector.description,
      department_id: sector.department_id,
    });
    setEditingId(sector.id);
    setShowForm(true);
  };

  const handleDelete = (sector: Sector) => {
    setDeleteModal({ isOpen: true, sector });
  };

  const confirmDelete = async () => {
    if (!deleteModal.sector) return;

    setDeleting(true);
    try {
      const { error } = await supabase
        .from('sectors')
        .delete()
        .eq('id', deleteModal.sector.id);

      if (error) throw error;
      setDeleteModal({ isOpen: false, sector: null });
      fetchData();
    } catch (error) {
      console.error('Erro ao excluir setor:', error);
      alert('Erro ao excluir setor');
    } finally {
      setDeleting(false);
    }
  };

  const handleCancel = () => {
    setFormData({ name: '', description: '', department_id: '' });
    setShowForm(false);
    setEditingId(null);
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
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Setores</h2>
          <p className="text-sm text-gray-500 dark:text-slate-300 mt-1">Gerencie os setores dos seus departamentos</p>
        </div>
        {!showForm && departments.length > 0 && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-xl hover:scale-105 transition-all shadow-md"
          >
            <Plus className="w-5 h-5" />
            Novo Setor
          </button>
        )}
      </div>

      {departments.length === 0 && (
        <div className="bg-white/70 dark:bg-slate-900 backdrop-blur-xl border border-gray-200/50 dark:border-slate-600 rounded-2xl p-12 text-center shadow-md">
          <div className="w-20 h-20 bg-gradient-to-br from-orange-100 to-orange-200 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <FolderTree className="w-10 h-10 text-orange-500" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Nenhum departamento encontrado</h3>
          <p className="text-sm text-gray-500 dark:text-slate-300">Você precisa criar departamentos antes de criar setores</p>
        </div>
      )}

      {departments.length > 0 && showForm && (
        <div className="bg-white/70 dark:bg-slate-900 backdrop-blur-xl border border-gray-200/50 dark:border-slate-600 rounded-2xl p-6 mb-6 shadow-md">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {editingId ? 'Editar Setor' : 'Novo Setor'}
            </h3>
            <button
              onClick={handleCancel}
              className="p-2 text-gray-400 hover:text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:bg-[#334155] dark:text-white/50 rounded-lg transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-2">
                Departamento *
              </label>
              <select
                required
                value={formData.department_id}
                onChange={(e) => setFormData({ ...formData, department_id: e.target.value })}
                className="w-full px-4 py-2.5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-600 text-gray-900 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 transition-all"
              >
                <option value="">Selecione um departamento</option>
                {departments.map((dept) => (
                  <option key={dept.id} value={dept.id}>
                    {dept.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-2">
                Nome do Setor *
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ex: Atendimento, Suporte, Financeiro"
                className="w-full px-4 py-2.5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-600 text-gray-900 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-2">
                Descrição
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Descreva as responsabilidades deste setor"
                rows={3}
                className="w-full px-4 py-2.5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-600 text-gray-900 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 transition-all resize-none"
              />
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={saving}
                className="flex-1 bg-gradient-to-br from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white py-2 rounded-xl disabled:opacity-50 transition-all font-medium"
              >
                {saving ? 'Salvando...' : editingId ? 'Atualizar' : 'Criar'}
              </button>

              <button
                type="button"
                onClick={handleCancel}
                className="px-4 py-2 bg-gray-100 dark:bg-[#334155] dark:text-white rounded-xl hover:bg-gray-200 transition-all"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {departments.length > 0 && sectors.length === 0 ? (
        <div className="bg-white/70 dark:bg-slate-900 backdrop-blur-xl border border-gray-200/50 dark:border-slate-600 rounded-2xl p-12 text-center shadow-md">
          <div className="w-20 h-20 bg-gradient-to-br from-blue-100 to-blue-200 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <FolderTree className="w-10 h-10 text-blue-500" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Nenhum setor cadastrado</h3>
          <p className="text-sm text-gray-500 dark:text-slate-300">Comece criando o primeiro setor para seus departamentos</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sectors.map((sector) => (
            <div
              key={sector.id}
              className="bg-white/70 dark:bg-slate-900 backdrop-blur-xl border border-gray-200/50 dark:border-slate-600 rounded-2xl p-6 shadow-md hover:shadow-lg transition-all group hover:-translate-y-1"
            >
              <div className="flex justify-between mb-3">
                <div className="w-14 h-14 bg-gradient-to-br from-blue-400 to-blue-600 rounded-xl flex items-center justify-center shadow-md">
                  <FolderTree className="text-white w-6 h-6" />
                </div>

                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => handleEdit(sector)} className="p-2 text-gray-400 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/20 rounded-lg transition-all">
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDelete(sector)} className="p-2 text-gray-400 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/20 rounded-lg transition-all">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <h3 className="font-bold text-gray-900 dark:text-white">{sector.name}</h3>

              {sector.department && (
                <p className="text-xs text-gray-500 dark:text-slate-300 mt-1">
                  <span className="font-medium">Departamento:</span> {sector.department.name}
                </p>
              )}

              {sector.description && (
                <p className="text-sm text-gray-600 dark:text-slate-300 mt-2">
                  {sector.description}
                </p>
              )}

              <p className="text-xs text-gray-400 mt-4">
                Criado em{' '}
                {new Date(sector.created_at).toLocaleDateString('pt-BR')}
              </p>
            </div>
          ))}
        </div>
      )}

      <Modal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, sector: null })}
        onConfirm={confirmDelete}
        title="Excluir Setor"
        message={`Tem certeza que deseja excluir o setor "${deleteModal.sector?.name}"?\n\nEsta ação não pode ser desfeita.`}
        confirmText="Excluir"
        cancelText="Cancelar"
        confirmColor="red"
        loading={deleting}
      />
    </div>
  );
}
