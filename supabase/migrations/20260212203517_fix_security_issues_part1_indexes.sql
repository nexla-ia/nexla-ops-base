/*
  # Fix Security Issues - Part 1: Foreign Key Indexes

  1. New Indexes
    - Add index on `companies.user_id` for foreign key performance
    - Add index on `messages.company_id` for foreign key performance  
    - Add index on `messages.sector_id` for foreign key performance
    - Add index on `transferencias.from_department_id` for foreign key performance
    - Add index on `transferencias.to_department_id` for foreign key performance

  2. Remove Duplicate Constraints
    - Remove duplicate unique constraint on `contact_tags`
    - Remove duplicate unique constraint on `contacts`

  3. Security Notes
    - Foreign key indexes are critical for join performance
    - Removing duplicate constraints reduces overhead
*/

-- ============================================================================
-- 1. ADD MISSING FOREIGN KEY INDEXES
-- ============================================================================

-- Index for companies.user_id
CREATE INDEX IF NOT EXISTS idx_companies_user_id 
  ON companies(user_id);

-- Index for messages.company_id  
CREATE INDEX IF NOT EXISTS idx_messages_company_id 
  ON messages(company_id);

-- Index for messages.sector_id
CREATE INDEX IF NOT EXISTS idx_messages_sector_id 
  ON messages(sector_id);

-- Index for transferencias.from_department_id
CREATE INDEX IF NOT EXISTS idx_transferencias_from_department_id 
  ON transferencias(from_department_id);

-- Index for transferencias.to_department_id
CREATE INDEX IF NOT EXISTS idx_transferencias_to_department_id 
  ON transferencias(to_department_id);

-- ============================================================================
-- 2. REMOVE DUPLICATE CONSTRAINTS (keep the more descriptive ones)
-- ============================================================================

-- contact_tags has duplicate unique constraints - keep contact_tags_contact_tag_unique
ALTER TABLE contact_tags 
  DROP CONSTRAINT IF EXISTS contact_tags_contact_id_tag_id_key;

-- contacts has duplicate unique constraints - keep contacts_company_phone_unique
ALTER TABLE contacts 
  DROP CONSTRAINT IF EXISTS contacts_company_id_phone_number_key;
