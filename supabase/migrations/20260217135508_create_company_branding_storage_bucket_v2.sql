/*
  # Create Storage Bucket for Company Branding

  ## 1. New Bucket
  - `company-branding` - Storage para logos e imagens de fundo das companhias
  
  ## 2. Security
  - RLS policies para controlar acesso
  - Companies podem fazer upload/update/delete de suas próprias imagens
  - Leitura pública permitida para exibir imagens
*/

-- Create bucket for company branding images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'company-branding',
  'company-branding',
  true,
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- Policy: Companies can upload their own branding images
CREATE POLICY "Companies can upload own branding"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'company-branding' AND
    (storage.foldername(name))[1] = (
      SELECT api_key::text 
      FROM companies 
      WHERE id = auth.uid()
    )
  );

-- Policy: Companies can update their own branding images
CREATE POLICY "Companies can update own branding"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'company-branding' AND
    (storage.foldername(name))[1] = (
      SELECT api_key::text 
      FROM companies 
      WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    bucket_id = 'company-branding' AND
    (storage.foldername(name))[1] = (
      SELECT api_key::text 
      FROM companies 
      WHERE id = auth.uid()
    )
  );

-- Policy: Companies can delete their own branding images
CREATE POLICY "Companies can delete own branding"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'company-branding' AND
    (storage.foldername(name))[1] = (
      SELECT api_key::text 
      FROM companies 
      WHERE id = auth.uid()
    )
  );

-- Policy: Public can view all branding images
CREATE POLICY "Public can view branding images"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'company-branding');