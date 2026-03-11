import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, Trash2, Edit2, X, Loader2, Building2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import Modal from './Modal';

interface Department {
  id: string; company_id: string; name: string; description: string; created_at: string;
}

function getInitials(name: string) {
  return name.split(' ').filter(Boolean).map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?';
}

const COLORS = ['#2563eb','#7c3aed','#059669','#d97706','#dc2626','#0891b2'];
function pickColor(id: string) {
  let h = 0; for (const c of id) h = (h * 31 + c.charCodeAt(0)) & 0xffff;
  return COLORS[Math.abs(h) % COLORS.length];
}

export default function DepartmentsManagement() {
  const { company } = useAuth();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; dept: Department | null }>({ isOpen: false, dept: null });
  const [deleting, setDeleting] = useState(false);
  const [formData, setFormData] = useState({ name: '', description: '' });

  useEffect(() => { fetchData(); }, [company]);

  const fetchData = async () => {
    if (!company?.id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.from('departments').select('*').eq('company_id', company.id).order('created_at', { ascending: false });
      if (error) throw error;
      setDepartments(data || []);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); if (!company?.id) return;
    setSaving(true);
    try {
      if (editingId) {
        const { error } = await supabase.from('departments').update({ name: formData.name, description: formData.description, updated_at: new Date().toISOString() }).eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('departments').insert([{ company_id: company.id, name: formData.name, description: formData.description }]);
        if (error) throw error;
      }
      setFormData({ name: '', description: '' }); setShowForm(false); setEditingId(null); fetchData();
    } catch (e) { console.error(e); alert('Erro ao salvar'); } finally { setSaving(false); }
  };

  const handleEdit = (d: Department) => { setFormData({ name: d.name, description: d.description }); setEditingId(d.id); setShowForm(true); };
  const handleCancel = () => { setFormData({ name: '', description: '' }); setShowForm(false); setEditingId(null); };
  const confirmDelete = async () => {
    if (!deleteModal.dept) return;
    setDeleting(true);
    try {
      const { error } = await supabase.from('departments').delete().eq('id', deleteModal.dept.id);
      if (error) throw error;
      setDeleteModal({ isOpen: false, dept: null }); fetchData();
    } catch (e) { console.error(e); alert('Erro ao excluir'); } finally { setDeleting(false); }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
    </div>
  );

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Departamentos</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{departments.length} departamento{departments.length !== 1 ? 's' : ''}</p>
        </div>
        {!showForm && (
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors">
            <Plus className="w-4 h-4" /> Novo Departamento
          </button>
        )}
      </div>

      {/* Formulário */}
      {showForm && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-5 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              {editingId ? 'Editar departamento' : 'Novo departamento'}
            </h3>
            <button onClick={handleCancel} className="p-1 text-slate-400 hover:text-slate-600 rounded transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">Nome *</label>
              <input required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ex: Comercial, Suporte, Financeiro"
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 text-slate-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">Descrição</label>
              <textarea value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })}
                placeholder="Responsabilidades deste departamento" rows={2}
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 text-slate-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none" />
            </div>
            <div className="flex gap-2 pt-1">
              <button type="submit" disabled={saving}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2">
                {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {saving ? 'Salvando...' : editingId ? 'Salvar' : 'Criar'}
              </button>
              <button type="button" onClick={handleCancel}
                className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Vazio */}
      {departments.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center mb-4">
            <Building2 className="w-6 h-6 text-slate-400" />
          </div>
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Nenhum departamento</p>
          <p className="text-xs text-slate-400 mt-1">Crie o primeiro para começar</p>
        </div>
      )}

      {/* Tabela */}
      {departments.length > 0 && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700">
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Departamento</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide hidden md:table-cell">Descrição</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide hidden sm:table-cell">Criado em</th>
                <th className="px-4 py-3 w-20" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
              {departments.map(dept => {
                const color = pickColor(dept.id);
                return (
                  <tr key={dept.id} className="group hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                          style={{ backgroundColor: color }}>
                          {getInitials(dept.name)}
                        </div>
                        <span className="text-sm font-medium text-slate-900 dark:text-white">{dept.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className="text-sm text-slate-500 dark:text-slate-400 line-clamp-1">
                        {dept.description || <span className="italic text-slate-300 dark:text-slate-600">—</span>}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <span className="text-sm text-slate-500 dark:text-slate-400">
                        {new Date(dept.created_at).toLocaleDateString('pt-BR')}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => handleEdit(dept)}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg transition-all">
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => setDeleteModal({ isOpen: true, dept })}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-all">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Modal isOpen={deleteModal.isOpen} onClose={() => setDeleteModal({ isOpen: false, dept: null })}
        onConfirm={confirmDelete} title="Excluir Departamento"
        message={`Excluir "${deleteModal.dept?.name}"? Esta ação não pode ser desfeita.`}
        confirmText="Excluir" cancelText="Cancelar" confirmColor="red" loading={deleting} />
    </div>
  );
}