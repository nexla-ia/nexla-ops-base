import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { supabase, Message } from '../lib/supabase';
import { MessageSquare, LogOut, Search, AlertCircle, CheckCheck, FileText, Download, User, Menu, X, Send, Paperclip, Image as ImageIcon, Mic, Play, Pause, Loader2, Briefcase, FolderTree, CircleUser as UserCircle2, Tag, Bell, XCircle, Info, ArrowRightLeft, Settings, Pin, Bot, CheckCircle2, FolderOpen, CreditCard, Plus, Edit2, Trash2 } from 'lucide-react';
import DepartmentsManagement from './DepartmentsManagement';
import SectorsManagement from './SectorsManagement';
import AttendantsManagement from './AttendantsManagement';
import TagsManagement from './TagsManagement';
import AgentConfig from './Agentconfig';
import TicketHistory from './TicketHistory';
import SettingsPage from './SettingsPage';
import MyPlan from './MyPlan';
import ProfileDropdown from './ProfileDropdown';
import Toast from './Toast';
import Modal from './Modal';
import { EmojiPicker } from './EmojiPicker';
import { linkifyText } from '../lib/linkifyText';
import { useRealtimeMessages, useRealtimeContacts, useRealtimeDepartments, useRealtimeSectors, useAiEnabled } from '../hooks';
import SystemMessage from './SystemMessage';

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
}

interface Department {
  id: string;
  name: string;
  company_id: string | null; // ✅ global quando NULL
  is_reception?: boolean | null;
  is_default?: boolean | null;
}

interface Sector {
  id: string;
  name: string;
}

interface NotificationItem {
  id: string;
  company_id: string;
  title: string;
  message: string;
  type: 'payment' | 'info' | 'warning' | 'error';
  is_read: boolean;
  created_at: string;
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

// Função para gerar cor consistente baseada no nome/número
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
  
  // Gera um hash mais dinâmico usando todos os caracteres
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) - hash) + input.charCodeAt(i);
    hash = hash & hash; // Converte para inteiro de 32 bits
  }
  
  return colors[Math.abs(hash) % colors.length];
}

type TabType = 'mensagens' | 'departamentos' | 'setores' | 'atendentes' | 'tags' | 'agente' | 'historico' | 'meu-plano' | 'configuracoes' | 'contatos';

