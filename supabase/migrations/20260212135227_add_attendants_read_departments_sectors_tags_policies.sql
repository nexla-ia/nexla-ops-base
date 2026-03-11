/*
  # Add Attendants Read Policies for Departments, Sectors and Tags

  1. New Policies
    - `departments`: Allow attendants to read all departments from their company
    - `sectors`: Allow attendants to read all sectors from their company
    - `tags`: Allow attendants to read all tags from their company

  2. Security
    - Attendants can only read data from their own company
    - No write permissions for attendants on these tables
    - Companies maintain full control over their data

  3. Important Notes
    - This enables attendants to see all departments/sectors/tags when transferring contacts
    - Attendants remain restricted to only viewing their own department's contacts
*/

-- Departments policies for attendants
CREATE POLICY "Attendants can view company departments"
  ON departments FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM attendants WHERE user_id = auth.uid()
    )
  );

-- Sectors policies for attendants
CREATE POLICY "Attendants can view company sectors"
  ON sectors FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM attendants WHERE user_id = auth.uid()
    )
  );

-- Tags policies for attendants
CREATE POLICY "Attendants can view company tags"
  ON tags FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM attendants WHERE user_id = auth.uid()
    )
  );
