import { User, Menu, Tag, ArrowRightLeft, Building2, CheckCircle2, FolderOpen, FolderTree, Phone } from 'lucide-react';

interface ChatHeaderProps {
  contactName: string;
  contactPhone: string;
  onToggleSidebar: () => void;
  onOpenTransferModal?: () => void;
  onOpenTagModal?: () => void;
  onCloseTicket?: () => void;
  onReopenTicket?: () => void;
  isFinalized?: boolean;
  tags?: Array<{ id: string; name: string; color: string }>;
  departmentBadge?: { show: boolean; text: string };
  sectorBadge?: { show: boolean; text: string };
}

export default function ChatHeader({
  contactName,
  contactPhone,
  onToggleSidebar,
  onOpenTransferModal,
  onOpenTagModal,
  onCloseTicket,
  onReopenTicket,
  isFinalized = false,
  tags = [],
  departmentBadge,
  sectorBadge,
}: ChatHeaderProps) {
  const initial = contactName ? contactName[0].toUpperCase() : null;

  // Cor consistente por nome
  const colors = [
    'from-blue-500 to-blue-600',
    'from-violet-500 to-purple-600',
    'from-emerald-500 to-teal-600',
    'from-rose-500 to-pink-600',
    'from-amber-500 to-orange-500',
    'from-cyan-500 to-sky-600',
  ];
  const colorIdx = contactName
    ? Math.abs(contactName.charCodeAt(0) % colors.length)
    : 0;
  const avatarColor = colors[colorIdx];

  return (
    <div className="bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-700/60 px-4 py-3 flex items-center justify-between shadow-sm transition-colors duration-200">
      {/* Esquerda: toggle + avatar + info */}
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <button
          onClick={onToggleSidebar}
          className="md:hidden p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Avatar com indicador de status */}
        <div className="relative flex-shrink-0">
          <div className={`w-11 h-11 bg-gradient-to-br ${avatarColor} rounded-full flex items-center justify-center text-white font-bold text-base shadow-md`}>
            {initial ?? <User className="w-5 h-5" />}
          </div>
          {/* Bolinha de status */}
          <span className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white dark:border-slate-900 ${isFinalized ? 'bg-slate-400' : 'bg-emerald-400'}`} />
        </div>

        {/* Nome, número e badges */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold text-slate-900 dark:text-white text-sm truncate">
              {contactName || contactPhone}
            </h2>
            <span className={`flex-shrink-0 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ${
              isFinalized
                ? 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                : 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
            }`}>
              {isFinalized ? 'Finalizado' : 'Ativo'}
            </span>
          </div>

          <div className="flex items-center gap-1.5 mt-0.5">
            <Phone className="w-3 h-3 text-slate-400 flex-shrink-0" />
            <p className="text-xs text-slate-500 dark:text-slate-400 font-mono truncate">
              {contactPhone}
            </p>
          </div>

          {/* Badges de dept, setor e tags */}
          {(departmentBadge?.show || sectorBadge?.show || tags.length > 0) && (
            <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
              {departmentBadge?.show && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-sky-50 dark:bg-sky-900/30 text-sky-700 dark:text-sky-400 text-[10px] font-medium rounded-full border border-sky-200 dark:border-sky-700">
                  <Building2 className="w-2.5 h-2.5" />
                  {departmentBadge.text}
                </span>
              )}
              {sectorBadge?.show && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-violet-50 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400 text-[10px] font-medium rounded-full border border-violet-200 dark:border-violet-700">
                  <FolderTree className="w-2.5 h-2.5" />
                  {sectorBadge.text}
                </span>
              )}
              {tags.map((tag) => (
                <span
                  key={tag.id}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium text-white"
                  style={{ backgroundColor: tag.color }}
                >
                  <Tag className="w-2.5 h-2.5" />
                  {tag.name}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Direita: ações */}
      <div className="flex items-center gap-2 flex-shrink-0 ml-3">
        {onOpenTransferModal && (
          <button
            onClick={onOpenTransferModal}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg transition-all"
            title="Transferir"
          >
            <ArrowRightLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Transferir</span>
          </button>
        )}

        {onOpenTagModal && (
          <button
            onClick={onOpenTagModal}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg transition-all"
            title="Tags"
          >
            <Tag className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Tags</span>
          </button>
        )}

        {!isFinalized && onCloseTicket && (
          <button
            onClick={onCloseTicket}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-500 hover:bg-emerald-600 rounded-lg transition-all shadow-sm shadow-emerald-200 dark:shadow-none"
            title="Finalizar atendimento"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Finalizar</span>
          </button>
        )}

        {isFinalized && onReopenTicket && (
          <button
            onClick={onReopenTicket}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-500 hover:bg-blue-600 rounded-lg transition-all shadow-sm"
            title="Reabrir atendimento"
          >
            <FolderOpen className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Reabrir</span>
          </button>
        )}
      </div>
    </div>
  );
}