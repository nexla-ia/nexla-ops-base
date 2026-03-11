import { Send, Paperclip, Image as ImageIcon, Loader2, Smile } from 'lucide-react';
import { EmojiPicker } from '../EmojiPicker';

interface MessageInputProps {
  messageText: string;
  onMessageChange: (text: string) => void;
  onSend: () => void;
  onFileSelect: () => void;
  onImageSelect: () => void;
  onPaste?: (e: React.ClipboardEvent<HTMLTextAreaElement>) => void;
  sending: boolean;
  uploadingFile: boolean;
  disabled?: boolean;
  placeholder?: string;
}

export default function MessageInput({
  messageText,
  onMessageChange,
  onSend,
  onFileSelect,
  onImageSelect,
  onPaste,
  sending,
  uploadingFile,
  disabled = false,
  placeholder = 'Digite uma mensagem...',
}: MessageInputProps) {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  const canSend = !sending && !uploadingFile && !disabled && messageText.trim().length > 0;

  return (
    <div className="bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-700/60 px-4 py-3 transition-colors duration-200">
      <div className="flex items-end gap-2">
        {/* Anexos */}
        <div className="flex items-center gap-1 flex-shrink-0 pb-1">
          <button
            onClick={onImageSelect}
            disabled={disabled}
            className="p-2 text-slate-400 dark:text-slate-500 hover:text-blue-500 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-slate-800 rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            title="Enviar imagem"
          >
            <ImageIcon className="w-5 h-5" />
          </button>
          <button
            onClick={onFileSelect}
            disabled={disabled}
            className="p-2 text-slate-400 dark:text-slate-500 hover:text-blue-500 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-slate-800 rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            title="Anexar arquivo"
          >
            <Paperclip className="w-5 h-5" />
          </button>
        </div>

        {/* Caixa de texto */}
        <div className="flex-1 relative flex items-end bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-2xl focus-within:border-blue-400 dark:focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100 dark:focus-within:ring-blue-900/40 transition-all overflow-hidden">
          <textarea
            value={messageText}
            onChange={(e) => onMessageChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={onPaste}
            disabled={disabled}
            placeholder={placeholder}
            rows={1}
            className="flex-1 bg-transparent text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 text-sm px-4 py-3 focus:outline-none resize-none min-h-[44px] max-h-[120px] disabled:opacity-50 disabled:cursor-not-allowed leading-relaxed"
            style={{ scrollbarWidth: 'none' }}
          />
          <div className="flex-shrink-0 pb-2 pr-2">
            <EmojiPicker
              onEmojiSelect={(emoji) => onMessageChange(messageText + emoji)}
            />
          </div>
        </div>

        {/* Botão enviar */}
        <button
          onClick={onSend}
          disabled={!canSend}
          className={`flex-shrink-0 mb-0.5 w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 ${
            canSend
              ? 'bg-blue-500 hover:bg-blue-600 text-white shadow-md shadow-blue-200 dark:shadow-none hover:scale-105 active:scale-95'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-300 dark:text-slate-600 cursor-not-allowed'
          }`}
          title="Enviar"
        >
          {sending || uploadingFile ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
        </button>
      </div>

      <p className="text-[10px] text-slate-400 dark:text-slate-600 mt-1.5 ml-1 select-none">
        Enter para enviar · Shift+Enter para nova linha
      </p>
    </div>
  );
}