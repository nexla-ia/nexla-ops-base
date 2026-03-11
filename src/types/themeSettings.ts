/**
 * Comprehensive Theme Settings Types
 * Defines all configuration options for company appearance, agent interface,
 * customer-facing display, and system behavior.
 */

export type ThemeMode = 'light' | 'dark' | 'auto' | 'custom';
export type ShadowStyle = 'none' | 'subtle' | 'medium' | 'strong';
export type LayoutType = 'compact' | 'comfortable' | 'spacious';
export type ViewType = 'list' | 'grid' | 'kanban';
export type SidebarPosition = 'left' | 'right';
export type ChatWidgetPosition = 'bottom-right' | 'bottom-left';
export type BubbleIcon = 'chat' | 'help' | 'support';

/**
 * Agent Interface Configuration
 * Controls the dashboard layout, available tools, and notifications
 */
export interface AgentInterfaceConfig {
  layout: LayoutType;
  sidebar_position: SidebarPosition;
  default_view: ViewType;
  enabled_modules: string[];
  quick_actions: string[];
  notification_preferences: {
    sound_enabled: boolean;
    desktop_notifications: boolean;
    badge_count: boolean;
  };
  dashboard_widgets: string[];
}

/**
 * Customer Display Configuration
 * Controls the chat widget, forms, and localization settings
 */
export interface CustomerDisplayConfig {
  chat_widget: {
    position: ChatWidgetPosition;
    bubble_color: string;
    bubble_icon: BubbleIcon;
    greeting_message: string;
    show_agent_avatars: boolean;
    show_typing_indicator: boolean;
    auto_open: boolean;
    auto_open_delay: number;
  };
  form_settings: {
    show_company_logo: boolean;
    require_name: boolean;
    require_email: boolean;
    custom_fields: Array<{
      name: string;
      type: string;
      required: boolean;
    }>;
  };
  localization: {
    default_language: string;
    available_languages: string[];
    timezone: string;
  };
}

/**
 * System Configuration
 * Controls features, business hours, automation, and limits
 */
export interface SystemConfig {
  features: {
    ai_enabled: boolean;
    auto_translation: boolean;
    file_attachments: boolean;
    voice_messages: boolean;
    video_calls: boolean;
    screen_sharing: boolean;
  };
  business_hours: {
    enabled: boolean;
    timezone: string;
    schedule: {
      [day: string]: {
        open: string;
        close: string;
      };
    };
    auto_reply_outside_hours: boolean;
    outside_hours_message: string;
  };
  automation: {
    auto_assignment: boolean;
    round_robin: boolean;
    smart_routing: boolean;
    auto_close_inactive: boolean;
    inactive_timeout_hours: number;
  };
  limits: {
    max_file_size_mb: number;
    max_attachments_per_message: number;
    max_active_chats_per_agent: number;
  };
}

/**
 * Integration Configuration
 * Controls third-party integrations
 */
export interface IntegrationConfig {
  whatsapp: {
    enabled: boolean;
    webhook_url: string;
  };
  telegram: {
    enabled: boolean;
    webhook_url: string;
  };
  email: {
    enabled: boolean;
    smtp_host: string;
    smtp_port: number;
  };
  analytics: {
    enabled: boolean;
    tracking_id: string;
  };
  crm: {
    enabled: boolean;
    provider: string;
    sync_enabled: boolean;
  };
}

/**
 * Change History Entry
 * Tracks configuration changes over time
 */
export interface ChangeHistoryEntry {
  version: number;
  modified_at: string;
  modified_by: string;
  changes: Record<string, any>;
}

/**
 * Complete Theme Settings Interface
 * Represents all configuration options stored in the theme_settings table
 */
export interface ThemeSettings {
  // Database fields
  id?: string;
  company_id?: string;
  created_at?: string;
  updated_at?: string;

  // Visual Customization - Basic Colors (Legacy)
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  background_color: string;
  text_color: string;

  // Message Colors
  incoming_message_color: string;
  outgoing_message_color: string;
  incoming_text_color: string;
  outgoing_text_color: string;

