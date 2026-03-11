import { useEffect, useState, useRef } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import { Menu, X, Building2, MessageSquare, Plus, LogOut, Search, User, Send, Paperclip, Image as ImageIcon, RefreshCw, Loader2, Edit2, Bell, Package, Settings, Copy, Check, Eye, Users, FolderTree, Tag as TagIcon, Contact, MessageCircle } from "lucide-react";
import Modal from "./Modal";
import Notification from "./Notification";
import PlansManagement from "./PlansManagement";

type Company = {
  id: string;
  api_key: string;
  name: string;
  phone_number: string;
  email: string;
  user_id: string | null;
  is_super_admin?: boolean | null;
  created_at?: string;
  max_attendants?: number;
  payment_notification_day?: number;
  plan_id?: string | null;
  additional_attendants?: number;
};

type Plan = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  billing_period: 'monthly' | 'annual';
  max_attendants: number | null;
  max_contacts: number | null;
  is_active: boolean;
};

type Message = {
  id: string;
  message: string | null;
  numero: string | null;
  pushname: string | null;
  tipomessage: string | null;
  created_at: string | null;
  apikey_instancia: string;
  company_id: string | null;
  caption: string | null;
  base64?: string | null;
  urlimagem?: string | null;
  urlpdf?: string | null;
  mimetype?: string | null;
  date_time?: string | null;
  'minha?'?: string | null;
};

type TabType = "empresas" | "planos" | "configuracoes";

