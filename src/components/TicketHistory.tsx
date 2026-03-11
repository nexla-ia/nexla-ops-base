import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { CheckCircle2, Clock, AlertCircle, User, Calendar, Phone, FolderOpen, MessageCircle, Eye, ArrowRight } from 'lucide-react';
import Toast from './Toast';

interface TicketContact {
  id: string;
  phone_number: string;
  name: string;
  ticket_status: 'aberto' | 'em_processo' | 'finalizado';
  ticket_opened_at: string;
  ticket_closed_at: string | null;
  ticket_closed_by: string | null;
  department_id: string | null;
  department_name?: string;
  closed_by_name?: string;
  message_count?: number;
}

interface TicketHistoryProps {
  onOpenChat?: (phoneNumber: string) => void;
}

export default function TicketHistory({ onOpenChat }: TicketHistoryProps = {}) {
  const { company, attendant } = useAuth();
  const [tickets, setTickets] = useState<TicketContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<'todos' | 'aberto' | 'em_processo' | 'finalizado'>('todos');
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [selectedTicket, setSelectedTicket] = useState<TicketContact | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  useEffect(() => {
    fetchTickets();
  }, [company?.id, attendant?.company_id]);

  const fetchTickets = async () => {
    try {
      setLoading(true);
      const companyId = company?.id || attendant?.company_id;

      if (!companyId) return;

      const { data, error } = await supabase
        .from('contacts')
        .select(`
          id,
          phone_number,
          name,
          ticket_status,
          ticket_opened_at,
          ticket_closed_at,
          ticket_closed_by,
          department_id,
          departments(name)
        `)
        .eq('company_id', companyId)
        .order('ticket_opened_at', { ascending: false });

      if (error) throw error;

      const ticketsWithNames = await Promise.all(
        (data || []).map(async (ticket) => {
          let closedByName = null;

          if (ticket.ticket_closed_by) {
            const { data: attendantData } = await supabase
              .from('attendants')
              .select('name')
              .eq('user_id', ticket.ticket_closed_by)
              .maybeSingle();

            if (attendantData) {
              closedByName = attendantData.name;
            } else {
              const { data: companyData } = await supabase
                .from('companies')
                .select('name')
                .eq('user_id', ticket.ticket_closed_by)
                .maybeSingle();

              if (companyData) {
                closedByName = companyData.name;
              }
            }
          }

          const { count } = await supabase
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('company_id', companyId)
            .eq('phone_number', ticket.phone_number);

          return {
            ...ticket,
            department_name: ticket.departments?.name,
            closed_by_name: closedByName,
            message_count: count || 0,
          };
        })
      );

      setTickets(ticketsWithNames as any);
    } catch (error) {
      console.error('Erro ao buscar histórico:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFinishTicket = async (ticketId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('contacts')
        .update({
          ticket_status: 'finalizado',
          ticket_closed_at: new Date().toISOString(),
          ticket_closed_by: user.id,
        })
        .eq('id', ticketId);

      if (error) throw error;

      setToastMessage('Chamado finalizado com sucesso!');
      setShowToast(true);
      fetchTickets();
    } catch (error) {
      console.error('Erro ao finalizar chamado:', error);
      setToastMessage('Erro ao finalizar chamado');
      setShowToast(true);
    }
  };

  const handleReopenTicket = async (ticketId: string) => {
    try {
      const { error } = await supabase
        .from('contacts')
        .update({
          ticket_status: 'aberto',
          ticket_closed_at: null,
          ticket_closed_by: null,
        })
        .eq('id', ticketId);

      if (error) throw error;

      setToastMessage('Chamado reaberto com sucesso!');
      setShowToast(true);
      fetchTickets();
    } catch (error) {
      console.error('Erro ao reabrir chamado:', error);
      setToastMessage('Erro ao reabrir chamado');
      setShowToast(true);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatPhone = (phone: string) => {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 13) {
      return `+${cleaned.slice(0, 2)} (${cleaned.slice(2, 4)}) ${cleaned.slice(4, 9)}-${cleaned.slice(9)}`;
    }
    return phone;
  };

  const calculateDuration = (openedAt: string, closedAt: string | null) => {
    const start = new Date(openedAt);
    const end = closedAt ? new Date(closedAt) : new Date();
    const diffMs = end.getTime() - start.getTime();

    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `${days}d ${hours % 24}h`;
    }
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const handleOpenChat = (phoneNumber: string) => {
    if (onOpenChat) {
      onOpenChat(phoneNumber);
    }
  };

  const handleViewDetails = (ticket: TicketContact) => {
    setSelectedTicket(ticket);
    setShowDetailsModal(true);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'aberto':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm font-medium">
            <AlertCircle className="w-4 h-4" />
            Aberto
          </span>
        );
      case 'em_processo':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-sm font-medium">
            <Clock className="w-4 h-4" />
            Em Processo
          </span>
        );
      case 'finalizado':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
            <CheckCircle2 className="w-4 h-4" />
            Finalizado
          </span>
        );
      default:
        return null;
    }
  };

  const filteredTickets = tickets.filter((ticket) => {
    if (filterStatus === 'todos') return true;
    return ticket.ticket_status === filterStatus;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-slate-600">Carregando histórico...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-gradient-to-br from-slate-50 to-blue-50 p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="animate-fadeIn">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Histórico de Chamados</h1>
          <p className="text-slate-600">Acompanhe o status de todos os atendimentos</p>
        </div>

        <div className="flex gap-3 animate-slideUp">
          <button
            onClick={() => setFilterStatus('todos')}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
              filterStatus === 'todos'
                ? 'bg-blue-500 text-white shadow-lg'
                : 'bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            Todos ({tickets.length})
          </button>
          <button
            onClick={() => setFilterStatus('aberto')}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
              filterStatus === 'aberto'
                ? 'bg-red-500 text-white shadow-lg'
                : 'bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            Abertos ({tickets.filter((t) => t.ticket_status === 'aberto').length})
          </button>
          <button
            onClick={() => setFilterStatus('em_processo')}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
              filterStatus === 'em_processo'
                ? 'bg-yellow-500 text-white shadow-lg'
                : 'bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            Em Processo ({tickets.filter((t) => t.ticket_status === 'em_processo').length})
          </button>
          <button
            onClick={() => setFilterStatus('finalizado')}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
              filterStatus === 'finalizado'
                ? 'bg-green-500 text-white shadow-lg'
                : 'bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            Finalizados ({tickets.filter((t) => t.ticket_status === 'finalizado').length})
          </button>
        </div>

        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden animate-slideUp" style={{ animationDelay: '0.1s' }}>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Contato</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Telefone</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Status</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Resumo</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Duração</th>
                  <th className="px-6 py-4 text-center text-sm font-semibold text-slate-700">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTickets.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                      Nenhum chamado encontrado
                    </td>
                  </tr>
                ) : (
                  filteredTickets.map((ticket) => (
                    <tr key={ticket.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white font-semibold">
                            {ticket.name ? ticket.name[0].toUpperCase() : <User className="w-5 h-5" />}
                          </div>
                          <div>
                            <div className="font-medium text-slate-900">{ticket.name || 'Sem nome'}</div>
                            <div className="text-xs text-slate-500">{ticket.department_name || 'Sem departamento'}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-slate-600">
                          <Phone className="w-4 h-4" />
                          <span className="font-mono text-sm">{formatPhone(ticket.phone_number)}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">{getStatusBadge(ticket.ticket_status)}</td>
                      <td className="px-6 py-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-sm text-slate-600">
                            <MessageCircle className="w-4 h-4 text-blue-500" />
                            <span className="font-medium">{ticket.message_count || 0}</span>
                            <span className="text-slate-500">mensagens</span>
                          </div>
                          {ticket.closed_by_name && (
                            <div className="flex items-center gap-2 text-xs text-slate-500">
                              <User className="w-3 h-3" />
                              Atendido por {ticket.closed_by_name}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-slate-600">
                          <Clock className="w-4 h-4" />
                          <span className="text-sm font-medium">
                            {calculateDuration(ticket.ticket_opened_at, ticket.ticket_closed_at)}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleViewDetails(ticket)}
                            className="px-3 py-2 bg-blue-50 text-blue-600 rounded-lg text-sm font-medium hover:bg-blue-100 transition-colors flex items-center gap-2"
                            title="Ver detalhes"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {onOpenChat && (
                            <button
                              onClick={() => handleOpenChat(ticket.phone_number)}
                              className="px-3 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg text-sm font-medium hover:from-blue-600 hover:to-blue-700 transition-all flex items-center gap-2"
                              title="Abrir chat"
                            >
                              <MessageCircle className="w-4 h-4" />
                              <ArrowRight className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showDetailsModal && selectedTicket && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowDetailsModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white text-2xl font-bold">
                    {selectedTicket.name ? selectedTicket.name[0].toUpperCase() : <User className="w-8 h-8" />}
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900">{selectedTicket.name || 'Sem nome'}</h2>
                    <p className="text-slate-600 flex items-center gap-2 mt-1">
                      <Phone className="w-4 h-4" />
                      {formatPhone(selectedTicket.phone_number)}
                    </p>
                  </div>
                </div>
                {getStatusBadge(selectedTicket.ticket_status)}
              </div>
            </div>

            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-blue-50 rounded-xl p-4">
                  <div className="flex items-center gap-2 text-blue-600 mb-2">
                    <MessageCircle className="w-5 h-5" />
                    <span className="font-semibold">Total de Mensagens</span>
                  </div>
                  <p className="text-3xl font-bold text-blue-700">{selectedTicket.message_count || 0}</p>
                </div>

                <div className="bg-green-50 rounded-xl p-4">
                  <div className="flex items-center gap-2 text-green-600 mb-2">
                    <Clock className="w-5 h-5" />
                    <span className="font-semibold">Duração Total</span>
                  </div>
                  <p className="text-3xl font-bold text-green-700">
                    {calculateDuration(selectedTicket.ticket_opened_at, selectedTicket.ticket_closed_at)}
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="bg-slate-50 rounded-xl p-4">
                  <div className="flex items-center gap-2 text-slate-700 mb-2">
                    <Calendar className="w-5 h-5" />
                    <span className="font-semibold">Informações do Chamado</span>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-600">Aberto em:</span>
                      <span className="font-medium text-slate-900">{formatDate(selectedTicket.ticket_opened_at)}</span>
                    </div>
                    {selectedTicket.ticket_closed_at && (
                      <div className="flex justify-between">
                        <span className="text-slate-600">Finalizado em:</span>
                        <span className="font-medium text-slate-900">{formatDate(selectedTicket.ticket_closed_at)}</span>
                      </div>
                    )}
                    {selectedTicket.department_name && (
                      <div className="flex justify-between">
                        <span className="text-slate-600">Departamento:</span>
                        <span className="font-medium text-slate-900">{selectedTicket.department_name}</span>
                      </div>
                    )}
                    {selectedTicket.closed_by_name && (
                      <div className="flex justify-between">
                        <span className="text-slate-600">Atendido por:</span>
                        <span className="font-medium text-slate-900">{selectedTicket.closed_by_name}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                {onOpenChat && (
                  <button
                    onClick={() => {
                      handleOpenChat(selectedTicket.phone_number);
                      setShowDetailsModal(false);
                    }}
                    className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl font-medium hover:from-blue-600 hover:to-blue-700 transition-all flex items-center justify-center gap-2 shadow-lg"
                  >
                    <MessageCircle className="w-5 h-5" />
                    Abrir Chat
                    <ArrowRight className="w-5 h-5" />
                  </button>
                )}
                {selectedTicket.ticket_status === 'finalizado' ? (
                  <button
                    onClick={() => {
                      handleReopenTicket(selectedTicket.id);
                      setShowDetailsModal(false);
                    }}
                    className="flex-1 px-6 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl font-medium hover:from-green-600 hover:to-green-700 transition-all flex items-center justify-center gap-2 shadow-lg"
                  >
                    <FolderOpen className="w-5 h-5" />
                    Reabrir Chamado
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      handleFinishTicket(selectedTicket.id);
                      setShowDetailsModal(false);
                    }}
                    className="flex-1 px-6 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl font-medium hover:from-green-600 hover:to-green-700 transition-all flex items-center justify-center gap-2 shadow-lg"
                  >
                    <CheckCircle2 className="w-5 h-5" />
                    Finalizar Chamado
                  </button>
                )}
              </div>

              <button
                onClick={() => setShowDetailsModal(false)}
                className="w-full px-6 py-3 bg-slate-100 text-slate-700 rounded-xl font-medium hover:bg-slate-200 transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {showToast && <Toast message={toastMessage} onClose={() => setShowToast(false)} />}
    </div>
  );
}
