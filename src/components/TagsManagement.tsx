import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, Trash2, Edit2, X, Loader2, Tag } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import Modal from './Modal';

interface TagData {
  id: string;
  company_id: string;
  name: string;
  color: string;
  created_at: string;
}

const PRESET_COLORS = [
  { name: 'Cinza', value: '#6B7280' },
  { name: 'Vermelho', value: '#EF4444' },
  { name: 'Laranja', value: '#F97316' },
  { name: 'Amarelo', value: '#EAB308' },
  { name: 'Verde', value: '#10B981' },
  { name: 'Teal', value: '#14B8A6' },
  { name: 'Azul', value: '#3B82F6' },
  { name: 'Roxo', value: '#8B5CF6' },
  { name: 'Rosa', value: '#EC4899' },
];

export default function TagsManagement() {
  const { company } = useAuth();
  const [tags, setTags] = useState<TagData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; tag: TagData | null }>({
    isOpen: false,
    tag: null,
  });
  const [deleting, setDeleting] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    color: '#6B7280',
  });

  useEffect(() => {
    fetchTags();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company?.id]);

  const fetchTags = async () => {
    if (!company?.id) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('tags')
        .select('*')
        .eq('company_id', company.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTags((data as TagData[]) || []);
    } catch (error) {
      console.error('Erro ao carregar tags:', error);
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
          .from('tags')
          .update({
            name: formData.name,
            color: formData.color,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingId);

        if (error) throw error;
      } else {
        const { error } = await supabase.from('tags').insert([
          {
            company_id: company.id,
            name: formData.name,
            color: formData.color,
          },
        ]);

        if (error) throw error;
      }

      setFormData({ name: '', color: '#6B7280' });
      setShowForm(false);
      setEditingId(null);
      fetchTags();
    } catch (error) {
      console.error('Erro ao salvar tag:', error);
      alert('Erro ao salvar tag');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (tag: TagData) => {
    setFormData({
      name: tag.name,
      color: tag.color,
    });
    setEditingId(tag.id);
    setShowForm(true);
  };

  const handleDelete = (tag: TagData) => {
    setDeleteModal({ isOpen: true, tag });
  };

  const confirmDelete = async () => {
    if (!deleteModal.tag) return;

    setDeleting(true);
    try {
      const { id } = deleteModal.tag;
      console.log('[TAG DELETE] start', { id });

      // 1) apaga vínculos com contatos
      {
        const { error } = await supabase
          .from('contact_tags')
          .delete()
          .eq('tag_id', id);

        console.log('[TAG DELETE] contact_tags', error);
        if (error) throw error;
      }

      // 2) apaga vínculos com mensagens (tabela ponte)
      {
        const { error } = await supabase
          .from('message_tags')
          .delete()
          .eq('tag_id', id);

        console.log('[TAG DELETE] message_tags', error);
        if (error) throw error;
      }

      // 3) limpa coluna direta messages.tag_id (se seu schema usa isso)
      {
        const { error } = await supabase
          .from('messages')
          .update({ tag_id: null })
          .eq('tag_id', id);

        console.log('[TAG DELETE] messages.tag_id null', error);
        if (error) throw error;
      }

      // 4) apaga a tag por último
      {
        const { error } = await supabase.from('tags').delete().eq('id', id);

        console.log('[TAG DELETE] tags delete', error);
        if (error) throw error;
      }

      setDeleteModal({ isOpen: false, tag: null });
      fetchTags();
    } catch (error: any) {
      console.error('Erro ao excluir tag:', error);
      const msg =
        error?.message ||
        error?.details ||
        error?.hint ||
        'Erro ao excluir tag';
      alert(msg);
    } finally {
      setDeleting(false);
    }
  };

  const handleCancel = () => {
    setFormData({ name: '', color: '#6B7280' });
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
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Tags</h2>
          <p className="text-sm text-gray-500 dark:text-slate-300 mt-1">
            Crie etiquetas para organizar e identificar conversas
          </p>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-xl hover:scale-105 transition-all shadow-md"
          >
            <Plus className="w-5 h-5" />
            Nova Tag
          </button>
        )}
      </div>

      {showForm && (
        <div className="bg-white/70 dark:bg-slate-900 backdrop-blur-xl border border-gray-200/50 dark:border-slate-600 rounded-2xl p-6 mb-6 shadow-md">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {editingId ? 'Editar Tag' : 'Nova Tag'}
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
                Nome da Tag *
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="Ex: Urgente, VIP, Orçamento"
                className="w-full px-4 py-2.5 bg-white dark:bg-slate-900 dark:text-white dark:border-slate-600 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-2">
                Cor *
              </label>
              <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-9 gap-3">
                {PRESET_COLORS.map((color) => (
                  <button
                    key={color.value}
                    type="button"
                    onClick={() =>
                      setFormData({ ...formData, color: color.value })
                    }
                    className={`relative p-3 rounded-xl transition-all ${
                      formData.color === color.value
                        ? 'ring-2 ring-offset-2 ring-blue-500 scale-110'
                        : 'hover:scale-105'
                    }`}
                    style={{ backgroundColor: color.value }}
                    title={color.name}
                  >
                    {formData.color === color.value && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-2 h-2 bg-white rounded-full shadow-lg"></div>
                      </div>
                    )}
                  </button>
                ))}
              </div>
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
                  'Atualizar'
                ) : (
                  'Criar Tag'
                )}
              </button>
              <button
                type="button"
                onClick={handleCancel}
                className="px-4 py-2.5 bg-gray-100 dark:bg-[#334155] dark:text-white text-gray-700 dark:text-slate-200 rounded-xl hover:bg-gray-200 transition-all font-medium"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {tags.length === 0 ? (
        <div className="bg-white/70 dark:bg-slate-900 backdrop-blur-xl border border-gray-200/50 dark:border-slate-600 rounded-2xl p-12 text-center shadow-md">
          <div className="w-20 h-20 bg-gradient-to-br from-blue-100 to-blue-200 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Tag className="w-10 h-10 text-blue-500" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Nenhuma tag cadastrada
          </h3>
          <p className="text-sm text-gray-500 dark:text-slate-300">
            Crie tags para organizar suas conversas por tipo, prioridade ou
            categoria
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {tags.map((tag) => (
            <div
              key={tag.id}
              className="bg-white/70 dark:bg-slate-900 backdrop-blur-xl border border-gray-200/50 dark:border-slate-600 rounded-2xl p-6 shadow-md hover:shadow-lg transition-all group hover:-translate-y-1"
            >
              <div className="flex items-center justify-between mb-3">
                <div
                  className="w-14 h-14 rounded-xl shadow-md"
                  style={{ backgroundColor: tag.color }}
                ></div>
                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => handleEdit(tag)}
                    className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                    title="Editar"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(tag)}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                    title="Excluir"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <h3 className="font-bold text-gray-900 dark:text-white truncate mb-2">
                {tag.name}
              </h3>

              <div
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium text-white"
                style={{ backgroundColor: tag.color }}
              >
                <Tag className="w-3 h-3" />
                {tag.name}
              </div>

              <p className="text-xs text-gray-400 mt-4">
                Criado em {new Date(tag.created_at).toLocaleDateString('pt-BR')}
              </p>
            </div>
          ))}
        </div>
      )}

      <Modal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, tag: null })}
        onConfirm={confirmDelete}
        title="Excluir Tag"
        message={`Tem certeza que deseja excluir a tag "${deleteModal.tag?.name}"?\n\nEsta ação não pode ser desfeita.`}
        confirmText="Excluir"
        cancelText="Cancelar"
        confirmColor="red"
        loading={deleting}
      />
    </div>
  );
}
