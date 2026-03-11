/*
  # Comprehensive Theme Settings Redesign
  
  This migration redesigns the theme_settings table to be a complete configuration system
  for company appearance, agent interface, customer-facing display, and system settings.

  ## 1. New Columns Added

  ### Visual Customization (Branding & Appearance)
  - `logo_primary_url` - Main company logo displayed in dashboard header
  - `logo_favicon_url` - Browser favicon/tab icon
  - `logo_email_url` - Logo used in email templates
  - `logo_chat_widget_url` - Logo displayed in customer chat widget
  - `font_family_primary` - Primary font for the interface (e.g., 'Inter', 'Roboto')
  - `font_family_secondary` - Secondary/accent font
  - `custom_css` - Custom CSS rules for advanced styling
  - `theme_mode` - Default theme: 'light', 'dark', 'auto', 'custom'
  - `border_radius` - Global border radius (e.g., '8px', '12px', '0px' for sharp)
  - `shadow_style` - Shadow intensity: 'none', 'subtle', 'medium', 'strong'

  ### Agent Interface Configuration (JSON)
  - `agent_interface_config` - Dashboard layout, tools, widgets configuration
    Structure: {
      layout: 'compact' | 'comfortable' | 'spacious',
      sidebar_position: 'left' | 'right',
      default_view: 'list' | 'grid' | 'kanban',
      enabled_modules: ['contacts', 'messages', 'analytics', 'reports'],
      quick_actions: ['transfer', 'tag', 'archive', 'priority'],
      notification_preferences: {
        sound_enabled: boolean,
        desktop_notifications: boolean,
        badge_count: boolean
      },
      dashboard_widgets: ['recent_contacts', 'active_chats', 'statistics']
    }

  ### Customer-Facing Display (JSON)
  - `customer_display_config` - Public interface and chat widget settings
    Structure: {
      chat_widget: {
        position: 'bottom-right' | 'bottom-left',
        bubble_color: '#hex',
        bubble_icon: 'chat' | 'help' | 'support',
        greeting_message: string,
        show_agent_avatars: boolean,
        show_typing_indicator: boolean,
        auto_open: boolean,
        auto_open_delay: number (seconds)
      },
      form_settings: {
        show_company_logo: boolean,
        require_name: boolean,
        require_email: boolean,
        custom_fields: [{name, type, required}]
      },
      localization: {
        default_language: 'pt-BR' | 'en-US' | 'es-ES',
        available_languages: string[],
        timezone: string
      }
    }

  ### System Configuration (JSON)
  - `system_config` - Feature flags, business rules, automation
    Structure: {
      features: {
        ai_enabled: boolean,
        auto_translation: boolean,
        file_attachments: boolean,
        voice_messages: boolean,
        video_calls: boolean,
        screen_sharing: boolean
      },
      business_hours: {
        enabled: boolean,
        timezone: string,
        schedule: {[day]: {open, close}},
        auto_reply_outside_hours: boolean,
        outside_hours_message: string
      },
      automation: {
        auto_assignment: boolean,
        round_robin: boolean,
        smart_routing: boolean,
        auto_close_inactive: boolean,
        inactive_timeout_hours: number
      },
      limits: {
        max_file_size_mb: number,
        max_attachments_per_message: number,
        max_active_chats_per_agent: number
      }
    }

  ### Integration Settings (JSON - Encrypted sensitive data separately)
  - `integration_config` - Third-party integrations and API keys
    Structure: {
      whatsapp: {enabled: boolean, webhook_url: string},
      telegram: {enabled: boolean, webhook_url: string},
      email: {enabled: boolean, smtp_host: string, smtp_port: number},
      analytics: {enabled: boolean, tracking_id: string},
      crm: {enabled: boolean, provider: string, sync_enabled: boolean}
    }

  ### Versioning & Metadata
  - `settings_version` - Version number for tracking configuration changes
  - `last_modified_by` - User ID who last modified settings
  - `change_history` - JSONB array of change records with timestamps and user info

  ## 2. Indexes
  - Index on company_id (already exists)
  - GIN index on JSONB columns for efficient querying
  - Index on settings_version for versioning queries

  ## 3. Security
  - All existing RLS policies remain active
  - New trigger for version tracking
*/

