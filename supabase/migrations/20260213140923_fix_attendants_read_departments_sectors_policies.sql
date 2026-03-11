/*
  # Fix Missing Attendants Read Policies for Departments and Sectors

  1. Problem
    - Attendants cannot view departments/sectors dropdown in transfer modal
    - Missing SELECT policies for attendants on departments and sectors tables
    - Tags policies exist but departments/sectors policies are missing

  2. New Policies
    - `departments`: Allow attendants to read all departments from their company
    - `sectors`: Allow attendants to read all sectors from their company

  3. Security
    - Attendants can only read data from their own company
    - No write permissions for attendants on these tables
    - Companies maintain full control over their data
*/

-- Departments policy for attendants
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'departments' 
      AND policyname = 'Attendants can view company departments'
  ) THEN
    CREATE POLICY "Attendants can view company departments"
      ON departments FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM attendants 
          WHERE attendants.user_id = auth.uid()
            AND attendants.company_id = departments.company_id
        )
      );
  END IF;
END $$;

-- Sectors policy for attendants
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'sectors' 
      AND policyname = 'Attendants can view company sectors'
  ) THEN
    CREATE POLICY "Attendants can view company sectors"
      ON sectors FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM attendants 
          WHERE attendants.user_id = auth.uid()
            AND attendants.company_id = sectors.company_id
        )
      );
  END IF;
END $$;
