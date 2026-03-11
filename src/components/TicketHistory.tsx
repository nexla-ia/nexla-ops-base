import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { CheckCircle2, Clock, AlertCircle, User, Phone, MessageCircle, Eye, ArrowRight, FolderOpen, Loader2, RefreshCw } from 'lucide-react';
import Toast from './Toast';

interface TicketContact {
  id: string; phone_number: string; name: string;
  ticket_status: 'aberto' | 'em_processo' | 'finalizado';
  ticket_opened_at: string; ticket_closed_at: string | null; ticket_closed_by: string | null;
  department_id: string | null; department_name?: string; closed_by_name?: string; message_count?: number;
}

interface TicketHistoryProps { onOpenChat?: (phone: string) => void; }

type FilterType = 'todos' | 'aberto' | 'em_processo' | 'finalizado';

const STATUS = {
  aberto:      { label: 'Aberto',     color: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400',    dot: 'bg-red-500',    icon: AlertCircle  },
  em_processo: { label: 'Em processo',color: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400', dot: 'bg-amber-500', icon: Clock },
  finalizado:  { label: 'Finalizado', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400', dot: 'bg-emerald-500', icon: CheckCircle2 },
};

function fmtDate(d: string) { return new Date(d).toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' }); }
function fmtPhone(p: string) { const c = p.replace(/\D/g,''); if(c.length===13) return `+${c.slice(0,2)} (${c.slice(2,4)}) ${c.slice(4,9)}-${c.slice(9)}`; return p; }
function duration(a: string, b: string|null) { const d=(b?new Date(b):new Date()).getTime()-new Date(a).getTime(), h=Math.floor(d/3600000), m=Math.floor((d%3600000)/60000); if(h>24){const days=Math.floor(h/24);return`${days}d ${h%24}h`;}if(h>0)return`${h}h ${m}m`;return`${m}m`; }

export default function TicketHistory({ onOpenChat }: TicketHistoryProps = {}) {
  const { company, attendant } = useAuth();
  const [tickets, setTickets] = useState<TicketContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>('todos');
  const [toast, setToast] = useState('');
  const [selected, setSelected] = useState<TicketContact | null>(null);

  useEffect(() => { fetchTickets(); }, [company?.id, attendant?.company_id]);

  const fetchTickets = async () => {
    try {
      setLoading(true);
      const cid = company?.id || attendant?.company_id; if (!cid) return;
      const { data, error } = await supabase.from('contacts').select(`id,phone_number,name,ticket_status,ticket_opened_at,ticket_closed_at,ticket_closed_by,department_id,departments(name)`).eq('company_id', cid).order('ticket_opened_at', { ascending: false });
      if (error) throw error;
      const enriched = await Promise.all((data || []).map(async t => {
        let closedByName = null;
        if (t.ticket_closed_by) {
          const { data: att } = await supabase.from('attendants').select('name').eq('user_id', t.ticket_closed_by).maybeSingle();
          if (att) closedByName = att.name;
          else { const { data: co } = await supabase.from('companies').select('name').eq('user_id', t.ticket_closed_by).maybeSingle(); if(co) closedByName = co.name; }
        }
        const { count } = await supabase.from('messages').select('*', { count: 'exact', head: true }).eq('company_id', cid).eq('phone_number', t.phone_number);
        return { ...t, department_name: (t as any).departments?.name, closed_by_name: closedByName, message_count: count || 0 };
      }));
      setTickets(enriched as any);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const finish = async (id: string) => {
    const { data: { user } } = await supabase.auth.getUser(); if (!user) return;
    await supabase.from('contacts').update({ ticket_status: 'finalizado', ticket_closed_at: new Date().toISOString(), ticket_closed_by: user.id }).eq('id', id);
    setToast('Chamado finalizado!'); setSelected(null); fetchTickets();
  };
  const reopen = async (id: string) => {
    await supabase.from('contacts').update({ ticket_status: 'aberto', ticket_closed_at: null, ticket_closed_by: null }).eq('id', id);
    setToast('Chamado reaberto!'); setSelected(null); fetchTickets();
  };

  const counts = { todos: tickets.length, aberto: tickets.filter(t => t.ticket_status === 'aberto').length, em_processo: tickets.filter(t => t.ticket_status === 'em_processo').length, finalizado: tickets.filter(t => t.ticket_status === 'finalizado').length };
  const filtered = filter === 'todos' ? tickets : tickets.filter(t => t.ticket_status === filter);

  const filterBtns: { key: FilterType; label: string; countColor: string }[] = [
    { key: 'todos',      label: 'Todos',       countColor: 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300' },
    { key: 'aberto',     label: 'Abertos',     countColor: 'bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400' },
    { key: 'em_processo',label: 'Em processo', countColor: 'bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400' },
    { key: 'finalizado', label: 'Finalizados', countColor: 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' },
  ];

  return (
    <div className="p-6 w-full">
      <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Histórico de Chamados</h2>
          <p className="text-sm text-slate-500 mt-0.5">Acompanhe todos os atendimentos</p>
        </div>
        <button onClick={fetchTickets} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors" title="Atualizar">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2 mb-5">
        {filterBtns.map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${filter === f.key ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900' : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-300'}`}>
            {f.label}
            <span className={`text-xs font-bold px-1.5 py-0.5 rounded-md ${filter === f.key ? 'bg-white/20 dark:bg-black/20 text-white dark:text-slate-900' : f.countColor}`}>
              {counts[f.key]}
            </span>
          </button>
        ))}
      </div>

      {/* Tabela */}
      {loading ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>
      ) : (
        <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700">
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Contato</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide hidden sm:table-cell">Telefone</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide hidden md:table-cell">Msgs</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide hidden lg:table-cell">Duração</th>
                <th className="px-4 py-3 w-20 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50 bg-white dark:bg-slate-900">
              {filtered.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-sm text-slate-400">Nenhum chamado encontrado</td></tr>
              ) : filtered.map(t => {
                const st = STATUS[t.ticket_status] || STATUS.aberto;
                const StIcon = st.icon;
                const initials = t.name ? t.name[0].toUpperCase() : '?';
                return (
                  <tr key={t.id} className="group hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">{initials}</div>
                        <div>
                          <p className="text-sm font-medium text-slate-900 dark:text-white">{t.name || 'Sem nome'}</p>
                          {t.department_name && <p className="text-xs text-slate-400">{t.department_name}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <span className="text-sm font-mono text-slate-500">{fmtPhone(t.phone_number)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold ${st.color}`}>
                        <StIcon className="w-3 h-3" />{st.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <div className="flex items-center gap-1 text-sm text-slate-500">
                        <MessageCircle className="w-3.5 h-3.5" />{t.message_count || 0}
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <div className="flex items-center gap-1 text-sm text-slate-500">
                        <Clock className="w-3.5 h-3.5" />{duration(t.ticket_opened_at, t.ticket_closed_at)}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => setSelected(t)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg transition-all" title="Detalhes"><Eye className="w-3.5 h-3.5" /></button>
                        {onOpenChat && <button onClick={() => onOpenChat(t.phone_number)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg transition-all" title="Abrir chat"><ArrowRight className="w-3.5 h-3.5" /></button>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal detalhes */}
      </div> {/* fim max-w-5xl */}
      {selected && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setSelected(null)}>
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-md border border-slate-200 dark:border-slate-700" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 p-5 border-b border-slate-100 dark:border-slate-700">
              <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-semibold">{selected.name ? selected.name[0].toUpperCase() : '?'}</div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-900 dark:text-white">{selected.name || 'Sem nome'}</p>
                <p className="text-sm text-slate-500 flex items-center gap-1"><Phone className="w-3 h-3" />{fmtPhone(selected.phone_number)}</p>
              </div>
              {(() => { const st = STATUS[selected.ticket_status]; const I = st.icon; return <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${st.color}`}><I className="w-3 h-3" />{st.label}</span>; })()}
            </div>
            <div className="p-5 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3 text-center">
                  <p className="text-xs text-slate-500 mb-1">Mensagens</p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">{selected.message_count || 0}</p>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3 text-center">
                  <p className="text-xs text-slate-500 mb-1">Duração</p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">{duration(selected.ticket_opened_at, selected.ticket_closed_at)}</p>
                </div>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-slate-500">Aberto em</span><span className="text-slate-900 dark:text-white font-medium">{fmtDate(selected.ticket_opened_at)}</span></div>
                {selected.ticket_closed_at && <div className="flex justify-between"><span className="text-slate-500">Finalizado em</span><span className="text-slate-900 dark:text-white font-medium">{fmtDate(selected.ticket_closed_at)}</span></div>}
                {selected.department_name && <div className="flex justify-between"><span className="text-slate-500">Departamento</span><span className="text-slate-900 dark:text-white font-medium">{selected.department_name}</span></div>}
                {selected.closed_by_name && <div className="flex justify-between"><span className="text-slate-500">Atendido por</span><span className="text-slate-900 dark:text-white font-medium">{selected.closed_by_name}</span></div>}
              </div>
            </div>
            <div className="flex gap-2 p-5 pt-0">
              {onOpenChat && <button onClick={() => { onOpenChat(selected.phone_number); setSelected(null); }} className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"><MessageCircle className="w-4 h-4" /> Abrir chat</button>}
              {selected.ticket_status === 'finalizado'
                ? <button onClick={() => reopen(selected.id)} className="flex-1 flex items-center justify-center gap-2 py-2.5 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-sm font-medium rounded-lg transition-colors"><FolderOpen className="w-4 h-4" /> Reabrir</button>
                : <button onClick={() => finish(selected.id)} className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors"><CheckCircle2 className="w-4 h-4" /> Finalizar</button>
              }
            </div>
          </div>
        </div>
      )}

      {toast && <Toast message={toast} onClose={() => setToast('')} />}
    </div>
  );
}