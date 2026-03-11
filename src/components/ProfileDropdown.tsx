import { History, Settings, LogOut, MessageSquare, Users, Briefcase, FolderTree, CircleUser as UserCircle2, Tag, CreditCard, Bell, X, CheckCheck, Info, AlertCircle, XCircle, Bot, ArrowRightLeft } from 'lucide-react';
const PaymentIcon = CreditCard;
import { useRef, useEffect } from 'react';

interface NotificationItem {
  id: string;
  company_id: string;
  title: string;
  message: string;
  type: 'payment' | 'info' | 'warning' | 'error';
  is_read: boolean;
  created_at: string;
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

const notificationTypeConfig = {
  payment: {
    icon: PaymentIcon,
    color: 'text-amber-500',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
  },
  info: {
    icon: Info,
    color: 'text-blue-500',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
  },
  warning: {
    icon: AlertCircle,
    color: 'text-orange-500',
    bg: 'bg-orange-50',
    border: 'border-orange-200',
  },
  error: {
    icon: XCircle,
    color: 'text-red-500',
    bg: 'bg-red-50',
    border: 'border-red-200',
  },
};

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Agora';
  if (diffMins < 60) return `${diffMins}m atras`;
  if (diffHours < 24) return `${diffHours}h atras`;
  return `${diffDays}d atras`;
}

