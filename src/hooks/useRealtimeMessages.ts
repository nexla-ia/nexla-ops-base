import { useEffect, useRef, useCallback } from 'react';
import { supabase, Message } from '../lib/supabase';
import { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

interface UseRealtimeMessagesProps {
  apiKey: string | null | undefined;
  enabled?: boolean;
  onMessagesChange?: (message: Message) => void;
  onNewMessage?: (message: Message, type: 'received' | 'sent') => void;
}

/**
 * Hook que monitora mudanças em tempo real nas mensagens
 * Escuta tanto mensagens recebidas quanto enviadas
 */
export const useRealtimeMessages = ({
  apiKey,
  enabled = true,
  onMessagesChange,
  onNewMessage
}: UseRealtimeMessagesProps) => {
  const channelsRef = useRef<any[]>([]);

  // Refs para callbacks — evita recriar canais quando funções mudam
  const onMessagesChangeRef = useRef(onMessagesChange);
  const onNewMessageRef = useRef(onNewMessage);
  useEffect(() => { onMessagesChangeRef.current = onMessagesChange; }, [onMessagesChange]);
  useEffect(() => { onNewMessageRef.current = onNewMessage; }, [onNewMessage]);

  useEffect(() => {
    if (!apiKey || !enabled) {
      return;
    }

    // Usa nome de canal estável (sem Date.now) para evitar duplicação
    const messagesChannelName = `messages-realtime-${apiKey}`;
    const sentChannelName = `sent-messages-realtime-${apiKey}`;

    // Remove canais anteriores se existirem
    channelsRef.current.forEach(ch => {
      try { supabase.removeChannel(ch); } catch (_) {}
    });
    channelsRef.current = [];

    console.log('📡 Iniciando monitoramento em tempo real para mensagens com apiKey:', apiKey);

    const messagesChannel = supabase
      .channel(messagesChannelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `apikey_instancia=eq.${apiKey}`
        },
        (payload: RealtimePostgresChangesPayload<Message>) => {
          console.log('📨 Nova mensagem recebida:', payload.new);
          const message = payload.new as Message;
          onNewMessageRef.current?.(message, 'received');
          onMessagesChangeRef.current?.(message);
        }
      )
      .subscribe((status) => {
        console.log('📨 Status mensagens recebidas:', status);
      });

    const sentMessagesChannel = supabase
      .channel(sentChannelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'sent_messages',
          filter: `apikey_instancia=eq.${apiKey}`
        },
        (payload: RealtimePostgresChangesPayload<Message>) => {
          console.log('📤 Nova mensagem enviada:', payload.new);
          const message = payload.new as Message;
          onNewMessageRef.current?.(message, 'sent');
          onMessagesChangeRef.current?.(message);
        }
      )
      .subscribe((status) => {
        console.log('📤 Status mensagens enviadas:', status);
      });

    channelsRef.current = [messagesChannel, sentMessagesChannel];

    return () => {
      console.log('🛑 Parando monitoramento de mensagens para apiKey:', apiKey);
      try { supabase.removeChannel(messagesChannel); } catch (_) {}
      try { supabase.removeChannel(sentMessagesChannel); } catch (_) {}
      channelsRef.current = [];
    };
  }, [apiKey, enabled]); // ← só recriar canal se apiKey ou enabled mudar

  return {};
};