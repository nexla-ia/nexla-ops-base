import {
  History, Settings, LogOut, MessageSquare, Users, Briefcase,
  FolderTree, CircleUser as UserCircle2, Tag, CreditCard, Bell,
  X, CheckCheck, Info, AlertCircle, XCircle, CreditCard as PaymentIcon,
  Bot, Menu, ChevronRight
} from 'lucide-react';
import { useRef, useEffect, useState } from 'react';

interface NotificationItem {
  id: string; company_id: string; title: string; message: string;
  type: 'payment' | 'info' | 'warning' | 'error'; is_read: boolean; created_at: string;
}

interface ProfileDropdownProps {
  userName: string;
  onHistoryClick: () => void;
  onSettingsClick: () => void;
  onLogout: () => void;
  onMessagesClick?: () => void;
  onContactsClick?: () => void;
  onTransfersClick?: () => void;
  onDepartmentsClick?: () => void;
  onSectorsClick?: () => void;
  onAttendantsClick?: () => void;
  onTagsClick?: () => void;
  onMyPlanClick?: () => void;
  onAgentClick?: () => void;
  showNavigationOptions?: boolean;
  showSettings?: boolean;
  activeTab?: string;
  isOpen: boolean;
  onToggle: () => void;
  notifications?: NotificationItem[];
  unreadNotificationsCount?: number;
  onMarkNotificationRead?: (id: string) => void;
  onMarkAllNotificationsRead?: () => void;
  showNotificationsPanel?: boolean;
  onToggleNotificationsPanel?: () => void;
}

const notifConfig = {
  payment: { icon: PaymentIcon, color: 'text-amber-500', bg: 'bg-amber-50' },
  info:    { icon: Info,         color: 'text-blue-500',  bg: 'bg-blue-50'  },
  warning: { icon: AlertCircle,  color: 'text-orange-500',bg: 'bg-orange-50'},
  error:   { icon: XCircle,      color: 'text-red-500',   bg: 'bg-red-50'   },
};

function relTime(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000), h = Math.floor(m / 60), d = Math.floor(h / 24);
  if (m < 1) return 'Agora'; if (m < 60) return `${m}m`; if (h < 24) return `${h}h`; return `${d}d`;
}

