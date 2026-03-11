/*
  # Add payment_day column to companies

  1. Changes
    - Add `payment_day` column to companies table
    - This represents the actual payment due date (day of month 1-31)
    - Different from `payment_notification_day` which is when to show notifications
    - Default: 10 (10th day of the month)

  2. Notes
    - payment_day = actual due date for payment
    - payment_notification_day = when to start showing payment reminders
*/

-- Add payment_day column to companies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'companies' AND column_name = 'payment_day'
  ) THEN
    ALTER TABLE companies 
    ADD COLUMN payment_day integer DEFAULT 10 CHECK (payment_day >= 1 AND payment_day <= 31);
    
    COMMENT ON COLUMN companies.payment_day IS 'Day of month (1-31) when payment is due';
  END IF;
END $$;