  // Branding
  display_name: string;
  logo_url?: string; // Legacy field
  logo_primary_url: string;
  logo_favicon_url?: string;
  logo_email_url?: string;
  logo_chat_widget_url?: string;

  // Typography & Styling
  font_family_primary: string;
  font_family_secondary: string;
  custom_css?: string;
  theme_mode: ThemeMode;
  border_radius: string;
  shadow_style: ShadowStyle;

  // Complex Configurations (JSONB)
  agent_interface_config: AgentInterfaceConfig;
  customer_display_config: CustomerDisplayConfig;
  system_config: SystemConfig;
  integration_config: IntegrationConfig;

  // Versioning & Metadata
  settings_version: number;
  last_modified_by?: string;
  change_history: ChangeHistoryEntry[];
}

/**
 * Simplified Theme Settings for UI Components
 * Used in the ThemeContext for easier consumption
 */
export interface SimpleThemeSettings {
  displayName: string;
  logoUrl: string;
  incomingMessageColor: string;
  outgoingMessageColor: string;
  incomingTextColor: string;
  outgoingTextColor: string;
  primaryColor: string;
  accentColor: string;
}

/**
 * Default configurations for new companies
 */
export const DEFAULT_AGENT_INTERFACE_CONFIG: AgentInterfaceConfig = {
  layout: 'comfortable',
  sidebar_position: 'left',
  default_view: 'list',
  enabled_modules: ['contacts', 'messages', 'departments', 'sectors', 'tags'],
  quick_actions: ['transfer', 'tag', 'priority'],
  notification_preferences: {
    sound_enabled: true,
    desktop_notifications: true,
    badge_count: true,
  },
  dashboard_widgets: ['recent_contacts', 'active_chats', 'statistics'],
};

export const DEFAULT_CUSTOMER_DISPLAY_CONFIG: CustomerDisplayConfig = {
  chat_widget: {
    position: 'bottom-right',
    bubble_color: '#3b82f6',
    bubble_icon: 'chat',
    greeting_message: 'Olá! Como podemos ajudar?',
    show_agent_avatars: true,
    show_typing_indicator: true,
    auto_open: false,
    auto_open_delay: 3,
  },
  form_settings: {
    show_company_logo: true,
    require_name: true,
    require_email: false,
    custom_fields: [],
  },
  localization: {
    default_language: 'pt-BR',
    available_languages: ['pt-BR', 'en-US'],
    timezone: 'America/Sao_Paulo',
  },
};

export const DEFAULT_SYSTEM_CONFIG: SystemConfig = {
  features: {
    ai_enabled: true,
    auto_translation: false,
    file_attachments: true,
    voice_messages: true,
    video_calls: false,
    screen_sharing: false,
  },
  business_hours: {
    enabled: false,
    timezone: 'America/Sao_Paulo',
    schedule: {
      monday: { open: '09:00', close: '18:00' },
      tuesday: { open: '09:00', close: '18:00' },
      wednesday: { open: '09:00', close: '18:00' },
      thursday: { open: '09:00', close: '18:00' },
      friday: { open: '09:00', close: '18:00' },
    },
    auto_reply_outside_hours: false,
    outside_hours_message: 'No momento estamos fora do horário de atendimento.',
  },
  automation: {
    auto_assignment: true,
    round_robin: false,
    smart_routing: false,
    auto_close_inactive: false,
    inactive_timeout_hours: 24,
  },
  limits: {
    max_file_size_mb: 10,
    max_attachments_per_message: 5,
    max_active_chats_per_agent: 10,
  },
};

export const DEFAULT_INTEGRATION_CONFIG: IntegrationConfig = {
  whatsapp: { enabled: true, webhook_url: '' },
  telegram: { enabled: false, webhook_url: '' },
  email: { enabled: false, smtp_host: '', smtp_port: 587 },
  analytics: { enabled: false, tracking_id: '' },
  crm: { enabled: false, provider: '', sync_enabled: false },
};
