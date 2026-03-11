-- COMPLETE THEME_SETTINGS TABLE SCHEMA
-- Generated: 2026-02-14
-- This file documents the complete structure of the theme_settings table

/*
  TABLE: theme_settings

  Purpose: Comprehensive configuration system for company appearance,
           agent interface, customer-facing display, and system behavior.

  One record per company (UNIQUE constraint on company_id)
*/

-- ============================================================================
-- BASIC COLUMNS
-- ============================================================================

id                      UUID PRIMARY KEY DEFAULT gen_random_uuid()
company_id              UUID NOT NULL UNIQUE REFERENCES companies(id) ON DELETE CASCADE

created_at              TIMESTAMPTZ DEFAULT now()
updated_at              TIMESTAMPTZ DEFAULT now()

-- ============================================================================
-- VISUAL CUSTOMIZATION - COLORS
-- ============================================================================

-- Brand Colors
primary_color           TEXT DEFAULT '#3b82f6'      -- Main brand color
secondary_color         TEXT DEFAULT '#1e40af'      -- Secondary brand color
accent_color            TEXT DEFAULT '#60a5fa'      -- Accent/highlight color
background_color        TEXT DEFAULT '#ffffff'      -- Main background
text_color              TEXT DEFAULT '#1e293b'      -- Default text color

-- Message Colors
incoming_message_color  TEXT DEFAULT '#f1f5f9'      -- Customer message background
outgoing_message_color  TEXT DEFAULT '#3b82f6'      -- Agent message background
incoming_text_color     TEXT DEFAULT '#1e293b'      -- Customer message text
outgoing_text_color     TEXT DEFAULT '#ffffff'      -- Agent message text

-- ============================================================================
-- VISUAL CUSTOMIZATION - BRANDING
-- ============================================================================

display_name            TEXT                        -- Company display name
logo_url                TEXT                        -- Legacy logo field (maintained for compatibility)
logo_primary_url        TEXT                        -- Main logo (dashboard header)
logo_favicon_url        TEXT                        -- Browser favicon (16x16 or 32x32px)
logo_email_url          TEXT                        -- Logo for email templates
logo_chat_widget_url    TEXT                        -- Logo for customer chat widget

-- ============================================================================
-- VISUAL CUSTOMIZATION - TYPOGRAPHY & STYLE
-- ============================================================================

font_family_primary     TEXT DEFAULT 'Inter, system-ui, sans-serif'
font_family_secondary   TEXT DEFAULT 'Inter, system-ui, sans-serif'
custom_css              TEXT                        -- Custom CSS rules
theme_mode              TEXT DEFAULT 'light'        -- 'light' | 'dark' | 'auto' | 'custom'
                        CHECK (theme_mode IN ('light', 'dark', 'auto', 'custom'))
border_radius           TEXT DEFAULT '8px'          -- Global border radius
shadow_style            TEXT DEFAULT 'medium'       -- 'none' | 'subtle' | 'medium' | 'strong'
                        CHECK (shadow_style IN ('none', 'subtle', 'medium', 'strong'))

-- ============================================================================
-- COMPLEX CONFIGURATIONS (JSONB)
-- ============================================================================

/*
  agent_interface_config JSONB

  Structure: {
    "layout": "comfortable",              // "compact" | "comfortable" | "spacious"
    "sidebar_position": "left",           // "left" | "right"
    "default_view": "list",               // "list" | "grid" | "kanban"
    "enabled_modules": ["contacts", "messages", ...],
    "quick_actions": ["transfer", "tag", ...],
    "notification_preferences": {
      "sound_enabled": true,
      "desktop_notifications": true,
      "badge_count": true
    },
    "dashboard_widgets": ["recent_contacts", ...]
  }
*/
agent_interface_config  JSONB DEFAULT '{ ... }'::jsonb

/*
  customer_display_config JSONB

  Structure: {
    "chat_widget": {
      "position": "bottom-right",
      "bubble_color": "#3b82f6",
      "bubble_icon": "chat",
      "greeting_message": "...",
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
  }
*/
customer_display_config JSONB DEFAULT '{ ... }'::jsonb

/*
  system_config JSONB

  Structure: {
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
      "schedule": { ... },
      "auto_reply_outside_hours": false,
      "outside_hours_message": "..."
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
  }
*/
system_config           JSONB DEFAULT '{ ... }'::jsonb

