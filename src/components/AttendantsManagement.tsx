import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, Trash2, Edit2, X, Loader2, Users } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import Modal from './Modal';

interface Department { id: string; name: string; }
interface Sector { id: string; name: string; department_id: string; }
interface Attendant {
  id: string; company_id: string; department_id: string | null; sector_id: string | null;
  name: string; email: string; phone: string; function: string; is_active: boolean; created_at: string;
  department?: Department; sector?: Sector;
}

function getInitials(name: string) {
  return name.split(' ').filter(Boolean).map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?';
}
const COLORS = ['#2563eb','#7c3aed','#059669','#d97706','#dc2626','#0891b2','#db2777','#ea580c'];
function pickColor(id: string) {
  let h = 0; for (const c of id) h = (h * 31 + c.charCodeAt(0)) & 0xffff;
  return COLORS[Math.abs(h) % COLORS.length];
}

export default function AttendantsManagement() {
  const { company } = useAuth();
  const [attendants, setAttendants] = useState<Attendant[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [filteredSectors, setFilteredSectors] = useState<Sector[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [maxAttendants, setMaxAttendants] = useState(5);
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; attendant: Attendant | null }>({ isOpen: false, attendant: null });
  const [deleting, setDeleting] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', function: '', password: '', department_id: '', sector_id: '', is_active: true });

  useEffect(() => { fetchData(); }, [company]);
  useEffect(() => {
    if (formData.department_id) {
      const f = sectors.filter(s => s.department_id === formData.department_id);
      setFilteredSectors(f);
      if (!f.find(s => s.id === formData.sector_id)) setFormData(p => ({ ...p, sector_id: '' }));
    } else { setFilteredSectors([]); setFormData(p => ({ ...p, sector_id: '' })); }
  }, [formData.department_id, sectors]);

  const fetchData = async () => {
    if (!company?.id) return;
    setLoading(true);
    try {
      const [ar, dr, sr, cr] = await Promise.all([
        supabase.from('attendants').select('*, departments(id, name), sectors(id, name, department_id)').eq('company_id', company.id).order('created_at', { ascending: false }),
        supabase.from('departments').select('id, name').eq('company_id', company.id).order('name', { ascending: true }),
        supabase.from('sectors').select('id, name, department_id').eq('company_id', company.id).order('name', { ascending: true }),
        supabase.from('companies').select('max_attendants').eq('id', company.id).maybeSingle(),
      ]);
      if (ar.error) throw ar.error;
      setAttendants((ar.data || []).map(a => ({ ...a, department: Array.isArray(a.departments) ? a.departments[0] : a.departments, sector: Array.isArray(a.sectors) ? a.sectors[0] : a.sectors })));
      setDepartments(dr.data || []); setSectors(sr.data || []); setMaxAttendants(cr.data?.max_attendants || 5);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); if (!company?.id) return;
    if (!editingId && attendants.length >= maxAttendants) { alert(`Limite de ${maxAttendants} atendentes atingido.`); return; }
    if (!editingId && !formData.password) { alert('Senha é obrigatória'); return; }
    setSaving(true);
    try {
      if (editingId) {
        const { error } = await supabase.from('attendants').update({ name: formData.name, email: formData.email, phone: formData.phone, function: formData.function, department_id: formData.department_id || null, sector_id: formData.sector_id || null, is_active: formData.is_active, updated_at: new Date().toISOString() }).eq('id', editingId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.rpc('rpc_create_attendant', {
          p_api_key: company.api_key, p_name: formData.name, p_email: formData.email, p_password: formData.password, p_phone: formData.phone, p_function: formData.function, p_department_id: formData.department_id || null, p_sector_id: formData.sector_id || null, p_is_active: formData.is_active,
        });
        if (error) throw error; if (data?.error) throw new Error(data.error);
      }
      setFormData({ name: '', email: '', phone: '', function: '', password: '', department_id: '', sector_id: '', is_active: true });
      setShowForm(false); setEditingId(null); fetchData();
    } catch (err: any) { alert(`Erro: ${err.message || 'Erro ao salvar'}`); } finally { setSaving(false); }
  };

  const handleEdit = (a: Attendant) => { setFormData({ name: a.name, email: a.email, phone: a.phone, function: a.function || '', password: '', department_id: a.department_id || '', sector_id: a.sector_id || '', is_active: a.is_active }); setEditingId(a.id); setShowForm(true); };
  const handleCancel = () => { setFormData({ name: '', email: '', phone: '', function: '', password: '', department_id: '', sector_id: '', is_active: true }); setShowForm(false); setEditingId(null); };
  const confirmDelete = async () => {
    if (!deleteModal.attendant) return;
    setDeleting(true);
    try {
      const { data: result, error } = await supabase.rpc('rpc_delete_attendant', { p_attendant_id: deleteModal.attendant.id });
      if (error) throw error;
      if (result?.error) throw new Error(result.error);
      setDeleteModal({ isOpen: false, attendant: null }); fetchData();
    } catch (err) { alert(err instanceof Error ? err.message : 'Erro'); } finally { setDeleting(false); }
  };

  const formatPhone = (v: string) => {
    const n = v.replace(/\D/g, '');
    if (n.length <= 10) return n.replace(/(\d{2})(\d{4})(\d{0,4})/, (_, a, b, c) => c ? `(${a}) ${b}-${c}` : b ? `(${a}) ${b}` : `(${a}`);
    return n.replace(/(\d{2})(\d{5})(\d{0,4})/, (_, a, b, c) => c ? `(${a}) ${b}-${c}` : b ? `(${a}) ${b}` : `(${a}`);
  };

  const limitReached = attendants.length >= maxAttendants;

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
    </div>
  );

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Atendentes</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {attendants.length} de {maxAttendants} atendentes
            {limitReached && <span className="ml-2 text-amber-600 font-medium">· Limite atingido</span>}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Barra de uso discreta */}
          <div className="hidden sm:flex items-center gap-2">
            <div className="w-24 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all"
                style={{ width: `${Math.min((attendants.length / maxAttendants) * 100, 100)}%`, backgroundColor: limitReached ? '#f59e0b' : '#2563eb' }} />
            </div>
            <span className="text-xs text-slate-400">{attendants.length}/{maxAttendants}</span>
          </div>
          {!showForm && !limitReached && (
            <button onClick={() => setShowForm(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors">
              <Plus className="w-4 h-4" /> Novo Atendente
            </button>
          )}
        </div>
      </div>

      {/* Formulário */}
      {showForm && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-5 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              {editingId ? 'Editar atendente' : 'Novo atendente'}
            </h3>
            <button onClick={handleCancel} className="p-1 text-slate-400 hover:text-slate-600 rounded transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">Nome *</label>
                <input required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="Nome completo"
                  className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 text-slate-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">Email *</label>
                <input required type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} placeholder="email@exemplo.com" disabled={!!editingId}
                  className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 text-slate-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all disabled:opacity-50" />
              </div>
            </div>
            {!editingId && (
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">Senha *</label>
                <input required type="password" value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} placeholder="Mínimo 6 caracteres" minLength={6}
                  className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 text-slate-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all" />
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">Função</label>
              <input value={formData.function} onChange={e => setFormData({ ...formData, function: e.target.value })} placeholder="Ex: Vendedor, Suporte"
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 text-slate-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">Departamento</label>
                <select value={formData.department_id} onChange={e => setFormData({ ...formData, department_id: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 text-slate-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all">
                  <option value="">Nenhum</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">Setor</label>
                <select value={formData.sector_id} onChange={e => setFormData({ ...formData, sector_id: e.target.value })} disabled={!formData.department_id}
                  className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 text-slate-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all disabled:opacity-40">
                  <option value="">Nenhum</option>
                  {filteredSectors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input type="checkbox" checked={formData.is_active} onChange={e => setFormData({ ...formData, is_active: e.target.checked })}
                className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500" />
              <span className="text-sm text-slate-700 dark:text-slate-200">Atendente ativo</span>
            </label>
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
      {attendants.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center mb-4">
            <Users className="w-6 h-6 text-slate-400" />
          </div>
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Nenhum atendente</p>
          <p className="text-xs text-slate-400 mt-1">Adicione o primeiro membro da equipe</p>
        </div>
      )}

      {/* Tabela */}
      {attendants.length > 0 && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700">
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Atendente</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide hidden md:table-cell">Contato</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide hidden lg:table-cell">Departamento / Setor</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide hidden sm:table-cell">Status</th>
                <th className="px-4 py-3 w-20" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
              {attendants.map(att => {
                const color = pickColor(att.id);
                return (
                  <tr key={att.id} className="group hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                          style={{ backgroundColor: color }}>
                          {getInitials(att.name)}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-900 dark:text-white">{att.name}</p>
                          {att.function && <p className="text-xs text-slate-400 dark:text-slate-500">{att.function}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <p className="text-sm text-slate-600 dark:text-slate-300">{att.email}</p>
                      {att.phone && <p className="text-xs text-slate-400">{att.phone}</p>}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <div className="flex flex-col gap-1">
                        {att.department && <span className="text-xs text-slate-600 dark:text-slate-300">{att.department.name}</span>}
                        {att.sector && <span className="text-xs text-slate-400">{att.sector.name}</span>}
                        {!att.department && !att.sector && <span className="text-xs text-slate-300 dark:text-slate-600">—</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      {att.is_active
                        ? <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500" />Ativo
                          </span>
                        : <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />Inativo
                          </span>
                      }
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => handleEdit(att)}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg transition-all">
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => setDeleteModal({ isOpen: true, attendant: att })}
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

      <Modal isOpen={deleteModal.isOpen} onClose={() => setDeleteModal({ isOpen: false, attendant: null })}
        onConfirm={confirmDelete} title="Excluir Atendente"
        message={`Excluir "${deleteModal.attendant?.name}"? Esta ação não pode ser desfeita.`}
        confirmText="Excluir" cancelText="Cancelar" confirmColor="red" loading={deleting} />
    </div>
  );
}