export default function SuperAdminDashboard() {
  const { signOut } = useAuth();
  const [userEmail, setUserEmail] = useState("");
  const [userId, setUserId] = useState("");
  const [activeTab, setActiveTab] = useState<TabType>("empresas");
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const [companies, setCompanies] = useState<Company[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);

  const [selectedChat, setSelectedChat] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [messageText, setMessageText] = useState("");
  const [imageCaption, setImageCaption] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // form
  const [name, setName] = useState("");
  const [phone_number, setPhoneNumber] = useState("");
  const [api_key, setApiKey] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [selectedPlanId, setSelectedPlanId] = useState<string>("");
  const [additionalAttendants, setAdditionalAttendants] = useState("0");
  const [paymentNotificationDay, setPaymentNotificationDay] = useState("5");

  // Modal and notifications
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; companyId: string; companyName: string }>({
    isOpen: false,
    companyId: "",
    companyName: "",
  });
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'warning' | 'info'; message: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [pixKey, setPixKey] = useState("");
  const [copied, setCopied] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsId, setSettingsId] = useState<string | null>(null);

  // Edit company
  const [editingCompany, setEditingCompany] = useState<string | null>(null);

  // Notification management
  const [showNotificationForm, setShowNotificationForm] = useState(false);
  const [selectedCompanyForNotification, setSelectedCompanyForNotification] = useState<Company | null>(null);
  const [notificationTitle, setNotificationTitle] = useState("");
  const [notificationMessage, setNotificationMessage] = useState("");
  const [notificationType, setNotificationType] = useState<'payment' | 'info' | 'warning' | 'error'>('info');
  const [sendingNotification, setSendingNotification] = useState(false);

  // Company details modal
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedCompanyDetails, setSelectedCompanyDetails] = useState<Company | null>(null);
  const [companyStats, setCompanyStats] = useState<{
    attendantsCount: number;
    departmentsCount: number;
    sectorsCount: number;
    tagsCount: number;
    contactsCount: number;
    messagesCount: number;
    planName: string;
  } | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);

  // =========================
  // Formatação de Telefone
  // =========================
  const formatPhoneNumber = (value: string) => {
    const numbers = value.replace(/\D/g, "");
    if (numbers.length <= 10) {
      return numbers
        .replace(/(\d{2})(\d)/, "($1) $2")
        .replace(/(\d{4})(\d)/, "$1-$2");
    }
    return numbers
      .replace(/(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{5})(\d)/, "$1-$2")
      .slice(0, 15);
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value);
    setPhoneNumber(formatted);
  };

  const generateApiKey = () => {
    const uuid = crypto.randomUUID();
    setApiKey(uuid);
  };

  // =========================
  // Load user + companies + messages
  // =========================
  useEffect(() => {
    (async () => {
      setLoading(true);
      setErrorMsg(null);

      const {
        data: { session },
        error: sessErr,
      } = await supabase.auth.getSession();

      if (sessErr) {
        setErrorMsg(sessErr.message);
        setLoading(false);
        return;
      }

      if (!session?.user) {
        setErrorMsg("Sem sessão. Faça login novamente.");
        setLoading(false);
        return;
      }

      setUserEmail(session.user.email ?? "");
      setUserId(session.user.id);

      await Promise.all([loadCompanies(), loadMessages(), loadPlans(), loadSystemSettings()]);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const messagesInterval = setInterval(() => {
      loadMessages();
    }, 1000);

    const companiesInterval = setInterval(() => {
      loadCompanies();
    }, 1000);

    const messagesChannel = supabase
      .channel('super-admin-messages')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
        },
        () => {
          loadMessages();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'sent_messages',
        },
        () => {
          loadMessages();
        }
      )
      .subscribe();

    const companiesChannel = supabase
      .channel('super-admin-companies')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'companies',
        },
        () => {
          loadCompanies();
        }
      )
      .subscribe();

    return () => {
      clearInterval(messagesInterval);
      clearInterval(companiesInterval);
      supabase.removeChannel(messagesChannel);
      supabase.removeChannel(companiesChannel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedChat) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  }, [selectedChat]);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  }, [messages.length]);

  const loadCompanies = async () => {
    setErrorMsg(null);

    const { data, error } = await supabase
      .from("companies")
      .select("id,api_key,name,phone_number,email,user_id,is_super_admin,created_at,max_attendants,payment_notification_day,plan_id,additional_attendants")
      .order("created_at", { ascending: false });

    if (error) {
      setErrorMsg(error.message);
      setCompanies([]);
      return;
    }

    setCompanies((data as Company[]) || []);
  };

  const loadPlans = async () => {
    const { data, error } = await supabase
      .from("plans")
      .select("*")
      .eq("is_active", true)
      .order("price", { ascending: true });

    if (error) {
      console.error("Error loading plans:", error);
      setPlans([]);
      return;
    }

    setPlans((data as Plan[]) || []);
  };

  const loadSystemSettings = async () => {
    const { data, error } = await supabase
      .from("system_settings")
      .select("*")
      .maybeSingle();

    if (error) {
      console.error("Error loading system settings:", error);
      return;
    }

    if (data) {
      setPixKey(data.pix_key || "");
      setSettingsId(data.id);
    }
  };

  const loadMessages = async () => {
    const [receivedResult, sentResult] = await Promise.all([
      supabase
        .from("messages")
        .select("*")
        .order("date_time", { ascending: false })
        .limit(100),
      supabase
        .from("sent_messages")
        .select("*")
        .order("date_time", { ascending: false })
        .limit(100)
    ]);

    if (receivedResult.error) {
      console.error("Error loading messages:", receivedResult.error);
      setMessages([]);
      return;
    }

    if (sentResult.error) {
      console.error("Error loading sent messages:", sentResult.error);
    }

    const allMessages = [
      ...(receivedResult.data || []),
      ...(sentResult.data || [])
    ];

    setMessages((allMessages as Message[]) || []);
  };

  // =========================
  // Create company
  // =========================
  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (
      !name.trim() ||
      !phone_number.trim() ||
      !api_key.trim() ||
      !email.trim() ||
      !password.trim()
    ) {
      setErrorMsg("Preencha todos os campos.");
      return;
    }

    const phoneNumbers = phone_number.replace(/\D/g, "");
    if (phoneNumbers.length < 10) {
      setErrorMsg("Telefone deve ter pelo menos 10 dígitos.");
      return;
    }

    if (password.length < 6) {
      setErrorMsg("Senha deve ter no mínimo 6 caracteres.");
      return;
    }

    setCreating(true);

    try {
      const {
        data: { session },
        error: sessErr,
      } = await supabase.auth.getSession();

      if (sessErr) throw sessErr;
      if (!session?.access_token) {
        throw new Error("Sem token. Faça login novamente.");
      }

      // Verificar se o usuário atual está na tabela super_admins
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        console.log("Current user ID:", user.id);
        const { data: adminCheck } = await supabase
          .from("super_admins")
          .select("user_id")
          .eq("user_id", user.id)
          .maybeSingle();
        console.log("Super admin check:", adminCheck);

        if (!adminCheck) {
          throw new Error("Você não está cadastrado como super admin. Entre em contato com o administrador do sistema.");
        }
      }

      const response = await supabase.functions.invoke("create-company", {
        body: {
          email: email.trim().toLowerCase(),
          password,
          name: name.trim(),
          phone_number: phone_number.trim(),
          api_key: api_key.trim(),
          plan_id: selectedPlanId || null,
          additional_attendants: parseInt(additionalAttendants) || 0,
          payment_notification_day: parseInt(paymentNotificationDay) || 5,
          payment_day: 10,
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      console.log("Response completo:", response);
      console.log("Response.data:", response.data);
      console.log("Response.error:", response.error);

      // Verificar se houve erro na chamada
      if (response.error) {
        console.error("Erro create-company:", response.error);
        console.error("Error details from data:", response.data);

        // Tentar fazer uma chamada direta para capturar a resposta real
        try {
          const directResponse = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-company`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${session.access_token}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                email: email.trim().toLowerCase(),
                password,
                name: name.trim(),
                phone_number: phone_number.trim(),
                api_key: api_key.trim(),
                plan_id: selectedPlanId || null,
                additional_attendants: parseInt(additionalAttendants) || 0,
                payment_notification_day: parseInt(paymentNotificationDay) || 5,
                payment_day: 10,
              }),
            }
          );

          console.log("Direct response status:", directResponse.status);
          const responseText = await directResponse.text();
          console.log("Direct response body:", responseText);

          if (!directResponse.ok) {
            try {
              const errorData = JSON.parse(responseText);
              let errorMessage = errorData.error || errorData.details || "Erro ao criar empresa";

              // Melhorar mensagem de erro de email duplicado
              if (errorMessage.includes("Email já está em uso")) {
                errorMessage = `O email "${email.trim().toLowerCase()}" já está cadastrado no sistema. Use um email diferente que nunca foi utilizado antes.`;
              } else if (errorMessage.includes("API Key já está em uso") || errorMessage.includes("api_key")) {
                errorMessage = `A API Key "${api_key.trim()}" já está em uso. Gere uma nova API Key única.`;
              }

              throw new Error(errorMessage);
            } catch (parseError: any) {
              if (parseError.message && !parseError.message.includes("Unexpected token")) {
                throw parseError;
              }
              throw new Error(`Erro HTTP ${directResponse.status}: ${responseText}`);
            }
          }

          const successData = JSON.parse(responseText);
          console.log("Empresa criada com sucesso:", successData);

          // limpa e fecha
          setShowForm(false);
          setName("");
          setPhoneNumber("");
          setApiKey("");
          setEmail("");
          setPassword("");
          setSelectedPlanId("");
          setAdditionalAttendants("0");
          setPaymentNotificationDay("5");

          // recarrega lista
          await loadCompanies();
          return;

        } catch (directError: any) {
          console.error("Erro na chamada direta:", directError);
          throw directError;
        }
      }

      if (response.data?.error) {
        console.error("Error in response data:", response.data);
        throw new Error(response.data.error);
      }

      console.log("Empresa criada:", response.data);

      // limpa e fecha
      setShowForm(false);
      setName("");
      setPhoneNumber("");
      setApiKey("");
      setEmail("");
      setPassword("");
      setSelectedPlanId("");
      setAdditionalAttendants("0");
      setPaymentNotificationDay("5");

      // recarrega lista
      await loadCompanies();
    } catch (err: any) {
      console.error("handleCreateCompany:", err);
      setErrorMsg(err?.message ?? "Erro inesperado.");
    } finally {
      setCreating(false);
    }
  };


  const openDeleteModal = (companyId: string, companyName: string) => {
    setDeleteModal({
      isOpen: true,
      companyId,
      companyName,
    });
  };

  const closeDeleteModal = () => {
    setDeleteModal({
      isOpen: false,
      companyId: "",
      companyName: "",
    });
  };

  const handleDeleteCompany = async () => {
    const { companyId, companyName } = deleteModal;
    setDeleting(true);

    try {
      const { data, error } = await supabase.rpc('delete_company_cascade', {
        company_uuid: companyId
      });

      if (error) {
        console.error('Erro ao deletar empresa:', error);
        setNotification({
          type: 'error',
          message: `Erro ao deletar empresa: ${error.message}`
        });
        return;
      }

      if (data?.success) {
        closeDeleteModal();
        setNotification({
          type: 'success',
          message: `Empresa "${companyName}" deletada com sucesso!`
        });
        await loadCompanies();
        await loadMessages();
      }
    } catch (err: any) {
      console.error('Erro ao deletar empresa:', err);
      setNotification({
        type: 'error',
        message: 'Erro inesperado ao deletar empresa'
      });
    } finally {
      setDeleting(false);
    }
  };

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      let error;

      if (settingsId) {
        const result = await supabase
          .from("system_settings")
          .update({ pix_key: pixKey })
          .eq("id", settingsId);
        error = result.error;
      } else {
        const result = await supabase
          .from("system_settings")
          .insert({ pix_key: pixKey })
          .select()
          .single();
        error = result.error;
        if (result.data) {
          setSettingsId(result.data.id);
        }
      }

      if (error) {
        console.error("Error saving settings:", error);
        setNotification({
          type: 'error',
          message: `Erro ao salvar configuracoes: ${error.message}`
        });
        return;
      }

      setNotification({
        type: 'success',
        message: 'Configuracoes salvas com sucesso!'
      });
    } catch (err: any) {
      console.error("Error saving settings:", err);
      setNotification({
        type: 'error',
        message: 'Erro inesperado ao salvar configuracoes'
      });
    } finally {
      setSavingSettings(false);
    }
  };

  const handleEditCompany = (company: Company) => {
    setEditingCompany(company.id);
    setName(company.name);
    setPhoneNumber(company.phone_number);
    setApiKey(company.api_key);
    setEmail(company.email);
    setSelectedPlanId(company.plan_id || "");
    setAdditionalAttendants(String(company.additional_attendants || 0));
    setPaymentNotificationDay(String(company.payment_notification_day || 5));
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openNotificationForm = (company: Company) => {
    setSelectedCompanyForNotification(company);
    setShowNotificationForm(true);
    setNotificationTitle("");
    setNotificationMessage("");
    setNotificationType('info');
  };

  const handleSendNotification = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedCompanyForNotification) return;

    setSendingNotification(true);
    try {
      const { error } = await supabase
        .from('notifications')
        .insert({
          company_id: selectedCompanyForNotification.id,
          title: notificationTitle.trim(),
          message: notificationMessage.trim(),
          type: notificationType,
          is_read: false,
        });

      if (error) throw error;

      setShowNotificationForm(false);
      setSelectedCompanyForNotification(null);
      setNotificationTitle("");
      setNotificationMessage("");
      setNotificationType('info');

      setNotification({
        type: 'success',
        message: `Notificação enviada para ${selectedCompanyForNotification.name}!`
      });
    } catch (err: any) {
      console.error('Erro ao enviar notificação:', err);
      setNotification({
        type: 'error',
        message: err?.message ?? 'Erro ao enviar notificação'
      });
    } finally {
      setSendingNotification(false);
    }
  };

  const openCompanyDetails = async (company: Company) => {
    setSelectedCompanyDetails(company);
    setShowDetailsModal(true);
    setLoadingStats(true);

    try {
      const [
        { count: attendantsCount },
        { count: departmentsCount },
        { count: sectorsCount },
        { count: tagsCount },
        { count: contactsCount },
        { count: messagesCount },
        planResult
      ] = await Promise.all([
        supabase.from('attendants').select('*', { count: 'exact', head: true }).eq('company_id', company.id),
        supabase.from('departments').select('*', { count: 'exact', head: true }).eq('company_id', company.id),
        supabase.from('sectors').select('*', { count: 'exact', head: true }).eq('company_id', company.id),
        supabase.from('tags').select('*', { count: 'exact', head: true }).eq('company_id', company.id),
        supabase.from('contacts').select('*', { count: 'exact', head: true }).eq('company_id', company.id),
        supabase.from('messages').select('*', { count: 'exact', head: true }).eq('company_id', company.id),
        company.plan_id
          ? supabase.from('plans').select('name').eq('id', company.plan_id).maybeSingle()
          : Promise.resolve({ data: null, error: null })
      ]);

      setCompanyStats({
        attendantsCount: attendantsCount || 0,
        departmentsCount: departmentsCount || 0,
        sectorsCount: sectorsCount || 0,
        tagsCount: tagsCount || 0,
        contactsCount: contactsCount || 0,
        messagesCount: messagesCount || 0,
        planName: planResult.data?.name || 'Sem plano'
      });
    } catch (err) {
      console.error('Erro ao carregar estatísticas:', err);
      setCompanyStats({
        attendantsCount: 0,
        departmentsCount: 0,
        sectorsCount: 0,
        tagsCount: 0,
        contactsCount: 0,
        messagesCount: 0,
        planName: 'Sem plano'
      });
    } finally {
      setLoadingStats(false);
    }
  };

  const handleUpdateCompany = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!editingCompany) return;

    setCreating(true);
    try {
      const { error } = await supabase
        .from('companies')
        .update({
          name: name.trim(),
          phone_number: phone_number.trim(),
          api_key: api_key.trim(),
          plan_id: selectedPlanId || null,
          additional_attendants: parseInt(additionalAttendants) || 0,
          payment_notification_day: parseInt(paymentNotificationDay) || 5,
        })
        .eq('id', editingCompany);

      if (error) throw error;

      setShowForm(false);
      setEditingCompany(null);
      setName("");
      setPhoneNumber("");
      setApiKey("");
      setEmail("");
      setPassword("");
      setSelectedPlanId("");
      setAdditionalAttendants("0");
      setPaymentNotificationDay("5");

      setNotification({
        type: 'success',
        message: 'Empresa atualizada com sucesso!'
      });

      await loadCompanies();
    } catch (err: any) {
      console.error('Erro ao atualizar empresa:', err);
      setNotification({
        type: 'error',
        message: err?.message ?? 'Erro ao atualizar empresa'
      });
    } finally {
      setCreating(false);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const sendMessage = async (messageData: Partial<Message>, apiKey: string) => {
    if (!selectedChat) return;

    setSending(true);
    try {
      const generatedIdMessage = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const { data: existingMessages } = await supabase
        .from('messages')
        .select('instancia, company_id')
        .eq('numero', selectedChat)
        .eq('apikey_instancia', apiKey)
        .order('date_time', { ascending: false })
        .limit(1);

      const instanciaValue = existingMessages?.[0]?.instancia || 'Admin';
      const companyId = existingMessages?.[0]?.company_id;

      const newMessage = {
        numero: selectedChat,
        sender: selectedChat,
        'minha?': 'true',
        pushname: 'Admin',
        apikey_instancia: apiKey,
        date_time: new Date().toISOString(),
        instancia: instanciaValue,
        idmessage: generatedIdMessage,
        company_id: companyId,
        ...messageData,
      };

      const { error } = await supabase
        .from('sent_messages')
        .insert([newMessage]);

      if (error) {
        console.error('Erro ao enviar mensagem:', error);
        alert('Erro ao enviar mensagem');
        return;
      }

      try {
        const timestamp = new Date().toISOString();

        const webhookPayload = {
          numero: selectedChat,
          message: messageData.message || '',
          tipomessage: messageData.tipomessage || 'conversation',
          base64: messageData.base64 || null,
          urlimagem: messageData.urlimagem || null,
          urlpdf: messageData.urlpdf || null,
          caption: messageData.caption || null,
          idmessage: generatedIdMessage,
          pushname: 'Admin',
          timestamp: timestamp,
          instancia: instanciaValue,
          apikey_instancia: apiKey,
        };

        await fetch('https://n8n.nexladesenvolvimento.com.br/webhook/EnvioMensagemOPS', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(webhookPayload),
        });
      } catch (webhookError) {
        console.error('Erro ao chamar webhook:', webhookError);
      }

      setMessageText('');
      await loadMessages();
      setTimeout(scrollToBottom, 100);
    } catch (err) {
      console.error('Erro ao enviar mensagem:', err);
      alert('Erro ao enviar mensagem');
    } finally {
      setSending(false);
    }
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

  const handleSendMessage = async () => {
    if (sending || !selectedChat) return;
    if (!messageText.trim() && !selectedFile) return;

    const selectedChatData = filteredChats.find(c => c.numero === selectedChat);
    if (!selectedChatData || selectedChatData.messages.length === 0) return;

    const apiKey = selectedChatData.messages[0].apikey_instancia;

    setSending(true);
    try {
      if (selectedFile) {
        const base64 = await fileToBase64(selectedFile);
        const isImage = selectedFile.type.startsWith('image/');

        const messageData: Partial<Message> = {
          tipomessage: isImage ? 'imageMessage' : 'documentMessage',
          mimetype: selectedFile.type,
          base64: base64,
        };

        if (isImage) {
          messageData.message = imageCaption || messageText.trim() || 'Imagem';
          if (imageCaption) {
            messageData.caption = imageCaption;
          }
        } else {
          messageData.message = messageText.trim() || selectedFile.name;
        }

        await sendMessage(messageData, apiKey);
        setSelectedFile(null);
        setFilePreview(null);
        setImageCaption('');
      } else {
        await sendMessage({
          message: messageText.trim(),
          tipomessage: 'conversation',
        }, apiKey);
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

  const groupMessagesByContact = () => {
    const grouped: { [key: string]: Message[] } = {};

    messages.forEach((msg) => {
      const key = msg.numero || "unknown";
      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(msg);
    });

    return Object.entries(grouped)
      .map(([numero, msgs]) => {
        const sortedMessages = msgs.sort((a, b) =>
          new Date(a.created_at || a.date_time || 0).getTime() - new Date(b.created_at || b.date_time || 0).getTime()
        );

        const lastMsg = sortedMessages[sortedMessages.length - 1];

        return {
          numero,
          pushname: lastMsg?.pushname || numero,
          lastMessage: lastMsg?.caption || lastMsg?.message || "",
          lastMessageTime: lastMsg?.created_at || lastMsg?.date_time || "",
          messages: sortedMessages,
          unreadCount: 0
        };
      })
      .sort((a, b) => {
        const timeA = new Date(a.lastMessageTime).getTime();
        const timeB = new Date(b.lastMessageTime).getTime();
        return timeB - timeA;
      });
  };

  const filteredChats = groupMessagesByContact().filter(chat =>
    chat.pushname.toLowerCase().includes(searchQuery.toLowerCase()) ||
    chat.numero.includes(searchQuery)
  );

  // =========================
  // UI
  // =========================

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-gray-100">
        <div className="text-center">
          <div className="text-4xl font-bold bg-gradient-to-r from-teal-500 to-teal-600 bg-clip-text text-transparent mb-4">
            NEXLA
          </div>
          <div className="text-gray-600 animate-pulse">Carregando...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-gray-100 flex">
      <aside
        className={`${
          sidebarOpen ? "w-64" : "w-20"
        } bg-white/80 backdrop-blur-xl border-r border-gray-200/50 transition-all duration-300 flex flex-col relative shadow-lg`}
      >
        <div className="p-6 border-b border-gray-200/50">
          <div className="flex items-center justify-between">
            {sidebarOpen ? (
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-teal-500 to-teal-600 bg-clip-text text-transparent">
                  NEXLA
                </h1>
                <p className="text-xs text-gray-500 mt-1">Admin Portal</p>
              </div>
            ) : (
              <div className="text-2xl font-bold bg-gradient-to-r from-teal-500 to-teal-600 bg-clip-text text-transparent">
                N
              </div>
            )}
          </div>
        </div>

        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="absolute -right-3 top-20 bg-white border border-teal-400/40 rounded-full p-1.5 text-teal-500 hover:bg-teal-50 transition-colors shadow-md"
        >
          {sidebarOpen ? <X size={16} /> : <Menu size={16} />}
        </button>

        <nav className="flex-1 p-4 space-y-2">
          <button
            onClick={() => setActiveTab("empresas")}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
              activeTab === "empresas"
                ? "bg-gradient-to-r from-teal-50 to-teal-100/50 text-teal-600 border border-teal-200 shadow-sm"
                : "text-gray-600 hover:text-teal-600 hover:bg-gray-50"
            }`}
          >
            <Building2 size={20} />
            {sidebarOpen && (
              <div className="flex-1 text-left">
                <div className="font-medium">Empresas</div>
                <div className="text-xs opacity-70">{companies.length} cadastradas</div>
              </div>
            )}
          </button>

          <button
            onClick={() => setActiveTab("planos")}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
              activeTab === "planos"
                ? "bg-gradient-to-r from-purple-50 to-purple-100/50 text-purple-600 border border-purple-200 shadow-sm"
                : "text-gray-600 hover:text-purple-600 hover:bg-gray-50"
            }`}
          >
            <Package size={20} />
            {sidebarOpen && (
              <div className="flex-1 text-left">
                <div className="font-medium">Planos</div>
                <div className="text-xs opacity-70">Gerenciar assinaturas</div>
              </div>
            )}
          </button>

          <button
            onClick={() => setActiveTab("configuracoes")}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
              activeTab === "configuracoes"
                ? "bg-gradient-to-r from-blue-50 to-blue-100/50 text-blue-600 border border-blue-200 shadow-sm"
                : "text-gray-600 hover:text-blue-600 hover:bg-gray-50"
            }`}
          >
            <Settings size={20} />
            {sidebarOpen && (
              <div className="flex-1 text-left">
                <div className="font-medium">Configuracoes</div>
                <div className="text-xs opacity-70">Chave PIX e mais</div>
              </div>
            )}
          </button>

        </nav>

        <div className="p-4 border-t border-gray-200/50">
          <div className={`${sidebarOpen ? "" : "flex justify-center"}`}>
            {sidebarOpen && (
              <div className="mb-3">
                <div className="text-xs text-gray-500 mb-1">Logado como</div>
                <div className="text-sm text-gray-700 truncate">{userEmail}</div>
              </div>
            )}
            <button
              onClick={signOut}
              className={`${
                sidebarOpen ? "w-full" : ""
              } flex items-center gap-2 px-4 py-2 rounded-lg text-gray-600 hover:text-red-500 hover:bg-red-50 border border-gray-200 hover:border-red-200 transition-all`}
            >
              <LogOut size={18} />
              {sidebarOpen && <span>Sair</span>}
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <div className="p-8">
          {errorMsg && (
            <div className="mb-6 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700 backdrop-blur-sm">
              {errorMsg}
            </div>
          )}

          {activeTab === "empresas" && (
            <>
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="text-3xl font-bold text-gray-900 mb-2">Empresas Cadastradas</h2>
                  <p className="text-gray-600">Gerencie todas as empresas do sistema</p>
                </div>

                <button
                  onClick={() => setShowForm(true)}
                  className="flex items-center gap-2 px-6 py-3 rounded-lg bg-gradient-to-r from-teal-500 to-teal-600 text-white font-medium hover:from-teal-600 hover:to-teal-700 transition-all shadow-lg"
                >
                  <Plus size={20} />
                  Nova Empresa
                </button>
              </div>

              {showForm && (
                <div className="mb-8 rounded-2xl bg-white/80 border border-teal-200/50 p-6 backdrop-blur-sm shadow-lg">
                  <h3 className="text-xl font-semibold text-gray-900 mb-6">
                    {editingCompany ? 'Editar Empresa' : 'Cadastrar Nova Empresa'}
                  </h3>

                  <form onSubmit={editingCompany ? handleUpdateCompany : handleCreateCompany} className="grid gap-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm text-gray-700 mb-2">
                          Nome da Empresa
                        </label>
                        <input
                          required
                          className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-gray-900 placeholder-gray-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="Ex: Minha Empresa"
                        />
                      </div>

                      <div>
                        <label className="block text-sm text-gray-700 mb-2">
                          Número de Telefone
                        </label>
                        <input
                          required
                          type="tel"
                          className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-gray-900 placeholder-gray-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                          value={phone_number}
                          onChange={handlePhoneChange}
                          placeholder="(69) 99999-9999"
                          maxLength={15}
                        />
                      </div>

                      <div>
                        <label className="block text-sm text-gray-700 mb-2">
                          Chave API
                        </label>
                        <div className="flex gap-2">
                          <input
                            required
                            className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-gray-900 placeholder-gray-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 font-mono text-sm"
                            value={api_key}
                            onChange={(e) => setApiKey(e.target.value)}
                            placeholder="UUID/chave"
                          />
                          <button
                            type="button"
                            onClick={generateApiKey}
                            className="rounded-lg bg-gray-100 px-4 py-2 text-gray-700 text-sm hover:bg-gray-200 border border-gray-300 transition-colors"
                          >
                            Gerar
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm text-gray-700 mb-2">
                          Email
                        </label>
                        <input
                          required={!editingCompany}
                          type="email"
                          disabled={!!editingCompany}
                          className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-gray-900 placeholder-gray-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 disabled:opacity-60 disabled:cursor-not-allowed"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="empresa@dominio.com"
                        />
                        {editingCompany && (
                          <p className="text-xs text-gray-500 mt-1">Email não pode ser alterado</p>
                        )}
                      </div>
                    </div>

                    {!editingCompany && (
                      <div>
                        <label className="block text-sm text-gray-700 mb-2">
                          Senha <span className="text-gray-500 text-xs">(mínimo 6 caracteres)</span>
                        </label>
                        <input
                          required
                          type="password"
                          className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-gray-900 placeholder-gray-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="********"
                          minLength={6}
                        />
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm text-gray-700 mb-2">
                          Plano da Empresa
                        </label>
                        <select
                          className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-gray-900 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                          value={selectedPlanId}
                          onChange={(e) => setSelectedPlanId(e.target.value)}
                        >
                          <option value="">Sem plano (personalizado)</option>
                          {plans.map((plan) => (
                            <option key={plan.id} value={plan.id}>
                              {plan.name} - R$ {plan.price.toFixed(2)}/{plan.billing_period === 'monthly' ? 'mês' : 'ano'}
                              {plan.max_attendants ? ` (${plan.max_attendants} atendentes)` : ' (ilimitado)'}
                            </option>
                          ))}
                        </select>
                        <p className="text-xs text-gray-500 mt-1">Selecione o plano de assinatura</p>
                      </div>

                      <div>
                        <label className="block text-sm text-gray-700 mb-2">
                          Atendentes Adicionais
                        </label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-gray-900 placeholder-gray-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                          value={additionalAttendants}
                          onChange={(e) => setAdditionalAttendants(e.target.value)}
                          placeholder="0"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          {selectedPlanId && plans.find(p => p.id === selectedPlanId) ? (
                            <>Total: {(plans.find(p => p.id === selectedPlanId)?.max_attendants || 0) + (parseInt(additionalAttendants) || 0)} atendentes</>
                          ) : (
                            'Atendentes além do plano base'
                          )}
                        </p>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm text-gray-700 mb-2">
                        Dia da notificação de pagamento
                      </label>
                      <input
                        required
                        type="number"
                        min="1"
                        max="31"
                        className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-gray-900 placeholder-gray-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                        value={paymentNotificationDay}
                        onChange={(e) => setPaymentNotificationDay(e.target.value)}
                        placeholder="5"
                      />
                      <p className="text-xs text-gray-500 mt-1">Dia do mês (1-31) para notificação</p>
                    </div>

                    <div className="flex items-center gap-3 mt-4">
                      <button
                        type="submit"
                        disabled={creating}
                        className="rounded-lg bg-gradient-to-r from-teal-500 to-teal-600 px-6 py-2.5 text-white font-medium hover:from-teal-600 hover:to-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg"
                      >
                        {creating ? (editingCompany ? "Salvando..." : "Cadastrando...") : (editingCompany ? "Salvar Alterações" : "Cadastrar Empresa")}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setShowForm(false);
                          setEditingCompany(null);
                          setName("");
                          setPhoneNumber("");
                          setApiKey("");
                          setEmail("");
                          setPassword("");
                          setAdditionalAttendants("0");
                          setPaymentNotificationDay("5");
                        }}
                        className="rounded-lg border border-gray-300 px-6 py-2.5 text-gray-700 hover:bg-gray-100 transition-colors"
                      >
                        Cancelar
                      </button>
                    </div>
                  </form>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {companies.length === 0 && (
                  <div className="col-span-full text-center py-16 text-gray-500">
                    Nenhuma empresa cadastrada.
                  </div>
                )}

                {companies.map((c, index) => (
                  <div
                    key={c.id}
                    className="group rounded-xl bg-white/80 border border-teal-200/50 p-6 hover:border-teal-300 hover:shadow-lg transition-all backdrop-blur-sm hover:scale-105 animate-fadeIn"
                    style={{ animationDelay: `${index * 0.1}s` }}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="text-xl font-semibold text-gray-900">{c.name}</div>
                      <div className="flex items-center gap-2">
                        {c.is_super_admin && (
                          <span className="text-xs px-2.5 py-1 rounded-full bg-gradient-to-r from-amber-100 to-orange-100 text-amber-700 border border-amber-300 font-medium">
                            Admin
                          </span>
                        )}
                        {!c.is_super_admin && (
                          <div className="flex gap-2">
                            <button
                              onClick={() => openCompanyDetails(c)}
                              className="p-2 text-green-500 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                              title="Ver detalhes"
                            >
                              <Eye size={18} />
                            </button>
                            <button
                              onClick={() => openNotificationForm(c)}
                              className="p-2 text-purple-500 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                              title="Enviar notificação"
                            >
                              <Bell size={18} />
                            </button>
                            <button
                              onClick={() => handleEditCompany(c)}
                              className="p-2 text-blue-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Editar empresa"
                            >
                              <Edit2 size={18} />
                            </button>
                            <button
                              onClick={() => openDeleteModal(c.id, c.name)}
                              className="p-2 text-red-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Deletar empresa"
                            >
                              <X size={18} />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="space-y-3 text-sm">
                      <div className="flex items-center gap-3 text-gray-700">
                        <span className="text-teal-600">📞</span>
                        <span>{c.phone_number}</span>
                      </div>
                      <div className="flex items-center gap-3 text-gray-700">
                        <span className="text-teal-600">✉️</span>
                        <span className="break-all">{c.email}</span>
                      </div>
                      <div className="flex items-start gap-3 mt-4 pt-4 border-t border-gray-200">
                        <span className="text-teal-600">🔑</span>
                        <span className="break-all text-xs font-mono text-gray-600 bg-gray-50 px-2 py-1 rounded">
                          {c.api_key}
                        </span>
                      </div>
                      {c.plan_id && (() => {
                        const plan = plans.find(p => p.id === c.plan_id);
                        return plan ? (
                          <div className="flex items-center gap-3 pt-2 border-t border-gray-200">
                            <span className="text-teal-600">📦</span>
                            <span className="text-gray-700">
                              Plano: <span className="font-semibold">{plan.name}</span>
                              {plan.max_attendants && (
                                <span className="text-xs ml-2">
                                  ({plan.max_attendants}
                                  {c.additional_attendants ? ` + ${c.additional_attendants}` : ''} atendentes)
                                </span>
                              )}
                            </span>
                          </div>
                        ) : null;
                      })()}
                      {!c.plan_id && (
                        <div className="flex items-center gap-3 pt-2 border-t border-gray-200">
                          <span className="text-teal-600">📦</span>
                          <span className="text-gray-700">
                            Plano: <span className="font-semibold">Personalizado</span>
                          </span>
                        </div>
                      )}
                      {c.additional_attendants > 0 && (
                        <div className="flex items-center gap-3 pt-2 border-t border-gray-200">
                          <span className="text-teal-600">👥</span>
                          <span className="text-gray-700">
                            Atendentes adicionais: <span className="font-semibold">{c.additional_attendants}</span>
                          </span>
                        </div>
                      )}
                      <div className="flex items-center gap-3 pt-2 border-t border-gray-200">
                        <span className="text-teal-600">💰</span>
                        <span className="text-gray-700">
                          Notificação de pagamento: Dia <span className="font-semibold">{c.payment_notification_day || 5}</span> do mês
                        </span>
                      </div>
                      {c.user_id && (
                        <div className="flex items-start gap-3 pt-2 border-t border-gray-200">
                          <span className="text-teal-600">👤</span>
                          <span className="break-all text-xs font-mono text-gray-600">
                            {c.user_id}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {activeTab === "planos" && (
            <PlansManagement />
          )}

          {activeTab === "configuracoes" && (
            <div className="max-w-4xl">
              <div className="bg-white rounded-2xl border border-gray-200 shadow-lg overflow-hidden">
                <div className="bg-gradient-to-r from-blue-500 to-blue-600 p-8">
                  <h2 className="text-3xl font-bold text-white mb-2">Configuracoes do Sistema</h2>
                  <p className="text-blue-100">Gerencie as configuracoes globais da plataforma</p>
                </div>

                <div className="p-8 space-y-6">
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                      <Settings className="w-6 h-6 text-blue-600" />
                      Chave PIX para Pagamentos
                    </h3>

                    <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
                      <label className="block text-sm font-medium text-gray-700 mb-3">
                        Chave PIX
                      </label>
                      <div className="flex gap-3">
                        <input
                          type="text"
                          value={pixKey}
                          onChange={(e) => setPixKey(e.target.value)}
                          className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                          placeholder="Digite a chave PIX"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(pixKey);
                            setCopied(true);
                            setTimeout(() => setCopied(false), 2000);
                          }}
                          className={`px-6 py-3 rounded-lg font-semibold flex items-center gap-2 transition-all ${
                            copied
                              ? 'bg-green-500 text-white'
                              : 'bg-blue-500 text-white hover:bg-blue-600'
                          }`}
                        >
                          {copied ? (
                            <>
                              <Check className="w-5 h-5" />
                              Copiado!
                            </>
                          ) : (
                            <>
                              <Copy className="w-5 h-5" />
                              Copiar
                            </>
                          )}
                        </button>
                      </div>
                      <p className="text-sm text-gray-500 mt-3">
                        Esta chave sera exibida para as empresas realizarem pagamentos
                      </p>
                    </div>
                  </div>

                  <div className="pt-6 border-t border-gray-200">
                    <button
                      type="button"
                      onClick={handleSaveSettings}
                      disabled={savingSettings}
                      className="px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg font-semibold hover:from-blue-600 hover:to-blue-700 transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {savingSettings ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          Salvando...
                        </>
                      ) : (
                        'Salvar Configuracoes'
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      <Modal
        isOpen={deleteModal.isOpen}
        onClose={closeDeleteModal}
        onConfirm={handleDeleteCompany}
        title="Confirmar exclusão"
        message={`Tem certeza que deseja deletar a empresa "${deleteModal.companyName}"?\n\nIsto irá deletar PERMANENTEMENTE:\n• Todos os atendentes\n• Todos os departamentos\n• Todos os setores\n• Todas as tags\n• Todas as mensagens\n\nEsta ação não pode ser desfeita!`}
        confirmText="Sim, deletar"
        cancelText="Cancelar"
        confirmColor="red"
        loading={deleting}
      />

      {showNotificationForm && selectedCompanyForNotification && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setShowNotificationForm(false)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full mx-4 animate-in zoom-in slide-in-from-bottom-4 duration-300" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-xl font-bold text-gray-900">Enviar Notificação</h3>
              <button onClick={() => setShowNotificationForm(false)} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSendNotification} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Empresa</label>
                <input
                  type="text"
                  value={selectedCompanyForNotification.name}
                  disabled
                  className="w-full rounded-lg border border-gray-300 bg-gray-50 px-4 py-2.5 text-gray-900 cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Tipo de Notificação</label>
                <select
                  value={notificationType}
                  onChange={(e) => setNotificationType(e.target.value as 'payment' | 'info' | 'warning' | 'error')}
                  className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-gray-900 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                  required
                >
                  <option value="info">Informação</option>
                  <option value="payment">Pagamento</option>
                  <option value="warning">Aviso</option>
                  <option value="error">Erro</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Título</label>
                <input
                  type="text"
                  value={notificationTitle}
                  onChange={(e) => setNotificationTitle(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-gray-900 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                  placeholder="Ex: Lembrete de Pagamento"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Mensagem</label>
                <textarea
                  value={notificationMessage}
                  onChange={(e) => setNotificationMessage(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-gray-900 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 min-h-[120px] resize-y"
                  placeholder="Digite a mensagem da notificação..."
                  required
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  disabled={sendingNotification}
                  className="flex-1 px-4 py-2.5 bg-gradient-to-br from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700 text-white rounded-xl transition-all font-medium shadow-lg disabled:opacity-50"
                >
                  {sendingNotification ? 'Enviando...' : 'Enviar Notificação'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowNotificationForm(false)}
                  disabled={sendingNotification}
                  className="flex-1 px-4 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-all font-medium disabled:opacity-50"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDetailsModal && selectedCompanyDetails && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gradient-to-br from-teal-500 to-teal-600 px-6 py-4 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-white">Detalhes da Empresa</h2>
                <p className="text-teal-50 text-sm mt-1">{selectedCompanyDetails.name}</p>
              </div>
              <button
                onClick={() => setShowDetailsModal(false)}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <X size={24} className="text-white" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                  <div className="text-xs text-gray-500 font-medium mb-1">Email</div>
                  <div className="text-sm text-gray-900 font-medium">{selectedCompanyDetails.email}</div>
                </div>
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                  <div className="text-xs text-gray-500 font-medium mb-1">Telefone</div>
                  <div className="text-sm text-gray-900 font-medium">{selectedCompanyDetails.phone_number}</div>
                </div>
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                  <div className="text-xs text-gray-500 font-medium mb-1">API Key</div>
                  <div className="text-sm text-gray-900 font-mono break-all">{selectedCompanyDetails.api_key}</div>
                </div>
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                  <div className="text-xs text-gray-500 font-medium mb-1">Max Atendentes</div>
                  <div className="text-sm text-gray-900 font-medium">{selectedCompanyDetails.max_attendants || 'Ilimitado'}</div>
                </div>
                <div className="bg-gradient-to-br from-teal-50 to-teal-100 p-4 rounded-xl border border-teal-200">
                  <div className="text-xs text-teal-600 font-medium mb-1">Plano Atual</div>
                  <div className="text-sm text-teal-900 font-bold">
                    {loadingStats ? 'Carregando...' : (companyStats?.planName || 'Sem plano')}
                  </div>
                </div>
              </div>

              <div className="border-t border-gray-200 pt-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Estatísticas</h3>
                {loadingStats ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="animate-spin text-teal-500" size={32} />
                  </div>
                ) : companyStats ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-xl border border-blue-200">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-white rounded-lg">
                          <Users size={24} className="text-blue-600" />
                        </div>
                        <div>
                          <div className="text-2xl font-bold text-blue-900">{companyStats.attendantsCount}</div>
                          <div className="text-xs text-blue-700 font-medium">Atendentes</div>
                        </div>
                      </div>
                    </div>

                    <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-4 rounded-xl border border-purple-200">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-white rounded-lg">
                          <Building2 size={24} className="text-purple-600" />
                        </div>
                        <div>
                          <div className="text-2xl font-bold text-purple-900">{companyStats.departmentsCount}</div>
                          <div className="text-xs text-purple-700 font-medium">Departamentos</div>
                        </div>
                      </div>
                    </div>

                    <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-xl border border-green-200">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-white rounded-lg">
                          <FolderTree size={24} className="text-green-600" />
                        </div>
                        <div>
                          <div className="text-2xl font-bold text-green-900">{companyStats.sectorsCount}</div>
                          <div className="text-xs text-green-700 font-medium">Setores</div>
                        </div>
                      </div>
                    </div>

                    <div className="bg-gradient-to-br from-orange-50 to-orange-100 p-4 rounded-xl border border-orange-200">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-white rounded-lg">
                          <TagIcon size={24} className="text-orange-600" />
                        </div>
                        <div>
                          <div className="text-2xl font-bold text-orange-900">{companyStats.tagsCount}</div>
                          <div className="text-xs text-orange-700 font-medium">Tags</div>
                        </div>
                      </div>
                    </div>

                    <div className="bg-gradient-to-br from-teal-50 to-teal-100 p-4 rounded-xl border border-teal-200">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-white rounded-lg">
                          <Contact size={24} className="text-teal-600" />
                        </div>
                        <div>
                          <div className="text-2xl font-bold text-teal-900">{companyStats.contactsCount}</div>
                          <div className="text-xs text-teal-700 font-medium">Contatos</div>
                        </div>
                      </div>
                    </div>

                    <div className="bg-gradient-to-br from-pink-50 to-pink-100 p-4 rounded-xl border border-pink-200">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-white rounded-lg">
                          <MessageCircle size={24} className="text-pink-600" />
                        </div>
                        <div>
                          <div className="text-2xl font-bold text-pink-900">{companyStats.messagesCount}</div>
                          <div className="text-xs text-pink-700 font-medium">Mensagens</div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="flex justify-end pt-4">
                <button
                  onClick={() => setShowDetailsModal(false)}
                  className="px-6 py-2.5 bg-gradient-to-br from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700 text-white rounded-xl transition-all font-medium shadow-lg"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {notification && (
        <Notification
          type={notification.type}
          message={notification.message}
          onClose={() => setNotification(null)}
        />
      )}
    </div>
  );
}
