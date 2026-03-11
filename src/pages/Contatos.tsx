import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Users, Loader2, Edit2, Trash2, X, MessageCircle } from 'lucide-react';
import Modal from '../components/Modal';
import Toast from '../components/Toast';

interface Contact {
  id: string;
  company_id: string;
  phone_number: string;
  name: string;
  department_id: string | null;
  sector_id: string | null;
  tag_id: string | null;
  last_message: string | null;
  last_message_time: string | null;
  created_at: string;
  updated_at: string;
  tag_ids?: string[];
  pinned?: boolean;
  ia_ativada?: boolean;
  photo_url?: string;
}

export default function Contatos() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { company, attendant } = useAuth();
  
  const [editingContactId, setEditingContactId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [editingPhone, setEditingPhone] = useState('');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; contact: Contact | null }>({
    isOpen: false,
    contact: null,
  });
  const [isDeleting, setIsDeleting] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  const companyId = company?.id || attendant?.company_id;

  const fetchContacts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .order('last_message_time', { ascending: false });

      if (error) {
        console.error('Erro ao buscar contatos:', error);
        setError('Erro ao carregar contatos');
        return;
      }

      setContacts(data || []);
    } catch (err) {
      console.error('Erro inesperado:', err);
      setError('Erro inesperado ao carregar contatos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!companyId) {
      setError('Empresa não encontrada');
      setLoading(false);
      return;
    }

    fetchContacts();
  }, [companyId, fetchContacts]);

  const handleEdit = (contact: Contact) => {
    const cleanPhone = (contact.phone_number || '')
      .replace('@s.whatsapp.net', '')
      .replace('@g.us', '');
    
    setEditingContactId(contact.id);
    setEditingName(contact.name);
    setEditingPhone(cleanPhone);
    setIsEditModalOpen(true);
  };

  const handleCancelEdit = () => {
    setEditingContactId(null);
    setEditingName('');
    setEditingPhone('');
    setIsEditModalOpen(false);
  };

  const openDeleteModal = (contact: Contact) => {
    setDeleteModal({ isOpen: true, contact });
  };

  const closeDeleteModal = () => {
    setDeleteModal({ isOpen: false, contact: null });
  };

  const handleDelete = async () => {
    if (!deleteModal.contact) return;

    setIsDeleting(true);
    try {
      const { data, error } = await supabase.rpc('delete_contact_and_messages', {
        p_contact_id: deleteModal.contact.id,
      });

      if (error) {
        console.error('❌ Erro ao deletar:', error);
        throw error;
      }

      const result = data as { success: boolean, error?: string };
      if (!result.success) {
        console.error('❌ Falha ao apagar:', result.error);
        throw new Error(result.error || 'Falha ao apagar o contato.');
      }

      setContacts(contacts.filter((contact) => contact.id !== deleteModal.contact!.id));
      closeDeleteModal();
      setToastMessage('Contato deletado com sucesso!');
      setShowToast(true);

      // Notify other tabs/components that a contact was deleted
      try {
        window.dispatchEvent(new CustomEvent('contactDeleted', { detail: deleteModal.contact!.id }));
      } catch (e) {
        // ignore
      }
    } catch (err: Error | unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
      console.error('❌ Erro ao apagar o contato:', err);
      alert(`Erro ao apagar o contato: ${errorMessage}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleUpdateContact = async () => {
    if (!editingContactId || !editingName.trim()) {
      alert('O nome não pode estar em branco.');
      return;
    }

    try {
      const { error } = await supabase
        .from('contacts')
        .update({
          name: editingName.trim(),
          phone_number: editingPhone.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', editingContactId);

      if (error) {
        console.error('Erro ao atualizar o contato:', error);
        alert('Ocorreu um erro ao tentar atualizar o contato.');
        return;
      }

      setContacts(
        contacts.map((contact) =>
          contact.id === editingContactId 
            ? { 
                ...contact, 
                name: editingName.trim(),
                phone_number: editingPhone.trim()
              } 
            : contact
        )
      );

      handleCancelEdit();
    } catch (err) {
      console.error('Erro inesperado ao atualizar:', err);
      alert('Ocorreu um erro inesperado. Tente novamente mais tarde.');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-teal-500 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 animate-in fade-in duration-300">
        <div className="text-center">
          <div className="text-red-500 mb-4">
            <Users className="w-16 h-16 mx-auto" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Erro</h2>
          <p className="text-gray-600 dark:text-slate-300">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-xl hover:scale-105 transition-all shadow-md"
          >
            Tentar Novamente
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      {showToast && (
        <Toast message={toastMessage} onClose={() => setShowToast(false)} duration={3000} />
      )}
      <div className="p-6 animate-in fade-in duration-300">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Contatos</h1>
            <p className="text-sm text-gray-500 dark:text-slate-300 mt-1">
              Gerencie os contatos da sua empresa ({contacts.length})
            </p>
          </div>
        </div>

        {contacts.length === 0 ? (
          <div className="text-center py-12">
            <Users className="w-16 h-16 text-gray-300 dark:text-slate-600 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Nenhum Contato</h2>
            <p className="text-gray-600 dark:text-slate-300">Não há contatos registrados ainda.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {contacts.map((contact) => {
              const safeName = (contact.name || '').trim();
              const cleanPhone = (contact.phone_number || '')
                .replace('@s.whatsapp.net', '')
                .replace('@g.us', '');
              const initial = safeName ? safeName[0].toUpperCase() : '?';
              
              const colors = [
                'from-blue-400 to-blue-600',
                'from-teal-400 to-teal-600',
                'from-pink-400 to-pink-600',
                'from-purple-400 to-purple-600',
                'from-indigo-400 to-indigo-600',
              ];
              const colorIndex = safeName ? Math.abs(safeName.charCodeAt(0) % colors.length) : 0;
              const color = colors[colorIndex];

              return (
                <div
                  key={contact.id}
                  className="bg-white/70 dark:bg-slate-900 backdrop-blur-xl border border-gray-200/50 dark:border-slate-600 rounded-2xl p-6 shadow-md hover:shadow-lg transition-all group hover:-translate-y-1"
                >
                  {/* Avatar + Actions */}
                  <div className="flex justify-between items-start mb-4">
                    <div className={`w-14 h-14 bg-gradient-to-br ${color} rounded-xl flex items-center justify-center shadow-md text-white font-bold text-xl`}>
                      {initial}
                    </div>

                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => handleEdit(contact)}
                        className="p-2 text-gray-400 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/20 rounded-lg transition-all"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => openDeleteModal(contact)}
                        className="p-2 text-gray-400 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/20 rounded-lg transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Name */}
                  <h3 className="font-bold text-gray-900 dark:text-white truncate">
                    {safeName || 'Sem nome'}
                  </h3>

                  {/* Phone */}
                  <div className="flex items-center gap-2 mt-2 text-sm text-gray-600 dark:text-slate-300">
                    <MessageCircle className="w-4 h-4 text-teal-500 flex-shrink-0" />
                    <p className="font-mono truncate">{cleanPhone || 'Sem número'}</p>
                  </div>

                  {/* Last Message */}
                  {contact.last_message && (
                    <div className="mt-3 p-2 bg-gray-50 dark:bg-slate-800/50 rounded-lg">
                      <p className="text-xs text-gray-500 dark:text-slate-400 font-medium mb-1">Última mensagem</p>
                      <p className="text-sm text-gray-700 dark:text-slate-300 line-clamp-2">
                        {contact.last_message}
                      </p>
                    </div>
                  )}

                  {/* Last Interaction Time */}
                  {contact.last_message_time && (
                    <p className="text-xs text-gray-400 dark:text-slate-500 mt-3">
                      {new Date(contact.last_message_time).toLocaleDateString('pt-BR')} às{' '}
                      {new Date(contact.last_message_time).toLocaleTimeString('pt-BR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal de Edição */}
      {isEditModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md p-6 animate-in zoom-in duration-200">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">Editar Contato</h3>
              <button 
                onClick={handleCancelEdit}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-2">
                  Nome
                </label>
                <input
                  type="text"
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  placeholder="Digite o nome"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && handleUpdateContact()}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-2">
                  Número
                </label>
                <input
                  type="text"
                  value={editingPhone}
                  onChange={(e) => setEditingPhone(e.target.value)}
                  placeholder="Digite o número"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 font-mono"
                  onKeyDown={(e) => e.key === 'Enter' && handleUpdateContact()}
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={handleUpdateContact}
                className="flex-1 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors font-semibold"
              >
                Salvar
              </button>
              <button
                onClick={handleCancelEdit}
                className="flex-1 px-4 py-2 bg-gray-200 dark:bg-slate-700 hover:bg-gray-300 dark:hover:bg-slate-600 text-gray-700 dark:text-white rounded-lg transition-colors font-semibold"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Exclusão */}
      <Modal
        isOpen={deleteModal.isOpen}
        onClose={closeDeleteModal}
        onConfirm={handleDelete}
        title="Excluir Contato"
        message={`Tem certeza que deseja excluir o contato "${deleteModal.contact?.name}"?\n\nTodas as mensagens e dados serão removidos permanentemente. Esta ação não pode ser desfeita.`}
        confirmText="Excluir"
        cancelText="Cancelar"
        confirmColor="red"
        loading={isDeleting}
      />
    </>
  );
}