export default function CompanyDashboard() {
  const { company, signOut } = useAuth();
  const { settings } = useTheme();
  const aiEnabled = useAiEnabled(company?.id || null);
  const [activeTab, setActiveTab] = useState<TabType>('mensagens');
  const [messages, setMessages] = useState<Message[]>([]);
  const [contactsDB, setContactsDB] = useState<ContactDB[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedContact, setSelectedContact] = useState<string | null>(null);
  const [contactFilter, setContactFilter] = useState<'todos' | 'departamento' | 'abertos'>('todos');
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


  // Mensagem de sistema no meio do chat (UI)
  const addInlineSystemMessage = useCallback((messageText: string, type: "system_transfer" | "system_notification" = "system_notification") => {
    const nowIso = new Date().toISOString();
    const uiMsg: any = {
      id: `ui_${type}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      numero: selectedContact || null,
      sender: null,
      minha: "false",
      pushname: "SISTEMA",
      tipomessage: type,
      message_type: type,
      message: messageText,
      date_time: nowIso,
      created_at: nowIso,
      apikey_instancia: company?.api_key,
      company_id: company?.id,
    };

    const toTs = (m: any) => {
      const raw = m?.date_time || m?.created_at || m?.timestamp;
      const t = raw ? new Date(raw).getTime() : 0;
      return Number.isFinite(t) ? t : 0;
    };

    setMessages((prev) => [...prev, uiMsg].sort((a, b) => toTs(a) - toTs(b)));
  }, [selectedContact, company?.api_key, company?.id]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
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
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showTagModal, setShowTagModal] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; phoneNumber: string } | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);

  // ✅ ID do departamento "Recepção" (criado automaticamente no banco)
  const receptionDeptId = useMemo(() => {
    const recepcao = departments.find(
      (d) => d.is_reception === true || String(d.name ?? '').toLowerCase().startsWith('recep')
    );
    return recepcao?.id ?? '';
  }, [departments]);

  const [sectors, setSectors] = useState<Sector[]>([]);
  const [tags, setTags] = useState<TagItem[]>([]);
  const [selectedDepartment, setSelectedDepartment] = useState<string>('');
  const [selectedSector, setSelectedSector] = useState<string>('');
  const [departamentoTransferencia, setDepartamentoTransferencia] = useState<string>('');
  const [setorTransferencia, setSetorTransferencia] = useState<string>('');

  // Mostra apenas setores do departamento selecionado
  const sectorsFiltered = useMemo(() => {
    const deptId = (selectedDepartment || '').trim();
    if (!deptId) return []; // sem dept => não mostra setor
    return sectors.filter((s: any) => s.department_id === deptId);
  }, [sectors, selectedDepartment]);

  // Setores filtrados para transferência
  const sectorsFilteredTransfer = useMemo(() => {
    const deptId = (departamentoTransferencia || '').trim();
    if (!deptId) return [];
    return sectors.filter((s: any) => s.department_id === deptId);
  }, [sectors, departamentoTransferencia]);

  const [selectedTags, setSelectedTags] = useState<string[]>([]);



  // ✅ Ao abrir o modal de transferência, se o contato não tiver departamento, já seleciona a Recepção
  useEffect(() => {
    if (!showTransferModal) return;
    if (selectedDepartment) return;
    if (!receptionDeptId) return;
    setSelectedDepartment(receptionDeptId);
  }, [showTransferModal, selectedDepartment, receptionDeptId]);
  const [, setTransferindo] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [iaGlobalAtivada, setIaGlobalAtivada] = useState(true);
  const [togglingIaGlobal, setTogglingIaGlobal] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);
  const [lastViewedMessageTime, setLastViewedMessageTime] = useState<{ [key: string]: number }>({});
  const [pendingMessagesCount, setPendingMessagesCount] = useState(0);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [webhookContacts, setWebhookContacts] = useState<{ name: string; phone: string }[]>([]);
  const [showWebhookContactsModal, setShowWebhookContactsModal] = useState(false);
  const [webhookContactsSearch, setWebhookContactsSearch] = useState('');
  const [loadingWebhookContacts, setLoadingWebhookContacts] = useState(false);
  const [showAddContactModal, setShowAddContactModal] = useState(false);
  const [newContactName, setNewContactName] = useState('');
  const [newContactPhone, setNewContactPhone] = useState('');
  const [addingContact, setAddingContact] = useState(false);
  const [showAllContactsModal, setShowAllContactsModal] = useState(false);
  const [allContactsList, setAllContactsList] = useState<{ id: string; name: string; phone_number: string; last_message_time?: string; ticket_status?: string }[]>([]);
  const [loadingAllContacts, setLoadingAllContacts] = useState(false);
  const [allContactsSearch, setAllContactsSearch] = useState('');
  const [pendingNewContact, setPendingNewContact] = useState<{ name: string; phone: string } | null>(null);
  
  // Estados para edição e deleção de contatos
  const [editingContactId, setEditingContactId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [editingPhone, setEditingPhone] = useState('');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; contact: any | null }>({
    isOpen: false,
    contact: null,
  });
  const [isDeletingContact, setIsDeletingContact] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messageInputRef = useRef<HTMLTextAreaElement | HTMLInputElement>(null);

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
  

  // Listen for contact deletions coming from other pages and update local state
  useEffect(() => {
    const handler = (ev: any) => {
      const contactId = ev?.detail;
      if (!contactId) return;

      setAllContactsList(prev => prev.filter(c => c.id !== contactId));

      setContactsDB(prev => {
        const next = prev.filter(c => c.id !== contactId);
        if (selectedContact) {
          const still = next.find(c => normalizePhone(c.phone_number) === normalizePhone(selectedContact));
          if (!still) {
            setSelectedContact(null);
            setPendingNewContact(null);
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
    // date_time é o mais confiável (ISO string salvo no banco)
    if (msg.date_time) {
      const t = new Date(msg.date_time).getTime();
      if (!isNaN(t) && t > 0) return t;
    }
    // timestamp unix (segundos) vindo do WhatsApp
    if (msg.timestamp) {
      const ts = Number(msg.timestamp);
      if (!isNaN(ts) && ts > 0) {
        // Se for unix epoch em segundos (< 9999999999), multiplica por 1000
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
      console.error('❌ Erro geral ao processar reações:', err);
      return messages;
    }
  };

  const fetchMessages = useCallback(async (limit?: number) => {
    if (!company) {
      setLoading(false);
      return;
    }

    setError(null);

    const timeout = setTimeout(() => {
      setLoading(false);
      // Silenciosamente timeout, sem mostrar erro no front
    }, 15000);

    // Sempre usar limit para evitar statement timeout no banco
    const effectiveLimit = limit || 150;

    try {
      // Incluir fallback por company_id caso mensagens não possuam apikey_instancia
      let messagesQuery = company?.id
        ? supabase.from('messages').select('*').or(`apikey_instancia.eq.${company.api_key},company_id.eq.${company.id}`)
        : supabase.from('messages').select('*').eq('apikey_instancia', company.api_key);

      let sentMessagesQuery = company?.id
        ? supabase.from('sent_messages').select('*').or(`apikey_instancia.eq.${company.api_key},company_id.eq.${company.id}`)
        : supabase.from('sent_messages').select('*').eq('apikey_instancia', company.api_key);

      messagesQuery = messagesQuery.order('created_at', { ascending: false }).limit(effectiveLimit);
      sentMessagesQuery = sentMessagesQuery.order('created_at', { ascending: false }).limit(effectiveLimit);

      const [receivedResult, sentResult] = await Promise.all([messagesQuery, sentMessagesQuery]);

      clearTimeout(timeout);

      if (receivedResult.error) {
        setError(`Erro ao carregar mensagens recebidas: ${receivedResult.error.message}`);
        return;
      }

      if (sentResult.error) {
        setError(`Erro ao carregar mensagens enviadas: ${sentResult.error.message}`);
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
      console.log('Dados recebidas:', receivedResult.data);

      // Log para debugar reactionMessage
      const reactionMessages = allMessages.filter(m => m.tipomessage === 'reactionMessage');
      if (reactionMessages.length > 0) {
        console.log('😊 REACTION MESSAGES ENCONTRADAS:', reactionMessages);
        reactionMessages.forEach((rm, idx) => {
          console.log(`  [${idx}] reaction_target_id="${rm.reaction_target_id}", message="${rm.message}", idmessage="${rm.idmessage}", id="${rm.id}"`);
        });
      }

      // Log para mostrar IDs das mensagens normais
      const normalMessages = allMessages.filter(m => m.tipomessage !== 'reactionMessage');
      console.log('📨 MENSAGENS NORMAIS:');
      normalMessages.slice(0, 5).forEach((msg, idx) => {
        console.log(`  [${idx}] idmessage="${msg.idmessage}", message="${msg.message?.substring(0, 30)}", id="${msg.id}"`);
      });

      // Log para verificar captions
      const messagesWithCaption = messagesWithReactions?.filter(m => m.caption);
      if (messagesWithCaption && messagesWithCaption.length > 0) {
        console.log('📝 Mensagens com caption encontradas:', messagesWithCaption);
      }
      console.log('📤 Mensagens enviadas:', sentResult.data?.length || 0);
      console.log('Dados enviadas:', sentResult.data);
      console.log('✉️ Total de mensagens:', messagesWithReactions.length);

      // Log para mensagens de sistema
      const systemMessages = messagesWithReactions.filter(m => m.message_type === 'system_transfer');
      if (systemMessages.length > 0) {
        console.log('🎫 MENSAGENS DE SISTEMA ENCONTRADAS:', systemMessages);
      } else {
        console.log('⚠️ Nenhuma mensagem de sistema encontrada');
      }

      setMessages(messagesWithReactions);

      if (limit && messagesWithReactions.length < limit) {
        setHasMoreMessages(false);
      }
    } catch (err: any) {
      clearTimeout(timeout);
      setError(`Erro ao carregar mensagens: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [company]);

  const loadMoreMessages = useCallback(async () => {
    if (!hasMoreMessages || loadingMoreMessages || !selectedContact || !company) return;

    setLoadingMoreMessages(true);
    try {
      const currentContactMessages = messages.filter(msg => {
        const contactId = getContactId(msg);
        return normalizeDbPhone(contactId) === normalizeDbPhone(selectedContact);
      }).sort((a, b) => getMessageTimestamp(a) - getMessageTimestamp(b));

      const oldestMessage = currentContactMessages[0];

      if (!oldestMessage) {
        setLoadingMoreMessages(false);
        return;
      }

      const messagesQuery = company?.id
        ? supabase.from('messages')
            .select('*')
            .or(`apikey_instancia.eq.${company.api_key},company_id.eq.${company.id}`)
            .lt('created_at', oldestMessage.created_at)
            .order('created_at', { ascending: false })
            .limit(30)
        : supabase.from('messages')
            .select('*')
            .eq('apikey_instancia', company.api_key)
            .lt('created_at', oldestMessage.created_at)
            .order('created_at', { ascending: false })
            .limit(30);

      const sentMessagesQuery = company?.id
        ? supabase.from('sent_messages')
            .select('*')
            .or(`apikey_instancia.eq.${company.api_key},company_id.eq.${company.id}`)
            .lt('created_at', oldestMessage.created_at)
            .order('created_at', { ascending: false })
            .limit(30)
        : supabase.from('sent_messages')
            .select('*')
            .eq('apikey_instancia', company.api_key)
            .lt('created_at', oldestMessage.created_at)
            .order('created_at', { ascending: false })
            .limit(30);

      const [receivedResult, sentResult] = await Promise.all([messagesQuery, sentMessagesQuery]);

      if (receivedResult.error || sentResult.error) {
        console.error('Erro ao carregar mais mensagens');
        setLoadingMoreMessages(false);
        return;
      }

      const newMessages = [
        ...(receivedResult.data || []),
        ...(sentResult.data || [])
      ].sort((a, b) => getMessageTimestamp(a) - getMessageTimestamp(b));

      const messagesWithReactions = processReactions(newMessages);

      if (messagesWithReactions.length < 30) {
        setHasMoreMessages(false);
      }

      setMessages(prev => {
        const combined = [...messagesWithReactions, ...prev];
        return combined.sort((a, b) => getMessageTimestamp(a) - getMessageTimestamp(b));
      });
    } catch (err) {
      console.error('Erro ao carregar mais mensagens:', err);
    } finally {
      setLoadingMoreMessages(false);
    }
  }, [hasMoreMessages, loadingMoreMessages, selectedContact, company, messages]);

  const fetchContacts = async () => {
    if (!company?.id) return;

    try {
      const { data: contactsData, error: contactsError } = await supabase
        .from('contacts')
        .select('id, company_id, phone_number, name, department_id, sector_id, tag_id, last_message, last_message_time, created_at, updated_at, pinned, ia_ativada, ticket_status, ticket_closed_at, ticket_closed_by')
        .eq('company_id', company.id)
        .order('last_message_time', { ascending: false });

      if (contactsError) throw contactsError;

      const { data: contactTagsData, error: contactTagsError } = await supabase
        .from('contact_tags')
        .select('contact_id, tag_id');

      if (contactTagsError) {
        console.error('Erro ao carregar contact_tags:', contactTagsError);
      }

      const normalized = (contactsData || []).map((c: any) => {
        const contactTags = (contactTagsData || [])
          .filter((ct: any) => ct.contact_id === c.id)
          .map((ct: any) => ct.tag_id);

        return {
          ...c,
          tag_ids: contactTags,
        };
      });

      setContactsDB(normalized);
    } catch (err) {
      console.error('Erro ao carregar contatos:', err);
    }
  };


  const fetchDepartments = useCallback(async () => {
    if (!company?.id) return;

    try {
      const { data, error } = await supabase
        .from('departments')
        .select('id,name,company_id')
        .or(`company_id.eq.${company.id},company_id.is.null`)
        .order('name');

      if (error) throw error;

      setDepartments(data || []);
    } catch (error) {
      console.error('Erro ao carregar departamentos:', error);
    }
  }, [company?.id]);


  const fetchSectors = useCallback(async () => {
    if (!company?.id) return;
    try {
      const { data, error } = await supabase
        .from('sectors')
        .select('*')
        .eq('company_id', company.id)
        .order('name');

      if (error) throw error;
      setSectors(data || []);
    } catch (error) {
      console.error('Erro ao carregar setores:', error);
    }
  }, [company?.id]);

  const fetchTags = useCallback(async () => {
    if (!company?.id) return;
    try {
      const { data, error } = await supabase
        .from('tags')
        .select('*')
        .eq('company_id', company.id)
        .order('name');

      if (error) throw error;
      setTags(data || []);
    } catch (error) {
      console.error('Erro ao carregar tags:', error);
    }
  }, [company?.id]);

  const fetchNotifications = async () => {
    if (!company?.id) return;
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('company_id', company.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setNotifications(data || []);
      const unread = (data || []).filter(n => !n.is_read).length;
      setUnreadNotificationsCount(unread);
    } catch (error) {
      console.error('Erro ao carregar notificações:', error);
    }
  };

  const markNotificationAsRead = async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId);

      if (error) throw error;
      await fetchNotifications();
    } catch (error) {
      console.error('Erro ao marcar notificação como lida:', error);
    }
  };

  const markAllNotificationsAsRead = async () => {
    if (!company?.id) return;
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('company_id', company.id)
        .eq('is_read', false);

      if (error) throw error;
      await fetchNotifications();
    } catch (error) {
      console.error('Erro ao marcar todas notificações como lidas:', error);
    }
  };

  const handleToggleIaGlobal = async () => {
    if (!company?.id) return;
    try {
      setTogglingIaGlobal(true);
      const newStatus = !iaGlobalAtivada;

      // Update no banco de dados
      const { error } = await supabase
        .from('companies')
        .update({ ia_ativada: newStatus })
        .eq('id', company.id);

      if (error) throw error;

      setIaGlobalAtivada(newStatus);
      setToastMessage(`✅ IA ${newStatus ? 'Ativada' : 'Desativada'} para toda a empresa`);
      setShowToast(true);
    } catch (err) {
      console.error('Erro ao toggle IA global:', err);
      setToastMessage('❌ Erro ao alterar IA');
      setShowToast(true);
      // Revert state on error
      setIaGlobalAtivada(iaGlobalAtivada);
    } finally {
      setTogglingIaGlobal(false);
    }
  };

  const checkPaymentNotifications = async () => {
    try {
      const { data, error } = await supabase.rpc("rpc_check_payment_notifications");

      if (error) {
        return;
      }

      console.log('Notificações verificadas:', data);

      // Recarregar notificações após verificação
      await fetchNotifications();
    } catch (error) {
      // Silenciar erros de notificações de pagamento
    }
  };

  const handleUpdateContactInfo = async () => {
  if (!selectedContact || !company?.api_key || !company?.id) return;

  try {
    // Helpers locais (garante que existem)
    const normalizePhone = (v: string) => {
      let digits = (v || "").toString().replace(/\D/g, "").replace(/@.*$/, "");

      // Remover 9 duplicado após o DDD
      if (digits.length === 13 && digits.startsWith('55')) {
        const ddd = digits.substring(2, 4);
        const resto = digits.substring(4);
        if (resto.startsWith('99')) {
          digits = '55' + ddd + resto.substring(1);
        }
      }

      return digits;
    };
    const normalizeDbPhone = (v: string) => {
      const digits = normalizePhone(v);
      if (!digits) return digits;
      return digits.startsWith("55") ? digits : `55${digits}`;
    };

    const selectedPhoneDb = normalizeDbPhone(selectedContact);

    // =========================
    // 1) Pegar contato atual (state -> banco fallback)
    // =========================
    let currentContact: any =
      contactsDB.find((c) => normalizeDbPhone(c.phone_number) === selectedPhoneDb) || null;

    // Se não achou no state OU achou sem id, busca no banco por phone_number
    if (!currentContact?.id) {
      console.warn("⚠️ Contato não encontrado no state, buscando no banco...", selectedPhoneDb);

      // Primeiro busca só por phone_number (evita company.id errado)
      const { data: byPhone, error: byPhoneErr } = await supabase
        .from("contacts")
        .select("id, company_id, phone_number, name, department_id, sector_id")
        .eq("phone_number", selectedPhoneDb)
        .maybeSingle();

      if (byPhoneErr) console.error("❌ Erro ao buscar contato no banco (phone_number):", byPhoneErr);
      if (byPhone?.id) currentContact = byPhone;

      // Se ainda não achou, tenta fallback removendo 55 (caso DB esteja sem 55)
      if (!currentContact?.id) {
        const without55 = selectedPhoneDb.startsWith("55") ? selectedPhoneDb.slice(2) : selectedPhoneDb;
        const { data: byPhone2, error: byPhone2Err } = await supabase
          .from("contacts")
          .select("id, company_id, phone_number, name, department_id, sector_id")
          .eq("phone_number", without55)
          .maybeSingle();

        if (byPhone2Err) console.error("❌ Erro ao buscar contato no banco (phone sem 55):", byPhone2Err);
        if (byPhone2?.id) currentContact = byPhone2;
      }
    }

    if (!currentContact?.id) {
      console.error("❌ Contato não encontrado nem no state nem no banco:", selectedPhoneDb);
      setToastMessage("Contato não encontrado");
      setShowToast(true);
      return;
    }

    const contactId = currentContact.id;

    // =========================
    // 2) Resolver Departamento (ID real)
    // =========================
    const receptionDept =
      departments.find((d) => (d as any).is_reception) ||
      departments.find((d) => d.name?.toLowerCase().startsWith("recep"));

    if (!receptionDept?.id) {
      throw new Error("Departamento Recepção não encontrado (is_reception ou nome começando com 'recep').");
    }

    // selectedDepartment precisa ser ID (uuid). Se vier vazio -> Recepção
    const newDepartmentId =
      selectedDepartment && selectedDepartment.trim() ? selectedDepartment : receptionDept.id;

    // valida se existe na lista carregada
    if (!departments.some((d) => d.id === newDepartmentId)) {
      throw new Error(`Departamento inválido (não está na lista carregada): ${newDepartmentId}`);
    }

    // Setor (não gera mensagem/evento, só atualiza se quiser)
    const newSectorId = selectedSector && selectedSector.trim() ? selectedSector : null;

    // =========================
    // 3) Detectar mudanças
    // =========================
    const oldDepartmentId = currentContact.department_id || receptionDept.id;
    const oldSectorId = currentContact.sector_id || null;

    const departmentChanged = oldDepartmentId !== newDepartmentId;
    const sectorChanged = oldSectorId !== newSectorId;

    // Tags: aqui o state real é selectedTags. Mas o contato no banco não tem tag_ids.
    // A referência correta é a tabela contact_tags. Então consideramos "mudou" sempre que selectedTags for diferente do estado selecionado atual da UI.
    // (Se você já carrega selectedTags a partir do banco ao selecionar o contato, isso fica correto.)

    const currentTagsPre = Array.isArray((currentContact as any).tag_ids) ? (currentContact as any).tag_ids : [];

    const tagsChangedPre =
      selectedTags.length !== currentTagsPre.length ||
      !selectedTags.every((id) => currentTagsPre.includes(id));

    if (!departmentChanged && !sectorChanged && !tagsChangedPre) {
      setToastMessage("Nenhuma alteração foi feita");
      setShowToast(true);
      return;
    }

    // =========================
    // 4) Atualizar CONTACT
    // =========================
    const updates: Record<string, any> = {};
    if (departmentChanged) updates.department_id = newDepartmentId;
    if (sectorChanged) updates.sector_id = newSectorId;

    if (Object.keys(updates).length > 0) {
      const { error: contactError } = await supabase
        .from("contacts")
        .update(updates)
        .eq("id", contactId);

      if (contactError) {
        console.error("❌ Erro ao atualizar contato:", contactError);
        throw contactError;
      }
    }

    // =========================
    // 5) Registrar transferência + mensagem UI (somente se mudou dept)
    // =========================
    if (departmentChanged) {
      const oldDeptName = departments.find((d: any) => d.id === oldDepartmentId)?.name || "Desconhecido";
      const newDeptName = departments.find((d: any) => d.id === newDepartmentId)?.name || "Desconhecido";

      console.log("🔄 [TRANSFER] De:", oldDepartmentId, "→ Para:", newDepartmentId);

      // 5.1) Tenta RPC (se existir)
      let transferOk = false;
      try {
        const { error: rpcErr } = await supabase.rpc("transfer_contact_department", {
          p_company_id: company.id,
          p_contact_id: contactId,
          p_to_department_id: newDepartmentId,
        });

        if (rpcErr) {
          console.warn("⚠️ RPC transfer_contact_department falhou, vai para fallback:", rpcErr);
        } else {
          transferOk = true;
        }
      } catch (e) {
        console.warn("⚠️ Exceção ao chamar RPC transfer_contact_department:", e);
      }

      // 5.2) Fallback: INSERT direto em transferencias (se RPC não existir)
      if (!transferOk) {
        const { error: fallbackErr } = await supabase.from("transferencias").insert([
          {
            company_id: company.id,
            api_key: company.api_key,
            contact_id: contactId,
            from_department_id: oldDepartmentId,
            to_department_id: newDepartmentId,
          },
        ]);

        if (fallbackErr) {
          console.error("❌ Fallback insert transferencias falhou:", fallbackErr);
        } else {
          transferOk = true;
        }
      }

      // Mensagem 100% UI
      if (transferOk) {
        addInlineSystemMessage(`Chamado transferido de ${oldDeptName} para ${newDeptName}`, "system_transfer");
      }
    }

    // =========================
    // 6) Atualizar TAGS (somente via RPC)
    // =========================
    // REGRA: nunca acessar contact_tags no frontend.
    // A UI trabalha com selectedTags (string[] de UUIDs).
    // A leitura/exibição vem de contacts.tag_ids (array) e do catálogo `tags`.

    // Detectar se tags mudaram de verdade
    const currentTags = Array.isArray((currentContact as any).tag_ids) ? (currentContact as any).tag_ids : [];
    const tagsChanged =
      selectedTags.length !== currentTags.length ||
      !selectedTags.every((id) => currentTags.includes(id));

    if (tagsChanged) {
      const { data: rpcData, error: rpcError } = await supabase.rpc('update_contact_tags', {
        p_contact_id: contactId,
        p_tag_ids: selectedTags,
      });

      if (rpcError) {
        console.error('[TAGS][Company] RPC update_contact_tags falhou:', rpcError);
        setToastMessage(`Erro ao atualizar tags: ${rpcError.message || String(rpcError)}`);
        setShowToast(true);
        throw rpcError;
      }

      // Opcional: manter espelho em contacts para UI (tag_ids e tag_id)
      // Isso garante que a lista de contatos e o header/modal atualizem imediatamente.
      const primaryTag = selectedTags.length > 0 ? selectedTags[0] : null;
      const { error: mirrorErr } = await supabase
        .from('contacts')
        .update({ tag_ids: selectedTags, tag_id: primaryTag })
        .eq('id', contactId);

      if (mirrorErr) {
        console.warn('[TAGS][Company] Aviso ao atualizar contacts.tag_ids/tag_id:', mirrorErr);
      }

      // Atualizar estado local imediatamente (sem depender de refetch)
      setContactsDB((prev) =>
        prev.map((c: any) => (c.id === contactId ? { ...c, tag_ids: selectedTags, tag_id: primaryTag } : c))
      );

      // Se quiser garantir consistência total, pode manter o refetch:
      fetchContacts();
    }

    // =========================

    // 7) Sync messages / sent_messages (somente se dept/sector mudou)
    // =========================
    if (Object.keys(updates).length > 0) {
      const phoneForMsg = selectedPhoneDb;

      const [messagesResult, sentMessagesResult] = await Promise.all([
        supabase
          .from("messages")
          .update(updates)
          .eq("apikey_instancia", company.api_key)
          .eq("numero", phoneForMsg),

        supabase
          .from("sent_messages")
          .update(updates)
          .eq("apikey_instancia", company.api_key)
          .eq("numero", phoneForMsg),
      ]);

      if (messagesResult.error) console.error("❌ Erro ao atualizar messages:", messagesResult.error);
      if (sentMessagesResult.error) console.error("❌ Erro ao atualizar sent_messages:", sentMessagesResult.error);
    }

    // =========================
    // 8) Finalização UI
    // =========================
    setToastMessage("Informacoes atualizadas com sucesso!");
    setShowToast(true);

    setSelectedDepartment("");
    setSelectedSector("");
    setSelectedTags([]);

    // Atualiza listas na UI (mantém sua estrutura)
    fetchContacts();
    fetchMessages();
  } catch (error: any) {
    console.error("Erro ao atualizar informações:", error);
    setToastMessage(`Erro: ${error?.message || "Não foi possível atualizar as informações"}`);
    setShowToast(true);
  }
};


  const handleTransferir = async () => {
    if (!selectedContact || !company?.api_key) {
      setToastMessage('❌ Erro: Contato ou empresa não identificados');
      setShowToast(true);
      return;
    }

    // ✅ agora departamentoTransferencia precisa ser UUID
    if (!departamentoTransferencia) {
      setToastMessage('⚠️ Selecione um departamento de destino');
      setShowToast(true);
      return;
    }

    // Pode acontecer de o state estar desatualizado. Fazemos fallback no banco.
    let currentContact: any = contactsDB.find(
      (c) => normalizeDbPhone(c.phone_number) === normalizeDbPhone(selectedContact)
    );

    if (!currentContact?.id && company?.id) {
      console.warn('⚠️ Contato não encontrado no state, buscando no banco...', selectedContact);
      const { data, error: fetchContactErr } = await supabase
        .from('contacts')
        .select('id, company_id, phone_number, name, department_id')
        .eq('company_id', company.id)
        .eq('phone_number', normalizeDbPhone(selectedContact))
        .maybeSingle();

      if (fetchContactErr) {
        console.error('❌ Erro ao buscar contato no banco:', fetchContactErr);
      }

      if (data) currentContact = data;
    }

    if (!currentContact?.id) {
      setToastMessage('❌ Erro: Contato não encontrado');
      setShowToast(true);
      return;
    }

    const deptDestino = departments.find(d => d.id === departamentoTransferencia);
    if (!deptDestino?.id) {
      setToastMessage('❌ Erro: Departamento destino inválido');
      setShowToast(true);
      return;
    }

    // ✅ evita transferir para o mesmo dept atual
    const oldDeptId = currentContact.department_id || null;
    if (oldDeptId === deptDestino.id) {
      setToastMessage('⚠️ Selecione um departamento diferente do atual');
      setShowToast(true);
      return;
    }

    setTransferindo(true);

    try {
      // 1) Atualizar contact + 2) inserir histórico de transferência
      // Preferência: RPC (1 chamada). Fallback: update+insert.
      let transferOk = false;

      // Tentativa 1: RPC
      try {
        const { error: rpcErr } = await supabase.rpc('transfer_contact_department', {
          p_company_id: company.id,
          p_contact_id: currentContact.id,
          p_to_department_id: deptDestino.id,
        });

        if (rpcErr) {
          console.warn('⚠️ RPC transfer_contact_department falhou, usando fallback...', rpcErr);
        } else {
          transferOk = true;
        }
      } catch (rpcCatch) {
        console.warn('⚠️ Exceção ao chamar RPC, usando fallback...', rpcCatch);
      }

      // Tentativa 2: Fallback (update contacts + insert transferencias)
      if (!transferOk) {
        const updateData: any = { department_id: deptDestino.id };

        // Se um setor foi selecionado, incluir na atualização
        if (setorTransferencia) {
          updateData.sector_id = setorTransferencia;
        } else {
          // Se não selecionou setor, limpar o setor existente
          updateData.sector_id = null;
        }

        const { error: updErr } = await supabase
          .from('contacts')
          .update(updateData)
          .eq('id', currentContact.id)
          .eq('company_id', company.id);

        if (updErr) throw updErr;

        const { error: insErr } = await supabase.from('transferencias').insert([
          {
            company_id: company.id,
            api_key: company.api_key,
            contact_id: currentContact.id,
            from_department_id: oldDeptId,
            to_department_id: deptDestino.id,
          },
        ]);

        if (insErr) throw insErr;
        transferOk = true;
      }

      if (transferOk) {
        setShowTransferModal(false);
        setDepartamentoTransferencia('');
        setSetorTransferencia('');

        setTimeout(() => {
          setToastMessage(`✅ Contato transferido para ${deptDestino.name}`);
          setShowToast(true);
        }, 100);

        // Mensagem 100% UI (não gravar em messages)
        const oldDeptName = departments.find((d: any) => d.id === oldDeptId)?.name || 'Desconhecido';
        const transferText = `Chamado transferido de ${oldDeptName} para ${deptDestino.name}`;
        addInlineSystemMessage(transferText, 'system_transfer');

        fetchMessages();
        fetchContacts();
      } else {
        setToastMessage(`❌ Erro: Erro desconhecido`);
        setShowToast(true);
      }
    } catch (error: any) {
      console.error('[TRANSFERÊNCIA] Erro:', error);
      setToastMessage(`❌ Erro ao transferir: ${error?.message || 'Erro desconhecido'}`);
      setShowToast(true);
    } finally {
      setTransferindo(false);
    }
  };

  const handleUpdateTags = async () => {
    if (!selectedContact || !company?.id) return;

    try {
      const currentContact = contactsDB.find(
        (c) => normalizeDbPhone(c.phone_number) === normalizeDbPhone(selectedContact)
      );

      if (!currentContact?.id) {
        setToastMessage('Erro: Contato não encontrado');
        setShowToast(true);
        return;
      }

      const { data: rpcData, error: rpcError } = await supabase.rpc('update_contact_tags', {
        p_contact_id: currentContact.id,
        p_tag_ids: selectedTags,
      });

      if (rpcError) throw rpcError;

      if (rpcData && !rpcData.success) {
        throw new Error(rpcData.error || 'Erro desconhecido');
      }

      setShowTagModal(false);

      setTimeout(() => {
        setToastMessage('✅ Tags atualizadas com sucesso!');
        setShowToast(true);
      }, 100);

      setContactsDB(prev => prev.map(c =>
        c.id === currentContact.id
          ? { ...c, tag_ids: selectedTags }
          : c
      ));

      fetchContacts();
    } catch (error: any) {
      console.error('Erro ao atualizar tags:', error);
      setToastMessage('Erro ao atualizar tags');
      setShowToast(true);
    }
  };

  const handleCloseTicket = async () => {
    if (!selectedContact || !company?.id) return;

    try {
      const currentContact = contactsDB.find(
        (c) => normalizeDbPhone(c.phone_number) === normalizeDbPhone(selectedContact)
      );

      if (!currentContact?.id) {
        setToastMessage('❌ Erro: Contato não encontrado');
        setShowToast(true);
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();

      const { error: updateError } = await supabase
        .from('contacts')
        .update({
          ticket_status: 'finalizado',
          ticket_closed_at: new Date().toISOString(),
          ticket_closed_by: user?.id || null
        })
        .eq('id', currentContact.id)
        .eq('company_id', company.id);

      if (updateError) throw updateError;

      setToastMessage('✅ Atendimento finalizado com sucesso!');
      setShowToast(true);

      setContactsDB(prev => prev.map(c =>
        c.id === currentContact.id
          ? {
              ...c,
              ticket_status: 'finalizado',
              ticket_closed_at: new Date().toISOString(),
              ticket_closed_by: user?.id || null
            }
          : c
      ));

      fetchContacts();
    } catch (error: any) {
      console.error('Erro ao finalizar atendimento:', error);
      setToastMessage('❌ Erro ao finalizar atendimento');
      setShowToast(true);
    }
  };

  const handleReopenTicket = async () => {
    if (!selectedContact || !company?.id) return;

    try {
      const currentContact = contactsDB.find(
        (c) => normalizeDbPhone(c.phone_number) === normalizeDbPhone(selectedContact)
      );

      if (!currentContact?.id) {
        setToastMessage('❌ Erro: Contato não encontrado');
        setShowToast(true);
        return;
      }

      const { error: updateError } = await supabase
        .from('contacts')
        .update({
          ticket_status: 'aberto',
          ticket_closed_at: null,
          ticket_closed_by: null
        })
        .eq('id', currentContact.id)
        .eq('company_id', company.id);

      if (updateError) throw updateError;

      setToastMessage('✅ Chamado reaberto com sucesso!');
      setShowToast(true);

      setContactsDB(prev => prev.map(c =>
        c.id === currentContact.id
          ? {
              ...c,
              ticket_status: 'aberto',
              ticket_closed_at: null,
              ticket_closed_by: null
            }
          : c
      ));

      fetchContacts();
    } catch (error: any) {
      console.error('Erro ao reabrir chamado:', error);
      setToastMessage('❌ Erro ao reabrir chamado');
      setShowToast(true);
    }
  };

  const handleOpenChatFromHistory = (phoneNumber: string) => {
    setActiveTab('mensagens');
    setSelectedContact(phoneNumber);
  };

  useEffect(() => {
    fetchMessages();
    fetchContacts();

    Promise.all([
      fetchDepartments(),
      fetchSectors(),
      fetchTags()
    ]);

    fetchNotifications();
    checkPaymentNotifications();

    if (!company?.api_key) return;

    const channel = supabase
      .channel('messages-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
          filter: `apikey_instancia=eq.${company.api_key}`,
        },
        () => {
          fetchMessages();
          fetchContacts();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'sent_messages',
          filter: `apikey_instancia=eq.${company.api_key}`,
        },
        () => {
          fetchMessages();
          fetchContacts();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'contacts',
          filter: `company_id=eq.${company.id}`,
        },
        () => {
          fetchContacts();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `company_id=eq.${company.id}`,
        },
        () => {
          fetchNotifications();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [company?.api_key, fetchMessages]);

  // Hook para monitorar mudanças em tempo real nas mensagens
  // Hook para monitorar mudanças em tempo real nas mensagens
  const handleRealtimeMessage = useCallback((message: Message) => {
    setMessages((prevMessages) => {
      const messageExists = prevMessages.some(m => m.id === message.id || m.idmessage === message.idmessage);
      if (messageExists) {
        return prevMessages.map(m => m.id === message.id ? message : m);
      }
      return [...prevMessages, message].sort((a, b) => getMessageTimestamp(a) - getMessageTimestamp(b));
    });
  }, []);

  const handleNewMessage = useCallback((message: Message, type: 'received' | 'sent') => {
    console.log(`📨 Nova mensagem ${type}:`, message);
    if (isUserScrollingRef.current) {
      setPendingMessagesCount(prev => prev + 1);
    } else {
      scrollToBottom();
    }
  }, []);

  useRealtimeMessages({
    apiKey: company?.api_key,
    enabled: true,
    onMessagesChange: handleRealtimeMessage,
    onNewMessage: handleNewMessage,
  });

  // Hook para monitorar mudanças em tempo real nos contatos
  useRealtimeContacts({
    companyId: company?.id,
    enabled: activeTab === 'mensagens' || activeTab === 'contatos',
    onContactsChange: (contact: any, type: 'INSERT' | 'UPDATE' | 'DELETE') => {
      console.log(`👥 Contato ${type}:`, contact);
      setContactsDB((prevContacts) => {
        const contactExists = prevContacts.some(c => c.id === contact.id);
        if (type === 'DELETE') {
          return prevContacts.filter(c => c.id !== contact.id);
        }
        if (contactExists) {
          return prevContacts.map(c => c.id === contact.id ? { ...c, ...contact } : c);
        }
        return [...prevContacts, contact];
      });
      // Atualizar allContactsList se estamos na aba contatos
      if (activeTab === 'contatos') {
        setAllContactsList(prevList => {
          const contactExists = prevList.some(c => c.id === contact.id);
          if (type === 'DELETE') {
            return prevList.filter(c => c.id !== contact.id);
          }
          if (contactExists) {
            return prevList.map(c => c.id === contact.id ? { ...c, ...contact } : c);
          }
          return [...prevList, contact];
        });
      }
    },
    onContactTagsChange: () => {
      console.log('🏷️ Tags alteradas, recarregando contatos...');
      fetchContacts();
    }
  });
  useRealtimeDepartments({
    companyId: company?.id,
    onDepartmentsChange: () => {
      fetchDepartments();
    }
  });

  useRealtimeSectors({
    companyId: company?.id,
    onSectorsChange: () => {
      fetchSectors();
    }
  });

  // Detecta transferências em tempo real e mostra um aviso no meio do chat
  useEffect(() => {
    if (!company?.id) return;

    const channel = supabase
      .channel(`rt-transferencias-${company.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "transferencias", filter: `company_id=eq.${company.id}` },
        (payload: any) => {
          const row = payload?.new || {};
          const contactId = row.contact_id || row.contactId || row.contato_id;
          if (!contactId || !selectedContact) return;

          const currentContact = contactsDB.find(
            (c: any) => normalizeDbPhone(c.phone_number) === normalizeDbPhone(selectedContact)
          );
          if (!currentContact?.id || currentContact.id !== contactId) return;

          const fromId = row.from_department_id || row.departamento_origem_id || row.fromDepartmentId;
          const toId = row.to_department_id || row.departamento_destino_id || row.toDepartmentId;

          const fromName = departments.find((d: any) => d.id === fromId)?.name || "Desconhecido";
          const toName = departments.find((d: any) => d.id === toId)?.name || "Desconhecido";

          addInlineSystemMessage(`Chamado transferido de ${fromName} para ${toName}`, "system_transfer");
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [company?.id, selectedContact, contactsDB, departments, addInlineSystemMessage]);



  // Polling automático como fallback - verifica a cada 3 segundos
  useEffect(() => {
    if (activeTab !== 'mensagens' || !company?.api_key) return;

    console.log('⏱️ Iniciando polling de mensagens a cada 3 segundos');

    const pollingInterval = setInterval(() => {
      console.log('🔄 Verificando novas mensagens...');
      fetchMessages();
      fetchContacts();
    }, 3000); // 3 segundos

    return () => {
      clearInterval(pollingInterval);
      console.log('⏹️ Parando polling de mensagens');
    };
  }, [activeTab, company?.api_key, fetchMessages]);

  const startConversationFromContact = async (wc: { name: string; phone: string }) => {
    if (!company?.id || !wc.phone) return;
    try {
      const target = encodeURIComponent('https://n8n.nexladesenvolvimento.com.br/webhook/iniciarconversa');
      const proxyUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/webhook-proxy?url=${target}`;
      await fetch(proxyUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          numero: wc.phone,
          name: wc.name || '',
          api_key: company.api_key,
        }),
      });
    } catch (err) {
      console.error('[iniciar-conversa] erro ao chamar webhook:', err);
    }

    try {
      await supabase.from('contacts').upsert(
        {
          company_id: company.id,
          phone_number: wc.phone,
          name: wc.name || null,
          last_message_time: new Date().toISOString(),
        },
        { onConflict: 'company_id,phone_number', ignoreDuplicates: false }
      );
    } catch (err) {
      console.error('[iniciar-conversa] erro ao upsert contato:', err);
    }

    setShowWebhookContactsModal(false);
    setWebhookContactsSearch('');
    setPendingNewContact({ name: wc.name, phone: wc.phone });
    setSelectedContact(wc.phone);
    if (window.innerWidth < 768) setSidebarOpen(false);
    fetchContacts();
  };

  const addContact = async () => {
    if (!company?.id) return;

    const name = newContactName.trim();
    const phoneRaw = newContactPhone.trim();
    let phone = phoneRaw.replace(/\D/g, ''); // Remove formatação, deixa só dígitos

    if (!name) {
      alert('❌ Digite o nome do contato!');
      return;
    }

    if (!phone || phone.length < 10) {
      alert('❌ Digite um número de telefone válido (mínimo 10 dígitos)!');
      return;
    }

    // Remover o 9 a mais após o DDD se o número tiver 11 dígitos
    if (phone.length === 11) {
      // Padrão brasileiro: DDD (2 dígitos) + 9 + 8 dígitos = 11 total
      // Remover o 9 após o DDD
      phone = phone.substring(0, 2) + phone.substring(3);
    }

    setAddingContact(true);
    try {
      await supabase.from('contacts').upsert(
        {
          company_id: company.id,
          phone_number: phone,
          name: name,
          last_message_time: new Date().toISOString(),
        },
        { onConflict: 'company_id,phone_number', ignoreDuplicates: false }
      );

      // Adicionar o novo contato à lista de contatos se ele não existir
      const newContact = {
        id: `${company.id}_${phone}`,
        name: name,
        phone_number: phone,
        last_message_time: new Date().toISOString(),
        ticket_status: 'aberto'
      };
      
      setAllContactsList(prev => {
        const exists = prev.some(c => c.phone_number === phone);
        if (exists) {
          return prev;
        }
        return [newContact, ...prev];
      });

      setShowAddContactModal(false);
      setNewContactName('');
      setNewContactPhone('');
      setPendingNewContact({ name, phone });
      setSelectedContact(phone);
      setActiveTab('contatos');
      if (window.innerWidth < 768) setSidebarOpen(false);
      fetchContacts();
      alert('✅ Contato adicionado com sucesso!');
    } catch (err) {
      console.error('Erro ao adicionar contato:', err);
      alert('❌ Erro ao adicionar contato. Tente novamente.');
    } finally {
      setAddingContact(false);
    }
  };

  const loadAllContactsFromDB = async () => {
    if (!company?.id) return;
    setAllContactsList([]);
    setAllContactsSearch('');
    setLoadingAllContacts(true);

    try {
      const { data: contactsData, error } = await supabase
        .from('contacts')
        .select('id, name, phone_number, last_message_time, ticket_status')
        .eq('company_id', company.id)
        .order('last_message_time', { ascending: false });

      if (error) throw error;

      console.log('📋 Contatos carregados da empresa:', company.id, contactsData?.length || 0);
      setAllContactsList(contactsData || []);
    } catch (err) {
      console.error('Erro ao carregar contatos:', err);
      alert('❌ Erro ao carregar contatos do banco de dados');
    } finally {
      setLoadingAllContacts(false);
    }
  };

  const fetchWebhookContacts = async () => {
    setShowWebhookContactsModal(true);
    if (webhookContacts.length > 0) return;
    setLoadingWebhookContacts(true);
    try {
      const target = encodeURIComponent('https://n8n.nexladesenvolvimento.com.br/webhook/buscacontato');
      const proxyUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/webhook-proxy?url=${target}`;
      const response = await fetch(proxyUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ api_key: company?.api_key }),
      });
      if (!response.ok) {
        console.error('Webhook respondeu com erro:', response.status, response.statusText);
        return;
      }
      const text = await response.text();
      console.log('[webhook-contatos] resposta bruta:', text.slice(0, 500));
      let data: any;
      try {
        data = JSON.parse(text);
      } catch {
        console.error('[webhook-contatos] JSON inválido');
        return;
      }

      const extractArray = (d: any): any[] => {
        if (Array.isArray(d)) return d;
        if (d && typeof d === 'object') {
          const values = Object.values(d);
          if (values.length > 0 && values.every((v) => v && typeof v === 'object' && !Array.isArray(v))) {
            return values as any[];
          }
          for (const val of values) {
            if (Array.isArray(val)) return val;
          }
        }
        return [];
      };

      const raw = extractArray(data);
      console.log('[webhook-contatos] total itens brutos:', raw.length, '| primeiro:', raw[0]);

      const list = raw
        .map((c: any) => {
          const phone = String(
            c.numero || c.remoteJid || c.phone || c.telefone || c.number || c.whatsapp || ''
          ).replace(/\D/g, '');
          const name = String(
            c.nome || c.Name || c.name || c.pushName || c.pushname || ''
          ).trim();
          return { name, phone };
        })
        .filter((c) => c.phone && c.phone.length >= 8);

      console.log('[webhook-contatos] lista processada:', list.length);
      setWebhookContactsSearch('');
      setWebhookContacts(list);
    } catch (err) {
      console.error('Erro ao chamar webhook de contatos:', err);
    } finally {
      setLoadingWebhookContacts(false);
    }
  };

  const formatTime = (msgOrTimestamp: any) => {

    if (!msgOrTimestamp) return '';
    try {
      let timestamp: number;

      if (typeof msgOrTimestamp === 'string' || typeof msgOrTimestamp === 'number') {
        timestamp = typeof msgOrTimestamp === 'number' ? msgOrTimestamp : new Date(msgOrTimestamp).getTime();
      } else {
        timestamp = getMessageTimestamp(msgOrTimestamp);
      }

      if (!timestamp || timestamp === 0) return '';
      const date = new Date(timestamp);
      return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  const formatDate = (msgOrTimestamp: any) => {
    if (!msgOrTimestamp) return '';
    try {
      let timestamp: number;

      if (typeof msgOrTimestamp === 'string' || typeof msgOrTimestamp === 'number') {
        timestamp = typeof msgOrTimestamp === 'number' ? msgOrTimestamp : new Date(msgOrTimestamp).getTime();
      } else {
        timestamp = getMessageTimestamp(msgOrTimestamp);
      }

      if (!timestamp || timestamp === 0) return '';

      const date = new Date(timestamp);
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      if (date.toDateString() === today.toDateString()) {
        return 'Hoje';
      } else if (date.toDateString() === yesterday.toDateString()) {
        return 'Ontem';
      } else {
        return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
      }
    } catch {
      return '';
    }
  };

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

  const filteredContacts = contacts.filter((contact) => {
    const searchLower = searchTerm.toLowerCase();
    const displayPhone = getPhoneNumber(contact.phoneNumber);

    const matchesSearch =
      contact.name.toLowerCase().includes(searchLower) ||
      displayPhone.toLowerCase().includes(searchLower) ||
      contact.phoneNumber.toLowerCase().includes(searchLower);

    if (!matchesSearch) return false;

    const contactDB = contactsDB.find(c => normalizeDbPhone(c.phone_number) === normalizeDbPhone(contact.phoneNumber));

    if (contactFilter === 'departamento') {
      if (!receptionDeptId) return true;
      return contactDB?.department_id === receptionDeptId;
    }

    if (contactFilter === 'abertos') {
      return contactDB?.ticket_status === 'aberto' || contactDB?.ticket_status === 'em_processo' || !contactDB?.ticket_status;
    }

    return true;
  });

  const selectedContactData = selectedContact
    ? contacts.find((c) => c.phoneNumber === selectedContact)
    : null;

  // Adicionar dados do banco ao selectedContactData
  const selectedContactDataWithDB = selectedContactData && contactsDB
    ? {
        ...selectedContactData,
        ticket_status: contactsDB.find(c => normalizeDbPhone(c.phone_number) === normalizeDbPhone(selectedContact))?.ticket_status,
        department_id: contactsDB.find(c => normalizeDbPhone(c.phone_number) === normalizeDbPhone(selectedContact))?.department_id,
        sector_id: contactsDB.find(c => normalizeDbPhone(c.phone_number) === normalizeDbPhone(selectedContact))?.sector_id,
        tag_ids: contactsDB.find(c => normalizeDbPhone(c.phone_number) === normalizeDbPhone(selectedContact))?.tag_ids,
      }
    : selectedContactData;

  const isContactOnline = (() => {
    if (!selectedContactDataWithDB) return false;
    const lastMsg = selectedContactDataWithDB.messages?.slice(-1)[0];
    if (!lastMsg || !lastMsg.created_at) return false;
    const lastTs = new Date(lastMsg.created_at).getTime();
    return (Date.now() - lastTs) < 5 * 60 * 1000;
  })();

  useEffect(() => {
    if (!selectedContact && contacts.length > 0) {
      setSelectedContact(contacts[0].phoneNumber);
    }
  }, [contacts.length, selectedContact]);

  useEffect(() => {
    if (selectedContact) {
      scrollToBottom(false);
      // Resetar o flag de scroll quando muda de contato
      isUserScrollingRef.current = false;
      // Marcar todas as mensagens como vistas
      if (selectedContactDataWithDB?.messages) {
        const lastMsgTime = selectedContactDataWithDB.messages.reduce((max, msg) => {
          return Math.max(max, getMessageTimestamp(msg));
        }, 0);
        setLastViewedMessageTime(prev => ({
          ...prev,
          [selectedContact]: lastMsgTime
        }));
      }
    }
  }, [selectedContact]);

  // Fechar menu de contexto ao clicar fora
  useEffect(() => {
    if (contextMenu) {
      const handleClick = () => closeContextMenu();
      document.addEventListener('click', handleClick);
      return () => document.removeEventListener('click', handleClick);
    }
  }, [contextMenu]);

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
    if (!company || !selectedContact) return;

    setSending(true);

    const generatedIdMessage = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const attendantName = company.name;
    const rawMessage = messageData.message || '';
    const rawCaption = messageData.caption || null;

    // ── 1. Buscar instancia/dept/setor do histórico (usa cache local se disponível)
    const existingMsg = messages
      .filter(m => m.numero === selectedContact || m.sender === selectedContact)
      .sort((a, b) => new Date(b.date_time || 0).getTime() - new Date(a.date_time || 0).getTime())[0];

    const instanciaValue = existingMsg?.instancia || company.name;
    const departmentId = existingMsg?.department_id || null;
    const sectorId = existingMsg?.sector_id || null;
    const tagId = existingMsg?.tag_id || null;

    const { phone_number: _ph, ...messageDataClean } = messageData as Message & { phone_number?: string };
    const newMessage = {
      numero: selectedContact,
      sender: null,
      'minha?': 'true',
      pushname: attendantName,
      apikey_instancia: company.api_key,
      date_time: new Date().toISOString(),
      instancia: instanciaValue,
      idmessage: generatedIdMessage,
      company_id: company.id,
      department_id: departmentId,
      sector_id: sectorId,
      tag_id: tagId,
      ...messageDataClean,
      message: rawMessage,
      caption: rawCaption,
    };

    // ── 2. Atualiza UI imediatamente (sem esperar Supabase/n8n)
    setMessages(prev => [...prev, newMessage as Message]);
    setMessageText('');
    setImageCaption('');
    setSelectedFile(null);
    setFilePreview(null);
    setTimeout(scrollToBottom, 100);
    setSending(false);

    // ── 3. Persiste no Supabase em background (não bloqueia UI)
    supabase.from('sent_messages').insert([newMessage]).then(({ error: insertErr }) => {
      if (insertErr) console.error('Erro ao salvar sent_messages:', insertErr);
    });

    // ── 4. Dispara webhook n8n em background (não bloqueia UI)
    const deptName = departments.find(d => d.id === departmentId)?.name || 'Recepção';
    const sectorName = sectors.find(s => s.id === sectorId)?.name || 'Recepção';

    const webhookPayload = {
      numero: selectedContact,
      message: rawMessage,
      tipomessage: messageData.tipomessage || 'conversation',
      base64: messageData.base64 || null,
      urlimagem: messageData.urlimagem || null,
      urlpdf: messageData.urlpdf || null,
      caption: rawCaption,
      idmessage: generatedIdMessage,
      pushname: company.name,
      department_name: deptName,
      sector_name: sectorName,
      timestamp: new Date().toISOString(),
      instancia: instanciaValue,
      apikey_instancia: company.api_key,
    };

    // Usa webhook_envio cadastrado para esta empresa (disponível no contexto)
    const webhookUrl = company?.webhook_envio;
    if (webhookUrl) {
      const webhookController = new AbortController();
      const webhookTimeout = setTimeout(() => webhookController.abort(), 10000);
      fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(webhookPayload),
        signal: webhookController.signal,
      })
        .then(res => {
          clearTimeout(webhookTimeout);
          if (!res.ok) console.error('Erro ao enviar para webhook:', res.status);
          else console.log('✅ Webhook enviado com sucesso');
        })
        .catch((webhookError: any) => {
          clearTimeout(webhookTimeout);
          if (webhookError?.name === 'AbortError') {
            console.warn('⚠️ Webhook timeout (10s)');
          } else {
            console.error('Erro ao chamar webhook:', webhookError);
          }
        });
    }
  };

  const handleContextMenu = (e: React.MouseEvent, phoneNumber: string) => {
    e.preventDefault();

    const menuWidth = 200;
    const menuHeight = 180;
    const padding = 10;

    let x = e.clientX;
    let y = e.clientY;

    if (x + menuWidth > window.innerWidth - padding) {
      x = window.innerWidth - menuWidth - padding;
    }

    if (y + menuHeight > window.innerHeight - padding) {
      y = window.innerHeight - menuHeight - padding;
    }

    if (x < padding) {
      x = padding;
    }

    if (y < padding) {
      y = padding;
    }

    setContextMenu({ x, y, phoneNumber });
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
        setSelectedTags(contactDB.tag_ids || []);
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

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result as string;
        resolve(base64.split(',')[1]);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // ===== FUNÇÕES DE EDIÇÃO E DELEÇÃO DE CONTATOS =====
  
  const handleEditContact = (contact: any) => {
    const cleanPhone = (contact.phone_number || '')
      .replace('@s.whatsapp.net', '')
      .replace('@g.us', '');
    
    setEditingContactId(contact.id);
    setEditingName(contact.name);
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
      alert('O nome não pode estar em branco.');
      return;
    }

    try {
      const { error } = await supabase
        .from('contacts')
        .update({
          name: editingName.trim(),
          phone_number: editingPhone.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', editingContactId);

      if (error) {
        console.error('Erro ao atualizar contato:', error);
        alert('Ocorreu um erro ao atualizar o contato.');
        return;
      }

      // Atualizar a lista de contatos
      setAllContactsList(prev => 
        prev.map(c => c.id === editingContactId 
          ? { ...c, name: editingName.trim(), phone_number: editingPhone.trim() }
          : c
        )
      );

      // Atualizar contactsDB (para aba de mensagens)
      setContactsDB(prev =>
        prev.map(c => c.id === editingContactId
          ? { ...c, name: editingName.trim(), phone_number: editingPhone.trim() }
          : c
        )
      );

      handleCloseEditModal();
    } catch (err) {
      console.error('Erro ao salvar contato:', err);
      alert('Ocorreu um erro inesperado. Tente novamente.');
    }
  };

  const handleOpenDeleteModal = (contact: any) => {
    setDeleteModal({ isOpen: true, contact });
  };

  const handleCloseDeleteModal = () => {
    setDeleteModal({ isOpen: false, contact: null });
  };

  const handleDeleteContact = async () => {
    if (!deleteModal.contact) return;

    setIsDeletingContact(true);
    try {
      const contactId = deleteModal.contact.id;

      // Use the database function to delete contact and all associated messages
      const { data: rpcData, error: rpcError } = await supabase.rpc('delete_contact_and_messages', {
        p_contact_id: contactId,
      });

      if (rpcError) throw rpcError;

      const result = rpcData as { success: boolean; message?: string } | null;
      if (result && !result.success) {
        throw new Error(result.message || 'Falha ao apagar o contato');
      }

      // Atualizar lista de contatos
      setAllContactsList(prev => prev.filter(c => c.id !== contactId));

      // Atualizar contactsDB (para aba de mensagens)
      setContactsDB(prev => prev.filter(c => c.id !== contactId));

      // Limpar seleção se era esse contato
      if (selectedContact) {
        const still = contactsDB.find(c => normalizePhone(c.phone_number) === normalizePhone(selectedContact));
        if (!still) {
          setSelectedContact(null);
          setPendingNewContact(null);
        }
      }

      handleCloseDeleteModal();
      setToastMessage('Contato deletado com sucesso!');
      setShowToast(true);

      // Notify other components/pages
      try {
        window.dispatchEvent(new CustomEvent('contactDeleted', { detail: contactId }));
      } catch (e) {
        // ignore
      }
    } catch (err: any) {
      console.error('Erro:', err);
      alert(`Erro ao deletar contato: ${err?.message || 'Erro desconhecido'}`);
    } finally {
      setIsDeletingContact(false);
    }
  };

  const handleSendMessage = async () => {
    if (sending) return;
    if (!messageText.trim() && !selectedFile) return;

    setSending(true);
    try {
      if (selectedFile) {
        const base64 = await fileToBase64(selectedFile);
        const isImage = selectedFile.type.startsWith('image/');
        const isAudio = selectedFile.type.startsWith('audio/');

        const messageData: Partial<Message> = {
          tipomessage: isImage ? 'imageMessage' : isAudio ? 'audioMessage' : 'documentMessage',
          mimetype: selectedFile.type,
          base64: base64,
        };

        if (isImage) {
          messageData.message = messageText.trim() || 'Imagem';
          if (imageCaption) {
            messageData.caption = imageCaption;
          }
        } else if (isAudio) {
          messageData.message = messageText.trim() || 'Áudio';
        } else {
          messageData.message = messageText.trim() || selectedFile.name;
        }

        await sendMessage(messageData);
        setSelectedFile(null);
        setFilePreview(null);
        setImageCaption('');
      } else {
        await sendMessage({
          message: messageText.trim(),
          tipomessage: 'conversation',
        });
      }
    } catch (err) {
      console.error('Erro ao enviar:', err);
      alert('Erro ao enviar mensagem');
    } finally {
      setSending(false);
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onload = () => {
        setFilePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
    e.target.value = '';
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setFilePreview(null);
    }
    e.target.value = '';
  };

  const clearSelectedFile = () => {
    setSelectedFile(null);
    setFilePreview(null);
    setImageCaption('');
  };


  if (loading && !error) {
    return (
      <div className="h-screen flex flex-col bg-gradient-to-br from-slate-50 to-gray-100">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="w-10 h-10 text-blue-500 animate-spin mx-auto mb-3" />
            <p className="text-gray-600 font-medium">Carregando mensagens...</p>
          </div>
        </div>
      </div>
    );
  }

  const groupMessagesByDate = (msgs: Message[]) => {
    const groups: { [key: string]: Message[] } = {};
    msgs.forEach((msg) => {
      const date = formatDate(msg);
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(msg);
    });
    return groups;
  };

  const currentMessages = selectedContactData?.messages || [];
  const messageGroups = groupMessagesByDate(currentMessages);

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50 overflow-hidden pt-14">
      {showToast && (
        <Toast
          message={toastMessage}
          onClose={() => setShowToast(false)}
          duration={2500}
        />
      )}

      {/* Modal de adicionar contato - Global */}
      {showAddContactModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowAddContactModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Adicionar Contato</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Digite o nome e telefone do contato
                </p>
              </div>
              <button onClick={() => setShowAddContactModal(false)} className="w-8 h-8 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Nome do Contato *
                </label>
                <input
                  type="text"
                  value={newContactName}
                  onChange={(e) => setNewContactName(e.target.value)}
                  placeholder="Ex: João Silva"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-green-400 focus:ring-2 focus:ring-green-100 transition-all"
                  disabled={addingContact}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Número do Telefone *
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={newContactPhone}
                  onChange={(e) => {
                    // Aceitar apenas números
                    const value = e.target.value.replace(/\D/g, '');
                    setNewContactPhone(value);
                  }}
                  placeholder="Ex: 6999999999"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-green-400 focus:ring-2 focus:ring-green-100 transition-all font-mono"
                  disabled={addingContact}
                />
                <p className="text-xs text-slate-500 mt-1">
                  Digite apenas números (DDD + telefone). Se digitar 11 dígitos, remove o 9 automaticamente
                </p>
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
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Adicionando...
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      Adicionar
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ProfileDropdown
        userName={settings.companyName || company?.name || 'Empresa'}
        onHistoryClick={() => setActiveTab('historico')}
        onSettingsClick={() => setActiveTab('configuracoes')}
        onLogout={signOut}
        showNavigationOptions={true}
        onMessagesClick={() => setActiveTab('mensagens')}
        onContactsClick={() => setActiveTab('contatos')}
        onDepartmentsClick={() => setActiveTab('departamentos')}
        onSectorsClick={() => setActiveTab('setores')}
        onAttendantsClick={() => setActiveTab('atendentes')}
        onTagsClick={() => setActiveTab('tags')}
        onMyPlanClick={() => setActiveTab('meu-plano')}
        onAgentClick={() => setActiveTab('agente')}
        activeTab={activeTab}
        isOpen={menuOpen}
        onToggle={() => setMenuOpen(!menuOpen)}
        notifications={notifications}
        unreadNotificationsCount={unreadNotificationsCount}
        onMarkNotificationRead={markNotificationAsRead}
        onMarkAllNotificationsRead={markAllNotificationsAsRead}
        showNotificationsPanel={showNotifications}
        onToggleNotificationsPanel={() => setShowNotifications(!showNotifications)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar - Contacts List (Apenas para aba mensagens) */}
        {activeTab === 'mensagens' && (
          <div
            className={`${sidebarOpen ? 'flex' : 'hidden'
              } md:flex w-full md:w-[300px] bg-[#1a1f2e] border-r border-[#252b3b] flex-col`}
          >

            {error && (
              <div className="bg-red-50/80 backdrop-blur-sm border-b border-red-200/50 px-5 py-3 flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                <p className="text-red-700 text-sm flex-1">{error}</p>
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
                      <Briefcase className="w-5 h-5 text-white" />
                    </div>
                  )}
                  {settings.companyName && (
                    <div className="flex-1 min-w-0">
                      <h2 className="text-sm font-bold text-slate-900 truncate">
                        {settings.companyName}
                      </h2>
                      <p className="text-xs text-slate-600">
                        Identidade da Empresa
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

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
                  Todos
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
                  className={`flex-1 py-1.5 rounded-md text-xs font-semibold transition-all ${
                    contactFilter === 'departamento'
                      ? 'bg-[#313a4f] text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Depto.
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto bg-[#1a1f2e]">
              {filteredContacts.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full p-8">
                  <div className="w-16 h-16 bg-[#252b3b] rounded-2xl flex items-center justify-center mb-4">
                    <MessageSquare className="w-8 h-8 text-slate-500" />
                  </div>
                  <p className="text-slate-400 text-sm text-center font-medium">
                    {searchTerm ? 'Nenhum contato encontrado' : 'Nenhuma conversa ainda'}
                  </p>
                  <p className="text-slate-600 text-xs text-center mt-1">
                    {searchTerm ? 'Tente pesquisar outro termo' : 'Aguardando novas mensagens'}
                  </p>
                </div>
              ) : (
                <div className="px-2 py-2 space-y-0.5">
                  {filteredContacts.map((contact) => (
                    <div
                      key={contact.phoneNumber}
                      onClick={() => {
                        setSelectedContact(contact.phoneNumber);
                        if (window.innerWidth < 768) {
                          setSidebarOpen(false);
                        }
                      }}
                      onContextMenu={(e) => handleContextMenu(e, contact.phoneNumber)}
                      className={`group cursor-pointer px-3 py-3 rounded-xl transition-all duration-150 ${
                        selectedContact === contact.phoneNumber
                          ? 'bg-blue-600 shadow-lg shadow-blue-900/30'
                          : 'hover:bg-[#252b3b] border border-transparent'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-10 h-10 bg-gradient-to-br ${getAvatarColor(contact.name || contact.phoneNumber)} rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0 shadow-sm`}>
                          {contact.name ? contact.name[0].toUpperCase() : <User className="w-4 h-4" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-1.5 flex-1 min-w-0">
                              <h3 className={`font-semibold truncate text-sm ${selectedContact === contact.phoneNumber ? 'text-white' : 'text-slate-200'}`}>
                                {contact.name || getPhoneNumber(contact.phoneNumber)}
                              </h3>
                              {contactsDB.find(c => normalizeDbPhone(c.phone_number) === normalizeDbPhone(contact.phoneNumber))?.pinned && (
                                <Pin className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" fill="currentColor" />
                              )}
                            </div>
                            <div className="flex flex-col items-end gap-1 ml-2 flex-shrink-0">
                              <span className={`text-[10px] font-medium ${selectedContact === contact.phoneNumber ? 'text-blue-200' : 'text-slate-500'}`}>
                                {formatTime(contact.lastMessageTime)}
                              </span>
                              {(() => {
                                const contactDB = contactsDB.find(c => normalizeDbPhone(c.phone_number) === normalizeDbPhone(contact.phoneNumber));
                                const isOpen = contactDB?.ticket_status !== 'finalizado';
                                return (
                                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide ${
                                    selectedContact === contact.phoneNumber
                                      ? isOpen
                                        ? 'bg-white/20 text-white'
                                        : 'bg-white/10 text-blue-200'
                                      : isOpen
                                        ? 'bg-emerald-500/20 text-emerald-400'
                                        : 'bg-slate-700 text-slate-400'
                                  }`}>
                                    <span className={`w-1.5 h-1.5 rounded-full ${
                                      selectedContact === contact.phoneNumber
                                        ? 'bg-white/70'
                                        : isOpen ? 'bg-emerald-400' : 'bg-slate-500'
                                    }`} />
                                    {isOpen ? 'Aberto' : 'Fechado'}
                                  </span>
                                );
                              })()}
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
                  ))}
                </div>
              )}
            </div>

            {/* Botões buscar e adicionar contatos */}
            <div className="px-3 pb-3 pt-2 border-t border-[#252b3b] bg-[#1a1f2e] flex justify-center gap-3">
              <button
                onClick={fetchWebhookContacts}
                title="Buscar contatos"
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-all hover:scale-[1.02] active:scale-95"
              >
                {loadingWebhookContacts ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <User className="w-4 h-4" />
                )}
                Nova Conversa
              </button>
            </div>

            {/* Modal de contatos do webhook */}
            {showWebhookContactsModal && (
              <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowWebhookContactsModal(false)}>
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col" style={{ maxHeight: '80vh' }} onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                    <div>
                      <h3 className="text-lg font-bold text-slate-900">Contatos</h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {loadingWebhookContacts ? 'Carregando...' : `${webhookContacts.length} contato${webhookContacts.length !== 1 ? 's' : ''} encontrado${webhookContacts.length !== 1 ? 's' : ''}`}
                      </p>
                    </div>
                    <button onClick={() => setShowWebhookContactsModal(false)} className="w-8 h-8 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all">
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="px-4 py-3 border-b border-slate-100">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="text"
                        value={webhookContactsSearch}
                        onChange={(e) => setWebhookContactsSearch(e.target.value)}
                        placeholder="Buscar por nome ou telefone..."
                        className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all bg-slate-50"
                        autoFocus
                        disabled={loadingWebhookContacts}
                      />
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto">
                    {loadingWebhookContacts ? (
                      <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                        <Loader2 className="w-8 h-8 animate-spin mb-3 text-blue-500" />
                        <p className="text-sm font-medium">Buscando contatos...</p>
                      </div>
                    ) : (() => {
                      const filtered = webhookContactsSearch.trim()
                        ? webhookContacts.filter((wc) =>
                            (wc.name || '').toLowerCase().includes(webhookContactsSearch.toLowerCase()) ||
                            (wc.phone || '').includes(webhookContactsSearch)
                          )
                        : webhookContacts;

                      if (filtered.length === 0) {
                        return (
                          <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                            <User className="w-10 h-10 mb-3 opacity-40" />
                            <p className="text-sm font-medium">Nenhum contato encontrado</p>
                            <p className="text-xs mt-1">Tente outro termo de busca</p>
                          </div>
                        );
                      }

                      return filtered.map((wc, idx) => {
                        const initial = (wc.name || wc.phone || '?')[0].toUpperCase();
                        const color = getAvatarColor(wc.name || wc.phone || '');
                        return (
                          <div
                            key={idx}
                            onClick={() => startConversationFromContact(wc)}
                            className="flex items-center gap-3 px-4 py-3 hover:bg-blue-50 active:bg-blue-100 transition-colors border-b border-slate-50 last:border-0 cursor-pointer group"
                          >
                            <div className={`w-10 h-10 bg-gradient-to-br ${color} rounded-full flex items-center justify-center text-white font-semibold text-sm flex-shrink-0 shadow-sm`}>
                              {initial}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-slate-900 truncate group-hover:text-blue-700 transition-colors">{wc.name || <span className="text-slate-400 font-normal italic">Sem nome</span>}</p>
                              <p className="text-xs text-slate-500 mt-0.5 font-mono">{wc.phone}</p>
                            </div>
                            <span className="text-xs text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity font-medium flex-shrink-0">Iniciar</span>
                          </div>
                        );
                      });
                    })()}
                  </div>

                </div>
              </div>
            )}

            {/* Modal de adicionar contato */}


          </div>
        )}

        <div className={`flex-1 flex-col ${activeTab === 'mensagens' && sidebarOpen ? 'hidden md:flex' : 'flex'}`}>
          {activeTab === 'mensagens' && (selectedContactDataWithDB || (selectedContact && pendingNewContact)) ? (
            (() => {
              console.log('💬 Abrindo conversa:', {
                selectedContact,
                hasPending: !!pendingNewContact,
                pendingNewContact,
                hasData: !!selectedContactDataWithDB,
              });
              const effectiveName = selectedContactDataWithDB?.name || pendingNewContact?.name || '';
              const effectivePhone = selectedContactDataWithDB?.phoneNumber || pendingNewContact?.phone || selectedContact || '';
              return (
            <>
              <header className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setSidebarOpen(true)}
                    className="md:hidden p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-all"
                  >
                    <Menu className="w-5 h-5" />
                  </button>
                  <div className={`w-11 h-11 bg-gradient-to-br ${getAvatarColor(effectiveName || effectivePhone)} rounded-full flex items-center justify-center text-white font-bold text-base shadow-md`}>
                    {effectiveName ? effectiveName[0].toUpperCase() : <User className="w-5 h-5" />}
                  </div>
                  <div>
                    <h2 className="font-bold text-slate-900 text-[15px] leading-tight">
                      {effectiveName || getPhoneNumber(effectivePhone)}
                    </h2>
                    <p className="text-xs text-slate-500 font-mono mt-0.5 tracking-tight">
                      {getPhoneNumber(effectivePhone)}
                    </p>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                      {selectedContactDataWithDB?.department_id && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-600 text-white text-[11px] font-semibold rounded-full">
                          <Briefcase className="w-2.5 h-2.5" />
                          {departments.find(d => d.id === selectedContactDataWithDB?.department_id)?.name || 'Departamento'}
                        </span>
                      )}
                      {selectedContactDataWithDB?.sector_id && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-violet-600 text-white text-[11px] font-semibold rounded-full">
                          <FolderTree className="w-2.5 h-2.5" />
                          {sectors.find(s => s.id === selectedContactDataWithDB?.sector_id)?.name || 'Setor'}
                        </span>
                      )}
                      {selectedContactDataWithDB?.tag_ids && selectedContactDataWithDB.tag_ids.length > 0 && (
                        <>
                          {selectedContactDataWithDB.tag_ids.map((tagId) => {
                            const tag = tags.find(t => t.id === tagId);
                            return tag ? (
                              <span
                                key={tagId}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold text-white"
                                style={{ backgroundColor: tag.color }}
                              >
                                <Tag className="w-2.5 h-2.5" />
                                {tag.name}
                              </span>
                            ) : null;
                          })}
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      const currentContact = contactsDB.find(c => normalizeDbPhone(c.phone_number) === normalizeDbPhone(selectedContact));
                      setSelectedDepartment(currentContact?.department_id || receptionDeptId || '');
                      setSelectedSector(currentContact?.sector_id || '');
                      setDepartamentoTransferencia('');
                      setSetorTransferencia('');
                      setShowTransferModal(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg transition-all"
                    title="Transferir departamento"
                  >
                    <ArrowRightLeft className="w-4 h-4" />
                    Transferir
                  </button>
                  <button
                    onClick={() => {
                      const currentContact = contactsDB.find(c => normalizeDbPhone(c.phone_number) === normalizeDbPhone(selectedContact));
                      setSelectedTags(currentContact?.tag_ids || []);
                      setShowTagModal(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg transition-all"
                    title="Gerenciar tags"
                  >
                    <Tag className="w-4 h-4" />
                    Tags
                  </button>
                  {(() => {
                    const currentContact = contactsDB.find(c => normalizeDbPhone(c.phone_number) === normalizeDbPhone(selectedContact));
                    const isFinalized = currentContact?.ticket_status === 'finalizado';

                    return isFinalized ? (
                      <button
                        onClick={handleReopenTicket}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-500 hover:bg-blue-600 rounded-lg transition-all shadow-sm"
                        title="Abrir chamado"
                      >
                        <FolderOpen className="w-4 h-4" />
                        <span className="hidden sm:inline">Abrir Chamado</span>
                      </button>
                    ) : (
                      <button
                        onClick={handleCloseTicket}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-500 hover:bg-emerald-600 rounded-lg transition-all shadow-sm shadow-emerald-100"
                        title="Finalizar atendimento"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span className="hidden sm:inline">Finalizar</span>
                      </button>
                    );
                  })()}
                </div>
              </header>

              <div
                className="flex-1 overflow-y-auto px-4 py-5"
                ref={messagesContainerRef}
                onScroll={handleMessagesScroll}
                style={{
                  backgroundColor: settings.backgroundColor || '#efeae2',
                  backgroundImage: settings.backgroundColor ? 'none' : `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.03'/%3E%3C/svg%3E")`,
                }}
              >
                <div className="w-full">
                  {hasMoreMessages && currentMessages.length >= 30 && (
                    <div className="flex justify-center mb-4">
                      <button
                        onClick={loadMoreMessages}
                        disabled={loadingMoreMessages}
                        className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                      >
                        {loadingMoreMessages ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Carregando...
                          </>
                        ) : (
                          'Carregar mensagens antigas'
                        )}
                      </button>
                    </div>
                  )}
                  {Object.entries(messageGroups).map(([date, msgs]) => (
                    <div key={date} className="mb-4">
                      <div className="flex justify-center mb-4">
                        <div className="px-3.5 py-1 rounded-full" style={{ backgroundColor: '#d1f4cc', boxShadow: '0 1px 1px rgba(0,0,0,0.1)' }}>
                          <p className="text-[12px] font-medium" style={{ color: '#1b4332' }}>{date}</p>
                        </div>
                      </div>
                      <div className="space-y-2">
                        {msgs.map((msg) => {
                          // Renderizar mensagens de sistema (transferência de departamento)
                          if (msg.message_type === 'system_transfer' || msg.tipomessage === 'system_transfer') {
                            console.log('📋 Renderizando mensagem de transferência:', msg);
                            return <SystemMessage key={msg.id} message={{ ...msg, message_type: msg.message_type || msg.tipomessage }} />;
                          }

                          // Renderizar notificações de sistema antigas (troca de setor)
                          if (msg.tipomessage === 'system_notification') {
                            return (
                              <div key={msg.id} className="flex justify-center my-4">
                                <div className="bg-blue-50 border border-blue-200 px-4 py-2 rounded-lg text-center">
                                  <p className="text-sm text-blue-700 font-medium">{linkifyText(msg.message)}</p>
                                </div>
                              </div>
                            );
                          }

                          const isSentMessage = msg['minha?'] === 'true';
                          // Para mensagem enviada pela empresa (isSentMessage): manter pushname/empresa
                          // Para mensagem recebida: mostrar APENAS o nome vindo da tabela contacts (ou vazio se não existir)
                          const contactIdForLabel = getContactId(msg);
                          const dbContactForLabel = contactsDB.find(c => normalizeDbPhone(c.phone_number) === normalizeDbPhone(contactIdForLabel));
                          if (!dbContactForLabel) fetchAndCacheContactByPhone(contactIdForLabel);
                          const senderLabel = isSentMessage ? (msg.pushname || company?.name || 'Atendente') : (dbContactForLabel?.name || '');
                          const base64Type = msg.base64 ? detectBase64Type(msg.base64) : null;
                          const tipoFromField = getMessageTypeFromTipomessage(msg.tipomessage);
                          const hasBase64Content = msg.base64 && base64Type;

                          return (
                            <div
                              key={msg.id}
                              className={`flex ${isSentMessage ? 'justify-end' : 'justify-start'}`}
                            >
                              <div
                                className={`max-w-[68%] rounded-2xl ${isSentMessage ? 'rounded-br-[5px]' : 'rounded-bl-[5px]'}`}
                                style={isSentMessage ? {
                                  backgroundColor: settings.messageBubbleSentColor || '#005c4b',
                                  color: settings.messageBubbleSentTextColor || '#e9f5ef',
                                  boxShadow: '0 1px 2px rgba(0,0,0,0.2)'
                                } : {
                                  backgroundColor: settings.messageBubbleReceivedColor || '#ffffff',
                                  color: settings.messageBubbleReceivedTextColor || '#111b21',
                                  boxShadow: '0 1px 2px rgba(0,0,0,0.13)'
                                }}
                              >
                                {/* TOPO DO BALÃO: APENAS NOME DO REMETENTE */}
                                <div className="px-3.5 pt-2 pb-0">
                                  <span
                                    className="text-[11px] font-semibold"
                                    style={{
                                      color: isSentMessage ? (settings.messageBubbleSentTextColor ? 'rgba(255,255,255,0.6)' : '#9ed8c9') : '#00a884'
                                    }}
                                  >
                                    {senderLabel}
                                  </span>
                                </div>

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
                                        {linkifyText(msg.caption)}
                                      </div>
                                    )}
                                  </div>
                                )}

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

                                {hasBase64Content && (base64Type === 'audio' || tipoFromField === 'audio') &&
                                  base64Type !== 'image' && tipoFromField !== 'image' && (
                                    <div className="p-3">
                                      <div
                                        className="flex items-center gap-3 p-3 rounded-xl"
                                        style={{
                                          backgroundColor: isSentMessage
                                            ? (settings.messageBubbleSentColor || '#005c4b')
                                            : (settings.messageBubbleReceivedColor || '#ffffff')
                                        }}
                                      >
                                        <button
                                          onClick={() => handleAudioPlay(msg.id, msg.base64!)}
                                          className={`p-2 rounded-full ${isSentMessage ? 'bg-white/20 hover:bg-white/30' : 'bg-blue-500 hover:bg-blue-600'} transition`}
                                        >
                                          {playingAudio === msg.id ? (
                                            <Pause className="w-5 h-5 text-white" />
                                          ) : (
                                            <Play className="w-5 h-5 text-white" />
                                          )}
                                        </button>
                                        <div className="flex-1">
                                          <p className="text-sm font-medium">
                                            {msg.message || 'Áudio'}
                                          </p>
                                          <p className="text-[11px]" style={{ opacity: 0.7 }}>
                                            Clique para {playingAudio === msg.id ? 'pausar' : 'reproduzir'}
                                          </p>
                                        </div>
                                        <Mic className={`w-5 h-5 ${isSentMessage ? 'text-blue-100' : 'text-blue-500'}`} />
                                      </div>
                                    </div>
                                  )}

                                {hasBase64Content && (base64Type === 'document' || tipoFromField === 'document') &&
                                  base64Type !== 'audio' && tipoFromField !== 'audio' &&
                                  base64Type !== 'image' && tipoFromField !== 'image' &&
                                  base64Type !== 'sticker' && tipoFromField !== 'sticker' &&
                                  base64Type !== 'video' && tipoFromField !== 'video' && (
                                    <div className="p-2">
                                      <button
                                        onClick={() => downloadBase64File(msg.base64!, msg.message || 'documento.pdf')}
                                        className="flex items-center gap-2 p-2.5 rounded-xl w-full transition"
                                        style={{ backgroundColor: isSentMessage ? (settings.messageBubbleSentColor || '#005c4b') : '#f1f5f9', color: isSentMessage ? (settings.messageBubbleSentTextColor || '#fff') : '#111b21' }}
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

                                {msg.urlpdf && !hasBase64Content && (
                                  <div className="p-2">
                                    <a
                                      href={msg.urlpdf}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="flex items-center gap-2 p-2.5 rounded-xl hover:opacity-90 transition"
                                      style={{ backgroundColor: isSentMessage ? (settings.messageBubbleSentColor || '#005c4b') : '#f1f5f9', color: isSentMessage ? (settings.messageBubbleSentTextColor || '#fff') : '#111b21' }}
                                    >
                                      <FileText className="w-8 h-8 flex-shrink-0" />
                                      <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium truncate">
                                          {msg.message || 'Documento'}
                                        </p>
                                        <p className={`text-[11px] ${isSentMessage ? 'text-blue-100' : 'text-gray-500'}`}>
                                          Clique para abrir
                                        </p>
                                      </div>
                                    </a>
                                  </div>
                                )}

                                {msg.message && !msg.urlpdf && !hasBase64Content && (
                                  <div className="px-3.5 pt-1 pb-1">
                                    <p className="text-[14px] leading-[1.5] whitespace-pre-wrap break-words tracking-[0.01em]">
                                      {linkifyText(msg.message)}
                                    </p>
                                  </div>
                                )}

                                <div className="px-3.5 pb-1.5 flex items-center justify-end gap-1">
                                  <span style={{ color: isSentMessage ? (settings.messageBubbleSentTextColor ? 'rgba(255,255,255,0.55)' : 'rgba(233,245,239,0.65)') : '#667781', fontSize: '11px' }}>
                                    {formatTime(msg)}
                                  </span>
                                  {isSentMessage && (
                                    <CheckCheck className="w-4 h-4" style={{ color: '#53bdeb' }} />
                                  )}
                                </div>

                                {msg.reactions && msg.reactions.length > 0 && (
                                  <div className="px-3.5 pb-2 flex flex-wrap gap-1">
                                    {msg.reactions.map((reaction, idx) => (
                                      <div
                                        key={idx}
                                        className="bg-gray-100 rounded-full px-2 py-1 flex items-center gap-1 text-sm"
                                      >
                                        <span>{reaction.emoji}</span>
                                        {reaction.count > 1 && (
                                          <span className="text-xs text-gray-600 font-medium">{reaction.count}</span>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              </div>

              {/* Botão flutuante para ir para baixo com contador de mensagens pendentes */}
              {showScrollButton && (
                <button
                  onClick={() => {
                    scrollToBottom(true);
                    setPendingMessagesCount(0);
                    // Marcar como visto
                    if (selectedContactData?.messages) {
                      const lastMsgTime = selectedContactData.messages.reduce((max, msg) => {
                        return Math.max(max, getMessageTimestamp(msg));
                      }, 0);
                      setLastViewedMessageTime(prev => ({
                        ...prev,
                        [selectedContact!]: lastMsgTime
                      }));
                    }
                  }}
                  className="fixed bottom-24 right-6 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-full p-2.5 shadow-lg transition-all flex items-center justify-center"
                  style={{ zIndex: 40 }}
                >
                  <div className="flex items-center justify-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                    </svg>
                    {pendingMessagesCount > 0 && (
                      <span className="text-xs font-bold bg-red-500 rounded-full w-5 h-5 flex items-center justify-center">
                        {pendingMessagesCount > 9 ? '9+' : pendingMessagesCount}
                      </span>
                    )}
                  </div>
                </button>
              )}

              <div className="bg-white px-4 py-3 border-t border-slate-200/80">
                {filePreview && (
                  <div className="mb-3 px-4 py-3 bg-blue-50/80 backdrop-blur-sm border border-blue-200/50 rounded-xl">
                    <div className="flex items-start gap-3">
                      <img src={filePreview} alt="Preview" className="w-20 h-20 object-cover rounded-lg" />
                      <div className="flex-1">
                        <p className="text-xs text-blue-600 mb-1 font-medium">Imagem selecionada</p>
                        <p className="text-xs text-gray-600">{selectedFile?.name}</p>
                        <button
                          onClick={clearSelectedFile}
                          className="text-xs text-red-500 hover:text-red-700 mt-2 font-medium"
                        >
                          Remover imagem
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {selectedFile && selectedFile.type.startsWith('image/') && (
                  <div className="mb-3">
                    <input
                      type="text"
                      value={imageCaption}
                      onChange={(e) => setImageCaption(e.target.value)}
                      placeholder="Legenda para imagem (opcional)"
                      className="w-full px-4 py-2.5 text-sm bg-white/60 border border-gray-200/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 focus:bg-white transition-all placeholder-gray-400"
                    />
                  </div>
                )}

                {selectedFile && !selectedFile.type.startsWith('image/') && (
                  <div className="mb-3 px-4 py-3 bg-gray-50/80 backdrop-blur-sm border border-gray-200/50 rounded-xl">
                    <div className="flex items-center gap-3">
                      <FileText className="w-8 h-8 text-gray-400" />
                      <div className="flex-1">
                        <p className="text-xs text-gray-600 mb-1 font-medium">Arquivo selecionado</p>
                        <p className="text-xs text-gray-600">{selectedFile?.name}</p>
                        <button
                          onClick={clearSelectedFile}
                          className="text-xs text-red-500 hover:text-red-700 mt-2 font-medium"
                        >
                          Remover arquivo
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-3">
                  <input
                    type="file"
                    ref={imageInputRef}
                    accept="image/*"
                    onChange={handleImageSelect}
                    className="hidden"
                  />
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept=".pdf,.doc,.docx,.txt"
                    onChange={handleFileSelect}
                    className="hidden"
                  />

                  <button
                    onClick={() => imageInputRef.current?.click()}
                    disabled={sending || !!selectedFile}
                    className="p-2 text-slate-400 dark:text-slate-500 hover:text-blue-500 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-slate-800 rounded-lg transition-all disabled:opacity-40"
                    title="Enviar imagem"
                  >
                    <ImageIcon className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={sending || !!selectedFile}
                    className="p-2 text-slate-400 dark:text-slate-500 hover:text-blue-500 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-slate-800 rounded-lg transition-all disabled:opacity-40"
                    title="Enviar arquivo"
                  >
                    <Paperclip className="w-5 h-5" />
                  </button>

                  <div className="flex-1 bg-slate-50 dark:bg-slate-800 rounded-2xl flex items-center px-4 py-2.5 border border-slate-200 dark:border-slate-600 focus-within:border-blue-400 dark:focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100 dark:focus-within:ring-blue-900/40 transition-all">
                    <textarea
                      ref={messageInputRef as React.RefObject<HTMLTextAreaElement>}
                      rows={1}
                      value={messageText}
                      onChange={(e) => setMessageText(e.target.value)}
                      onPaste={handlePasteContent}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage();
                        }
                        // Shift+Enter -> newline (default behavior)
                      }}
                      placeholder="Digite uma mensagem ou arraste um arquivo…"
                      disabled={sending}
                      className="flex-1 bg-transparent text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none disabled:opacity-50 text-sm resize-none leading-relaxed"
                    />
                    <EmojiPicker
                      onSelect={(emoji) => setMessageText(prev => prev + emoji)}
                    />
                  </div>

                  <button
                    onClick={handleSendMessage}
                    disabled={(!messageText.trim() && !selectedFile) || sending}
                    className="w-10 h-10 bg-blue-500 hover:bg-blue-600 rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center shadow-sm hover:scale-105 active:scale-95"
                    title="Enviar mensagem"
                  >
                    {sending || uploadingFile ? (
                      <Loader2 className="w-5 h-5 text-white animate-spin" />
                    ) : (
                      <Send className="w-5 h-5 text-white" />
                    )}
                  </button>
                </div>

                {uploadingFile && (
                  <div className="mt-3 text-center">
                    <p className="text-sm text-gray-500 font-medium">Enviando arquivo...</p>
                  </div>
                )}
              </div>
            </>
              );
            })()
          ) : activeTab === 'mensagens' ? (
            <div className="flex-1 flex items-center justify-center" style={{ backgroundColor: '#efeae2' }}>
              <div className="text-center p-8 max-w-sm">
                <div className="w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-5" style={{ backgroundColor: '#c8ddc9', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                  <MessageSquare className="w-10 h-10" style={{ color: '#3a5c42' }} />
                </div>
                <h3 className="text-lg font-bold mb-2" style={{ color: '#3a5c42' }}>Nenhuma conversa selecionada</h3>
                <p className="text-sm" style={{ color: '#5a7a62' }}>Escolha um contato na lista para começar</p>
              </div>
            </div>
          ) : activeTab === 'departamentos' ? (
            <div key="departamentos" className="flex-1 bg-slate-50 overflow-y-auto animate-in fade-in slide-in-from-bottom-2 duration-200">
              <DepartmentsManagement />
            </div>
          ) : activeTab === 'setores' ? (
            <div key="setores" className="flex-1 bg-slate-50 overflow-y-auto animate-in fade-in slide-in-from-bottom-2 duration-200">
              <SectorsManagement />
            </div>
          ) : activeTab === 'atendentes' ? (
            <div key="atendentes" className="flex-1 bg-slate-50 overflow-y-auto animate-in fade-in slide-in-from-bottom-2 duration-200">
              <AttendantsManagement />
            </div>
          ) : activeTab === 'tags' ? (
            <div key="tags" className="flex-1 bg-slate-50 overflow-y-auto animate-in fade-in slide-in-from-bottom-2 duration-200">
              <TagsManagement />
            </div>
          ) : activeTab === 'agente' ? (
            <div key="agente" className="flex-1 bg-slate-50 overflow-y-auto animate-in fade-in slide-in-from-bottom-2 duration-200">
              <AgentConfig />
            </div>
          ) : activeTab === 'historico' ? (
            <div key="historico" className="flex-1 bg-slate-50 overflow-y-auto animate-in fade-in slide-in-from-bottom-2 duration-200">
              <TicketHistory onOpenChat={handleOpenChatFromHistory} />
            </div>
          ) : activeTab === 'meu-plano' ? (
            <div key="meu-plano" className="flex-1 bg-slate-50 overflow-y-auto animate-in fade-in slide-in-from-bottom-2 duration-200">
              <MyPlan companyId={company?.id || ''} />
            </div>
          ) : activeTab === 'contatos' ? (
            <div key="contatos" className="flex-1 bg-slate-50 overflow-y-auto animate-in fade-in slide-in-from-bottom-2 duration-200">
              {(() => {
                if (company?.id) {
                  if (allContactsList.length === 0 && !loadingAllContacts) {
                    loadAllContactsFromDB();
                  }
                } else {
                  return (
                    <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                      <AlertCircle className="w-10 h-10 mb-3 opacity-40" />
                      <p className="text-sm font-medium">Empresa não identificada</p>
                    </div>
                  );
                }
                return (
                  <div className="w-full p-6">
                    <div className="mb-6 flex items-center justify-between">
                      <h2 className="text-3xl font-bold text-slate-900 dark:text-white">Contatos</h2>
                      <button
                        onClick={() => setShowAddContactModal(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-lg font-semibold transition-all shadow-md hover:shadow-lg"
                      >
                        <Plus className="w-5 h-5" />
                        Adicionar
                      </button>
                    </div>

                    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                      <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                          <input
                            type="text"
                            value={allContactsSearch}
                            onChange={(e) => setAllContactsSearch(e.target.value)}
                            placeholder="Buscar por nome ou telefone..."
                            className="w-full pl-10 pr-4 py-2.5 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-white focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900 transition-all"
                          />
                        </div>
                      </div>

                      <div className="p-6">
                        {loadingAllContacts ? (
                          <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                            <Loader2 className="w-8 h-8 animate-spin mb-3 text-blue-500" />
                            <p className="text-sm font-medium">Carregando contatos...</p>
                          </div>
                        ) : (() => {
                          const filtered = allContactsSearch.trim()
                            ? allContactsList.filter((contact) =>
                                (contact.name || '').toLowerCase().includes(allContactsSearch.toLowerCase()) ||
                                (contact.phone_number || '').includes(allContactsSearch)
                              )
                            : allContactsList;

                          if (filtered.length === 0) {
                            return (
                              <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                                <User className="w-10 h-10 mb-3 opacity-40" />
                                <p className="text-sm font-medium">Nenhum contato encontrado</p>
                                <p className="text-xs mt-1">Procure por contatos ou adicione um novo</p>
                              </div>
                            );
                          }

                          return (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                              {filtered.map((contact) => {
                                const initial = (contact.name || contact.phone_number || '?')[0].toUpperCase();
                                const color = getAvatarColor(contact.name || contact.phone_number || '');
                                const lastMessageTime = contact.last_message_time ? formatDate(contact.last_message_time) : 'Sem mensagens';
                                const isTicketOpen = contact.ticket_status !== 'finalizado';
                                const cleanPhone = (contact.phone_number || '').replace('@s.whatsapp.net', '').replace('@g.us', '');

                                return (
                                  <div
                                    key={contact.id}
                                    className="bg-white/70 dark:bg-slate-900 backdrop-blur-xl border border-gray-200/50 dark:border-slate-600 rounded-2xl p-6 shadow-md hover:shadow-lg transition-all group hover:-translate-y-1 cursor-pointer"
                                    onClick={() => {
                                      const normalizedPhone = normalizePhone(contact.phone_number);
                                      setSelectedContact(normalizedPhone);
                                      setPendingNewContact({ 
                                        name: contact.name || '', 
                                        phone: normalizedPhone 
                                      });
                                      setActiveTab('mensagens');
                                      if (window.innerWidth < 768) setSidebarOpen(false);
                                    }}
                                  >
                                    {/* Avatar + Actions */}
                                    <div className="flex justify-between mb-3">
                                      <div 
                                        className={`w-14 h-14 bg-gradient-to-br ${color} rounded-xl flex items-center justify-center shadow-md text-white font-semibold text-lg`}
                                      >
                                        {initial}
                                      </div>

                                      <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button 
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleEditContact(contact);
                                          }}
                                          className="p-2 text-gray-400 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/20 rounded-lg transition-all"
                                          title="Editar contato"
                                        >
                                          <Edit2 className="w-4 h-4" />
                                        </button>
                                        <button 
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleOpenDeleteModal(contact);
                                          }}
                                          className="p-2 text-gray-400 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/20 rounded-lg transition-all"
                                          title="Deletar contato"
                                        >
                                          <Trash2 className="w-4 h-4" />
                                        </button>
                                      </div>
                                    </div>

                                    {/* Nome */}
                                    <h3 className="font-bold text-gray-900 dark:text-white">
                                      {contact.name || 'Sem nome'}
                                    </h3>

                                    {/* Número */}
                                    <p className="text-sm text-gray-600 dark:text-slate-300 mt-1">
                                      {cleanPhone || 'Sem número'}
                                    </p>

                                    {/* Última Mensagem (opcional) */}
                                    {contact.last_message && (
                                      <p className="text-xs text-gray-600 dark:text-slate-400 mt-2 line-clamp-2">
                                        {contact.last_message}
                                      </p>
                                    )}

                                    {/* Data + Status */}
                                    <div className="mt-4 pt-3 border-t border-gray-100 dark:border-slate-700 flex items-center justify-between text-xs">
                                      <p className="text-gray-400 dark:text-slate-500">
                                        {lastMessageTime}
                                      </p>
                                      {isTicketOpen ? (
                                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500 text-white">
                                          <span className="w-1.5 h-1.5 rounded-full bg-white/80" />
                                          Aberto
                                        </span>
                                      ) : (
                                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-200">
                                          <span className="w-1.5 h-1.5 rounded-full bg-slate-400 dark:bg-slate-400" />
                                          Fechado
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })()}
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

              {/* Modal de Edição de Contato */}
              {isEditModalOpen && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
                  <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md p-6 animate-in zoom-in duration-200">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-xl font-bold text-gray-900 dark:text-white">Editar Contato</h3>
                      <button 
                        onClick={handleCloseEditModal}
                        className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-300"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-2">
                          Nome
                        </label>
                        <input
                          type="text"
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          placeholder="Digite o nome"
                          className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                          autoFocus
                          onKeyDown={(e) => e.key === 'Enter' && handleSaveContactEdit()}
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-2">
                          Número
                        </label>
                        <input
                          type="text"
                          value={editingPhone}
                          onChange={(e) => setEditingPhone(e.target.value)}
                          placeholder="Digite o número"
                          className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 font-mono"
                          onKeyDown={(e) => e.key === 'Enter' && handleSaveContactEdit()}
                        />
                      </div>
                    </div>

                    <div className="flex gap-3 mt-6">
                      <button
                        onClick={handleSaveContactEdit}
                        className="flex-1 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors font-semibold"
                      >
                        Salvar
                      </button>
                      <button
                        onClick={handleCloseEditModal}
                        className="flex-1 px-4 py-2 bg-gray-200 dark:bg-slate-700 hover:bg-gray-300 dark:hover:bg-slate-600 text-gray-700 dark:text-white rounded-lg transition-colors font-semibold"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Modal de Exclusão de Contato */}
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
            </div>
          ) : activeTab === 'configuracoes' ? (
            <div key="configuracoes" className="flex-1 animate-in fade-in slide-in-from-bottom-2 duration-200">
              <SettingsPage />
            </div>
          ) : null}
        </div>
      </div>

      {imageModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75 p-4 cursor-pointer"
          onClick={closeImageModal}
        >
          <div className="relative max-w-5xl max-h-[90vh] cursor-default" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={closeImageModal}
              className="absolute -top-10 right-0 text-white hover:text-gray-300 transition"
              title="Fechar"
            >
              <X className="w-8 h-8" />
            </button>
            {imageModalType === 'video' ? (
              <video
                src={imageModalSrc}
                controls
                autoPlay
                className="max-w-full max-h-[90vh] object-contain rounded-lg"
              />
            ) : (
              <img
                src={imageModalSrc}
                alt="Imagem ampliada"
                className="max-w-full max-h-[90vh] object-contain rounded-lg"
              />
            )}
          </div>
        </div>
      )}

      {/* Modal de Transferir Departamento */}
      {showTransferModal && (
        <div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 relative z-[10000]">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <ArrowRightLeft className="w-6 h-6 text-blue-600" />
                Transferir Departamento
              </h3>
              <button
                onClick={() => {
                  setShowTransferModal(false);
                  setDepartamentoTransferencia('');
                  setSetorTransferencia('');
                }}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Departamento de Destino
                </label>
                <select
                  value={departamentoTransferencia}
                  onChange={(e) => {
                    setDepartamentoTransferencia(e.target.value);
                    setSetorTransferencia('');
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

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Setor (Opcional)
                </label>
                <select
                  value={setorTransferencia}
                  onChange={(e) => setSetorTransferencia(e.target.value)}
                  disabled={!departamentoTransferencia}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all disabled:bg-slate-100 disabled:cursor-not-allowed"
                >
                  <option value="">Selecione um setor</option>
                  {sectorsFilteredTransfer.map((sector) => (
                    <option key={sector.id} value={sector.id}>
                      {sector.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowTransferModal(false);
                  setDepartamentoTransferencia('');
                  setSetorTransferencia('');
                }}
                className="flex-1 px-4 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-all font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={handleTransferir}
                className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all font-medium shadow-sm"
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

            <div className="space-y-2 max-h-96 overflow-y-auto">
              {tags.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-8">
                  Nenhuma tag disponível
                </p>
              ) : (
                tags.map((tag) => (
                  <label
                    key={tag.id}
                    className="flex items-center gap-3 p-3 hover:bg-slate-50 rounded-lg cursor-pointer transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={selectedTags.includes(tag.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          if (selectedTags.length < 5) {
                            setSelectedTags([...selectedTags, tag.id]);
                          } else {
                            setToastMessage('Você pode selecionar no máximo 5 tags');
                            setShowToast(true);
                          }
                        } else {
                          setSelectedTags(selectedTags.filter(id => id !== tag.id));
                        }
                      }}
                      className="w-5 h-5 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                      disabled={!selectedTags.includes(tag.id) && selectedTags.length >= 5}
                    />
                    <span
                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium text-white flex-1"
                      style={{ backgroundColor: tag.color }}
                    >
                      <Tag className="w-4 h-4" />
                      {tag.name}
                    </span>
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
          className="fixed bg-white  rounded-lg shadow-2xl border border-slate-200  py-2 z-50 min-w-[200px] transition-colors duration-300"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => handleTogglePin(contextMenu.phoneNumber)}
            className="w-full px-4 py-2.5 text-left hover:bg-slate-50  transition-colors flex items-center gap-3 text-slate-700 "
          >
            <Pin className="w-4 h-4" />
            {contactsDB.find(c => normalizeDbPhone(c.phone_number) === normalizeDbPhone(contextMenu.phoneNumber))?.pinned
              ? 'Desafixar contato'
              : 'Fixar contato'}
          </button>
          {aiEnabled && (
            <button
              onClick={() => handleToggleIA(contextMenu.phoneNumber)}
              className="w-full px-4 py-2.5 text-left hover:bg-slate-50  transition-colors flex items-center gap-3 text-slate-700 "
            >
              <Bot className="w-4 h-4" />
              {contactsDB.find(c => normalizeDbPhone(c.phone_number) === normalizeDbPhone(contextMenu.phoneNumber))?.ia_ativada
                ? 'Desativar IA'
                : 'Ativar IA'}
            </button>
          )}
          <button
            onClick={() => handleContextMenuTag(contextMenu.phoneNumber)}
            className="w-full px-4 py-2.5 text-left hover:bg-slate-50  transition-colors flex items-center gap-3 text-slate-700 "
          >
            <Tag className="w-4 h-4" />
            Adicionar tag
          </button>
          <button
            onClick={() => handleContextMenuTransfer(contextMenu.phoneNumber)}
            className="w-full px-4 py-2.5 text-left hover:bg-slate-50  transition-colors flex items-center gap-3 text-slate-700 "
          >
            <ArrowRightLeft className="w-4 h-4" />
            Transferir departamento
          </button>
        </div>
      )}

      {/* Toast de notificação */}
      {showToast && <Toast message={toastMessage} onClose={() => setShowToast(false)} />}
    </div>
  );
}