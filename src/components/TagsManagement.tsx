import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, Trash2, Edit2, X, Loader2, Tag, Hash } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import Modal from './Modal';

interface TagData { id: string; company_id: string; name: string; color: string; created_at: string; }

const COLORS = [
  { name: 'Cinza',   value: '#64748b' }, { name: 'Vermelho', value: '#ef4444' },
  { name: 'Laranja', value: '#f97316' }, { name: 'Amarelo',  value: '#eab308' },
  { name: 'Verde',   value: '#22c55e' }, { name: 'Teal',     value: '#14b8a6' },
  { name: 'Azul',    value: '#3b82f6' }, { name: 'Índigo',   value: '#6366f1' },
  { name: 'Roxo',    value: '#a855f7' }, { name: 'Rosa',     value: '#ec4899' },
];

export default function TagsManagement() {
  const { company } = useAuth();
  const [tags, setTags] = useState<TagData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; tag: TagData | null }>({ isOpen: false, tag: null });
  const [deleting, setDeleting] = useState(false);
  const [formData, setFormData] = useState({ name: '', color: '#3b82f6' });

  useEffect(() => { fetchTags(); }, [company?.id]);

  const fetchTags = async () => {
    if (!company?.id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.from('tags').select('*').eq('company_id', company.id).order('created_at', { ascending: false });
      if (error) throw error;
      setTags(data || []);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); if (!company?.id) return;
    setSaving(true);
    try {
      if (editingId) {
        const { error } = await supabase.from('tags').update({ name: formData.name, color: formData.color }).eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('tags').insert([{ company_id: company.id, ...formData }]);
        if (error) throw error;
      }
      setFormData({ name: '', color: '#3b82f6' }); setShowForm(false); setEditingId(null); fetchTags();
    } catch (e) { console.error(e); alert('Erro ao salvar tag'); } finally { setSaving(false); }
  };

  const handleEdit = (t: TagData) => { setFormData({ name: t.name, color: t.color }); setEditingId(t.id); setShowForm(true); };
  const handleCancel = () => { setFormData({ name: '', color: '#3b82f6' }); setShowForm(false); setEditingId(null); };

  const confirmDelete = async () => {
    if (!deleteModal.tag) return;
    setDeleting(true);
    try {
      const { id } = deleteModal.tag;
      await supabase.from('contact_tags').delete().eq('tag_id', id);
      await supabase.from('message_tags').delete().eq('tag_id', id);
      await supabase.from('messages').update({ tag_id: null }).eq('tag_id', id);
      const { error } = await supabase.from('tags').delete().eq('id', id);
      if (error) throw error;
      setDeleteModal({ isOpen: false, tag: null }); fetchTags();
    } catch (e: any) { alert(e?.message || 'Erro ao excluir'); } finally { setDeleting(false); }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>;

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Tags</h2>
          <p className="text-sm text-slate-500 mt-0.5">{tags.length} tag{tags.length !== 1 ? 's' : ''} cadastrada{tags.length !== 1 ? 's' : ''}</p>
        </div>
        {!showForm && (
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors">
            <Plus className="w-3.5 h-3.5" /> Nova Tag
          </button>
        )}
      </div>

      {/* Formulário */}
      {showForm && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-5 mb-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: formData.color + '22' }}>
                <Tag className="w-3.5 h-3.5" style={{ color: formData.color }} />
              </div>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">{editingId ? 'Editar tag' : 'Nova tag'}</p>
            </div>
            <button onClick={handleCancel} className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wide">Nome *</label>
                <input required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: Urgente, VIP, Suporte"
                  className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 text-slate-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wide">Cor *</label>
                <div className="flex flex-wrap gap-2">
                  {COLORS.map(c => (
                    <button key={c.value} type="button" onClick={() => setFormData({ ...formData, color: c.value })}
                      title={c.name}
                      className={`w-7 h-7 rounded-lg transition-all ${formData.color === c.value ? 'ring-2 ring-offset-2 ring-slate-400 dark:ring-slate-500 scale-110' : 'hover:scale-110 opacity-60 hover:opacity-100'}`}
                      style={{ backgroundColor: c.value }} />
                  ))}
                </div>
              </div>
            </div>

            {/* Preview */}
            <div className="flex items-center gap-3 py-3 px-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
              <span className="text-xs text-slate-400 font-medium">Preview:</span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold text-white shadow-sm" style={{ backgroundColor: formData.color }}>
                <Hash className="w-3 h-3" />{formData.name || 'Nome da tag'}
              </span>
            </div>

            <div className="flex gap-2 pt-1">
              <button type="submit" disabled={saving}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-1.5">
                {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {saving ? 'Salvando…' : editingId ? 'Salvar' : 'Criar'}
              </button>
              <button type="button" onClick={handleCancel}
                className="px-4 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Lista */}
      {tags.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center mb-4">
            <Tag className="w-6 h-6 text-slate-400" />
          </div>
          <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">Nenhuma tag cadastrada</p>
          <p className="text-xs text-slate-400 mt-1">Crie tags para organizar suas conversas</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
          {tags.map(tag => (
            <div key={tag.id}
              className="group flex items-center justify-between bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 hover:border-slate-300 dark:hover:border-slate-600 hover:shadow-sm transition-all">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: tag.color + '22' }}>
                  <Hash className="w-4 h-4" style={{ color: tag.color }} />
                </div>
                <div className="min-w-0">
                  <span className="block text-sm font-semibold text-slate-800 dark:text-white truncate">{tag.name}</span>
                  <span className="block text-xs text-slate-400 font-mono">{tag.color}</span>
                </div>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-2 flex-shrink-0">
                <button onClick={() => handleEdit(tag)}
                  className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg transition-all">
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => setDeleteModal({ isOpen: true, tag })}
                  className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-all">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={deleteModal.isOpen} onClose={() => setDeleteModal({ isOpen: false, tag: null })}
        onConfirm={confirmDelete} title="Excluir Tag"
        message={`Excluir a tag "${deleteModal.tag?.name}"? Esta ação não pode ser desfeita.`}
        confirmText="Excluir" cancelText="Cancelar" confirmColor="red" loading={deleting} />
    </div>
  );
}