/*
  integration_config JSONB

  Structure: {
    "whatsapp": {"enabled": true, "webhook_url": ""},
    "telegram": {"enabled": false, "webhook_url": ""},
    "email": {"enabled": false, "smtp_host": "", "smtp_port": 587},
    "analytics": {"enabled": false, "tracking_id": ""},
    "crm": {"enabled": false, "provider": "", "sync_enabled": false}
  }
*/
integration_config      JSONB DEFAULT '{ ... }'::jsonb

-- ============================================================================
-- VERSIONING & METADATA
-- ============================================================================

settings_version        INTEGER DEFAULT 1           -- Auto-incremented on updates
last_modified_by        UUID REFERENCES auth.users(id)
change_history          JSONB DEFAULT '[]'::jsonb   -- Last 50 changes

-- ============================================================================
-- INDEXES
-- ============================================================================

-- B-tree indexes for direct column lookups
CREATE INDEX idx_theme_settings_company_id ON theme_settings(company_id);
CREATE INDEX idx_theme_settings_version ON theme_settings(settings_version);

-- GIN indexes for JSONB column queries (efficient nested value searches)
CREATE INDEX idx_theme_settings_agent_config ON theme_settings USING GIN(agent_interface_config);
CREATE INDEX idx_theme_settings_customer_config ON theme_settings USING GIN(customer_display_config);
CREATE INDEX idx_theme_settings_system_config ON theme_settings USING GIN(system_config);
CREATE INDEX idx_theme_settings_integration_config ON theme_settings USING GIN(integration_config);

-- ============================================================================
-- CONSTRAINTS
-- ============================================================================

-- One settings record per company
UNIQUE(company_id)

-- Cascade delete when company is deleted
FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE

-- Valid theme modes only
CHECK (theme_mode IN ('light', 'dark', 'auto', 'custom'))

-- Valid shadow styles only
CHECK (shadow_style IN ('none', 'subtle', 'medium', 'strong'))

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Auto-update updated_at timestamp
CREATE TRIGGER update_theme_settings_updated_at_trigger
  BEFORE UPDATE ON theme_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_theme_settings_updated_at();

-- Track version changes and build change history
CREATE TRIGGER track_theme_settings_changes_trigger
  BEFORE UPDATE ON theme_settings
  FOR EACH ROW
  EXECUTE FUNCTION track_theme_settings_changes();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

ALTER TABLE theme_settings ENABLE ROW LEVEL SECURITY;

-- Companies can read their own settings
CREATE POLICY "Companies can read own theme settings"
  ON theme_settings FOR SELECT TO authenticated
  USING (company_id IN (SELECT id FROM companies WHERE user_id = auth.uid()));

-- Companies can insert their settings
CREATE POLICY "Companies can insert own theme settings"
  ON theme_settings FOR INSERT TO authenticated
  WITH CHECK (company_id IN (SELECT id FROM companies WHERE user_id = auth.uid()));

-- Companies can update their own settings
CREATE POLICY "Companies can update own theme settings"
  ON theme_settings FOR UPDATE TO authenticated
  USING (company_id IN (SELECT id FROM companies WHERE user_id = auth.uid()))
  WITH CHECK (company_id IN (SELECT id FROM companies WHERE user_id = auth.uid()));

-- Attendants can read their company's settings
CREATE POLICY "Attendants can read company theme settings"
  ON theme_settings FOR SELECT TO authenticated
  USING (company_id IN (SELECT company_id FROM attendants WHERE user_id = auth.uid()));

-- Super admins can read all settings
CREATE POLICY "Super admins can read all theme settings"
  ON theme_settings FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM super_admins WHERE user_id = auth.uid()));

-- Super admins can update all settings
CREATE POLICY "Super admins can update all theme settings"
  ON theme_settings FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM super_admins WHERE user_id = auth.uid()));

-- ============================================================================
-- USAGE EXAMPLES
-- ============================================================================

-- Get all settings for a company
SELECT * FROM theme_settings WHERE company_id = 'uuid-here';

-- Update simple color values
UPDATE theme_settings
SET primary_color = '#10b981', accent_color = '#059669'
WHERE company_id = 'uuid-here';

-- Check if AI is enabled (JSONB query)
SELECT company_id, system_config->'features'->>'ai_enabled' as ai_enabled
FROM theme_settings;

-- Enable a feature (JSONB update)
UPDATE theme_settings
SET system_config = jsonb_set(
  system_config,
  '{features,video_calls}',
  'true'::jsonb
)
WHERE company_id = 'uuid-here';

-- Find companies using compact layout
SELECT company_id, display_name
FROM theme_settings
WHERE agent_interface_config->>'layout' = 'compact';

-- Export settings as JSON
SELECT row_to_json(theme_settings.*)
FROM theme_settings
WHERE company_id = 'uuid-here';