-- Add Visual Customization columns
ALTER TABLE theme_settings 
  ADD COLUMN IF NOT EXISTS logo_primary_url text,
  ADD COLUMN IF NOT EXISTS logo_favicon_url text,
  ADD COLUMN IF NOT EXISTS logo_email_url text,
  ADD COLUMN IF NOT EXISTS logo_chat_widget_url text,
  ADD COLUMN IF NOT EXISTS font_family_primary text DEFAULT 'Inter, system-ui, sans-serif',
  ADD COLUMN IF NOT EXISTS font_family_secondary text DEFAULT 'Inter, system-ui, sans-serif',
  ADD COLUMN IF NOT EXISTS custom_css text,
  ADD COLUMN IF NOT EXISTS theme_mode text DEFAULT 'light' CHECK (theme_mode IN ('light', 'dark', 'auto', 'custom')),
  ADD COLUMN IF NOT EXISTS border_radius text DEFAULT '8px',
  ADD COLUMN IF NOT EXISTS shadow_style text DEFAULT 'medium' CHECK (shadow_style IN ('none', 'subtle', 'medium', 'strong'));

-- Add Configuration JSON columns
ALTER TABLE theme_settings
  ADD COLUMN IF NOT EXISTS agent_interface_config jsonb DEFAULT '{
    "layout": "comfortable",
    "sidebar_position": "left",
    "default_view": "list",
    "enabled_modules": ["contacts", "messages", "departments", "sectors", "tags"],
    "quick_actions": ["transfer", "tag", "priority"],
    "notification_preferences": {
      "sound_enabled": true,
      "desktop_notifications": true,
      "badge_count": true
    },
    "dashboard_widgets": ["recent_contacts", "active_chats", "statistics"]
  }'::jsonb,
  
  ADD COLUMN IF NOT EXISTS customer_display_config jsonb DEFAULT '{
    "chat_widget": {
      "position": "bottom-right",
      "bubble_color": "#3b82f6",
      "bubble_icon": "chat",
      "greeting_message": "Olá! Como podemos ajudar?",
      "show_agent_avatars": true,
      "show_typing_indicator": true,
      "auto_open": false,
      "auto_open_delay": 3
    },
    "form_settings": {
      "show_company_logo": true,
      "require_name": true,
      "require_email": false,
      "custom_fields": []
    },
    "localization": {
      "default_language": "pt-BR",
      "available_languages": ["pt-BR", "en-US"],
      "timezone": "America/Sao_Paulo"
    }
  }'::jsonb,
  
  ADD COLUMN IF NOT EXISTS system_config jsonb DEFAULT '{
    "features": {
      "ai_enabled": true,
      "auto_translation": false,
      "file_attachments": true,
      "voice_messages": true,
      "video_calls": false,
      "screen_sharing": false
    },
    "business_hours": {
      "enabled": false,
      "timezone": "America/Sao_Paulo",
      "schedule": {
        "monday": {"open": "09:00", "close": "18:00"},
        "tuesday": {"open": "09:00", "close": "18:00"},
        "wednesday": {"open": "09:00", "close": "18:00"},
        "thursday": {"open": "09:00", "close": "18:00"},
        "friday": {"open": "09:00", "close": "18:00"}
      },
      "auto_reply_outside_hours": false,
      "outside_hours_message": "No momento estamos fora do horário de atendimento."
    },
    "automation": {
      "auto_assignment": true,
      "round_robin": false,
      "smart_routing": false,
      "auto_close_inactive": false,
      "inactive_timeout_hours": 24
    },
    "limits": {
      "max_file_size_mb": 10,
      "max_attachments_per_message": 5,
      "max_active_chats_per_agent": 10
    }
  }'::jsonb,
  
  ADD COLUMN IF NOT EXISTS integration_config jsonb DEFAULT '{
    "whatsapp": {"enabled": true, "webhook_url": ""},
    "telegram": {"enabled": false, "webhook_url": ""},
    "email": {"enabled": false, "smtp_host": "", "smtp_port": 587},
    "analytics": {"enabled": false, "tracking_id": ""},
    "crm": {"enabled": false, "provider": "", "sync_enabled": false}
  }'::jsonb;

-- Add Versioning & Metadata columns
ALTER TABLE theme_settings
  ADD COLUMN IF NOT EXISTS settings_version integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS last_modified_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS change_history jsonb DEFAULT '[]'::jsonb;

