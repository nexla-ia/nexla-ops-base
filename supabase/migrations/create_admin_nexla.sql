/*
  Criar conta admin - Nexla
  user_id: f113fe37-4825-490f-9a3b-5f95b6b70e20 (nexla@nexla.com.br)
*/

-- 1. Inserir empresa
INSERT INTO companies (
  id,
  user_id,
  name,
  email,
  phone,
  phone_number,
  api_key,
  max_attendants,
  additional_attendants,
  ia_ativada,
  is_active,
  created_at
)
VALUES (
  'b556fa35-7418-41ea-aba3-289b3a348838',
  'f113fe37-4825-490f-9a3b-5f95b6b70e20',
  'Nexla',
  'nexla@nexla.com.br',
  '(69) 8116-1007',
  '(69) 8116-1007',
  '04878D4C6C99-40C2-8272-6977F2092677',
  5,
  0,
  true,
  true,
  now()
)
ON CONFLICT (id) DO NOTHING;

-- 2. Inserir como super_admin
INSERT INTO super_admins (user_id, created_at)
VALUES ('f113fe37-4825-490f-9a3b-5f95b6b70e20', now())
ON CONFLICT (user_id) DO NOTHING;

SELECT 'Admin criado com sucesso!' AS status;
