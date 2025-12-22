-- Migration: Secure function search paths
-- Description: Fixes "role mutable search_path" security warnings for ticket functions

-- 1. Secure update_tickets_updated_at
CREATE OR REPLACE FUNCTION public.update_tickets_updated_at()
RETURNS TRIGGER 
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Secure generate_next_base_code
CREATE OR REPLACE FUNCTION public.generate_next_base_code()
RETURNS TEXT 
SET search_path = ''
AS $$
DECLARE
  next_id INTEGER;
BEGIN
  -- Get next ID from sequence. Explicitly referencing public schema for table
  SELECT COALESCE(MAX(id), 0) + 1 INTO next_id FROM public.tickets;
  
  -- Return code with format PL + 4 digits
  RETURN 'PL' || LPAD(next_id::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

-- 3. Secure generate_full_code
CREATE OR REPLACE FUNCTION public.generate_full_code(base_code TEXT, created_date TIMESTAMPTZ)
RETURNS TEXT 
SET search_path = ''
AS $$
BEGIN
  -- Format: base_code + DDMMYY
  RETURN base_code || TO_CHAR(created_date, 'DDMMYY');
END;
$$ LANGUAGE plpgsql;