-- Migrate existing logo_url to logo_primary_url
UPDATE theme_settings 
SET logo_primary_url = logo_url 
WHERE logo_url IS NOT NULL AND logo_primary_url IS NULL;

-- Create GIN indexes for JSONB columns for efficient querying
CREATE INDEX IF NOT EXISTS idx_theme_settings_agent_config ON theme_settings USING GIN (agent_interface_config);
CREATE INDEX IF NOT EXISTS idx_theme_settings_customer_config ON theme_settings USING GIN (customer_display_config);
CREATE INDEX IF NOT EXISTS idx_theme_settings_system_config ON theme_settings USING GIN (system_config);
CREATE INDEX IF NOT EXISTS idx_theme_settings_integration_config ON theme_settings USING GIN (integration_config);
CREATE INDEX IF NOT EXISTS idx_theme_settings_version ON theme_settings(settings_version);

-- Create function to track version changes
CREATE OR REPLACE FUNCTION track_theme_settings_changes()
RETURNS TRIGGER AS $$
BEGIN
  -- Increment version
  NEW.settings_version = OLD.settings_version + 1;
  
  -- Track who made the change
  NEW.last_modified_by = auth.uid();
  
  -- Add to change history (keep last 50 changes)
  NEW.change_history = (
    SELECT jsonb_agg(item)
    FROM (
      SELECT item
      FROM jsonb_array_elements(
        NEW.change_history || jsonb_build_object(
          'version', OLD.settings_version,
          'modified_at', OLD.updated_at,
          'modified_by', auth.uid(),
          'changes', jsonb_build_object(
            'old_primary_color', OLD.primary_color,
            'new_primary_color', NEW.primary_color
          )
        )
      ) AS item
      ORDER BY (item->>'modified_at')::timestamptz DESC
      LIMIT 50
    ) sub
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for version tracking
DROP TRIGGER IF EXISTS track_theme_settings_changes_trigger ON theme_settings;
CREATE TRIGGER track_theme_settings_changes_trigger
  BEFORE UPDATE ON theme_settings
  FOR EACH ROW
  EXECUTE FUNCTION track_theme_settings_changes();

-- Add helpful comments to the table
COMMENT ON TABLE theme_settings IS 'Comprehensive configuration settings for company appearance, agent interface, customer display, and system behavior';

COMMENT ON COLUMN theme_settings.logo_primary_url IS 'Main company logo displayed in dashboard header and navigation';
COMMENT ON COLUMN theme_settings.logo_favicon_url IS 'Browser favicon/tab icon (16x16 or 32x32 px)';
COMMENT ON COLUMN theme_settings.logo_email_url IS 'Logo used in email templates and notifications';
COMMENT ON COLUMN theme_settings.logo_chat_widget_url IS 'Logo displayed in customer-facing chat widget';
COMMENT ON COLUMN theme_settings.font_family_primary IS 'Primary font family for the interface';
COMMENT ON COLUMN theme_settings.custom_css IS 'Custom CSS rules for advanced styling (applied globally)';
COMMENT ON COLUMN theme_settings.theme_mode IS 'Default theme mode: light, dark, auto (follows system), or custom';
COMMENT ON COLUMN theme_settings.border_radius IS 'Global border radius for UI elements (e.g., 8px, 12px, 0px)';
COMMENT ON COLUMN theme_settings.shadow_style IS 'Shadow intensity for UI elements: none, subtle, medium, strong';

COMMENT ON COLUMN theme_settings.agent_interface_config IS 'Agent dashboard configuration: layout, tools, widgets, notifications';
COMMENT ON COLUMN theme_settings.customer_display_config IS 'Customer-facing settings: chat widget, forms, localization';
COMMENT ON COLUMN theme_settings.system_config IS 'System settings: features, business hours, automation, limits';
COMMENT ON COLUMN theme_settings.integration_config IS 'Third-party integrations: WhatsApp, Telegram, email, analytics, CRM';

COMMENT ON COLUMN theme_settings.settings_version IS 'Version number incremented with each update for change tracking';
COMMENT ON COLUMN theme_settings.last_modified_by IS 'User ID of the person who last modified these settings';
COMMENT ON COLUMN theme_settings.change_history IS 'Array of historical changes with timestamps (last 50 changes)';
