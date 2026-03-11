import React, { useState, useEffect, useRef } from 'react';
import { Smile, Heart, ThumbsUp, Sparkles, Flag } from 'lucide-react';

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
}

type EmojiCategory = 'recent' | 'smileys' | 'gestures' | 'hearts' | 'symbols';

const emojiCategories = {
  recent: [],
  smileys: [
    '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂',
    '🙂', '🙃', '😉', '😊', '😇', '🥰', '😍', '🤩',
    '😘', '😗', '😚', '😙', '🥲', '😋', '😛', '😜',
    '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔', '🤐',
    '🤨', '😐', '😑', '😶', '😏', '😒', '🙄', '😬',
    '😮', '😯', '😲', '😳', '🥺', '😦', '😧', '😨',
    '😰', '😥', '😢', '😭', '😱', '😖', '😣', '😞',
    '😓', '😩', '😫', '🥱', '😤', '😡', '😠', '🤬',
    '😈', '👿', '💀', '☠️', '💩', '🤡', '👹', '👺',
    '👻', '👽', '👾', '🤖', '😺', '😸', '😹', '😻',
    '😼', '😽', '🙀', '😿', '😾'
  ],
  gestures: [
    '👋', '🤚', '🖐️', '✋', '🖖', '👌', '🤌', '🤏',
    '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆',
    '🖕', '👇', '☝️', '👍', '👎', '✊', '👊', '🤛',
    '🤜', '👏', '🙌', '👐', '🤲', '🤝', '🙏', '✍️',
    '💪', '🦾', '🦿', '🦵', '🦶', '👂', '🦻', '👃',
    '🧠', '🫀', '🫁', '🦷', '🦴', '👀', '👁️', '👅',
    '👄', '💋', '🩸'
  ],
  hearts: [
    '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍',
    '🤎', '💔', '❤️‍🔥', '❤️‍🩹', '💕', '💞', '💓', '💗',
    '💖', '💘', '💝', '💟', '💌', '💢', '💥', '💫',
    '💦', '💨', '🕳️', '💬', '💭', '🗨️', '🗯️', '💤'
  ],
  symbols: [
    '🎉', '🎊', '🎈', '🎁', '🏆', '🥇', '🥈', '🥉',
    '⭐', '🌟', '✨', '💫', '🔥', '💥', '⚡', '💧',
    '🌊', '🌈', '☀️', '🌙', '⭐', '🌠', '☄️', '💥',
    '✅', '❌', '⚠️', '❗', '❓', '💯', '🆗', '🆕',
    '🆙', '🆒', '🆓', '🔴', '🟠', '🟡', '🟢', '🔵',
    '🟣', '⚫', '⚪', '🟤', '🔺', '🔻', '🔸', '🔹',
    '🚀', '🎯', '📱', '💻', '⌨️', '🖥️', '🖨️', '🖱️',
    '📧', '📩', '📨', '📬', '📭', '📮', '📪', '📫',
    '📞', '☎️', '📲', '📳', '📴', '📵', '📶'
  ]
};

export const EmojiPicker: React.FC<EmojiPickerProps> = ({ onSelect }) => {
  const [showPicker, setShowPicker] = useState(false);
  const [activeCategory, setActiveCategory] = useState<EmojiCategory>('smileys');
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        setShowPicker(false);
      }
    };

    if (showPicker) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showPicker]);

  const handleEmojiSelect = (emoji: string) => {
    onSelect(emoji);
    setShowPicker(false);
  };

  return (
    <div className="relative" ref={pickerRef}>
      <button
        onClick={() => setShowPicker(!showPicker)}
        className="text-slate-500 hover:text-blue-500 transition-colors p-2 hover:bg-slate-100 rounded-lg"
        title="Emojis"
        type="button"
      >
        <Smile className="w-5 h-5" />
      </button>

      {showPicker && (
        <div className="absolute bottom-12 right-0 bg-white border border-slate-200 rounded-xl shadow-2xl w-96 z-50 overflow-hidden">
          {/* Header com categorias */}
          <div className="flex border-b border-slate-200 bg-slate-50 p-2">
            <button
              onClick={() => setActiveCategory('smileys')}
              className={`flex-1 p-2 rounded-lg transition-all ${
                activeCategory === 'smileys'
                  ? 'bg-white shadow-sm text-blue-600'
                  : 'text-slate-600 hover:bg-white/50'
              }`}
              title="Rostos e Emoções"
            >
              <Smile className="w-5 h-5 mx-auto" />
            </button>
            <button
              onClick={() => setActiveCategory('gestures')}
              className={`flex-1 p-2 rounded-lg transition-all ${
                activeCategory === 'gestures'
                  ? 'bg-white shadow-sm text-blue-600'
                  : 'text-slate-600 hover:bg-white/50'
              }`}
              title="Gestos e Mãos"
            >
              <ThumbsUp className="w-5 h-5 mx-auto" />
            </button>
            <button
              onClick={() => setActiveCategory('hearts')}
              className={`flex-1 p-2 rounded-lg transition-all ${
                activeCategory === 'hearts'
                  ? 'bg-white shadow-sm text-blue-600'
                  : 'text-slate-600 hover:bg-white/50'
              }`}
              title="Corações"
            >
              <Heart className="w-5 h-5 mx-auto" />
            </button>
            <button
              onClick={() => setActiveCategory('symbols')}
              className={`flex-1 p-2 rounded-lg transition-all ${
                activeCategory === 'symbols'
                  ? 'bg-white shadow-sm text-blue-600'
                  : 'text-slate-600 hover:bg-white/50'
              }`}
              title="Símbolos e Objetos"
            >
              <Sparkles className="w-5 h-5 mx-auto" />
            </button>
          </div>

          {/* Grid de emojis */}
          <div className="p-3">
            <div className="grid grid-cols-9 gap-1 max-h-72 overflow-y-auto">
              {emojiCategories[activeCategory].map((emoji, index) => (
                <button
                  key={`${emoji}-${index}`}
                  onClick={() => handleEmojiSelect(emoji)}
                  className="text-2xl hover:bg-slate-100 p-2 rounded-lg transition-all hover:scale-110 cursor-pointer"
                  type="button"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
