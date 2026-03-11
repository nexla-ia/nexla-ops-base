import { useEffect, useRef } from 'react';
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

  useEffect(() => {
    if (!apiKey || !enabled) {
      console.log('⏸️ Monitoramento desativado. apiKey:', apiKey, 'enabled:', enabled);
      return;
    }

    console.log('📡 Iniciando monitoramento em tempo real para mensagens com apiKey:', apiKey);

    // Canal para mensagens recebidas (messages table)
    const messagesChannel = supabase
      .channel(`messages-${apiKey}-${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `apikey_instancia=eq.${apiKey}`
        },
        (payload: RealtimePostgresChangesPayload<Message>) => {
          console.log('📨 NOVA mensagem recebida detectada:', payload);
          const message = payload.new as Message;
          
          if (onNewMessage) {
            console.log('🔔 Chamando onNewMessage para mensagem recebida');
            onNewMessage(message, 'received');
          }
          
          if (onMessagesChange) {
            console.log('🔄 Chamando onMessagesChange para mensagem recebida');
            onMessagesChange(message);
          }
        }
      )
      .subscribe((status) => {
        console.log('📨 Status subscription mensagens recebidas (messages):', status);
      });

    // Canal para mensagens enviadas (sent_messages table)
    const sentMessagesChannel = supabase
      .channel(`sent-messages-${apiKey}-${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'sent_messages',
          filter: `apikey_instancia=eq.${apiKey}`
        },
        (payload: RealtimePostgresChangesPayload<Message>) => {
          console.log('📤 NOVA mensagem enviada detectada:', payload);
          const message = payload.new as Message;
          
          if (onNewMessage) {
            console.log('🔔 Chamando onNewMessage para mensagem enviada');
            onNewMessage(message, 'sent');
          }
          
          if (onMessagesChange) {
            console.log('🔄 Chamando onMessagesChange para mensagem enviada');
            onMessagesChange(message);
          }
        }
      )
      .subscribe((status) => {
        console.log('📤 Status subscription mensagens enviadas (sent_messages):', status);
      });

    channelsRef.current = [messagesChannel, sentMessagesChannel];

    // Cleanup
    return () => {
      console.log('🛑 Parando monitoramento de mensagens para apiKey:', apiKey);
      messagesChannel.unsubscribe();
      sentMessagesChannel.unsubscribe();
    };
  }, [apiKey, enabled, onMessagesChange, onNewMessage]);

  return {};
};
