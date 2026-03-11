import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export function useAiEnabled(companyId: string | null): boolean {
  const [aiEnabled, setAiEnabled] = useState<boolean>(false);

  useEffect(() => {
    if (!companyId) {
      setAiEnabled(false);
      return;
    }

    const checkAiEnabled = async () => {
      try {
        const { data: company, error } = await supabase
          .from('companies')
          .select('plan_id')
          .eq('id', companyId)
          .maybeSingle();

        if (error || !company) {
          setAiEnabled(false);
          return;
        }

        if (!company.plan_id) {
          setAiEnabled(false);
          return;
        }

        const { data: plan, error: planError } = await supabase
          .from('plans')
          .select('ai_enabled')
          .eq('id', company.plan_id)
          .maybeSingle();

        if (planError || !plan) {
          setAiEnabled(false);
          return;
        }

        setAiEnabled(plan.ai_enabled);
      } catch (error) {
        console.error('Error checking AI enabled:', error);
        setAiEnabled(false);
      }
    };

    checkAiEnabled();

    const channel = supabase
      .channel(`ai-enabled-${companyId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'companies',
          filter: `id=eq.${companyId}`
        },
        () => {
          checkAiEnabled();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'plans'
        },
        () => {
          checkAiEnabled();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [companyId]);

  return aiEnabled;
}