export default function ProfileDropdown({
  userName,
  onHistoryClick,
  onSettingsClick,
  onLogout,
  onMessagesClick,
  onContactsClick,
  onTransfersClick,
  onDepartmentsClick,
  onSectorsClick,
  onAttendantsClick,
  onTagsClick,
  onMyPlanClick,
  onAgentClick,
  showNavigationOptions = false,
  showSettings = true,
  activeTab,
  notifications = [],
  unreadNotificationsCount = 0,
  onMarkNotificationRead,
  onMarkAllNotificationsRead,
  showNotificationsPanel = false,
  onToggleNotificationsPanel,
}: ProfileDropdownProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showNotificationsPanel) return;
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onToggleNotificationsPanel?.();
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showNotificationsPanel, onToggleNotificationsPanel]);

  return (
    <header className="fixed top-0 left-0 right-0 h-14 bg-slate-900 z-50 shadow-lg">
      <div className="h-full flex items-center justify-between px-4">
        <div className="flex items-center gap-1">
          {showNavigationOptions && (
            <>
              {onMessagesClick && (
                <button
                  onClick={onMessagesClick}
                  className={`relative flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-200 ${
                    activeTab === 'mensagens'
                      ? 'bg-blue-500/20 text-blue-400'
                      : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <MessageSquare className="w-4 h-4" />
                  <span className="text-sm font-medium hidden sm:inline">Mensagens</span>
                  {activeTab === 'mensagens' && (
                    <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-blue-500 rounded-full" />
                  )}
                </button>
              )}

              {onContactsClick && (
                <button
                  onClick={onContactsClick}
                  className={`relative flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-200 ${
                    activeTab === 'contatos'
                      ? 'bg-blue-500/20 text-blue-400'
                      : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <Users className="w-4 h-4" />
                  <span className="text-sm font-medium hidden sm:inline">Contatos</span>
                  {activeTab === 'contatos' && (
                    <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-blue-500 rounded-full" />
                  )}
                </button>
              )}

              {onTransfersClick && (
                <button
                  onClick={onTransfersClick}
                  className={`relative flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-200 ${
                    activeTab === 'transferencias'
                      ? 'bg-blue-500/20 text-blue-400'
                      : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <ArrowRightLeft className="w-4 h-4" />
                  <span className="text-sm font-medium hidden sm:inline">Transferências</span>
                  {activeTab === 'transferencias' && (
                    <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-blue-500 rounded-full" />
                  )}
                </button>
              )}

              {onDepartmentsClick && (
                <button
                  onClick={onDepartmentsClick}
                  className={`relative flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-200 ${
                    activeTab === 'departamentos'
                      ? 'bg-blue-500/20 text-blue-400'
                      : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <Briefcase className="w-4 h-4" />
                  <span className="text-sm font-medium hidden sm:inline">Departamentos</span>
                  {activeTab === 'departamentos' && (
                    <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-blue-500 rounded-full" />
                  )}
                </button>
              )}

              {onSectorsClick && (
                <button
                  onClick={onSectorsClick}
                  className={`relative flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-200 ${
                    activeTab === 'setores'
                      ? 'bg-blue-500/20 text-blue-400'
                      : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <FolderTree className="w-4 h-4" />
                  <span className="text-sm font-medium hidden sm:inline">Setores</span>
                  {activeTab === 'setores' && (
                    <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-blue-500 rounded-full" />
                  )}
                </button>
              )}

              {onAttendantsClick && (
                <button
                  onClick={onAttendantsClick}
                  className={`relative flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-200 ${
                    activeTab === 'atendentes'
                      ? 'bg-blue-500/20 text-blue-400'
                      : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <UserCircle2 className="w-4 h-4" />
                  <span className="text-sm font-medium hidden sm:inline">Atendentes</span>
                  {activeTab === 'atendentes' && (
                    <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-blue-500 rounded-full" />
                  )}
                </button>
              )}

              {onTagsClick && (
                <button
                  onClick={onTagsClick}
                  className={`relative flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-200 ${
                    activeTab === 'tags'
                      ? 'bg-blue-500/20 text-blue-400'
                      : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <Tag className="w-4 h-4" />
                  <span className="text-sm font-medium hidden sm:inline">Tags</span>
                  {activeTab === 'tags' && (
                    <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-blue-500 rounded-full" />
                  )}
                </button>
              )}

              {onAgentClick && (
                <button
                  onClick={onAgentClick}
                  className={`relative flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-200 ${
                    activeTab === 'agente'
                      ? 'bg-blue-500/20 text-blue-400'
                      : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <Bot className="w-4 h-4" />
                  <span className="text-sm font-medium hidden sm:inline">Agente</span>
                  {activeTab === 'agente' && (
                    <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-blue-500 rounded-full" />
                  )}
                </button>
              )}

              {onMyPlanClick && (
                <button
                  onClick={onMyPlanClick}
                  className={`relative flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-200 ${
                    activeTab === 'meu-plano'
                      ? 'bg-blue-500/20 text-blue-400'
                      : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <CreditCard className="w-4 h-4" />
                  <span className="text-sm font-medium hidden sm:inline">Meu Plano</span>
                  {activeTab === 'meu-plano' && (
                    <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-blue-500 rounded-full" />
                  )}
                </button>
              )}

              <div className="w-px h-6 bg-slate-700 mx-2 hidden sm:block" />
            </>
          )}

          <button
            onClick={onHistoryClick}
            className={`relative flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-200 ${
              activeTab === 'historico'
                ? 'bg-blue-500/20 text-blue-400'
                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <History className="w-4 h-4" />
            <span className="text-sm font-medium hidden sm:inline">Historico</span>
            {activeTab === 'historico' && (
              <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-blue-500 rounded-full" />
            )}
          </button>

          {showSettings && (
            <button
              onClick={onSettingsClick}
              className={`relative flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-200 ${
                activeTab === 'configuracoes'
                  ? 'bg-blue-500/20 text-blue-400'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Settings className="w-4 h-4" />
              <span className="text-sm font-medium hidden sm:inline">Configuracoes</span>
              {activeTab === 'configuracoes' && (
                <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-blue-500 rounded-full" />
              )}
            </button>
          )}
        </div>

        <div className="flex items-center gap-3">
          {onToggleNotificationsPanel && (
            <div className="relative" ref={panelRef}>
              <button
                onClick={onToggleNotificationsPanel}
                className={`relative p-2 rounded-lg transition-all duration-200 ${
                  showNotificationsPanel
                    ? 'bg-slate-700 text-white'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}
                title="Notificacoes"
              >
                <Bell className="w-5 h-5" />
                {unreadNotificationsCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-4 h-4 flex items-center justify-center shadow-lg leading-none">
                    {unreadNotificationsCount > 9 ? '9+' : unreadNotificationsCount}
                  </span>
                )}
              </button>

              {showNotificationsPanel && (
                <div className="absolute right-0 top-full mt-2 w-96 bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden z-50">
                  <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200">
                    <div className="flex items-center gap-2">
                      <Bell className="w-4 h-4 text-slate-600" />
                      <span className="font-semibold text-slate-800 text-sm">Notificacoes</span>
                      {unreadNotificationsCount > 0 && (
                        <span className="bg-red-500 text-white text-xs font-bold rounded-full px-1.5 py-0.5 leading-none">
                          {unreadNotificationsCount}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {unreadNotificationsCount > 0 && onMarkAllNotificationsRead && (
                        <button
                          onClick={onMarkAllNotificationsRead}
                          className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 transition-colors font-medium"
                          title="Marcar todas como lidas"
                        >
                          <CheckCheck className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Marcar todas</span>
                        </button>
                      )}
                      <button
                        onClick={onToggleNotificationsPanel}
                        className="p-1 text-slate-400 hover:text-slate-600 rounded transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="max-h-[400px] overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                        <Bell className="w-10 h-10 text-slate-300 mb-3" />
                        <p className="text-slate-500 text-sm font-medium">Nenhuma notificacao</p>
                        <p className="text-slate-400 text-xs mt-1">Voce esta em dia!</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-100">
                        {notifications.map((notif) => {
                          const cfg = notificationTypeConfig[notif.type] || notificationTypeConfig.info;
                          const Icon = cfg.icon;
                          return (
                            <div
                              key={notif.id}
                              className={`px-4 py-3 transition-colors ${
                                notif.is_read ? 'bg-white hover:bg-slate-50' : 'bg-blue-50/40 hover:bg-blue-50/60'
                              }`}
                            >
                              <div className="flex items-start gap-3">
                                <div className={`flex-shrink-0 w-8 h-8 rounded-lg ${cfg.bg} flex items-center justify-center mt-0.5`}>
                                  <Icon className={`w-4 h-4 ${cfg.color}`} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-start justify-between gap-2">
                                    <p className={`text-sm font-medium leading-snug ${notif.is_read ? 'text-slate-700' : 'text-slate-900'}`}>
                                      {notif.title}
                                    </p>
                                    {!notif.is_read && (
                                      <span className="flex-shrink-0 w-2 h-2 bg-blue-500 rounded-full mt-1.5" />
                                    )}
                                  </div>
                                  <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{notif.message}</p>
                                  <div className="flex items-center justify-between mt-1.5">
                                    <span className="text-xs text-slate-400">{formatRelativeTime(notif.created_at)}</span>
                                    {!notif.is_read && onMarkNotificationRead && (
                                      <button
                                        onClick={() => onMarkNotificationRead(notif.id)}
                                        className="text-xs text-blue-600 hover:text-blue-800 transition-colors font-medium"
                                      >
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

          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold text-xs">
              {userName.charAt(0).toUpperCase()}
            </div>
            <span className="text-sm font-medium text-white hidden md:inline">{userName}</span>
          </div>

          <button
            onClick={onLogout}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-red-400 hover:bg-red-950/50 hover:text-red-300 transition-all duration-200"
            title="Sair"
          >
            <LogOut className="w-4 h-4" />
            <span className="text-sm font-medium hidden sm:inline">Sair</span>
          </button>
        </div>
      </div>
    </header>
  );
}