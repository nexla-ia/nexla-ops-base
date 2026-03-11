import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, Trash2, Edit2, X, Loader2, FolderTree, Search } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import Modal from './Modal';

interface Department { id: string; name: string; }
interface Sector { id: string; department_id: string; company_id: string; name: string; description: string; created_at: string; department?: Department; }

const COLORS = ['#2563eb','#7c3aed','#059669','#d97706','#dc2626','#0891b2'];
function pickColor(id: string) {
  let h = 0; for (const c of id) h = (h * 31 + c.charCodeAt(0)) & 0xffff;
  return COLORS[Math.abs(h) % COLORS.length];
}

export default function SectorsManagement() {
  const { company } = useAuth();
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; sector: Sector | null }>({ isOpen: false, sector: null });
  const [deleting, setDeleting] = useState(false);
  const [formData, setFormData] = useState({ name: '', description: '', department_id: '' });

  useEffect(() => { fetchData(); }, [company]);

  const fetchData = async () => {
    if (!company?.id) return;
    setLoading(true);
    try {
      const [s, d] = await Promise.all([
        supabase.from('sectors').select('*, departments(id, name)').eq('company_id', company.id).order('created_at', { ascending: false }),
        supabase.from('departments').select('id, name').eq('company_id', company.id).order('name', { ascending: true }),
      ]);
      if (s.error) throw s.error; if (d.error) throw d.error;
      setSectors((s.data || []).map(x => ({ ...x, department: Array.isArray(x.departments) ? x.departments[0] : x.departments })));
      setDepartments(d.data || []);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); if (!company?.id) return;
    setSaving(true);
    try {
      if (editingId) {
        const { error } = await supabase.from('sectors').update({ name: formData.name, description: formData.description, department_id: formData.department_id, updated_at: new Date().toISOString() }).eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('sectors').insert([{ company_id: company.id, department_id: formData.department_id, name: formData.name, description: formData.description }]);
        if (error) throw error;
      }
      setFormData({ name: '', description: '', department_id: '' }); setShowForm(false); setEditingId(null); fetchData();
    } catch (e) { console.error(e); alert('Erro ao salvar'); } finally { setSaving(false); }
  };

  const handleEdit = (s: Sector) => { setFormData({ name: s.name, description: s.description, department_id: s.department_id }); setEditingId(s.id); setShowForm(true); };
  const handleCancel = () => { setFormData({ name: '', description: '', department_id: '' }); setShowForm(false); setEditingId(null); };
  const confirmDelete = async () => {
    if (!deleteModal.sector) return;
    setDeleting(true);
    try {
      const { error } = await supabase.from('sectors').delete().eq('id', deleteModal.sector.id);
      if (error) throw error;
      setDeleteModal({ isOpen: false, sector: null }); fetchData();
    } catch (e) { console.error(e); alert('Erro ao excluir'); } finally { setDeleting(false); }
  };

  const filtered = sectors.filter(s => {
    const ms = !search || s.name.toLowerCase().includes(search.toLowerCase());
    const md = !filterDept || s.department_id === filterDept;
    return ms && md;
  });

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
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Setores</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{sectors.length} setor{sectors.length !== 1 ? 'es' : ''}</p>
        </div>
        {!showForm && departments.length > 0 && (
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors">
            <Plus className="w-4 h-4" /> Novo Setor
          </button>
        )}
      </div>

      {/* Sem departamentos */}
      {departments.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center mb-4">
            <FolderTree className="w-6 h-6 text-slate-400" />
          </div>
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Nenhum departamento encontrado</p>
          <p className="text-xs text-slate-400 mt-1">Crie departamentos primeiro para poder adicionar setores</p>
        </div>
      )}

      {/* Formulário */}
      {departments.length > 0 && showForm && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-5 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              {editingId ? 'Editar setor' : 'Novo setor'}
            </h3>
            <button onClick={handleCancel} className="p-1 text-slate-400 hover:text-slate-600 rounded transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">Departamento *</label>
                <select required value={formData.department_id} onChange={e => setFormData({ ...formData, department_id: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 text-slate-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all">
                  <option value="">Selecione...</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">Nome *</label>
                <input required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: Atendimento, Suporte"
                  className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 text-slate-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">Descrição</label>
              <textarea value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })}
                placeholder="Responsabilidades deste setor" rows={2}
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

      {/* Filtros */}
      {departments.length > 0 && sectors.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-2 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar setor..."
              className="w-full pl-9 pr-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all" />
          </div>
          <select value={filterDept} onChange={e => setFilterDept(e.target.value)}
            className="px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all min-w-[170px]">
            <option value="">Todos os departamentos</option>
            {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
      )}

      {/* Vazio */}
      {departments.length > 0 && sectors.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center mb-4">
            <FolderTree className="w-6 h-6 text-slate-400" />
          </div>
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Nenhum setor cadastrado</p>
          <p className="text-xs text-slate-400 mt-1">Clique em "Novo Setor" para começar</p>
        </div>
      )}

      {/* Tabela agrupada por departamento */}
      {filtered.length > 0 && (() => {
        const grouped = departments
          .map(d => ({ dept: d, items: filtered.filter(s => s.department_id === d.id) }))
          .filter(g => g.items.length > 0);

        return (
          <div className="space-y-4">
            {grouped.map(({ dept, items }) => {
              const color = pickColor(dept.id);
              return (
                <div key={dept.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                  {/* Cabeçalho do grupo */}
                  <div className="flex items-center gap-2.5 px-4 py-2.5 border-b border-slate-100 dark:border-slate-700/50"
                    style={{ backgroundColor: `${color}08` }}>
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wide">{dept.name}</span>
                    <span className="text-xs text-slate-400">{items.length}</span>
                  </div>
                  {/* Linhas */}
                  <table className="w-full">
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                      {items.map(sector => (
                        <tr key={sector.id} className="group hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                              <span className="text-sm font-medium text-slate-900 dark:text-white">{sector.name}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 hidden md:table-cell">
                            <span className="text-sm text-slate-500 dark:text-slate-400 line-clamp-1">
                              {sector.description || '—'}
                            </span>
                          </td>
                          <td className="px-4 py-3 hidden sm:table-cell w-28">
                            <span className="text-sm text-slate-400">{new Date(sector.created_at).toLocaleDateString('pt-BR')}</span>
                          </td>
                          <td className="px-4 py-3 w-20">
                            <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => handleEdit(sector)}
                                className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg transition-all">
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => setDeleteModal({ isOpen: true, sector })}
                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-all">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })}
          </div>
        );
      })()}

      {/* Sem resultado na busca */}
      {departments.length > 0 && sectors.length > 0 && filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <p className="text-sm text-slate-500">Nenhum resultado para "{search}"</p>
          <button onClick={() => { setSearch(''); setFilterDept(''); }} className="text-xs text-blue-500 hover:underline mt-2">Limpar filtros</button>
        </div>
      )}

      <Modal isOpen={deleteModal.isOpen} onClose={() => setDeleteModal({ isOpen: false, sector: null })}
        onConfirm={confirmDelete} title="Excluir Setor"
        message={`Excluir "${deleteModal.sector?.name}"? Esta ação não pode ser desfeita.`}
        confirmText="Excluir" cancelText="Cancelar" confirmColor="red" loading={deleting} />
    </div>
  );
}