import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { supabase, Message } from '../lib/supabase';
import { MessageSquare, LogOut, MoreVertical, Search, AlertCircle, CheckCheck, FileText, Download, User, Menu, X, Send, Paperclip, Image as ImageIcon, Mic, Play, Pause, Loader2, Tag, ArrowRightLeft, Building2, Pin, Bot, CheckCircle2, FolderOpen, Users, Plus, Edit2, Trash2, Phone } from 'lucide-react';
import Modal from './Modal';
import Toast from './Toast';
import { EmojiPicker } from './EmojiPicker';
import SystemMessage from './SystemMessage';
import ProfileDropdown from './ProfileDropdown';
import TicketHistory from './TicketHistory';
import { useRealtimeMessages, useRealtimeContacts, useRealtimeDepartments, useRealtimeSectors, useAiEnabled } from '../hooks';
import { linkifyText } from '../lib/linkifyText';

interface Contact {
  phoneNumber: string;
  name: string;
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
  messages: Message[];
  department_id?: string;
  sector_id?: string;
  tag_ids?: string[];
  contact_db_id?: string;
}

interface ContactDB {
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
  ticket_status?: string;
  ticket_closed_at?: string | null;
  ticket_closed_by?: string | null;
  attendant_id?: string | null;
}

interface Department {
  id: string;
  name: string;
  company_id: string | null;
  is_reception?: boolean | null;
  is_default?: boolean | null;
}

interface Sector {
  id: string;
  name: string;
}

interface TagItem {
  id: string;
  name: string;
  color: string;
}

function normalizePhone(input?: string | null): string {
  if (!input) return '';
  const noJid = input.includes('@') ? input.split('@')[0] : input;
  let digits = noJid.replace(/\D/g, '');

  // Remover 9 duplicado após o DDD
  // Formato esperado: 55 (DDI) + 2 dígitos (DDD) + 9 dígitos
  // Se vier: 5569999145425 (13 dígitos com 9 duplicado)
  // Deve virar: 556999145425 (12 dígitos corretos)
  if (digits.length === 13 && digits.startsWith('55')) {
    const ddd = digits.substring(2, 4);
    const resto = digits.substring(4);
    // Se após DDD começar com 99, remover o primeiro 9
    if (resto.startsWith('99')) {
      digits = '55' + ddd + resto.substring(1);
    }
  }

  return digits;
}

// Para consultas no banco (se o número vier sem DDI 55 ou com sufixo @...)
function normalizeDbPhone(input?: string | null): string {
  const digits = normalizePhone(input);
  if (!digits) return '';
  return digits.startsWith('55') ? digits : `55${digits}`;
}

function getAvatarColor(input: string): string {
  const colors = [
    'from-blue-500 to-blue-600',
    'from-emerald-500 to-emerald-600',
    'from-amber-500 to-amber-600',
    'from-rose-500 to-rose-600',
    'from-sky-500 to-sky-600',
    'from-purple-500 to-purple-600',
    'from-pink-500 to-pink-600',
    'from-indigo-500 to-indigo-600',
    'from-cyan-500 to-cyan-600',
    'from-teal-500 to-teal-600',
  ];
  if (!input) return colors[0];
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) - hash) + input.charCodeAt(i);
    hash = hash & hash;
  }
  return colors[Math.abs(hash) % colors.length];
}

