import { MessageSquare } from 'lucide-react';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title?: string;
  description?: string;
}

export default function EmptyState({
  icon,
  title = "Selecione um contato para começar",
  description
}: EmptyStateProps) {
  return (
    <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50/20 to-slate-50 dark:from-black dark:via-black dark:to-black transition-colors duration-300">
      <div className="text-center text-slate-500 dark:text-slate-400 px-4">
        {icon || <MessageSquare className="w-24 h-24 mx-auto mb-4 text-slate-300 dark:text-slate-600" />}
        <p className="text-lg font-medium text-slate-600 dark:text-slate-400">{title}</p>
        {description && (
          <p className="text-sm text-slate-400 dark:text-slate-500 mt-2">{description}</p>
        )}
      </div>
    </div>
  );
}
