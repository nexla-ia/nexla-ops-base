import { useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

interface Sector {
  id: string;
  company_id: string;
  name: string;
  created_at: string;
}

interface UseRealtimeSectorsProps {
  companyId: string | null | undefined;
  enabled?: boolean;
  onSectorsChange?: (sector: Sector, type: 'INSERT' | 'UPDATE' | 'DELETE') => void;
}

/**
 * Hook que monitora mudanças em tempo real nos setores
 * @param companyId - ID da empresa para filtrar setores
 * @param enabled - Se deve ativar o monitoramento (padrão: true)
 * @param onSectorsChange - Callback quando um setor é alterado
 */
export const useRealtimeSectors = ({
  companyId,
  enabled = true,
  onSectorsChange
}: UseRealtimeSectorsProps) => {
  const subscriptionRef = useRef<any>(null);

  const handleSectorChange = useCallback((
    payload: RealtimePostgresChangesPayload<Sector>
  ) => {
    console.log('🗂️ Mudança em setor detectada:', payload);

    const sector = payload.new as Sector;

    if (onSectorsChange) {
      onSectorsChange(sector, payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE');
    }
  }, [onSectorsChange]);

  useEffect(() => {
    if (!companyId || !enabled) return;

    console.log('🗂️ Iniciando monitoramento de setores em tempo real para empresa:', companyId);

    const sectorsSubscription = supabase
      .channel(`sectors-${companyId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'sectors',
          filter: `company_id=eq.${companyId}`
        },
        handleSectorChange
      )
      .subscribe((status) => {
        console.log('🗂️ Status inscrição setores:', status);
      });

    subscriptionRef.current = sectorsSubscription;

    return () => {
      console.log('🛑 Parando monitoramento de setores para:', companyId);
      sectorsSubscription.unsubscribe();
    };
  }, [companyId, enabled, handleSectorChange]);

  const stopMonitoring = useCallback(() => {
    if (subscriptionRef.current) {
      subscriptionRef.current.unsubscribe();
      subscriptionRef.current = null;
      console.log('⏹️ Monitoramento de setores interrompido');
    }
  }, []);

  return { stopMonitoring };
};
