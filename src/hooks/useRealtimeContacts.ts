import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

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
}

interface UseRealtimeContactsProps {
  companyId: string | null | undefined;
  enabled?: boolean;
  onContactsChange?: (contact: ContactDB, type: 'INSERT' | 'UPDATE' | 'DELETE') => void;
  onContactTagsChange?: () => void;
}

/**
 * Hook que monitora mudanças em tempo real nos contatos
 */
export const useRealtimeContacts = ({
  companyId,
  enabled = true,
  onContactsChange,
  onContactTagsChange
}: UseRealtimeContactsProps) => {
  const channelRef = useRef<any>(null);
  const tagsChannelRef = useRef<any>(null);

  useEffect(() => {
    if (!companyId || !enabled) {
      return;
    }

    console.log('👥 Iniciando monitoramento de contatos em tempo real para empresa:', companyId);

    const contactsChannel = supabase
      .channel(`contacts-${companyId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'contacts',
          filter: `company_id=eq.${companyId}`
        },
        (payload: RealtimePostgresChangesPayload<ContactDB>) => {
          console.log('🔄 Mudança em contato detectada:', payload);
          const contact = payload.new as ContactDB;

          if (onContactsChange) {
            onContactsChange(contact, payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE');
          }
        }
      )
      .subscribe((status) => {
        console.log('📋 Status inscrição contatos:', status);
      });

    channelRef.current = contactsChannel;

    // Monitorar mudanças na tabela contact_tags
    const contactTagsChannel = supabase
      .channel(`contact-tags-${companyId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'contact_tags'
        },
        (payload: any) => {
          console.log('🏷️ Mudança em contact_tags detectada:', payload);
          if (onContactTagsChange) {
            onContactTagsChange();
          }
        }
      )
      .subscribe((status) => {
        console.log('📋 Status inscrição contact_tags:', status);
      });

    tagsChannelRef.current = contactTagsChannel;

    // Cleanup
    return () => {
      console.log('🛑 Parando monitoramento de contatos para:', companyId);
      contactsChannel.unsubscribe();
      contactTagsChannel.unsubscribe();
    };
  }, [companyId, enabled, onContactsChange, onContactTagsChange]);

  return {};
};
