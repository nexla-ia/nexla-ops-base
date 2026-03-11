/**
 * Theme Settings Helper Functions
 * Utility functions for reading, updating, and managing comprehensive theme settings
 */

import { supabase } from './supabase';
import {
  ThemeSettings,
  AgentInterfaceConfig,
  CustomerDisplayConfig,
  SystemConfig,
  IntegrationConfig,
  DEFAULT_AGENT_INTERFACE_CONFIG,
  DEFAULT_CUSTOMER_DISPLAY_CONFIG,
  DEFAULT_SYSTEM_CONFIG,
  DEFAULT_INTEGRATION_CONFIG,
} from '../types/themeSettings';

/**
 * Fetch complete theme settings for a company
 */
export async function getThemeSettings(companyId: string): Promise<ThemeSettings | null> {
  try {
    const { data, error } = await supabase
      .from('theme_settings')
      .select('*')
      .eq('company_id', companyId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching theme settings:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error in getThemeSettings:', error);
    return null;
  }
}

/**
 * Update specific visual settings (colors, logos, fonts)
 */
export async function updateVisualSettings(
  companyId: string,
  settings: Partial<Pick<ThemeSettings,
    'primary_color' | 'secondary_color' | 'accent_color' |
    'incoming_message_color' | 'outgoing_message_color' |
    'incoming_text_color' | 'outgoing_text_color' |
    'logo_primary_url' | 'logo_favicon_url' | 'logo_email_url' |
    'logo_chat_widget_url' | 'display_name' | 'font_family_primary' |
    'font_family_secondary' | 'theme_mode' | 'border_radius' | 'shadow_style'
  >>
) {
  try {
    const { data, error } = await supabase
      .from('theme_settings')
      .update(settings)
      .eq('company_id', companyId)
      .select()
      .single();

    if (error) {
      console.error('Error updating visual settings:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Error in updateVisualSettings:', error);
    throw error;
  }
}

/**
 * Update agent interface configuration
 */
export async function updateAgentInterfaceConfig(
  companyId: string,
  config: Partial<AgentInterfaceConfig>
) {
  try {
    // Fetch current config
    const current = await getThemeSettings(companyId);
    const currentConfig = current?.agent_interface_config || DEFAULT_AGENT_INTERFACE_CONFIG;

    // Merge with new config
    const mergedConfig = {
      ...currentConfig,
      ...config,
      notification_preferences: {
        ...currentConfig.notification_preferences,
        ...(config.notification_preferences || {}),
      },
    };

    const { data, error } = await supabase
      .from('theme_settings')
      .update({ agent_interface_config: mergedConfig })
      .eq('company_id', companyId)
      .select()
      .single();

    if (error) {
      console.error('Error updating agent interface config:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Error in updateAgentInterfaceConfig:', error);
    throw error;
  }
}

/**
 * Update customer display configuration
 */
export async function updateCustomerDisplayConfig(
  companyId: string,
  config: Partial<CustomerDisplayConfig>
) {
  try {
    const current = await getThemeSettings(companyId);
    const currentConfig = current?.customer_display_config || DEFAULT_CUSTOMER_DISPLAY_CONFIG;

    const mergedConfig = {
      ...currentConfig,
      ...config,
      chat_widget: {
        ...currentConfig.chat_widget,
        ...(config.chat_widget || {}),
      },
      form_settings: {
        ...currentConfig.form_settings,
        ...(config.form_settings || {}),
      },
      localization: {
        ...currentConfig.localization,
        ...(config.localization || {}),
      },
    };

    const { data, error } = await supabase
      .from('theme_settings')
      .update({ customer_display_config: mergedConfig })
      .eq('company_id', companyId)
      .select()
      .single();

    if (error) {
      console.error('Error updating customer display config:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Error in updateCustomerDisplayConfig:', error);
    throw error;
  }
}

/**
 * Update system configuration
 */
export async function updateSystemConfig(
  companyId: string,
  config: Partial<SystemConfig>
) {
  try {
    const current = await getThemeSettings(companyId);
    const currentConfig = current?.system_config || DEFAULT_SYSTEM_CONFIG;

    const mergedConfig = {
      ...currentConfig,
      ...config,
      features: {
        ...currentConfig.features,
        ...(config.features || {}),
      },
      business_hours: {
        ...currentConfig.business_hours,
        ...(config.business_hours || {}),
      },
      automation: {
        ...currentConfig.automation,
        ...(config.automation || {}),
      },
      limits: {
        ...currentConfig.limits,
        ...(config.limits || {}),
      },
    };

    const { data, error } = await supabase
      .from('theme_settings')
      .update({ system_config: mergedConfig })
      .eq('company_id', companyId)
      .select()
      .single();

    if (error) {
      console.error('Error updating system config:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Error in updateSystemConfig:', error);
    throw error;
  }
}

/**
 * Update integration configuration
 */
export async function updateIntegrationConfig(
  companyId: string,
  config: Partial<IntegrationConfig>
) {
  try {
    const current = await getThemeSettings(companyId);
    const currentConfig = current?.integration_config || DEFAULT_INTEGRATION_CONFIG;

    const mergedConfig = {
      ...currentConfig,
      ...config,
      whatsapp: {
        ...currentConfig.whatsapp,
        ...(config.whatsapp || {}),
      },
      telegram: {
        ...currentConfig.telegram,
        ...(config.telegram || {}),
      },
      email: {
        ...currentConfig.email,
        ...(config.email || {}),
      },
      analytics: {
        ...currentConfig.analytics,
        ...(config.analytics || {}),
      },
      crm: {
        ...currentConfig.crm,
        ...(config.crm || {}),
      },
    };

    const { data, error } = await supabase
      .from('theme_settings')
      .update({ integration_config: mergedConfig })
      .eq('company_id', companyId)
      .select()
      .single();

    if (error) {
      console.error('Error updating integration config:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Error in updateIntegrationConfig:', error);
    throw error;
  }
}

/**
 * Create initial theme settings for a new company
 */
export async function createInitialThemeSettings(companyId: string, displayName: string) {
  try {
    const { data, error } = await supabase
      .from('theme_settings')
      .insert({
        company_id: companyId,
        display_name: displayName,
        logo_primary_url: '',
        primary_color: '#3b82f6',
        secondary_color: '#1e40af',
        accent_color: '#60a5fa',
        background_color: '#ffffff',
        text_color: '#1e293b',
        incoming_message_color: '#f1f5f9',
        outgoing_message_color: '#3b82f6',
        incoming_text_color: '#1e293b',
        outgoing_text_color: '#ffffff',
        font_family_primary: 'Inter, system-ui, sans-serif',
        font_family_secondary: 'Inter, system-ui, sans-serif',
        theme_mode: 'light',
        border_radius: '8px',
        shadow_style: 'medium',
        agent_interface_config: DEFAULT_AGENT_INTERFACE_CONFIG,
        customer_display_config: DEFAULT_CUSTOMER_DISPLAY_CONFIG,
        system_config: DEFAULT_SYSTEM_CONFIG,
        integration_config: DEFAULT_INTEGRATION_CONFIG,
        settings_version: 1,
        change_history: [],
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating initial theme settings:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Error in createInitialThemeSettings:', error);
    throw error;
  }
}

/**
 * Check if a feature is enabled
 */
export async function isFeatureEnabled(companyId: string, featureName: keyof SystemConfig['features']): Promise<boolean> {
  try {
    const settings = await getThemeSettings(companyId);
    if (!settings) return false;

    return settings.system_config?.features?.[featureName] ?? false;
  } catch (error) {
    console.error('Error checking feature:', error);
    return false;
  }
}

/**
 * Get business hours status (open/closed)
 */
export function isWithinBusinessHours(config: SystemConfig): boolean {
  if (!config.business_hours.enabled) return true;

  const now = new Date();
  const dayName = now.toLocaleDateString('en-US', { weekday: 'lowercase' });
  const schedule = config.business_hours.schedule[dayName];

  if (!schedule) return false;

  const currentTime = now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });

  return currentTime >= schedule.open && currentTime <= schedule.close;
}

/**
 * Export all settings as JSON for backup
 */
export async function exportThemeSettings(companyId: string): Promise<string> {
  try {
    const settings = await getThemeSettings(companyId);
    if (!settings) throw new Error('Settings not found');

    return JSON.stringify(settings, null, 2);
  } catch (error) {
    console.error('Error exporting theme settings:', error);
    throw error;
  }
}

/**
 * Import settings from JSON backup
 */
export async function importThemeSettings(companyId: string, jsonData: string) {
  try {
    const settings = JSON.parse(jsonData) as Partial<ThemeSettings>;

    // Remove fields that shouldn't be imported
    delete settings.id;
    delete settings.company_id;
    delete settings.created_at;
    delete settings.updated_at;
    delete settings.settings_version;
    delete settings.last_modified_by;

    const { data, error } = await supabase
      .from('theme_settings')
      .update(settings)
      .eq('company_id', companyId)
      .select()
      .single();

    if (error) {
      console.error('Error importing theme settings:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Error in importThemeSettings:', error);
    throw error;
  }
}
