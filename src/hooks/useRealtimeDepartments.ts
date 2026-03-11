import { useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

interface Department {
  id: string;
  company_id: string;
  name: string;
  created_at: string;
}

interface UseRealtimeDepartmentsProps {
  companyId: string | null | undefined;
  enabled?: boolean;
  onDepartmentsChange?: (department: Department, type: 'INSERT' | 'UPDATE' | 'DELETE') => void;
}

/**
 * Hook que monitora mudanças em tempo real nos departamentos
 * @param companyId - ID da empresa para filtrar departamentos
 * @param enabled - Se deve ativar o monitoramento (padrão: true)
 * @param onDepartmentsChange - Callback quando um departamento é alterado
 */
export const useRealtimeDepartments = ({
  companyId,
  enabled = true,
  onDepartmentsChange
}: UseRealtimeDepartmentsProps) => {
  const subscriptionRef = useRef<any>(null);

  const handleDepartmentChange = useCallback((
    payload: RealtimePostgresChangesPayload<Department>
  ) => {
    console.log('🏢 Mudança em departamento detectada:', payload);

    const department = payload.new as Department;

    if (onDepartmentsChange) {
      onDepartmentsChange(department, payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE');
    }
  }, [onDepartmentsChange]);

  useEffect(() => {
    if (!companyId || !enabled) return;

    console.log('🏢 Iniciando monitoramento de departamentos em tempo real para empresa:', companyId);

    const departmentsSubscription = supabase
      .channel(`departments-${companyId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'departments',
          filter: `company_id=eq.${companyId}`
        },
        handleDepartmentChange
      )
      .subscribe((status) => {
        console.log('🏢 Status inscrição departamentos:', status);
      });

    subscriptionRef.current = departmentsSubscription;

    return () => {
      console.log('🛑 Parando monitoramento de departamentos para:', companyId);
      departmentsSubscription.unsubscribe();
    };
  }, [companyId, enabled, handleDepartmentChange]);

  const stopMonitoring = useCallback(() => {
    if (subscriptionRef.current) {
      subscriptionRef.current.unsubscribe();
      subscriptionRef.current = null;
      console.log('⏹️ Monitoramento de departamentos interrompido');
    }
  }, []);

  return { stopMonitoring };
};