export default function AttendantDashboard() {
  const { attendant, company, signOut } = useAuth();
  const { settings } = useTheme();
  const aiEnabled = useAiEnabled(company?.id || null);
  const [currentView, setCurrentView] = useState<'mensagens' | 'contatos' | 'transferencias' | 'historico' | 'configuracoes'>('mensagens');
  const [messages, setMessages] = useState<Message[]>([]);
  const [contactsDB, setContactsDB] = useState<ContactDB[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedContact, setSelectedContact] = useState<string | null>(null);
  const [contactFilter, setContactFilter] = useState<'todos' | 'departamento' | 'abertos'>('abertos');
  const [attendantsList, setAttendantsList] = useState<{id: string; user_id: string; name: string}[]>([]);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [loadingMoreMessages, setLoadingMoreMessages] = useState(false);

  // Cache para evitar múltiplas buscas no fallback de contatos
  const fetchedPhonesRef = useRef<Set<string>>(new Set());

  const fetchAndCacheContactByPhone = useCallback(async (phone: string) => {
    const phoneNormalized = normalizeDbPhone(phone);
    if (!phoneNormalized) return;
    if (fetchedPhonesRef.current.has(phoneNormalized)) return;
    fetchedPhonesRef.current.add(phoneNormalized);

    try {
      const { data, error: fetchErr } = await supabase
        .from('contacts')
        .select('*')
        .eq('phone_number', phoneNormalized)
        .maybeSingle();

      if (fetchErr) {
        console.error('Erro ao buscar contato (fallback):', fetchErr);
        return;
      }

      if (data) {
        console.log('Fallback contact found:', data.phone_number, data.name, data.company_id);
        setContactsDB(prev => {
          if (prev.some(c => c.id === data.id)) return prev;
          return [...prev, { ...data, tag_ids: data.tag_ids || [] } as any];
        });
      }
    } catch (e) {
      console.error('Erro inesperado ao buscar contato (fallback):', e);
    }
  }, []);

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [messageText, setMessageText] = useState('');
  const [imageCaption, setImageCaption] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [uploadingFile] = useState(false);
  const [playingAudio, setPlayingAudio] = useState<string | null>(null);
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [imageModalSrc, setImageModalSrc] = useState('');
  const [imageModalType, setImageModalType] = useState<'image' | 'sticker' | 'video'>('image');
  const [departments, setDepartments] = useState<Department[]>([]);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [tags, setTags] = useState<TagItem[]>([]);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [lastViewedMessageTime, setLastViewedMessageTime] = useState<{ [key: string]: number }>({});
  const [pendingMessagesCount, setPendingMessagesCount] = useState(0);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messageInputRef = useRef<HTMLTextAreaElement | HTMLInputElement>(null);

  // Modais de transferência e tags
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showTagModal, setShowTagModal] = useState(false);

  // Estados para aba contatos
  const [allContactsList, setAllContactsList] = useState<{ id: string; name: string; phone_number: string; last_message_time?: string; last_message?: string; ticket_status?: string }[]>([]);
  const [loadingAllContacts, setLoadingAllContacts] = useState(false);
  const [allContactsSearch, setAllContactsSearch] = useState('');
  const [showAddContactModal, setShowAddContactModal] = useState(false);
  const [newContactName, setNewContactName] = useState('');
  const [newContactPhone, setNewContactPhone] = useState('');
  const [newContactDdi, setNewContactDdi] = useState('55');
  const [showDdiDropdown, setShowDdiDropdown] = useState(false);
  const DDI_OPTIONS = [
    { code: '55',  flag: '🇧🇷', label: 'BR', digits: [10, 11] },
    { code: '1',   flag: '🇺🇸', label: 'US', digits: [10] },
    { code: '351', flag: '🇵🇹', label: 'PT', digits: [9] },
    { code: '54',  flag: '🇦🇷', label: 'AR', digits: [10] },
    { code: '595', flag: '🇵🇾', label: 'PY', digits: [9] },
    { code: '598', flag: '🇺🇾', label: 'UY', digits: [8] },
    { code: '56',  flag: '🇨🇱', label: 'CL', digits: [9] },
    { code: '57',  flag: '🇨🇴', label: 'CO', digits: [10] },
    { code: '58',  flag: '🇻🇪', label: 'VE', digits: [10] },
    { code: '591', flag: '🇧🇴', label: 'BO', digits: [8] },
    { code: '593', flag: '🇪🇨', label: 'EC', digits: [9] },
    { code: '51',  flag: '🇵🇪', label: 'PE', digits: [9] },
    { code: '34',  flag: '🇪🇸', label: 'ES', digits: [9] },
    { code: '44',  flag: '🇬🇧', label: 'GB', digits: [10] },
    { code: '49',  flag: '🇩🇪', label: 'DE', digits: [10, 11] },
    { code: '33',  flag: '🇫🇷', label: 'FR', digits: [9] },
    { code: '39',  flag: '🇮🇹', label: 'IT', digits: [9, 10] },
    { code: '52',  flag: '🇲🇽', label: 'MX', digits: [10] },
  ];
  const [addingContact, setAddingContact] = useState(false);
  const [editingContactId, setEditingContactId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [editingPhone, setEditingPhone] = useState('');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; contact: any | null }>({ isOpen: false, contact: null });
  const [isDeletingContact, setIsDeletingContact] = useState(false);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>('');
  const [selectedSectorId, setSelectedSectorId] = useState<string>('');
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);

  // Menu de contexto (clique direito)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; phoneNumber: string } | null>(null);

  const handlePasteContent = (e: React.ClipboardEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];

      // Se for imagem
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          const reader = new FileReader();
          reader.onload = (event) => {
            const base64 = event.target?.result as string;
            setSelectedFile(file);
            setFilePreview(base64);
            console.log('✅ Imagem colada via Ctrl+V anexada para envio');
          };
          reader.readAsDataURL(file);
        }
      }
      // Se for arquivo
      else if (item.kind === 'file') {
        e.preventDefault();
        const file = item.getAsFile();
        if (file && !file.type.startsWith('image/')) {
          const reader = new FileReader();
          reader.onload = (event) => {
            const base64 = event.target?.result as string;
            setSelectedFile(file);
            setFilePreview(base64);
            console.log('✅ Arquivo colado via Ctrl+V convertido para base64');
          };
          reader.readAsDataURL(file);
        }
      }
    }
  };
  const isUserScrollingRef = useRef(false);

  const scrollToBottom = (smooth = true) => {
    requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({
        behavior: smooth ? 'smooth' : 'auto',
        block: 'end'
      });
    });
  };

  const handleMessagesScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const distanceFromBottom = target.scrollHeight - target.scrollTop - target.clientHeight;
    isUserScrollingRef.current = distanceFromBottom > 100;
    setShowScrollButton(distanceFromBottom > 100);
  };

  const detectBase64Type = (base64: string): 'image' | 'audio' | 'document' | null => {
    if (!base64) return null;

    if (base64.startsWith('data:image/') || base64.startsWith('/9j/') || base64.startsWith('iVBORw0KGgo')) {
      return 'image';
    }

    if (base64.startsWith('data:audio/') || base64.includes('audio/mpeg') || base64.includes('audio/ogg')) {
      return 'audio';
    }

    if (base64.startsWith('data:application/pdf') || base64.startsWith('JVBERi0')) {
      return 'document';
    }

    return 'document';
  };

  const getMessageTypeFromTipomessage = (tipomessage?: string | null): 'image' | 'audio' | 'document' | 'sticker' | 'video' | null => {
    if (!tipomessage) return null;

    const tipo = tipomessage.toLowerCase();

    if (tipo === 'imagemessage' || tipo === 'image') {
      return 'image';
    }

    if (tipo === 'audiomessage' || tipo === 'audio' || tipo === 'ptt') {
      return 'audio';
    }

    if (tipo === 'documentmessage' || tipo === 'document') {
      return 'document';
    }

    if (tipo === 'stickermessage' || tipo === 'sticker') {
      return 'sticker';
    }

    if (tipo === 'videomessage' || tipo === 'video') {
      return 'video';
    }

    return null;
  };

  const normalizeBase64 = (base64: string, type: 'image' | 'audio' | 'document' | 'sticker' | 'video'): string => {
    if (base64.startsWith('data:')) {
      return base64;
    }

    const mimeTypes = {
      image: 'data:image/jpeg;base64,',
      audio: 'data:audio/mpeg;base64,',
      document: 'data:application/pdf;base64,',
      sticker: 'data:image/webp;base64,',
      video: 'data:video/mp4;base64,'
    };

    return mimeTypes[type] + base64;
  };

  const handleAudioPlay = (messageId: string, base64Audio: string) => {
    if (playingAudio === messageId) {
      audioRef.current?.pause();
      setPlayingAudio(null);
    } else {
      if (audioRef.current) {
        audioRef.current.pause();
      }

      const audioSrc = normalizeBase64(base64Audio, 'audio');
      const audio = new Audio(audioSrc);
      audioRef.current = audio;

      audio.play();
      setPlayingAudio(messageId);

      audio.onended = () => {
        setPlayingAudio(null);
      };
    }
  };

  const downloadBase64File = (base64: string, filename: string) => {
    const link = document.createElement('a');
    link.href = base64.startsWith('data:') ? base64 : `data:application/octet-stream;base64,${base64}`;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const openImageModal = (src: string, type: 'image' | 'sticker' | 'video' = 'image') => {
    setImageModalSrc(src);
    setImageModalType(type);
    setImageModalOpen(true);
  };

  const closeImageModal = () => {
    setImageModalOpen(false);
    setImageModalSrc('');
  };

  const getMessageTimestamp = (msg: any): number => {
    if (msg.date_time) {
      const t = new Date(msg.date_time).getTime();
      if (!isNaN(t) && t > 0) return t;
    }
    if (msg.timestamp) {
      const ts = Number(msg.timestamp);
      if (!isNaN(ts) && ts > 0) {
        return ts < 9_999_999_999 ? ts * 1000 : ts;
      }
    }
    if (msg.created_at) {
      const t = new Date(msg.created_at).getTime();
      if (!isNaN(t)) return t;
    }
    return 0;
  };

  const processReactions = (messages: any[]) => {
    try {
      const looksLikeEmoji = (v?: string | null) =>
        !!v && v.length <= 6 && /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]|[\uD800-\uDBFF][\uDC00-\uDFFF]/u.test(v || '');

      return messages.map(msg => {
        if (!msg?.idmessage) return { ...msg, reactions: [] };

        if (msg.reaction_target_id && looksLikeEmoji(msg.reaction_target_id)) {
          console.log(`✨ Mensagem ${msg.idmessage} tem reação: ${msg.reaction_target_id}`);

          return {
            ...msg,
            reactions: [{ emoji: msg.reaction_target_id, count: 1 }]
          };
        }

        return { ...msg, reactions: [] };
      });
    } catch (err) {
      console.error('❌ Erro ao processar reações:', err);
      return messages;
    }
  };

  const fetchMessages = useCallback(async (retryCount = 0) => {
    if (!attendant?.api_key) {
      setLoading(false);
      return;
    }

    setError(null);

    const timeout = setTimeout(() => {
      setLoading(false);
      // Silenciosamente timeout, sem mostrar erro no front
    }, 15000);

    try {
      // Usar api_key do attendant para buscar mensagens da empresa
      const messagesQuery = supabase
        .from('messages')
        .select('*')
        .eq('apikey_instancia', attendant.api_key)
        .order('created_at', { ascending: false })
        .limit(150);

      const sentMessagesQuery = supabase
        .from('sent_messages')
        .select('*')
        .eq('apikey_instancia', attendant.api_key)
        .order('created_at', { ascending: false })
        .limit(150);

      const [receivedResult, sentResult] = await Promise.all([messagesQuery, sentMessagesQuery]);

      clearTimeout(timeout);

      if (receivedResult.error) {
        // Se for erro de rede (Failed to fetch), tenta novamente até 2x
        if (receivedResult.error.message?.includes('Failed to fetch') && retryCount < 2) {
          console.warn(`⚠️ Tentativa ${retryCount + 1} falhou, tentando novamente...`);
          setTimeout(() => fetchMessages(retryCount + 1), 2000 * (retryCount + 1));
          return;
        }
        setError(`Erro ao carregar mensagens recebidas: ${receivedResult.error.message}`);
        setLoading(false);
        return;
      }

      if (sentResult.error) {
        if (sentResult.error.message?.includes('Failed to fetch') && retryCount < 2) {
          console.warn(`⚠️ Tentativa ${retryCount + 1} falhou, tentando novamente...`);
          setTimeout(() => fetchMessages(retryCount + 1), 2000 * (retryCount + 1));
          return;
        }
        setError(`Erro ao carregar mensagens enviadas: ${sentResult.error.message}`);
        setLoading(false);
        return;
      }

      const allMessages = [
        ...(receivedResult.data || []),
        ...(sentResult.data || [])
      ].sort((a, b) => {
        return getMessageTimestamp(a) - getMessageTimestamp(b);
      });

      // Processar reações
      const messagesWithReactions = processReactions(allMessages);

      console.log('📩 Mensagens recebidas:', receivedResult.data?.length || 0);
      console.log('📤 Mensagens enviadas:', sentResult.data?.length || 0);

      setMessages(messagesWithReactions);
      setLoading(false);
    } catch (error: any) {
      clearTimeout(timeout);
      // Retry automático para erros de rede
      if (error?.message?.includes('Failed to fetch') && retryCount < 2) {
        console.warn(`⚠️ Erro de rede, tentativa ${retryCount + 1}/2 em ${(retryCount + 1) * 2}s...`);
        setTimeout(() => fetchMessages(retryCount + 1), 2000 * (retryCount + 1));
        return;
      }
      console.error('Erro inesperado:', error);
      setError(`Erro inesperado: ${error.message}`);
      setLoading(false);
    }
  }, [attendant]);

  const fetchContacts = async () => {
    if (!attendant?.company_id) return;

    try {
      const { data, error } = await supabase
        .from('contacts')
        .select(`
          id,
          company_id,
          phone_number,
          name,
          department_id,
          sector_id,
          tag_id,
          last_message,
          last_message_time,
          created_at,
          updated_at,
          pinned,
          ia_ativada,
          ticket_status,
          ticket_closed_at,
          ticket_closed_by,
          attendant_id,
          contact_tags(tag_id)
        `)
        .eq('company_id', attendant.company_id)
        .order('last_message_time', { ascending: false });

      if (error) throw error;

      const normalized = (data || []).map((c: any) => ({
        ...c,
        tag_ids: c.contact_tags?.map((ct: any) => ct.tag_id) || [],
      }));

      setContactsDB(normalized);
    } catch (err) {
      console.error('Erro ao carregar contatos:', err);
    }
  };

  const fetchDepartments = useCallback(async () => {
    if (!attendant?.company_id) return;

    try {
      const { data, error } = await supabase
        .from('departments')
        .select('id,name,company_id')
        .or(`company_id.eq.${attendant.company_id},company_id.is.null`)
        .order('name');

      if (error) throw error;

      setDepartments(data || []);
    } catch (error) {
      console.error('Erro ao carregar departamentos:', error);
    }
  }, [attendant?.company_id]);

  const fetchSectors = useCallback(async () => {
    if (!attendant?.company_id) return;
    try {
      const { data, error } = await supabase
        .from('sectors')
        .select('*')
        .eq('company_id', attendant.company_id)
        .order('name');

      if (error) throw error;

      setSectors(data || []);
    } catch (error) {
      console.error('Erro ao carregar setores:', error);
    }
  }, [attendant?.company_id]);

  const fetchAttendants = useCallback(async () => {
    if (!attendant?.company_id) return;
    try {
      const { data } = await supabase
        .from('attendants')
        .select('id, user_id, name')
        .eq('company_id', attendant.company_id)
        .eq('is_active', true);
      setAttendantsList(data || []);
    } catch (e) {
      console.error('Erro ao carregar atendentes:', e);
    }
  }, [attendant?.company_id]);

  const fetchTags = async () => {
    if (!attendant?.company_id) return;
    try {
      const { data, error } = await supabase
        .from('tags')
        .select('*')
        .eq('company_id', attendant.company_id)
        .order('name');

      if (error) throw error;

      setTags(data || []);
    } catch (error) {
      console.error('Erro ao carregar tags:', error);
    }
  };

  // Listen for contact deletions from other pages and update local contacts/messages
  useEffect(() => {
    const handler = (ev: any) => {
      const contactId = ev?.detail;
      if (!contactId) return;

      setContactsDB(prev => {
        const removed = prev.find(c => c.id === contactId);
        const next = prev.filter(c => c.id !== contactId);
        if (removed) {
          const removedDigits = normalizePhone(removed.phone_number);
          if (removedDigits && normalizePhone(selectedContact || '') === removedDigits) {
            setSelectedContact(null);
          }
        }
        return next;
      });

      setToastMessage('Contato deletado com sucesso!');
      setShowToast(true);
    };

    window.addEventListener('contactDeleted', handler as EventListener);
    return () => window.removeEventListener('contactDeleted', handler as EventListener);
  }, [selectedContact]);



  useEffect(() => {
    fetchMessages();
    fetchContacts();
    fetchDepartments();
    fetchSectors();
    fetchAttendants();
    fetchTags();
  }, [attendant?.company_id, fetchMessages]);

  // Realtime para mensagens
  const handleRealtimeMessage = useCallback((message: Message) => {
    setMessages((prevMessages) => {
      const exists = prevMessages.some((m) => m.id === message.id || m.idmessage === message.idmessage);
      if (exists) return prevMessages;
      const updated = [...prevMessages, message].sort((a, b) => getMessageTimestamp(a) - getMessageTimestamp(b));
      return processReactions(updated);
    });
  }, []);

  useRealtimeMessages({
    apiKey: attendant?.api_key,
    enabled: true,
    onMessagesChange: handleRealtimeMessage,
  });

  // Realtime para contatos
  useRealtimeContacts({
    companyId: attendant?.company_id,
    enabled: true,
    onContactsChange: (contact: any, type: 'INSERT' | 'UPDATE' | 'DELETE') => {
      console.log(`👥 Contato ${type}:`, contact);
      setContactsDB((prevContacts) => {
        if (type === 'INSERT') {
          return [...prevContacts, { ...contact, tag_ids: contact.tag_ids || [] }];
        }
        if (type === 'UPDATE') {
          return prevContacts.map((c) =>
            c.id === contact.id ? { ...c, ...contact, tag_ids: contact.tag_ids || c.tag_ids || [] } : c
          );
        }
        if (type === 'DELETE') {
          return prevContacts.filter((c) => c.id !== contact.id);
        }
        return prevContacts;
      });
    },
  });

  useRealtimeDepartments({
    companyId: attendant?.company_id,
    onDepartmentsChange: () => {
      fetchDepartments();
    }
  });

  useRealtimeSectors({
    companyId: attendant?.company_id,
    onSectorsChange: () => {
      fetchSectors();
    }
  });

  // Realtime via useRealtimeMessages e useRealtimeContacts (sem polling)

  const getContactId = (msg: Message): string => {
    return normalizePhone(msg.numero || msg.phone_number || msg.sender || msg.number || '');
  };

  const getPhoneNumber = (contactId: string): string => {
    return normalizePhone(contactId);
  };

  const groupMessagesByContact = (): Contact[] => {
    const contactsMap: { [key: string]: Contact } = {};

    messages.forEach((msg) => {
      const contactId = getContactId(msg);
      if (!contactId) return;

      if (!contactsMap[contactId]) {
        // Buscar informações do contato na tabela contacts
        const contactDB = contactsDB.find(c => normalizeDbPhone(c.phone_number) === normalizeDbPhone(contactId));

        // Se não estiver no state, tentar buscar no banco (fallback sem depender de company_id)
        if (!contactDB) {
          fetchAndCacheContactByPhone(contactId);
        }

        // SEMPRE usar nome do banco. Se não existir, exibir vazio (sem fallback)
        const contactName = contactDB?.name || '';

        contactsMap[contactId] = {
          phoneNumber: contactId,
          name: contactName,
          lastMessage: '',
          lastMessageTime: '',
          unreadCount: 0,
          messages: [],
          department_id: contactDB?.department_id || undefined,
          sector_id: contactDB?.sector_id || undefined,
          tag_ids: contactDB?.tag_ids || [],
          contact_db_id: contactDB?.id || undefined,
        };
      }

      contactsMap[contactId].messages.push(msg);
    });

    const contacts = Object.values(contactsMap).map((contact) => {
      contact.messages.sort((a, b) => {
        return getMessageTimestamp(a) - getMessageTimestamp(b);
      });

      // Filtrar mensagens de sistema e transferência para não aparecer como última mensagem
      const nonSystemMessages = contact.messages.filter(msg =>
        msg.tipomessage !== 'system' &&
        msg.tipomessage !== 'system_transfer' &&
        msg.tipomessage !== 'system_notification' &&
        msg.message_type !== 'system_transfer'
      );
      const lastMsg = nonSystemMessages.length > 0
        ? nonSystemMessages[nonSystemMessages.length - 1]
        : contact.messages[contact.messages.length - 1];

      if (lastMsg) {
        if (lastMsg.message && lastMsg.message.trim()) {
          contact.lastMessage = lastMsg.message;
        } else if (lastMsg.urlimagem || lastMsg.base64?.startsWith('data:image')) {
          contact.lastMessage = 'Imagem';
        } else if (lastMsg.urlaudio || lastMsg.base64?.startsWith('data:audio')) {
          contact.lastMessage = 'Áudio';
        } else if (lastMsg.urlpdf || lastMsg.base64?.startsWith('data:application/pdf')) {
          contact.lastMessage = 'Documento';
        } else if (lastMsg.urlvideo || lastMsg.base64?.startsWith('data:video')) {
          contact.lastMessage = 'Vídeo';
        } else {
          contact.lastMessage = 'Mensagem';
        }
      } else {
        contact.lastMessage = '';
      }

      const lastMsgTime = getMessageTimestamp(lastMsg);
      contact.lastMessageTime = lastMsgTime > 0 ? new Date(lastMsgTime).toISOString() : '';

      // CRÍTICO: O nome SEMPRE vem do banco de dados
      // Se o DB não tiver name, mostramos vazio (sem fallback)
      const dbContact = contactsDB.find(c => normalizeDbPhone(c.phone_number) === normalizeDbPhone(contact.phoneNumber));
      if (dbContact?.name) {
        contact.name = dbContact.name;
      } else {
        contact.name = '';
      }

      // Adicionar tags e departamento do contato
      contact.tag_ids = dbContact?.tag_ids || [];
      contact.department_id = dbContact?.department_id || null;
      contact.sector_id = dbContact?.sector_id || null;

      // Contar mensagens pendentes (do cliente, não respondidas pela empresa)
      const lastViewedTime = lastViewedMessageTime[contact.phoneNumber] || 0;
      contact.unreadCount = 0;

      // Procurar por mensagens não lidas do cliente que não foram respondidas
      for (let i = contact.messages.length - 1; i >= 0; i--) {
        const msg = contact.messages[i];
        const isSent = msg['minha?'] === 'true';
        const msgTime = getMessageTimestamp(msg);

        // Se é mensagem do cliente (não enviada pela empresa)
        if (!isSent && msgTime > lastViewedTime) {
          // Verificar se há resposta DEPOIS dessa mensagem
          let hasResponse = false;
          for (let j = i + 1; j < contact.messages.length; j++) {
            const responseMsg = contact.messages[j];
            const isResponseSent = responseMsg['minha?'] === 'true';
            if (isResponseSent) {
              hasResponse = true;
              break;
            }
          }

          // Só contar como pendente se não tem resposta
          if (!hasResponse) {
            contact.unreadCount++;
          }
        }
      }

      return contact;
    });

    contacts.sort((a, b) => {
      // Buscar informações de pinned do banco
      const contactA = contactsDB.find(c => normalizeDbPhone(c.phone_number) === normalizeDbPhone(a.phoneNumber));
      const contactB = contactsDB.find(c => normalizeDbPhone(c.phone_number) === normalizeDbPhone(b.phoneNumber));

      const aPinned = contactA?.pinned || false;
      const bPinned = contactB?.pinned || false;

      // Contatos fixados sempre primeiro
      if (aPinned && !bPinned) return -1;
      if (!aPinned && bPinned) return 1;

      // Se ambos fixados ou ambos não fixados, ordenar por data
      const dateA = new Date(a.lastMessageTime).getTime();
      const dateB = new Date(b.lastMessageTime).getTime();
      return dateB - dateA;
    });

    return contacts;
  };

  const contacts = groupMessagesByContact();

  // Filtrar contatos por departamento do atendente
  const filteredContacts = useMemo(() => {
    let filtered = contacts;

    // Aplicar filtros
    if (contactFilter === 'todos') {
      // Recepção: só contatos do departamento chamado "Recepção"
      const recepcaoDept = departments.find(d => d.name.toLowerCase().includes('recep'));
      if (recepcaoDept) {
        filtered = filtered.filter(contact => contact.department_id === recepcaoDept.id);
      } else {
        filtered = filtered.filter(contact => !contact.department_id);
      }
    }

    if (contactFilter === 'departamento' && attendant?.department_id) {
      filtered = filtered.filter(contact =>
        contact.department_id === attendant.department_id
      );
    }

    if (contactFilter === 'abertos') {
      filtered = filtered.filter(contact => {
        const contactDB = contactsDB.find(c => normalizeDbPhone(c.phone_number) === normalizeDbPhone(contact.phoneNumber));
        // Só mostrar contatos do departamento que não foram assumidos por ninguém
        const inDepartment = contact.department_id === attendant?.department_id;
        const notAssumed = !contactDB?.attendant_id && (contactDB?.ticket_status === 'aberto' || !contactDB?.ticket_status);
        return inDepartment && notAssumed;
      });
    }

    // Aplicar filtro de pesquisa
    const searchLower = searchTerm.toLowerCase();
    filtered = filtered.filter((contact) => {
      const displayPhone = getPhoneNumber(contact.phoneNumber);
      return (
        contact.name.toLowerCase().includes(searchLower) ||
        displayPhone.toLowerCase().includes(searchLower) ||
        contact.phoneNumber.toLowerCase().includes(searchLower)
      );
    });

    // Ordenar para que contatos fixados apareçam primeiro
    filtered.sort((a, b) => {
      const aDB = contactsDB.find(c => normalizeDbPhone(c.phone_number) === normalizeDbPhone(a.phoneNumber));
      const bDB = contactsDB.find(c => normalizeDbPhone(c.phone_number) === normalizeDbPhone(b.phoneNumber));
      const aPinned = aDB?.pinned || false;
      const bPinned = bDB?.pinned || false;

      if (aPinned && !bPinned) return -1;
      if (!aPinned && bPinned) return 1;
      return 0;
    });

    return filtered;
  }, [contacts, attendant?.department_id, searchTerm, contactsDB, contactFilter]);

  const selectedContactData = selectedContact
    ? contacts.find((c) => c.phoneNumber === selectedContact)
    : null;

  const isContactOnline = (() => {
    if (!selectedContactData) return false;
    const lastMsg = selectedContactData.messages?.slice(-1)[0];
    if (!lastMsg || !lastMsg.created_at) return false;
    const lastTs = new Date(lastMsg.created_at).getTime();
    return (Date.now() - lastTs) < 5 * 60 * 1000;
  })();

  // Verificar se o contato pertence ao departamento do atendente
  const isContactFromMyDepartment = useMemo(() => {
    if (!selectedContactData || !attendant?.department_id) return false;
    return selectedContactData.department_id === attendant.department_id;
  }, [selectedContactData, attendant?.department_id]);

  // Carregar tags do contato quando abrir o modal
  useEffect(() => {
    if (showTagModal && selectedContactData) {
      const contactDB = contactsDB.find(c =>
        normalizeDbPhone(c.phone_number) === normalizeDbPhone(selectedContactData.phoneNumber)
      );
      setSelectedTagIds(contactDB?.tag_ids || []);
    }
  }, [showTagModal]);

  // Função para assumir a conversa (transferir para o departamento do atendente)
  const handleAssumeConversation = async () => {
    if (!selectedContactData || !attendant?.department_id) return;

    try {
      const contactDB = contactsDB.find(c =>
        normalizeDbPhone(c.phone_number) === normalizeDbPhone(selectedContactData.phoneNumber)
      );

      if (!contactDB) {
        setToastMessage('Contato não encontrado');
        setShowToast(true);
        return;
      }

      const oldDepartmentId = contactDB.department_id;

      const { error } = await supabase
        .from('contacts')
        .update({
          department_id: attendant.department_id,
          sector_id: attendant.sector_id || null
        })
        .eq('id', contactDB.id);

      if (error) throw error;

      // Registrar a transferência na tabela transferencias
      await supabase
        .from('transferencias')
        .insert({
          company_id: attendant?.company_id,
          api_key: attendant?.api_key,
          contact_id: contactDB.id,
          from_department_id: oldDepartmentId,
          to_department_id: attendant.department_id
        });

      // A mensagem de sistema é criada automaticamente pela trigger do banco

      setToastMessage('Conversa assumida com sucesso!');
      setShowToast(true);

      // Atualizar o estado local
      setContactsDB(prev => prev.map(c =>
        c.id === contactDB.id
          ? { ...c, department_id: attendant.department_id, sector_id: attendant.sector_id || null }
          : c
      ));
    } catch (error: any) {
      console.error('Erro ao assumir conversa:', error);
      setToastMessage('Erro ao assumir conversa');
      setShowToast(true);
    }
  };

  // Nota: A mensagem de sistema de transferência é criada automaticamente pela trigger do banco

  // Função para transferir departamento
  const handleTransferDepartment = async () => {
    if (!selectedContactData || !selectedDepartmentId) return;

    try {
      const contactDB = contactsDB.find(c =>
        normalizeDbPhone(c.phone_number) === normalizeDbPhone(selectedContactData.phoneNumber)
      );

      if (!contactDB) {
        setToastMessage('Contato não encontrado');
        setShowToast(true);
        return;
      }

      const oldDepartmentId = contactDB.department_id;

      const { error } = await supabase
        .from('contacts')
        .update({
          department_id: selectedDepartmentId,
          sector_id: selectedSectorId || null
        })
        .eq('id', contactDB.id);

      if (error) throw error;

      // Registrar a transferência na tabela transferencias
      await supabase
        .from('transferencias')
        .insert({
          company_id: attendant?.company_id,
          api_key: attendant?.api_key,
          contact_id: contactDB.id,
          from_department_id: oldDepartmentId,
          to_department_id: selectedDepartmentId
        });

      // A mensagem de sistema é criada automaticamente pela trigger do banco

      setToastMessage('Departamento transferido com sucesso!');
      setShowToast(true);
      setShowTransferModal(false);

      // Atualizar o estado local
      setContactsDB(prev => prev.map(c =>
        c.id === contactDB.id
          ? { ...c, department_id: selectedDepartmentId, sector_id: selectedSectorId || null }
          : c
      ));

      // Limpar seleção
      setSelectedDepartmentId('');
      setSelectedSectorId('');
    } catch (error: any) {
      console.error('Erro ao transferir departamento:', error);
      setToastMessage('Erro ao transferir departamento');
      setShowToast(true);
    }
  };

  // Função para adicionar/remover tags
  const handleUpdateTags = async () => {
    if (!selectedContactData) return;

    try {
      const contactDB = contactsDB.find(c =>
        normalizeDbPhone(c.phone_number) === normalizeDbPhone(selectedContactData.phoneNumber)
      );

      if (!contactDB) {
        setToastMessage('Contato não encontrado');
        setShowToast(true);
        return;
      }

      // Usar RPC para atualizar tags
      const { data, error } = await supabase.rpc('update_contact_tags', {
        p_contact_id: contactDB.id,
        p_tag_ids: selectedTagIds
      });

      if (error) throw error;

      // Verificar se o RPC retornou sucesso
      if (data && !data.success) {
        throw new Error(data.error || 'Erro desconhecido');
      }

      setToastMessage('Tags atualizadas com sucesso!');
      setShowToast(true);
      setShowTagModal(false);

      // Atualizar o estado local
      setContactsDB(prev => prev.map(c =>
        c.id === contactDB.id
          ? { ...c, tag_ids: selectedTagIds }
          : c
      ));

      // Recarregar contatos para garantir sincronização
      await fetchContacts();
    } catch (error: any) {
      console.error('Erro ao atualizar tags:', error);
      setToastMessage(`Erro ao atualizar tags: ${error.message || 'Erro desconhecido'}`);
      setShowToast(true);
    }
  };

  const handleCloseTicket = async () => {
    if (!selectedContactData || !attendant?.company_id) return;

    try {
      const contactDB = contactsDB.find(c =>
        normalizeDbPhone(c.phone_number) === normalizeDbPhone(selectedContactData.phoneNumber)
      );

      if (!contactDB) {
        setToastMessage('❌ Erro: Contato não encontrado');
        setShowToast(true);
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();

      const { error: updateError } = await supabase
        .from('contacts')
        .update({
          ticket_status: 'aberto',
          ticket_closed_at: null,
          ticket_closed_by: null,
          attendant_id: null
        })
        .eq('id', contactDB.id)
        .eq('company_id', attendant.company_id);

      if (updateError) throw updateError;

      setToastMessage('✅ Atendimento finalizado — conversa voltou para Abertos');
      setShowToast(true);

      setContactsDB(prev => prev.map(c =>
        c.id === contactDB.id
          ? {
              ...c,
              ticket_status: 'aberto',
              ticket_closed_at: null,
              ticket_closed_by: null,
              attendant_id: null
            }
          : c
      ));

      await fetchContacts();
    } catch (error: any) {
      console.error('Erro ao finalizar atendimento:', error);
      setToastMessage('❌ Erro ao finalizar atendimento');
      setShowToast(true);
    }
  };

  const handleReopenTicket = async () => {
    if (!selectedContactData || !attendant?.company_id) return;

    try {
      const contactDB = contactsDB.find(c =>
        normalizeDbPhone(c.phone_number) === normalizeDbPhone(selectedContactData.phoneNumber)
      );

      if (!contactDB) {
        setToastMessage('❌ Erro: Contato não encontrado');
        setShowToast(true);
        return;
      }

      const { error: updateError } = await supabase
        .from('contacts')
        .update({
          ticket_status: 'aberto',
          ticket_closed_at: null,
          ticket_closed_by: null,
          attendant_id: null
        })
        .eq('id', contactDB.id)
        .eq('company_id', attendant.company_id);

      if (updateError) throw updateError;

      setToastMessage('✅ Chamado reaberto com sucesso!');
      setShowToast(true);

      setContactsDB(prev => prev.map(c =>
        c.id === contactDB.id
          ? {
              ...c,
              ticket_status: 'aberto',
              ticket_closed_at: null,
              ticket_closed_by: null,
              attendant_id: null
            }
          : c
      ));

      await fetchContacts();
    } catch (error: any) {
      console.error('Erro ao reabrir chamado:', error);
      setToastMessage('❌ Erro ao reabrir chamado');
      setShowToast(true);
    }
  };

  const handleAssumeContact = async (phoneNumber: string) => {
    if (!attendant) return;

    const contactDB = contactsDB.find(c => normalizeDbPhone(c.phone_number) === normalizeDbPhone(phoneNumber));
    if (!contactDB) return;

    if (contactDB.attendant_id) {
      setToastMessage('❌ Esta conversa já foi assumida por outro atendente');
      setShowToast(true);
      return;
    }

    const deptName = departments.find(d => d.id === attendant.department_id)?.name || 'seu departamento';

    const { error } = await supabase
      .from('contacts')
      .update({ ticket_status: 'em_processo', attendant_id: attendant.user_id })
      .eq('id', contactDB.id)
      .is('attendant_id', null);

    if (error) {
      setToastMessage('❌ Não foi possível assumir a conversa');
      setShowToast(true);
      return;
    }

    // Mensagem de sistema registrando a assunção
    await supabase.from('messages').insert({
      numero: phoneNumber,
      apikey_instancia: attendant.api_key,
      company_id: attendant.company_id,
      department_id: attendant.department_id,
      sector_id: null,
      message: `Conversa assumida pelo atendente ${attendant.name} do departamento ${deptName}`,
      message_type: 'system_transfer',
      tipomessage: 'system',
      date_time: new Date().toISOString(),
      idmessage: `system_assume_${Date.now()}`,
      instancia: attendant.name,
      'minha?': 'false',
      sender: null,
      pushname: 'Sistema',
    });

    setContactsDB(prev => prev.map(c =>
      c.id === contactDB.id ? { ...c, ticket_status: 'em_processo', attendant_id: attendant.user_id } : c
    ));

    setSelectedContact(phoneNumber);
    setContactFilter('departamento');
    setToastMessage('✅ Conversa assumida com sucesso!');
    setShowToast(true);
  };

  const handleOpenChatFromHistory = (phoneNumber: string) => {
    setCurrentView('mensagens');
    setSelectedContact(phoneNumber);
  };

  // Funções do menu de contexto
  const handleContextMenu = (e: React.MouseEvent, phoneNumber: string) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, phoneNumber });
  };

  const closeContextMenu = () => {
    setContextMenu(null);
  };

  const handleTogglePin = async (phoneNumber: string) => {
    try {
      const contactDB = contactsDB.find(c =>
        normalizeDbPhone(c.phone_number) === normalizeDbPhone(phoneNumber)
      );

      if (!contactDB) {
        setToastMessage('Contato não encontrado');
        setShowToast(true);
        return;
      }

      const newPinnedState = !contactDB.pinned;

      const { error } = await supabase
        .from('contacts')
        .update({ pinned: newPinnedState })
        .eq('id', contactDB.id);

      if (error) throw error;

      setToastMessage(newPinnedState ? 'Contato fixado!' : 'Contato desfixado!');
      setShowToast(true);

      setContactsDB(prev => prev.map(c =>
        c.id === contactDB.id
          ? { ...c, pinned: newPinnedState }
          : c
      ));
    } catch (error: any) {
      console.error('Erro ao fixar/desafixar contato:', error);
      const errorMessage = error.message || 'Erro desconhecido';
      setToastMessage(`Erro ao fixar contato: ${errorMessage}`);
      setShowToast(true);
    }
    closeContextMenu();
  };

  const handleToggleIA = async (phoneNumber: string) => {
    try {
      const contactDB = contactsDB.find(c =>
        normalizeDbPhone(c.phone_number) === normalizeDbPhone(phoneNumber)
      );

      if (!contactDB) {
        setToastMessage('Contato não encontrado');
        setShowToast(true);
        return;
      }

      const newIAState = !contactDB.ia_ativada;

      const { error } = await supabase
        .from('contacts')
        .update({ ia_ativada: newIAState })
        .eq('id', contactDB.id);

      if (error) throw error;

      setToastMessage(newIAState ? 'IA ativada para este contato!' : 'IA desativada para este contato!');
      setShowToast(true);

      setContactsDB(prev => prev.map(c =>
        c.id === contactDB.id
          ? { ...c, ia_ativada: newIAState }
          : c
      ));
    } catch (error: any) {
      console.error('Erro ao alterar IA do contato:', error);
      const errorMessage = error.message || 'Erro desconhecido';
      setToastMessage(`Erro ao alterar IA: ${errorMessage}`);
      setShowToast(true);
    }
    closeContextMenu();
  };

  const handleContextMenuTag = (phoneNumber: string) => {
    setSelectedContact(phoneNumber);
    closeContextMenu();

    setTimeout(() => {
      const contactDB = contactsDB.find(c =>
        normalizeDbPhone(c.phone_number) === normalizeDbPhone(phoneNumber)
      );
      if (contactDB) {
        setSelectedTagIds(contactDB.tag_ids || []);
        setShowTagModal(true);
      } else {
        setToastMessage('Contato não encontrado');
        setShowToast(true);
      }
    }, 50);
  };

  const handleContextMenuTransfer = (phoneNumber: string) => {
    setSelectedContact(phoneNumber);
    setShowTransferModal(true);
    closeContextMenu();
  };

  useEffect(() => {
    if (!selectedContact && filteredContacts.length > 0) {
      setSelectedContact(filteredContacts[0].phoneNumber);
    }
  }, [filteredContacts.length, selectedContact]);

  // Verificar se o contato selecionado ainda está no filtro atual
  useEffect(() => {
    if (selectedContact) {
      const isContactInFilter = filteredContacts.some(c => c.phoneNumber === selectedContact);
      if (!isContactInFilter) {
        // Se o contato selecionado não está mais no filtro
        if (filteredContacts.length > 0) {
          // Selecionar o primeiro contato disponível
          setSelectedContact(filteredContacts[0].phoneNumber);
        } else {
          // Limpar a seleção se não houver contatos
          setSelectedContact('');
        }
      }
    }
  }, [contactFilter, filteredContacts, selectedContact]);

  // Fechar menu de contexto ao clicar fora
  useEffect(() => {
    if (contextMenu) {
      const handleClick = () => closeContextMenu();
      document.addEventListener('click', handleClick);
      return () => document.removeEventListener('click', handleClick);
    }
  }, [contextMenu]);

  useEffect(() => {
    if (selectedContact) {
      scrollToBottom(false);
      // Resetar o flag de scroll quando muda de contato
      isUserScrollingRef.current = false;
      // Marcar todas as mensagens como vistas
      if (selectedContactData?.messages) {
        const lastMsgTime = selectedContactData.messages.reduce((max, msg) => {
          return Math.max(max, getMessageTimestamp(msg));
        }, 0);
        setLastViewedMessageTime(prev => ({
          ...prev,
          [selectedContact]: lastMsgTime
        }));
      }
    }
  }, [selectedContact]);

  // Contar mensagens pendentes (novas mensagens que não foram vistas)
  useEffect(() => {
    if (!selectedContact || !selectedContactData?.messages) {
      setPendingMessagesCount(0);
      return;
    }

    const lastViewedTime = lastViewedMessageTime[selectedContact] || 0;
    const pendingCount = selectedContactData.messages.filter(msg => {
      const isSent = msg['minha?'] === 'true';
      const msgTime = getMessageTimestamp(msg);
      return !isSent && msgTime > lastViewedTime;
    }).length;

    setPendingMessagesCount(pendingCount);
  }, [messages, selectedContact, selectedContactData, lastViewedMessageTime]);

  const sendMessage = async (messageData: Partial<Message>) => {
    if (!attendant || !selectedContact) return;

    setSending(true);
    try {
      const generatedIdMessage = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const { data: existingMessages } = await supabase
        .from('messages')
        .select('instancia, department_id, sector_id, tag_id')
        .eq('numero', selectedContact)
        .eq('apikey_instancia', attendant.api_key)
        .order('date_time', { ascending: false })
        .limit(1);

      const instanciaValue = existingMessages?.[0]?.instancia || attendant.name;
      const departmentId = existingMessages?.[0]?.department_id || null;
      const sectorId = existingMessages?.[0]?.sector_id || null;
      const tagId = existingMessages?.[0]?.tag_id || null;

      const attendantName = attendant?.name || 'Atendente';
      const rawMessage = messageData.message || '';
      const rawCaption = messageData.caption || null;

      const { phone_number: _ph, ...messageDataClean } = messageData as Message & { phone_number?: string };
      const newMessage = {
        numero: selectedContact,
        sender: null,
        'minha?': 'true',
        pushname: attendantName,
        apikey_instancia: attendant.api_key,
        date_time: new Date().toISOString(),
        instancia: instanciaValue,
        idmessage: generatedIdMessage,
        company_id: attendant.company_id,
        department_id: departmentId,
        sector_id: sectorId,
        tag_id: tagId,
        ...messageDataClean,
        message: rawMessage,
        caption: rawCaption,
      };

      const { error: insertError } = await supabase.from('sent_messages').insert([newMessage]);

      if (insertError) {
        console.error('Erro ao inserir mensagem:', insertError);
        throw insertError;
      }

      // Usa webhook_envio cadastrado para esta empresa (disponível no contexto)
      const webhookUrl = company?.webhook_envio;
      if (webhookUrl) {
        const webhookController = new AbortController();
        const webhookTimeout = setTimeout(() => webhookController.abort(), 10000);
        fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            numero: selectedContact,
            message: rawMessage,
            caption: rawCaption,
            tipomessage: messageData.tipomessage || 'conversation',
            base64: messageData.base64 || null,
            urlimagem: messageData.urlimagem || null,
            urlpdf: messageData.urlpdf || null,
            idmessage: generatedIdMessage,
            pushname: attendantName,
            instancia: instanciaValue,
            apikey_instancia: company?.api_key,
            timestamp: newMessage.date_time,
          }),
          signal: webhookController.signal,
        })
          .then(() => clearTimeout(webhookTimeout))
          .catch((e: any) => {
            clearTimeout(webhookTimeout);
            if (e?.name !== 'AbortError') console.error('Erro ao chamar webhook envio:', e);
          });
      }

      // Adicionar à lista local imediatamente
      setMessages((prev) => [...prev, newMessage as Message]);

      // Limpar campos de envio
      setMessageText('');
      setImageCaption('');
      setSelectedFile(null);
      setFilePreview(null);

      // Scroll para o fim
      setTimeout(() => scrollToBottom(true), 100);

      setToastMessage('Mensagem enviada com sucesso!');
      setShowToast(true);
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
      setToastMessage('Erro ao enviar mensagem');
      setShowToast(true);
    } finally {
      setSending(false);
    }
  };

  const handleSendMessage = async () => {
    if (!messageText.trim() && !selectedFile) return;

    if (selectedFile) {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64 = e.target?.result as string;
        const base64Content = base64.split(',')[1];

        const isImage = selectedFile.type.startsWith('image/');
        const isPDF = selectedFile.type === 'application/pdf';

        await sendMessage({
          message: imageCaption || '',
          caption: imageCaption || null,
          tipomessage: isImage ? 'imageMessage' : (isPDF ? 'documentMessage' : 'documentMessage'),
          urlimagem: isImage ? base64Content : null,
          urlpdf: isPDF ? base64Content : null,
          urldocumento: !isImage && !isPDF ? base64Content : null,
        });
      };
      reader.readAsDataURL(selectedFile);
    } else {
      await sendMessage({
        message: messageText,
        tipomessage: 'conversation',
      });
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setSelectedFile(file);
        setFilePreview(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setSelectedFile(file);
        setFilePreview(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const formatTime = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Hoje';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Ontem';
    } else {
      return date.toLocaleDateString('pt-BR');
    }
  };

  const generateColor = (str: string) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const c = (hash & 0x00FFFFFF)
      .toString(16)
      .toUpperCase();
    return "00000".substring(0, 6 - c.length) + c;
  };

  // === FUNÇÕES DA ABA CONTATOS ===
  const loadAllContactsFromDB = useCallback(async (silent = false) => {
    if (!attendant?.company_id) return;
    if (!silent) {
      setAllContactsList([]);
      setAllContactsSearch('');
    }
    setLoadingAllContacts(!silent);
    try {
      const { data, error } = await supabase
        .from('contacts')
        .select('id, name, phone_number, last_message_time, last_message, ticket_status')
        .eq('company_id', attendant.company_id)
        .order('last_message_time', { ascending: false });
      if (error) throw error;
      setAllContactsList(data || []);
    } catch (err) {
      console.error('Erro ao carregar contatos:', err);
    } finally {
      setLoadingAllContacts(false);
    }
  }, [attendant?.company_id]);

  // Auto-refresh da aba contatos a cada 30 segundos
  useEffect(() => {
    if (currentView !== 'contatos' || !attendant?.company_id) return;
    loadAllContactsFromDB(false); // carrega imediatamente ao entrar na aba
    const interval = setInterval(() => loadAllContactsFromDB(true), 15000);
    return () => clearInterval(interval);
  }, [currentView, attendant?.company_id, loadAllContactsFromDB]);

  useEffect(() => {
    if (showDdiDropdown) {
      const handleClick = () => setShowDdiDropdown(false);
      document.addEventListener('click', handleClick);
      return () => document.removeEventListener('click', handleClick);
    }
  }, [showDdiDropdown]);

  const addContact = async () => {
    if (!attendant?.company_id) return;
    const name = newContactName.trim();
    let phone = newContactPhone.trim().replace(/\D/g, '');

    if (!name) {
      setToastMessage('❌ Digite o nome do contato!');
      setShowToast(true);
      return;
    }

    const ddiOption = DDI_OPTIONS.find(d => d.code === newContactDdi);
    if (!phone || !ddiOption?.digits.includes(phone.length)) {
      const expected = ddiOption?.digits.join(' ou ') ?? '10';
      setToastMessage(`❌ Número inválido! Digite ${expected} dígitos para ${ddiOption?.label ?? 'este país'}.`);
      setShowToast(true);
      return;
    }

    const ddi = newContactDdi.replace(/\D/g, '');
    if (ddi === '55' && phone.length === 11) {
      phone = phone.substring(0, 2) + phone.substring(3);
    }
    if (!phone.startsWith(ddi)) {
      phone = ddi + phone;
    }

    setAddingContact(true);
    try {
      const { data: upsertedRows, error: upsertError } = await supabase.from('contacts').upsert(
        { company_id: attendant.company_id, phone_number: phone, name, last_message_time: new Date().toISOString() },
        { onConflict: 'company_id,phone_number', ignoreDuplicates: false }
      ).select('id, name, phone_number, last_message_time');

      if (upsertError) throw upsertError;

      const savedContact = upsertedRows?.[0];
      if (!savedContact) {
        const { data: fetched } = await supabase
          .from('contacts')
          .select('id, name, phone_number, last_message_time')
          .eq('company_id', attendant.company_id)
          .eq('phone_number', phone)
          .single();
        if (fetched) {
          setAllContactsList(prev => {
            const exists = prev.some(c => c.phone_number === phone);
            if (exists) return prev;
            return [{ ...fetched, ticket_status: 'aberto' }, ...prev];
          });
        }
      } else {
        setAllContactsList(prev => {
          const exists = prev.some(c => c.phone_number === phone);
          if (exists) return prev;
          return [{ ...savedContact, ticket_status: 'aberto' }, ...prev];
        });
      }

      setShowAddContactModal(false);
      setNewContactName('');
      setNewContactPhone('');
      setNewContactDdi('55');
      setToastMessage('✅ Contato adicionado com sucesso!');
      setShowToast(true);
      fetchContacts();
    } catch (err: any) {
      console.error('Erro ao adicionar contato:', err);
      setToastMessage(`❌ Erro ao adicionar contato: ${err?.message || 'Tente novamente.'}`);
      setShowToast(true);
    } finally {
      setAddingContact(false);
    }
  };

  const handleEditContact = (contact: any) => {
    const cleanPhone = (contact.phone_number || '').replace('@s.whatsapp.net','').replace('@g.us','');
    setEditingContactId(contact.id);
    setEditingName(contact.name || '');
    setEditingPhone(cleanPhone);
    setIsEditModalOpen(true);
  };

  const handleCloseEditModal = () => {
    setEditingContactId(null);
    setEditingName('');
    setEditingPhone('');
    setIsEditModalOpen(false);
  };

  const handleSaveContactEdit = async () => {
    if (!editingContactId || !editingName.trim()) {
      setToastMessage('O nome não pode estar em branco');
      setShowToast(true);
      return;
    }
    try {
      const { error } = await supabase
        .from('contacts')
        .update({ name: editingName.trim(), phone_number: editingPhone.trim(), updated_at: new Date().toISOString() })
        .eq('id', editingContactId);
      if (error) throw error;
      setAllContactsList(prev => prev.map(c => c.id === editingContactId ? { ...c, name: editingName.trim(), phone_number: editingPhone.trim() } : c));
      setContactsDB(prev => prev.map(c => c.id === editingContactId ? { ...c, name: editingName.trim(), phone_number: editingPhone.trim() } : c));
      handleCloseEditModal();
      setToastMessage('Contato atualizado!');
      setShowToast(true);
    } catch (err) {
      console.error(err);
      setToastMessage('Erro ao atualizar contato');
      setShowToast(true);
    }
  };

  const handleOpenDeleteModal = (contact: any) => setDeleteModal({ isOpen: true, contact });
  const handleCloseDeleteModal = () => setDeleteModal({ isOpen: false, contact: null });

  const handleDeleteContact = async () => {
    if (!deleteModal.contact) return;
    setIsDeletingContact(true);
    try {
      let contactId = deleteModal.contact.id;
      const phone_number = deleteModal.contact.phone_number;

      // Se o ID não for UUID válido, busca o real pelo phone
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(contactId)) {
        const { data: found } = await supabase
          .from('contacts')
          .select('id')
          .eq('phone_number', phone_number)
          .single();
        if (!found?.id) throw new Error('Contato não encontrado no banco de dados');
        contactId = found.id;
      }

      const { data: rpcData, error: rpcError } = await supabase.rpc('delete_contact_and_messages', { p_contact_id: contactId });
      if (rpcError) throw rpcError;
      const result = rpcData as { success: boolean; message?: string } | null;
      if (result && !result.success) throw new Error(result.message || 'Falha ao apagar o contato');

      const deletedPhone = phone_number;
      const phoneDigits = deletedPhone.replace(/\D/g, '');
      await supabase.from('messages').delete().or(`numero.eq.${deletedPhone},numero.eq.${phoneDigits},numero.eq.${deletedPhone}@s.whatsapp.net`);
      await supabase.from('sent_messages').delete().or(`numero.eq.${deletedPhone},numero.eq.${phoneDigits}`);

      setAllContactsList(prev => prev.filter(c => c.phone_number !== deletedPhone && c.id !== contactId));
      setContactsDB(prev => prev.filter(c => c.phone_number !== deletedPhone && c.id !== contactId));

      if (selectedContact && normalizePhone(deletedPhone) === normalizePhone(selectedContact)) {
        setSelectedContact(null);
        setMessages([]);
      }

      handleCloseDeleteModal();
      setToastMessage('Contato deletado com sucesso!');
      setShowToast(true);

      try {
        window.dispatchEvent(new CustomEvent('contactDeleted', { detail: contactId }));
      } catch (e) {
        // ignore
      }
    } catch (err: any) {
      console.error(err);
      setToastMessage(`Erro ao deletar contato: ${err?.message || 'Erro desconhecido'}`);
      setShowToast(true);
    } finally {
      setIsDeletingContact(false);
    }
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100 dark:from-[#0d1117] dark:to-[#0b0f14]">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600 font-medium">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50 dark:from-[#0d1117] dark:via-[#0d1117] dark:to-[#0b0f14] transition-colors duration-300 pt-14">
      {/* Toast */}
      {showToast && (
        <Toast
          message={toastMessage}
          onClose={() => setShowToast(false)}
        />
      )}

      <ProfileDropdown
        userName={attendant?.name || 'Atendente'}
        onMessagesClick={() => setCurrentView('mensagens')}
        onContactsClick={() => setCurrentView('contatos')}
        onTransfersClick={() => setCurrentView('transferencias')}
        onHistoryClick={() => setCurrentView('historico')}
        onLogout={signOut}
        showNavigationOptions={true}
        showSettings={false}
        activeTab={currentView}
        isOpen={false}
        onToggle={() => {}}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {currentView === 'historico' ? (
          <TicketHistory onOpenChat={handleOpenChatFromHistory} />
        ) : currentView === 'contatos' ? (
          <div className="flex-1 bg-slate-50 overflow-y-auto">
            {(() => {

              const filtered = allContactsSearch.trim()
                ? allContactsList.filter(c =>
                    (c.name || '').toLowerCase().includes(allContactsSearch.toLowerCase()) ||
                    (c.phone_number || '').includes(allContactsSearch)
                  )
                : allContactsList;

              return (
                <div className="w-full p-6">
                  <div className="mb-6 flex items-center justify-between">
                    <h2 className="text-3xl font-bold text-slate-900">Contatos</h2>
                    <button
                      onClick={() => setShowAddContactModal(true)}
                      className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-lg font-semibold transition-all shadow-md hover:shadow-lg"
                    >
                      <Plus className="w-5 h-5" />
                      Adicionar
                    </button>
                  </div>

                  <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">

                    <div className="px-6 py-4 border-b border-slate-100">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                          type="text"
                          value={allContactsSearch}
                          onChange={(e) => setAllContactsSearch(e.target.value)}
                          placeholder="Buscar por nome ou telefone..."
                          className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg bg-white text-gray-900 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
                        />
                      </div>
                    </div>

                    <div className="p-6">
                      {loadingAllContacts ? (
                        <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                          <Loader2 className="w-8 h-8 animate-spin mb-3 text-blue-500" />
                          <p className="text-sm font-medium">Carregando contatos...</p>
                        </div>
                      ) : filtered.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                          <User className="w-10 h-10 mb-3 opacity-40" />
                          <p className="text-sm font-medium">Nenhum contato encontrado</p>
                          <p className="text-xs mt-1">Procure por contatos ou adicione um novo</p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {filtered.map((contact) => {
                            const initial = (contact.name || contact.phone_number || '?')[0].toUpperCase();
                            const color = getAvatarColor(contact.name || contact.phone_number || '');
                            const hasHistory = !!contact.last_message;
                            const lastMessageTime = contact.last_message_time && hasHistory ? formatDate(contact.last_message_time) : null;
                            const isTicketOpen = contact.ticket_status !== 'finalizado';
                            const cleanPhone = (contact.phone_number || '').replace('@s.whatsapp.net', '').replace('@g.us', '');

                            return (
                              <div
                                key={contact.id}
                                className={`bg-white/70 border border-gray-200/50 rounded-2xl p-6 shadow-md hover:shadow-lg transition-all group hover:-translate-y-1 ${hasHistory ? 'cursor-pointer' : 'cursor-default'}`}
                                onClick={() => {
                                  if (!hasHistory) return;
                                  setCurrentView('mensagens');
                                  setSelectedContact(normalizePhone(contact.phone_number));
                                }}
                              >
                                {/* Avatar + Actions */}
                                <div className="flex justify-between mb-3">
                                  <div className={`w-14 h-14 bg-gradient-to-br ${color} rounded-xl flex items-center justify-center shadow-md text-white font-semibold text-lg`}>
                                    {initial}
                                  </div>
                                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                      onClick={(e) => { e.stopPropagation(); handleEditContact(contact); }}
                                      className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                                      title="Editar contato"
                                    >
                                      <Edit2 className="w-4 h-4" />
                                    </button>
                                    <button
                                      onClick={(e) => { e.stopPropagation(); handleOpenDeleteModal(contact); }}
                                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                      title="Deletar contato"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                </div>

                                {/* Nome */}
                                <h3 className="font-bold text-gray-900">{contact.name || 'Sem nome'}</h3>

                                {/* Número */}
                                <p className="text-sm text-gray-600 mt-1">{cleanPhone || 'Sem número'}</p>

                                {/* Última Mensagem */}
                                {hasHistory && contact.last_message && (
                                  <p className="text-xs text-gray-600 mt-2 line-clamp-2">{contact.last_message}</p>
                                )}

                                {/* Data + Status */}
                                <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs">
                                  {hasHistory ? (
                                    <>
                                      <span className="text-[11px] text-slate-400 truncate">
                                        {lastMessageTime}
                                      </span>
                                      {isTicketOpen ? (
                                        <span className="flex-shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500 text-white shadow-sm shadow-emerald-100">
                                          <span className="w-1.5 h-1.5 rounded-full bg-white/80 animate-pulse" />
                                          Aberto
                                        </span>
                                      ) : (
                                        <span className="flex-shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500">
                                          <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                                          Fechado
                                        </span>
                                      )}
                                    </>
                                  ) : (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setCurrentView('mensagens');
                                        setSelectedContact(normalizePhone(contact.phone_number));
                                      }}
                                      className="w-full py-1.5 rounded-lg bg-teal-500 hover:bg-teal-600 text-white text-[11px] font-semibold transition-colors"
                                    >
                                      Iniciar Conversa
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                  </div>

                  {!loadingAllContacts && allContactsList.length > 0 && (
                    <p className="text-center text-sm text-slate-500 mt-4">
                      Total de {allContactsList.length} contato{allContactsList.length !== 1 ? 's' : ''}
                    </p>
                  )}
                </div>
              );
            })()}

            {/* ── Modal: Adicionar Contato ─────────────── */}
            {showAddContactModal && (
              <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowAddContactModal(false)}>
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                    <div>
                      <h3 className="text-lg font-bold text-slate-900">Adicionar Contato</h3>
                      <p className="text-xs text-slate-500 mt-0.5">Digite o nome e telefone do contato</p>
                    </div>
                    <button onClick={() => setShowAddContactModal(false)} className="w-8 h-8 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all">
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="p-5 space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Nome do Contato *</label>
                      <input
                        type="text"
                        value={newContactName}
                        onChange={(e) => setNewContactName(e.target.value)}
                        placeholder="Ex: João Silva"
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-green-400 focus:ring-2 focus:ring-green-100 transition-all"
                        disabled={addingContact}
                        autoFocus
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Número do Telefone *</label>
                      {(() => {
                        const selectedDdi = DDI_OPTIONS.find(d => d.code === newContactDdi)!;
                        const digits = newContactPhone.length;
                        const valid = selectedDdi.digits.includes(digits);
                        const hasInput = digits > 0;
                        const max = Math.max(...selectedDdi.digits);
                        const borderClass = hasInput ? (valid ? 'border-green-400 ring-2 ring-green-100' : 'border-red-400 ring-2 ring-red-100') : 'border-slate-200';
                        return (
                          <div className="flex gap-2 items-stretch">
                            <div className="relative">
                              <button
                                type="button"
                                onClick={() => setShowDdiDropdown(prev => !prev)}
                                disabled={addingContact}
                                className="h-full flex items-center gap-1.5 px-3 py-2 border border-slate-200 rounded-lg bg-white hover:bg-slate-50 transition-all text-sm whitespace-nowrap font-medium text-slate-700"
                              >
                                <span className="font-mono">+{newContactDdi}</span>
                                <svg className="w-3 h-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                              </button>
                              {showDdiDropdown && (
                                <div className="absolute top-full left-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 max-h-60 overflow-y-auto min-w-[140px]">
                                  {DDI_OPTIONS.map(opt => (
                                    <button
                                      key={opt.code}
                                      type="button"
                                      onClick={() => { setNewContactDdi(opt.code); setNewContactPhone(''); setShowDdiDropdown(false); }}
                                      className={`flex items-center justify-between w-full px-3 py-2 text-sm transition-colors first:rounded-t-xl last:rounded-b-xl ${newContactDdi === opt.code ? 'bg-green-50 text-green-700 font-semibold' : 'text-slate-700 hover:bg-slate-50'}`}
                                    >
                                      <span className="font-medium">{opt.label}</span>
                                      <span className="font-mono text-slate-400 text-xs">+{opt.code}</span>
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                            <div className="flex-1 relative">
                              <input
                                type="text"
                                inputMode="numeric"
                                value={newContactPhone}
                                onChange={(e) => {
                                  const value = e.target.value.replace(/\D/g, '').slice(0, max);
                                  setNewContactPhone(value);
                                }}
                                placeholder={`${selectedDdi.digits.join(' ou ')} dígitos`}
                                className={`w-full px-3 py-2 border rounded-lg focus:outline-none transition-all font-mono ${borderClass}`}
                                disabled={addingContact}
                              />
                              {hasInput && (
                                <span className={`absolute right-3 top-1/2 -translate-y-1/2 text-xs font-mono ${valid ? 'text-green-500' : 'text-red-400'}`}>
                                  {digits}/{max}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })()}
                    </div>

                    <div className="flex gap-3 pt-2">
                      <button
                        onClick={() => setShowAddContactModal(false)}
                        className="flex-1 px-4 py-2 text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-all"
                        disabled={addingContact}
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={addContact}
                        disabled={addingContact || !newContactName.trim() || !newContactPhone.trim()}
                        className="flex-1 px-4 py-2 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        {addingContact ? (
                          <><Loader2 className="w-4 h-4 animate-spin" />Adicionando...</>
                        ) : (
                          <><Plus className="w-4 h-4" />Adicionar</>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

          </div>
        ) : currentView === 'transferencias' ? (
          <div className="flex-1 bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50 dark:from-[#0d1117] dark:via-[#0d1117] dark:to-[#0b0f14] overflow-y-auto">
            <div className="w-full p-6">
              <div className="mb-6">
                <h2 className="text-3xl font-bold text-slate-900">Transferir Contatos</h2>
                <p className="text-slate-500 mt-1 text-sm">Selecione um contato para transferir de departamento</p>
              </div>
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-6">
                  {contactsDB.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                      <ArrowRightLeft className="w-10 h-10 mb-3 opacity-40" />
                      <p className="text-sm font-medium">Nenhum contato disponível</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {contactsDB
                        .filter((contact, index, self) =>
                          index === self.findIndex(c => c.phone_number === contact.phone_number)
                        )
                        .map((contact) => {
                          const cleanPhone = (contact.phone_number || '').replace('@s.whatsapp.net','').replace('@g.us','');
                          const deptName = departments.find(d => d.id === contact.department_id)?.name || 'Sem departamento';
                          return (
                            <div
                              key={contact.id}
                              className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100 hover:border-blue-200 hover:bg-blue-50/30 transition-all"
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-gradient-to-br from-sky-400 to-blue-600 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-sm">
                                  {(contact.name || '?')[0].toUpperCase()}
                                </div>
                                <div>
                                  <p className="font-semibold text-slate-900">{contact.name || 'Sem nome'}</p>
                                  <p className="text-xs text-slate-500 font-mono">{cleanPhone}</p>
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 mt-1 bg-blue-100 text-blue-700 text-[11px] font-medium rounded-full">
                                    <Building2 className="w-2.5 h-2.5" />{deptName}
                                  </span>
                                </div>
                              </div>
                              <button
                                onClick={() => {
                                  setSelectedContact(normalizePhone(contact.phone_number));
                                  setShowTransferModal(true);
                                }}
                                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-all shadow-sm"
                              >
                                <ArrowRightLeft className="w-4 h-4" />
                                Transferir
                              </button>
                            </div>
                          );
                        })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : currentView === 'mensagens' ? (
          <>
            {/* Sidebar - Contacts List */}
            <div
              className={`${sidebarOpen ? 'flex' : 'hidden'
                } md:flex w-full md:w-[300px] bg-[#1a1f2e] border-r border-[#252b3b] flex-col`}
            >
          {error && (
            <div className="bg-red-900/30 border-b border-red-800 px-5 py-3 flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
              <p className="text-red-300 text-sm flex-1">{error}</p>
            </div>
          )}

          {(settings.companyName || settings.logoUrl) && (
            <div className="px-4 py-3 border-b border-[#252b3b] bg-[#1a1f2e]">
              <div className="flex items-center gap-3">
                {settings.logoUrl ? (
                  <img
                    src={settings.logoUrl}
                    alt={settings.companyName || 'Logo'}
                    className="h-10 w-auto object-contain"
                  />
                ) : (
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-white" />
                  </div>
                )}
                {settings.companyName && (
                  <div className="flex-1 min-w-0">
                    <h2 className="text-sm font-bold text-slate-200 truncate">
                      {settings.companyName}
                    </h2>
                    <p className="text-xs text-slate-500">
                      Identidade da Empresa
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Barra de Pesquisa e Filtros */}
          <div className="px-3 py-3 border-b border-[#252b3b] bg-[#1a1f2e]">
            <div className="relative mb-3">
              <Search className="absolute left-3.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                placeholder="Buscar conversa..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-[#252b3b] text-slate-200 text-sm pl-10 pr-4 py-2.5 rounded-xl border border-[#313a4f] focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/60 transition-all placeholder-slate-500 shadow-sm"
              />
            </div>

            <div className="flex bg-[#252b3b] rounded-lg p-0.5 gap-0.5">
              <button
                onClick={() => setContactFilter('todos')}
                className={`flex-1 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  contactFilter === 'todos'
                    ? 'bg-[#313a4f] text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Recepção
              </button>
              <button
                onClick={() => setContactFilter('abertos')}
                className={`flex-1 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  contactFilter === 'abertos'
                    ? 'bg-[#313a4f] text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Abertos
              </button>
              <button
                onClick={() => setContactFilter('departamento')}
                className={`flex-1 py-1.5 rounded-md text-xs font-semibold transition-all truncate ${
                  contactFilter === 'departamento'
                    ? 'bg-[#313a4f] text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title={departments.find(d => d.id === attendant?.department_id)?.name || 'Meu departamento'}
              >
                {departments.find(d => d.id === attendant?.department_id)?.name || 'Depto.'}
              </button>
            </div>
          </div>

          {/* Lista de Contatos */}
          <div className="flex-1 overflow-y-auto bg-[#1a1f2e]">
            {filteredContacts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full p-8">
                <div className="w-16 h-16 bg-[#252b3b] rounded-2xl flex items-center justify-center mb-4">
                  <MessageSquare className="w-8 h-8 text-slate-500" />
                </div>
                <p className="text-slate-400 text-sm text-center font-medium">
                  {searchTerm ? 'Nenhum contato encontrado' : contactFilter === 'departamento' ? 'Não há contatos no seu departamento' : contactFilter === 'abertos' ? 'Não há conversas aguardando atendimento' : 'Nenhuma conversa ainda'}
                </p>
              </div>
            ) : (
              <div className="px-2 py-2 space-y-0.5">
                {filteredContacts.map((contact) => {
                  const contactDB = contactsDB.find(c => normalizeDbPhone(c.phone_number) === normalizeDbPhone(contact.phoneNumber));
                  const isOpen = contactDB?.ticket_status !== 'finalizado';
                  return (
                    <div
                      key={contact.phoneNumber}
                      onClick={() => {
                        setSelectedContact(contact.phoneNumber);
                        setSidebarOpen(false);
                      }}
                      onContextMenu={(e) => handleContextMenu(e, contact.phoneNumber)}
                      className={`group cursor-pointer px-3 py-3 rounded-xl transition-all duration-150 ${
                        selectedContact === contact.phoneNumber
                          ? 'bg-blue-600 shadow-lg shadow-blue-900/30'
                          : 'hover:bg-[#252b3b] border border-transparent'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-sky-400 to-blue-600 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0 shadow-sm">
                          {contact.name ? contact.name[0].toUpperCase() : <User className="w-4 h-4" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-1.5 flex-1 min-w-0">
                              <h3 className={`font-semibold truncate text-sm ${selectedContact === contact.phoneNumber ? 'text-white' : 'text-slate-200'}`}>
                                {contact.name || getPhoneNumber(contact.phoneNumber)}
                              </h3>
                              {contactDB?.pinned && (
                                <Pin className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" fill="currentColor" />
                              )}
                            </div>
                            <div className="flex flex-col items-end gap-1 ml-2 flex-shrink-0">
                              <span className={`text-[10px] font-medium ${selectedContact === contact.phoneNumber ? 'text-blue-200' : 'text-slate-500'}`}>
                                {formatTime(contact.lastMessageTime)}
                              </span>
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide ${
                                selectedContact === contact.phoneNumber
                                  ? isOpen ? 'bg-white/20 text-white' : 'bg-white/10 text-blue-200'
                                  : isOpen ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700 text-slate-400'
                              }`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${selectedContact === contact.phoneNumber ? 'bg-white/70' : isOpen ? 'bg-emerald-400' : 'bg-slate-500'}`} />
                                {isOpen ? 'Aberto' : 'Fechado'}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <p className={`text-xs truncate flex-1 ${selectedContact === contact.phoneNumber ? 'text-blue-100/80' : 'text-slate-500'}`}>
                              {contact.lastMessage}
                            </p>
                            {contact.unreadCount > 0 && (
                              <span className="ml-2 bg-blue-600 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center flex-shrink-0">
                                {contact.unreadCount > 9 ? '9+' : contact.unreadCount}
                              </span>
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

        {/* Chat Area */}
        <div className="flex-1 flex flex-col" style={{ backgroundColor: settings.backgroundColor || "#efeae2" }}>
          {selectedContactData ? (
            <>
              {/* Chat Header */}
              <div className="border-b px-6 py-4 flex items-center justify-between" style={{ backgroundColor: "#1a1f2e", borderColor: "#252b3b" }}>
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => setSidebarOpen(true)}
                    className="md:hidden p-2 text-slate-300 hover:bg-white/10 rounded-lg"
                  >
                    <Menu className="w-5 h-5" />
                  </button>
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white font-semibold shadow-sm">
                    {selectedContactData.name ? selectedContactData.name[0].toUpperCase() : <User className="w-5 h-5" />}
                  </div>
                  <div>
                    <h2 className="font-semibold text-white">
                      {selectedContactData.name || getPhoneNumber(selectedContactData.phoneNumber)}
                    </h2>
                    <p className="text-sm text-slate-500 mt-0.5">
                      {getPhoneNumber(selectedContactData.phoneNumber)}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 mt-1.5">
                      {/* Badge de departamento se não for do meu departamento */}
                      {selectedContactData.department_id && selectedContactData.department_id !== attendant?.department_id && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded-full border border-amber-200">
                          <Building2 className="w-3 h-3" />
                          {departments.find(d => d.id === selectedContactData.department_id)?.name || 'Outro departamento'}
                        </span>
                      )}
                      {/* Tags do contato no cabeçalho */}
                      {selectedContactData.tag_ids && selectedContactData.tag_ids.length > 0 && (
                        <>
                          {selectedContactData.tag_ids.map((tagId) => {
                            const tag = tags.find(t => t.id === tagId);
                            return tag ? (
                              <span
                                key={tagId}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium text-white"
                                style={{ backgroundColor: tag.color }}
                              >
                                <Tag className="w-3 h-3" />
                                {tag.name}
                              </span>
                            ) : null;
                          })}
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Botões de Ação */}
                {(() => {
                  const currentContact = contactsDB.find(c => normalizeDbPhone(c.phone_number) === normalizeDbPhone(selectedContactData?.phoneNumber || ''));
                  const notAssumed = !currentContact?.attendant_id;
                  const assumedByMe = currentContact?.attendant_id === attendant?.user_id;
                  const isFinalized = currentContact?.ticket_status === 'finalizado';

                  // Conversa ainda não assumida — mostrar só "Iniciar Conversa"
                  if (notAssumed && !isFinalized) {
                    return (
                      <button
                        onClick={() => handleAssumeContact(selectedContactData.phoneNumber)}
                        className="px-5 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-all flex items-center gap-2 shadow-sm"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        Iniciar Conversa
                      </button>
                    );
                  }

                  // Assumida pelo atendente atual (ou finalizada) — botões normais
                  if (assumedByMe || isFinalized) {
                    return (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setShowTransferModal(true)}
                          className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-all flex items-center gap-2 shadow-sm"
                          title="Transferir departamento"
                        >
                          <ArrowRightLeft className="w-4 h-4" />
                          Transferir
                        </button>
                        <button
                          onClick={() => setShowTagModal(true)}
                          className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-all flex items-center gap-2 shadow-sm"
                          title="Adicionar tag"
                        >
                          <Tag className="w-4 h-4" />
                          Tags
                        </button>
                        {isFinalized ? (
                          <button
                            onClick={handleReopenTicket}
                            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-all flex items-center gap-2 shadow-sm"
                          >
                            <FolderOpen className="w-4 h-4" />
                            <span className="hidden sm:inline">Abrir Chamado</span>
                          </button>
                        ) : (
                          <button
                            onClick={handleCloseTicket}
                            className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-all flex items-center gap-2 shadow-sm"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            <span className="hidden sm:inline">Finalizar</span>
                          </button>
                        )}
                      </div>
                    );
                  }

                  // Assumida por outro — sem botões de ação
                  return null;
                })()}
              </div>

              {/* Messages Area */}
              <div
                ref={messagesContainerRef}
                onScroll={handleMessagesScroll}
                className="flex-1 overflow-y-auto p-5 space-y-2"
                style={{
                  backgroundColor: settings.backgroundColor || '#efeae2',
                  backgroundImage: settings.backgroundColor ? 'none' : `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.03'/%3E%3C/svg%3E")`,
                }}
              >
                {selectedContactData.messages.map((msg, index) => {
                  const isSent = msg['minha?'] === 'true';
                  const isSystemTransfer = msg.message_type === 'system_transfer';
                  const showDate = index === 0 || formatDate(msg.date_time || msg.created_at || '') !== formatDate(selectedContactData.messages[index - 1]?.date_time || selectedContactData.messages[index - 1]?.created_at || '');

                  // Detectar tipo de mídia (mesma lógica do CompanyDashboard)
                  const base64Type = msg.base64 ? detectBase64Type(msg.base64) : null;
                  const tipoFromField = getMessageTypeFromTipomessage(msg.tipomessage);
                  const hasBase64Content = msg.base64 && base64Type;

                  return (
                    <div key={msg.id || msg.idmessage || index}>
                      {showDate && (
                        <div className="flex justify-center my-4">
                          <div className="px-3.5 py-1 rounded-full" style={{ backgroundColor: '#d1f4cc', boxShadow: '0 1px 1px rgba(0,0,0,0.1)' }}>
                            <p className="text-[12px] font-medium" style={{ color: '#1b4332' }}>{formatDate(msg.date_time || msg.created_at || '')}</p>
                          </div>
                        </div>
                      )}

                      {/* Mensagem de Sistema (Transferência) */}
                      {isSystemTransfer ? (
                        <SystemMessage message={msg} />
                      ) : (
                        <div className={`flex ${isSent ? 'justify-end' : 'justify-start'}`}>
                        <div
                          className={`max-w-[70%] ${isSent ? 'rounded-2xl rounded-br-[5px]' : 'rounded-2xl rounded-bl-[5px]'}`}
                          style={isSent ? {
                            backgroundColor: settings.messageBubbleSentColor || '#005c4b',
                            color: settings.messageBubbleSentTextColor || '#e9f5ef',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.2)'
                          } : {
                            backgroundColor: settings.messageBubbleReceivedColor || '#ffffff',
                            color: settings.messageBubbleReceivedTextColor || '#111b21',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.13)'
                          }}
                        >
                          {/* Nome do remetente */}
                          <div className="px-3.5 pt-2 pb-0">
                            <span
                              className="text-[11px] font-semibold"
                              style={{
                                color: isSent ? (settings.messageBubbleSentTextColor ? 'rgba(255,255,255,0.6)' : '#9ed8c9') : '#00a884'
                              }}
                            >
                              {isSent ? (attendant?.name || 'Atendente') : (selectedContactData.name || selectedContactData.phoneNumber)}
                            </span>
                          </div>

                          {/* Imagem via urlimagem */}
                          {msg.urlimagem && !hasBase64Content && (
                            <div className="p-1">
                              <img
                                src={msg.urlimagem}
                                alt="Imagem"
                                className="rounded-xl max-w-full h-auto cursor-pointer hover:opacity-95 transition"
                                style={{ maxHeight: '300px' }}
                                onClick={() => openImageModal(msg.urlimagem!)}
                              />
                            </div>
                          )}

                          {/* Imagem via base64 */}
                          {hasBase64Content && (base64Type === 'image' || tipoFromField === 'image') && (base64Type !== 'sticker' && tipoFromField !== 'sticker') && (
                            <div className="p-1">
                              <img
                                src={normalizeBase64(msg.base64!, 'image')}
                                alt="Imagem"
                                className="rounded-xl max-w-full h-auto cursor-pointer hover:opacity-95 transition"
                                style={{ maxHeight: '300px' }}
                                onClick={() => openImageModal(normalizeBase64(msg.base64!, 'image'), 'image')}
                              />
                              {msg.caption && (
                                <div className="mt-2 px-2 text-sm">
                                  {linkifyText(msg.caption, isSent)}
                                </div>
                              )}
                            </div>
                          )}

                          {/* Sticker via base64 */}
                          {hasBase64Content && (base64Type === 'sticker' || tipoFromField === 'sticker') && (
                            <div className="p-2">
                              <img
                                src={normalizeBase64(msg.base64!, 'sticker')}
                                alt="Figurinha"
                                className="rounded-lg max-w-[250px] h-auto cursor-pointer hover:opacity-90 transition"
                                style={{ maxHeight: '250px' }}
                                onClick={() => openImageModal(normalizeBase64(msg.base64!, 'sticker'), 'sticker')}
                              />
                            </div>
                          )}

                          {/* Vídeo via base64 */}
                          {hasBase64Content && (base64Type === 'video' || tipoFromField === 'video') && (
                            <div
                              className="p-1 relative group cursor-pointer"
                              onClick={() => openImageModal(normalizeBase64(msg.base64!, 'video'), 'video')}
                            >
                              <video
                                src={normalizeBase64(msg.base64!, 'video')}
                                className="rounded-xl max-w-full h-auto"
                                style={{ maxHeight: '300px' }}
                              />
                              <div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity">
                                <div className="w-12 h-12 bg-white/90 rounded-full flex items-center justify-center">
                                  <Play className="w-6 h-6 text-blue-500 ml-1" />
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Áudio via base64 */}
                          {hasBase64Content && (base64Type === 'audio' || tipoFromField === 'audio') &&
                            base64Type !== 'image' && tipoFromField !== 'image' && (
                              <div className="p-3">
                                <div
                                  className="flex items-center gap-3 p-3 rounded-xl"
                                  style={{
                                    backgroundColor: isSent
                                      ? (settings.messageBubbleSentColor || '#005c4b')
                                      : (settings.messageBubbleReceivedColor || '#f1f5f9')
                                  }}
                                >
                                  <button
                                    onClick={() => handleAudioPlay(msg.id || msg.idmessage || '', msg.base64!)}
                                    className={`p-2 rounded-full ${isSent ? 'bg-blue-700 hover:bg-blue-800' : 'bg-blue-500 hover:bg-blue-600'} transition`}
                                  >
                                    {playingAudio === (msg.id || msg.idmessage) ? (
                                      <Pause className="w-5 h-5 text-white" />
                                    ) : (
                                      <Play className="w-5 h-5 text-white" />
                                    )}
                                  </button>
                                  <div className="flex-1">
                                    <p className="text-sm font-medium">
                                      {msg.message || 'Áudio'}
                                    </p>
                                    <p className={`text-[11px] ${isSent ? 'text-blue-100' : 'text-gray-500'}`}>
                                      Clique para {playingAudio === (msg.id || msg.idmessage) ? 'pausar' : 'reproduzir'}
                                    </p>
                                  </div>
                                  <Mic className={`w-5 h-5 ${isSent ? 'text-blue-100' : 'text-blue-500'}`} />
                                </div>
                              </div>
                            )}

                          {/* Documento via base64 */}
                          {hasBase64Content && (base64Type === 'document' || tipoFromField === 'document') &&
                            base64Type !== 'audio' && tipoFromField !== 'audio' &&
                            base64Type !== 'image' && tipoFromField !== 'image' &&
                            base64Type !== 'sticker' && tipoFromField !== 'sticker' &&
                            base64Type !== 'video' && tipoFromField !== 'video' && (
                              <div className="p-2">
                                <button
                                  onClick={() => downloadBase64File(msg.base64!, msg.message || 'documento.pdf')}
                                  className="flex items-center gap-2 p-2.5 rounded-xl w-full transition"
                                  style={{ backgroundColor: isSent ? (settings.messageBubbleSentColor || '#005c4b') : '#f1f5f9', color: isSent ? (settings.messageBubbleSentTextColor || '#fff') : '#111b21' }}
                                >
                                  <FileText className="w-8 h-8 flex-shrink-0" />
                                  <div className="flex-1 min-w-0 text-left">
                                    <p className="text-sm font-medium truncate">
                                      {msg.message || 'Documento'}
                                    </p>
                                    <p className="text-[11px]" style={{ opacity: 0.7 }}>
                                      Clique para baixar
                                    </p>
                                  </div>
                                  <Download className="w-5 h-5 flex-shrink-0" />
                                </button>
                              </div>
                            )}

                          {/* Documento via urlpdf */}
                          {msg.urlpdf && !hasBase64Content && (
                            <div className="p-2">
                              <a
                                href={msg.urlpdf}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 p-2.5 rounded-xl hover:opacity-90 transition"
                                style={{ backgroundColor: isSent ? (settings.messageBubbleSentColor || '#005c4b') : '#f1f5f9', color: isSent ? (settings.messageBubbleSentTextColor || '#fff') : '#111b21' }}
                              >
                                <FileText className="w-8 h-8 flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium truncate">
                                    {msg.message || 'Documento'}
                                  </p>
                                  <p className="text-[11px]" style={{ opacity: 0.7 }}>
                                    Clique para abrir
                                  </p>
                                </div>
                              </a>
                            </div>
                          )}

                          {/* Texto da mensagem */}
                          {msg.message && !msg.urlpdf && !hasBase64Content && (
                            <div className="px-3.5 py-2">
                              <p className="text-[14px] leading-[1.4] whitespace-pre-wrap break-words">
                                {linkifyText(msg.message, isSent)}
                              </p>
                            </div>
                          )}

                          {/* Footer com hora e check */}
                          <div className="px-3.5 pb-1.5 flex items-center justify-end gap-1">
                            <span style={{ color: isSent ? (settings.messageBubbleSentTextColor ? 'rgba(255,255,255,0.55)' : 'rgba(233,245,239,0.65)') : '#667781', fontSize: '11px' }}>
                              {formatTime(msg.date_time || msg.created_at || '')}
                            </span>
                            {isSent && (
                              <CheckCheck className="w-4 h-4" style={{ color: '#53bdeb' }} />
                            )}
                          </div>

                          {/* Reações */}
                          {msg.reactions && msg.reactions.length > 0 && (
                            <div className={"px-2 pb-2 flex flex-wrap gap-1 " + (isSent ? "justify-end" : "justify-start")}>
                              {msg.reactions.map((reaction, idx) => (
                                <div
                                  key={idx}
                                  className="inline-flex items-center gap-1 text-sm rounded-full px-2 py-0.5 select-none cursor-default"
                                  style={{
                                    background: isSent ? 'rgba(255,255,255,0.18)' : 'rgba(14,165,233,0.10)',
                                    border: isSent ? '1px solid rgba(255,255,255,0.25)' : '1px solid rgba(14,165,233,0.20)',
                                    backdropFilter: 'blur(4px)',
                                    boxShadow: '0 1px 3px rgba(0,0,0,0.08)'
                                  }}
                                  title={reaction.emoji}
                                >
                                  <span style={{fontSize: '15px', lineHeight: 1}}>{reaction.emoji}</span>
                                  {reaction.count > 1 && (
                                    <span
                                      className="text-[11px] font-semibold"
                                      style={{ color: isSent ? 'rgba(255,255,255,0.9)' : '#0ea5e9' }}
                                    >
                                      {reaction.count}
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      )}
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Scroll to bottom button */}
              {showScrollButton && (
                <button
                  onClick={() => scrollToBottom(true)}
                  className="absolute bottom-24 right-8 bg-white text-blue-600 p-3 rounded-full shadow-lg hover:shadow-xl transition-all"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                  </svg>
                </button>
              )}

              {/* File Preview */}
              {filePreview && (
                <div className="border-t p-4 animate-in slide-in-from-bottom duration-200" style={{ backgroundColor: "#1a1f2e", borderColor: "#252b3b" }}>
                  <div className="max-w-[200px] relative">
                    <button
                      onClick={() => {
                        setSelectedFile(null);
                        setFilePreview(null);
                        setImageCaption('');
                      }}
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1.5 hover:bg-red-600 hover:scale-110 transition-all duration-200 shadow-lg"
                    >
                      <X className="w-4 h-4" />
                    </button>
                    {selectedFile?.type.startsWith('image/') ? (
                      <img src={filePreview} alt="Preview" className="max-w-full h-auto rounded-lg shadow-md" />
                    ) : (
                      <div className="flex items-center gap-2 bg-white p-3 rounded-lg border border-slate-200 shadow-md">
                        <FileText className="w-8 h-8 text-blue-600" />
                        <span className="text-sm text-slate-700 truncate">{selectedFile?.name}</span>
                      </div>
                    )}
                    <input
                      type="text"
                      placeholder="Adicionar legenda..."
                      value={imageCaption}
                      onChange={(e) => setImageCaption(e.target.value)}
                      className="w-full mt-2 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all duration-200"
                    />
                  </div>
                </div>
              )}

              {/* Banner: conversa assumida por outro atendente */}
                {(() => {
                  const cDB = contactsDB.find(c => normalizeDbPhone(c.phone_number) === normalizeDbPhone(selectedContactData.phoneNumber));
                  const isAssumedByOther = cDB?.attendant_id && cDB.attendant_id !== attendant?.user_id;
                  if (!isAssumedByOther) return null;
                  const attendingName = attendantsList.find(a => a.user_id === cDB?.attendant_id)?.name || 'outro atendente';
                  return (
                    <div className="px-4 py-3 bg-amber-900/30 border-t border-amber-700/40 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                      <p className="text-sm text-amber-300">
                        Esta conversa está sendo atendida por <strong>{attendingName}</strong>
                      </p>
                    </div>
                  );
                })()}

              {/* Message Input ou Botão Assumir Conversa */}
              <div className="border-t p-4" style={{ backgroundColor: "#1a1f2e", borderColor: "#252b3b" }}>
                {(() => {
                  const cDB = contactsDB.find(c => normalizeDbPhone(c.phone_number) === normalizeDbPhone(selectedContactData.phoneNumber));
                  const notAssumed = !cDB?.attendant_id && cDB?.ticket_status !== 'finalizado';
                  if (notAssumed) {
                    return (
                      <div className="flex items-center justify-center py-3">
                        <p className="text-sm text-slate-500">Clique em <strong className="text-slate-300">Iniciar Conversa</strong> para começar o atendimento</p>
                      </div>
                    );
                  }
                  return null;
                })()}
                {selectedContactData && !isContactFromMyDepartment ? (
                  // Mostrar botão para assumir conversa (outro departamento)
                  <div className="flex flex-col items-center gap-3 py-4">
                    <div className="text-center">
                      <p className="text-sm text-slate-300 mb-2">
                        Este contato pertence a outro departamento
                      </p>
                      <p className="text-xs text-slate-400">
                        Assuma a conversa para poder enviar mensagens
                      </p>
                    </div>
                    <button
                      onClick={handleAssumeConversation}
                      className="px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white font-medium rounded-lg hover:shadow-lg hover:shadow-blue-500/50 hover:scale-105 transition-all duration-200 shadow-md flex items-center gap-2"
                    >
                      <User className="w-5 h-5" />
                      Assumir Conversa
                    </button>
                  </div>
                ) : contactsDB.find(c => normalizeDbPhone(c.phone_number) === normalizeDbPhone(selectedContactData.phoneNumber))?.attendant_id || contactsDB.find(c => normalizeDbPhone(c.phone_number) === normalizeDbPhone(selectedContactData.phoneNumber))?.ticket_status === 'finalizado' ? (
                  // Input normal de mensagem (conversa assumida ou finalizada)
                  <div className="flex items-end gap-2">
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileSelect}
                      className="hidden"
                      accept=".pdf,.doc,.docx,.txt"
                    />
                    <input
                      type="file"
                      ref={imageInputRef}
                      onChange={handleImageSelect}
                      className="hidden"
                      accept="image/*"
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="p-2.5 text-slate-400 hover:text-blue-400 hover:bg-white/10 rounded-lg transition-all duration-200 hover:scale-110"
                      title="Anexar arquivo"
                    >
                      <Paperclip className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => imageInputRef.current?.click()}
                      className="p-2.5 text-slate-400 hover:text-blue-400 hover:bg-white/10 rounded-lg transition-all duration-200 hover:scale-110"
                      title="Enviar imagem"
                    >
                    <ImageIcon className="w-5 h-5" />
                  </button>
                  <div className="flex-1 relative">
                    {(() => {
                      const cDB = contactsDB.find(c => normalizeDbPhone(c.phone_number) === normalizeDbPhone(selectedContactData.phoneNumber));
                      const isAssumedByOther = !!(cDB?.attendant_id && cDB.attendant_id !== attendant?.user_id);
                      return (
                        <textarea
                          ref={messageInputRef as any}
                          value={messageText}
                          onChange={(e) => setMessageText(e.target.value)}
                          onPaste={handlePasteContent}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              handleSendMessage();
                            }
                          }}
                          placeholder={isAssumedByOther ? 'Conversa sendo atendida por outro atendente...' : 'Digite uma mensagem...'}
                          disabled={isAssumedByOther}
                          className={`w-full px-4 py-3 pr-12 border rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 resize-none min-h-[48px] max-h-[120px] transition-all duration-200 text-white placeholder-slate-400 bg-[#252b3b] border-[#313a4f]${isAssumedByOther ? ' opacity-50 cursor-not-allowed' : ''}`}
                          rows={1}
                        />
                      );
                    })()}
                    <div className="absolute right-2 bottom-2">
                      <EmojiPicker
                        onEmojiSelect={(emoji) => {
                          setMessageText((prev) => prev + emoji);
                        }}
                      />
                    </div>
                  </div>
                    <button
                      onClick={handleSendMessage}
                      disabled={sending || uploadingFile || (!messageText.trim() && !selectedFile)}
                      className="p-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg hover:shadow-lg hover:shadow-blue-500/50 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 transition-all duration-200 shadow-md"
                    >
                      {sending || uploadingFile ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <Send className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                ) : null}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center" style={{ backgroundColor: "#1a1f2e" }}>
              <div className="text-center text-slate-400">
                <MessageSquare className="w-24 h-24 mx-auto mb-4 text-slate-300" />
                <p className="text-lg font-medium text-slate-600">Selecione um contato para começar</p>
              </div>
            </div>
          )}
        </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center" style={{ backgroundColor: "#1a1f2e" }}>
            <div className="text-center">
              <Settings className="w-24 h-24 mx-auto mb-4 text-slate-600" />
              <p className="text-lg font-medium text-slate-400">Configurações em desenvolvimento</p>
            </div>
          </div>
        )}
      </div>

      {/* Image Modal */}
      {imageModalOpen && (
        <div
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
          onClick={closeImageModal}
        >
          <button
            onClick={closeImageModal}
            className="absolute top-4 right-4 text-white hover:text-gray-300 transition-colors"
          >
            <X className="w-8 h-8" />
          </button>
          {imageModalType === 'video' ? (
            <video
              src={imageModalSrc}
              controls
              className="max-w-full max-h-full"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <img
              src={imageModalSrc}
              alt="Visualização"
              className="max-w-full max-h-full object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          )}
        </div>
      )}

      {/* Modal de Transferir Departamento */}
      {showTransferModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <ArrowRightLeft className="w-6 h-6 text-blue-600" />
                Transferir Departamento
              </h3>
              <button
                onClick={() => setShowTransferModal(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Departamento
                </label>
                <select
                  value={selectedDepartmentId}
                  onChange={(e) => {
                    setSelectedDepartmentId(e.target.value);
                    setSelectedSectorId('');
                  }}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
                >
                  <option value="">Selecione um departamento</option>
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name}
                    </option>
                  ))}
                </select>
              </div>

              {selectedDepartmentId && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Setor (opcional)
                  </label>
                  <select
                    value={selectedSectorId}
                    onChange={(e) => setSelectedSectorId(e.target.value)}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
                  >
                    <option value="">Nenhum setor</option>
                    {sectors
                      .filter((sector: any) => sector.department_id === selectedDepartmentId)
                      .map((sector) => (
                        <option key={sector.id} value={sector.id}>
                          {sector.name}
                        </option>
                      ))}
                  </select>
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowTransferModal(false)}
                className="flex-1 px-4 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-all font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={handleTransferDepartment}
                disabled={!selectedDepartmentId}
                className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium shadow-sm"
              >
                Transferir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Tags */}
      {showTagModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <Tag className="w-6 h-6 text-blue-600" />
                Gerenciar Tags
              </h3>
              <button
                onClick={() => setShowTagModal(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-3 max-h-96 overflow-y-auto">
              {tags.length === 0 ? (
                <p className="text-center text-slate-500 py-8">
                  Nenhuma tag disponível
                </p>
              ) : (
                tags.map((tag) => (
                  <label
                    key={tag.id}
                    className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer transition-all"
                  >
                    <input
                      type="checkbox"
                      checked={selectedTagIds.includes(tag.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          if (selectedTagIds.length >= 5) {
                            setToastMessage('Máximo de 5 tags por contato');
                            setShowToast(true);
                            return;
                          }
                          setSelectedTagIds([...selectedTagIds, tag.id]);
                        } else {
                          setSelectedTagIds(selectedTagIds.filter((id) => id !== tag.id));
                        }
                      }}
                      className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500 cursor-pointer"
                    />
                    <span
                      className="w-4 h-4 rounded-full flex-shrink-0"
                      style={{ backgroundColor: tag.color }}
                    />
                    <span className="flex-1 font-medium text-slate-900">{tag.name}</span>
                  </label>
                ))
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowTagModal(false)}
                className="flex-1 px-4 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-all font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={handleUpdateTags}
                className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all font-medium shadow-sm"
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Menu de contexto (clique direito) */}
      {contextMenu && (
        <div
          className="fixed bg-white rounded-lg shadow-2xl border border-slate-200 py-2 z-50 min-w-[200px]"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => handleTogglePin(contextMenu.phoneNumber)}
            className="w-full px-4 py-2.5 text-left hover:bg-slate-50 transition-colors flex items-center gap-3 text-slate-700"
          >
            <Pin className="w-4 h-4" />
            {contactsDB.find(c => normalizeDbPhone(c.phone_number) === normalizeDbPhone(contextMenu.phoneNumber))?.pinned
              ? 'Desafixar contato'
              : 'Fixar contato'}
          </button>
          {aiEnabled && (
            <button
              onClick={() => handleToggleIA(contextMenu.phoneNumber)}
              className="w-full px-4 py-2.5 text-left hover:bg-slate-50 transition-colors flex items-center gap-3 text-slate-700"
            >
              <Bot className="w-4 h-4" />
              {contactsDB.find(c => normalizeDbPhone(c.phone_number) === normalizeDbPhone(contextMenu.phoneNumber))?.ia_ativada
                ? 'Desativar IA'
                : 'Ativar IA'}
            </button>
          )}
          <button
            onClick={() => {
              const c = contactsDB.find(x => normalizeDbPhone(x.phone_number) === normalizeDbPhone(contextMenu.phoneNumber));
              if (c) handleEditContact(c);
              closeContextMenu();
            }}
            className="w-full px-4 py-2.5 text-left hover:bg-slate-50 transition-colors flex items-center gap-3 text-slate-700"
          >
            <Edit2 className="w-4 h-4" />
            Editar nome
          </button>
          <button
            onClick={() => handleContextMenuTag(contextMenu.phoneNumber)}
            className="w-full px-4 py-2.5 text-left hover:bg-slate-50 transition-colors flex items-center gap-3 text-slate-700"
          >
            <Tag className="w-4 h-4" />
            Adicionar tag
          </button>
          <button
            onClick={() => handleContextMenuTransfer(contextMenu.phoneNumber)}
            className="w-full px-4 py-2.5 text-left hover:bg-slate-50 transition-colors flex items-center gap-3 text-slate-700"
          >
            <ArrowRightLeft className="w-4 h-4" />
            Transferir departamento
          </button>
        </div>
      )}

      {/* Modal: Editar Contato (global) */}
      {isEditModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-6 py-5 text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                    <Edit2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold">Editar Contato</h3>
                    <p className="text-blue-100 text-xs">Atualize nome ou número</p>
                  </div>
                </div>
                <button onClick={handleCloseEditModal} className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-all">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Nome</label>
                <input
                  type="text"
                  value={editingName}
                  onChange={e => setEditingName(e.target.value)}
                  placeholder="Nome do contato"
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all bg-slate-50 focus:bg-white"
                  autoFocus
                  onKeyDown={e => e.key === 'Enter' && handleSaveContactEdit()}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Número</label>
                <div className="relative">
                  <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={editingPhone}
                    onChange={e => setEditingPhone(e.target.value)}
                    placeholder="Número do contato"
                    className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all bg-slate-50 focus:bg-white font-mono"
                    onKeyDown={e => e.key === 'Enter' && handleSaveContactEdit()}
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={handleCloseEditModal} className="flex-1 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-all text-sm font-semibold">Cancelar</button>
                <button onClick={handleSaveContactEdit} className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-all text-sm font-semibold shadow-sm">Salvar alterações</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Excluir Contato (global) */}
      <Modal
        isOpen={deleteModal.isOpen}
        onClose={handleCloseDeleteModal}
        onConfirm={handleDeleteContact}
        title="Excluir Contato"
        message={`Tem certeza que deseja excluir o contato "${deleteModal.contact?.name}"?\n\nTodas as mensagens e dados serão removidos permanentemente. Esta ação não pode ser desfeita.`}
        confirmText="Excluir"
        cancelText="Cancelar"
        confirmColor="red"
        loading={isDeletingContact}
      />

      {/* Toast de notificação */}
      {showToast && <Toast message={toastMessage} onClose={() => setShowToast(false)} />}
    </div>
  );
}