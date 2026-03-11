import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { ThemeSettings } from '../types/themeSettings';

export function useThemeSettings(companyId: string | null) {
  const [themeSettings, setThemeSettings] = useState<ThemeSettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!companyId) {
      setLoading(false);
      return;
    }

    const loadThemeSettings = async () => {
      try {
        const { data, error } = await supabase
          .from('theme_settings')
          .select('*')
          .eq('company_id', companyId)
          .maybeSingle();

        if (error) throw error;

        if (data) {
          setThemeSettings(data);
        }
      } catch (error) {
        console.error('Error loading theme settings:', error);
      } finally {
        setLoading(false);
      }
    };

    loadThemeSettings();

    const channel = supabase
      .channel(`theme_settings:${companyId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'theme_settings',
          filter: `company_id=eq.${companyId}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            setThemeSettings(payload.new as ThemeSettings);
          } else if (payload.eventType === 'DELETE') {
            setThemeSettings(null);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [companyId]);

  return { themeSettings, loading };
}
