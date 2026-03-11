import { useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

interface Notification {
  id: string;
  company_id: string;
  title: string;
  message: string;
  type: 'payment' | 'info' | 'warning' | 'error';
  is_read: boolean;
  created_at: string;
}

interface UseRealtimeNotificationsProps {
  companyId: string | null | undefined;
  enabled?: boolean;
  onNotificationChange?: (notification: Notification, type: 'INSERT' | 'UPDATE' | 'DELETE') => void;
  onNewNotification?: (notification: Notification) => void;
}

/**
 * Hook que monitora mudanças em tempo real nas notificações
 * @param companyId - ID da empresa para filtrar notificações
 * @param enabled - Se deve ativar o monitoramento (padrão: true)
 * @param onNotificationChange - Callback quando uma notificação é alterada
 * @param onNewNotification - Callback quando uma nova notificação chega
 */
export const useRealtimeNotifications = ({
  companyId,
  enabled = true,
  onNotificationChange,
  onNewNotification
}: UseRealtimeNotificationsProps) => {
  const subscriptionRef = useRef<any>(null);

  const handleNotificationChange = useCallback((
    payload: RealtimePostgresChangesPayload<Notification>
  ) => {
    console.log('🔔 Mudança em notificação detectada:', payload);

    const notification = payload.new as Notification;

    if (payload.eventType === 'INSERT' && onNewNotification) {
      console.log('✨ Nova notificação recebida:', notification);
      onNewNotification(notification);
    }

    if (onNotificationChange) {
      onNotificationChange(notification, payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE');
    }
  }, [onNotificationChange, onNewNotification]);

  useEffect(() => {
    if (!companyId || !enabled) return;

    console.log('🔔 Iniciando monitoramento de notificações em tempo real para empresa:', companyId);

    const notificationsSubscription = supabase
      .channel(`notifications-${companyId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `company_id=eq.${companyId}`
        },
        handleNotificationChange
      )
      .subscribe((status) => {
        console.log('🔔 Status inscrição notificações:', status);
      });

    subscriptionRef.current = notificationsSubscription;

    return () => {
      console.log('🛑 Parando monitoramento de notificações para:', companyId);
      notificationsSubscription.unsubscribe();
    };
  }, [companyId, enabled, handleNotificationChange]);

  const stopMonitoring = useCallback(() => {
    if (subscriptionRef.current) {
      subscriptionRef.current.unsubscribe();
      subscriptionRef.current = null;
      console.log('⏹️ Monitoramento de notificações interrompido');
    }
  }, []);

  return { stopMonitoring };
};