export default function ProfileDropdown({
  userName, onHistoryClick, onSettingsClick, onLogout,
  onMessagesClick, onContactsClick, onDepartmentsClick, onSectorsClick,
  onAttendantsClick, onTagsClick, onMyPlanClick, onAgentClick,
  showNavigationOptions = false, showSettings = true, activeTab,
  notifications = [], unreadNotificationsCount = 0,
  onMarkNotificationRead, onMarkAllNotificationsRead,
  showNotificationsPanel = false, onToggleNotificationsPanel,
}: ProfileDropdownProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Fecha painel de notificações clicando fora
  useEffect(() => {
    if (!showNotificationsPanel) return;
    const h = (e: MouseEvent) => { if (panelRef.current && !panelRef.current.contains(e.target as Node)) onToggleNotificationsPanel?.(); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [showNotificationsPanel]);

  // Fecha menu mobile clicando fora
  useEffect(() => {
    if (!mobileOpen) return;
    const h = (e: MouseEvent) => { if (mobileMenuRef.current && !mobileMenuRef.current.contains(e.target as Node)) setMobileOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [mobileOpen]);

  const navItems = [
    { key: 'mensagens',     label: 'Mensagens',     icon: MessageSquare, fn: onMessagesClick },
    { key: 'contatos',      label: 'Contatos',      icon: Users,         fn: onContactsClick },
    { key: 'departamentos', label: 'Departamentos', icon: Briefcase,     fn: onDepartmentsClick },
    { key: 'setores',       label: 'Setores',       icon: FolderTree,    fn: onSectorsClick },
    { key: 'atendentes',    label: 'Atendentes',    icon: UserCircle2,   fn: onAttendantsClick },
    { key: 'tags',          label: 'Tags',          icon: Tag,           fn: onTagsClick },
    { key: 'agente',        label: 'Agente',        icon: Bot,           fn: onAgentClick },
    { key: 'meu-plano',     label: 'Meu Plano',     icon: CreditCard,    fn: onMyPlanClick },
    { key: 'historico',     label: 'Histórico',     icon: History,       fn: onHistoryClick },
    { key: 'configuracoes', label: 'Configurações', icon: Settings,      fn: onSettingsClick },
  ].filter(item => item.fn);

  const handleNav = (fn?: () => void) => { fn?.(); setMobileOpen(false); };

  return (
    <header className="fixed top-0 left-0 right-0 h-14 bg-slate-900 z-50 border-b border-slate-800">
      <div className="h-full flex items-center justify-between px-3 sm:px-4">

        {/* ── Nav desktop ── */}
        <nav className="flex items-center gap-0.5 overflow-x-auto scrollbar-none">
          {showNavigationOptions && navItems.map(({ key, label, icon: Icon, fn }) => {
            const isActive = activeTab === key;
            return (
              <button key={key} onClick={() => handleNav(fn)}
                className={`relative flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-sm font-medium transition-all duration-150 whitespace-nowrap flex-shrink-0 ${
                  isActive ? 'text-white bg-slate-700/80' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span className="hidden lg:inline">{label}</span>
                {/* Underline ativo */}
                {isActive && (
                  <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-blue-500 rounded-full" />
                )}
              </button>
            );
          })}
        </nav>

        {/* ── Direita: notif + user + logout ── */}
        <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0 ml-2">

          {/* Botão menu mobile — aparece só quando há muitos itens */}
          {showNavigationOptions && (
            <div className="relative lg:hidden" ref={mobileMenuRef}>
              <button onClick={() => setMobileOpen(v => !v)}
                className={`p-2 rounded-lg transition-colors ${mobileOpen ? 'bg-slate-700 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
                <Menu className="w-4 h-4" />
              </button>

              {/* Drawer mobile */}
              {mobileOpen && (
                <div className="absolute right-0 top-full mt-2 w-52 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl overflow-hidden"
                  style={{ animation: 'fadeSlideDown 0.15s ease-out' }}>
                  <style>{`@keyframes fadeSlideDown{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}}`}</style>
                  <div className="p-1.5">
                    {navItems.map(({ key, label, icon: Icon, fn }) => {
                      const isActive = activeTab === key;
                      return (
                        <button key={key} onClick={() => handleNav(fn)}
                          className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-colors ${
                            isActive ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                          }`}>
                          <div className="flex items-center gap-2.5">
                            <Icon className="w-4 h-4" />
                            <span className="font-medium">{label}</span>
                          </div>
                          {isActive && <ChevronRight className="w-3.5 h-3.5 opacity-70" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Notificações */}
          {onToggleNotificationsPanel && (
            <div className="relative" ref={panelRef}>
              <button onClick={onToggleNotificationsPanel}
                className={`relative p-2 rounded-lg transition-colors ${showNotificationsPanel ? 'bg-slate-700 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
                <Bell className="w-4 h-4" />
                {unreadNotificationsCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center leading-none">
                    {unreadNotificationsCount > 9 ? '9+' : unreadNotificationsCount}
                  </span>
                )}
              </button>

              {showNotificationsPanel && (
                <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden z-50"
                  style={{ animation: 'fadeSlideDown 0.15s ease-out' }}>
                  <style>{`@keyframes fadeSlideDown{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}}`}</style>
                  <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <Bell className="w-4 h-4 text-slate-500" />
                      <span className="font-semibold text-slate-800 text-sm">Notificações</span>
                      {unreadNotificationsCount > 0 && (
                        <span className="bg-red-500 text-white text-xs font-bold rounded-full px-1.5 py-0.5 leading-none">{unreadNotificationsCount}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      {unreadNotificationsCount > 0 && onMarkAllNotificationsRead && (
                        <button onClick={onMarkAllNotificationsRead}
                          className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 px-2 py-1 rounded-lg hover:bg-blue-50 transition-colors font-medium">
                          <CheckCheck className="w-3.5 h-3.5" /> Marcar todas
                        </button>
                      )}
                      <button onClick={onToggleNotificationsPanel}
                        className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="max-h-96 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-10 text-center px-4">
                        <Bell className="w-8 h-8 text-slate-300 mb-2" />
                        <p className="text-sm font-medium text-slate-500">Nenhuma notificação</p>
                        <p className="text-xs text-slate-400 mt-0.5">Você está em dia!</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-100">
                        {notifications.map(n => {
                          const cfg = notifConfig[n.type] || notifConfig.info;
                          const Icon = cfg.icon;
                          return (
                            <div key={n.id} className={`px-4 py-3 transition-colors ${n.is_read ? 'hover:bg-slate-50' : 'bg-blue-50/40 hover:bg-blue-50/60'}`}>
                              <div className="flex items-start gap-3">
                                <div className={`flex-shrink-0 w-7 h-7 rounded-lg ${cfg.bg} flex items-center justify-center mt-0.5`}>
                                  <Icon className={`w-3.5 h-3.5 ${cfg.color}`} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-start justify-between gap-2">
                                    <p className={`text-sm font-medium leading-snug ${n.is_read ? 'text-slate-700' : 'text-slate-900'}`}>{n.title}</p>
                                    {!n.is_read && <span className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-1.5 flex-shrink-0" />}
                                  </div>
                                  <p className="text-xs text-slate-500 mt-0.5">{n.message}</p>
                                  <div className="flex items-center justify-between mt-1.5">
                                    <span className="text-xs text-slate-400">{relTime(n.created_at)}</span>
                                    {!n.is_read && onMarkNotificationRead && (
                                      <button onClick={() => onMarkNotificationRead(n.id)}
                                        className="text-xs text-blue-600 hover:text-blue-800 font-medium transition-colors">
                                        Marcar como lida
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Usuário */}
          <div className="flex items-center gap-2 pl-1">
            <div className="w-7 h-7 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
              {userName.charAt(0).toUpperCase()}
            </div>
            <span className="text-sm font-medium text-slate-300 hidden md:inline max-w-[120px] truncate">{userName}</span>
          </div>

          {/* Logout */}
          <button onClick={onLogout}
            className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-slate-400 hover:bg-red-950/60 hover:text-red-400 transition-colors">
            <LogOut className="w-4 h-4" />
            <span className="text-sm font-medium hidden sm:inline">Sair</span>
          </button>
        </div>
      </div>
    </header>
  );
}