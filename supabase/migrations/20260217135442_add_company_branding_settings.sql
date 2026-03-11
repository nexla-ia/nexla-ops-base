/*
  # Add Company Branding and Visual Settings

  ## 1. New Columns Added
  
  ### Chat Background
  - `background_type` - Tipo do fundo: 'color' ou 'image'
  - `background_color` - Cor de fundo do chat (hex color)
  - `background_image_url` - URL da imagem de fundo do chat (tamanho recomendado: 1920x1080px)
  
  ### Message Bubbles
  - `message_bubble_sent_color` - Cor dos balões de mensagens enviadas (hex color)
  - `message_bubble_sent_text_color` - Cor do texto das mensagens enviadas (hex color)
  - `message_bubble_received_color` - Cor dos balões de mensagens recebidas (hex color)
  - `message_bubble_received_text_color` - Cor do texto das mensagens recebidas (hex color)
  
  ### Company Branding
  - `company_name` - Nome da empresa exibido no header
  
  ## 2. Notes
  - Todas as configurações são aplicadas globalmente para a companhia
  - Tamanho recomendado para background: 1920x1080px (Full HD)
  - Tamanho recomendado para logo: 200x60px (largura x altura)
*/

-- Add chat background settings
ALTER TABLE theme_settings
  ADD COLUMN IF NOT EXISTS background_type text DEFAULT 'color' CHECK (background_type IN ('color', 'image')),
  ADD COLUMN IF NOT EXISTS background_color text DEFAULT '#f8fafc',
  ADD COLUMN IF NOT EXISTS background_image_url text;

-- Add message bubble colors
ALTER TABLE theme_settings
  ADD COLUMN IF NOT EXISTS message_bubble_sent_color text DEFAULT '#3b82f6',
  ADD COLUMN IF NOT EXISTS message_bubble_sent_text_color text DEFAULT '#ffffff',
  ADD COLUMN IF NOT EXISTS message_bubble_received_color text DEFAULT '#ffffff',
  ADD COLUMN IF NOT EXISTS message_bubble_received_text_color text DEFAULT '#1e293b';

-- Add company branding
ALTER TABLE theme_settings
  ADD COLUMN IF NOT EXISTS company_name text;

-- Add comments
COMMENT ON COLUMN theme_settings.background_type IS 'Tipo de fundo do chat: color (cor sólida) ou image (imagem)';
COMMENT ON COLUMN theme_settings.background_color IS 'Cor de fundo do chat quando background_type é color';
COMMENT ON COLUMN theme_settings.background_image_url IS 'URL da imagem de fundo (recomendado: 1920x1080px)';
COMMENT ON COLUMN theme_settings.message_bubble_sent_color IS 'Cor de fundo dos balões de mensagens enviadas';
COMMENT ON COLUMN theme_settings.message_bubble_sent_text_color IS 'Cor do texto das mensagens enviadas';
COMMENT ON COLUMN theme_settings.message_bubble_received_color IS 'Cor de fundo dos balões de mensagens recebidas';
COMMENT ON COLUMN theme_settings.message_bubble_received_text_color IS 'Cor do texto das mensagens recebidas';
COMMENT ON COLUMN theme_settings.company_name IS 'Nome da empresa exibido no header do dashboard';