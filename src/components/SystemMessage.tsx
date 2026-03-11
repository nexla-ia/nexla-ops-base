import React from 'react';
import { Message } from '../lib/supabase';
import { ArrowRightLeft } from 'lucide-react';

interface SystemMessageProps {
  message: Message;
}

export const SystemMessage: React.FC<SystemMessageProps> = ({ message }) => {
  const isTransfer = message.message_type === 'system_transfer';

  if (!isTransfer) {
    return null;
  }

  return (
    <div className="flex justify-center items-center my-4 px-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="bg-gradient-to-r from-blue-50 to-blue-100/50 border border-blue-200/80 rounded-xl px-6 py-3.5 text-center max-w-3xl shadow-md hover:shadow-lg transition-shadow duration-200 backdrop-blur-sm">
        <div className="flex items-center justify-center gap-2.5">
          <div className="p-1.5 bg-blue-500/10 rounded-full">
            <ArrowRightLeft className="w-4 h-4 text-blue-600" />
          </div>
          <p className="text-blue-900 text-sm font-medium leading-relaxed">
            {message.message}
          </p>
        </div>
        <p className="text-blue-600/80 text-xs mt-2 font-medium">
          {new Date(message.created_at).toLocaleString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
          })}
        </p>
      </div>
    </div>
  );
};

export default SystemMessage;
