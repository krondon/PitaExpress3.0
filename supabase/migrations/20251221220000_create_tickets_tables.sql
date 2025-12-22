-- Migration: Create tickets and print_history tables
-- Description: Tables for managing user tickets with barcode generation and print tracking

-- Create tickets table
CREATE TABLE IF NOT EXISTS public.tickets (
  -- Primary key
  id BIGSERIAL PRIMARY KEY,
  
  -- User information
  user_name TEXT NOT NULL,
  
  -- Generated codes
  base_code TEXT NOT NULL,        -- Format: PL0001, PL0002, etc.
  full_code TEXT NOT NULL,        -- Format: PL0001211225 (base_code + DDMMYY)
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Audit
  created_by UUID REFERENCES auth.users(id),
  
  -- Constraints
  CONSTRAINT tickets_base_code_unique UNIQUE (base_code),
  CONSTRAINT tickets_full_code_unique UNIQUE (full_code),
  CONSTRAINT tickets_user_name_min_length CHECK (char_length(user_name) >= 3)
);

-- Create print_history table for tracking label prints
CREATE TABLE IF NOT EXISTS public.print_history (
  id BIGSERIAL PRIMARY KEY,
  ticket_id BIGINT NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  printed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  printed_by UUID REFERENCES auth.users(id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_tickets_user_name ON public.tickets(user_name);
CREATE INDEX IF NOT EXISTS idx_tickets_created_at ON public.tickets(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tickets_base_code ON public.tickets(base_code);
CREATE INDEX IF NOT EXISTS idx_print_history_ticket_id ON public.print_history(ticket_id);
CREATE INDEX IF NOT EXISTS idx_print_history_printed_at ON public.print_history(printed_at DESC);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_tickets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updated_at
DROP TRIGGER IF EXISTS trigger_update_tickets_updated_at ON public.tickets;
CREATE TRIGGER trigger_update_tickets_updated_at
  BEFORE UPDATE ON public.tickets
  FOR EACH ROW
  EXECUTE FUNCTION update_tickets_updated_at();

-- Function to generate next base code
CREATE OR REPLACE FUNCTION generate_next_base_code()
RETURNS TEXT AS $$
DECLARE
  next_id INTEGER;
BEGIN
  -- Get next ID from sequence
  SELECT COALESCE(MAX(id), 0) + 1 INTO next_id FROM public.tickets;
  
  -- Return code with format PL + 4 digits (PL0001, PL0002, etc.)
  RETURN 'PL' || LPAD(next_id::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

-- Function to generate full code with date
CREATE OR REPLACE FUNCTION generate_full_code(base_code TEXT, created_date TIMESTAMPTZ)
RETURNS TEXT AS $$
BEGIN
  -- Format: base_code + DDMMYY
  RETURN base_code || TO_CHAR(created_date, 'DDMMYY');
END;
$$ LANGUAGE plpgsql;

-- Enable Row Level Security
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.print_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies for tickets table
-- Only admins can access tickets
CREATE POLICY "Admins can view all tickets"
  ON public.tickets
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.administrators
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can insert tickets"
  ON public.tickets
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.administrators
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can update tickets"
  ON public.tickets
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.administrators
      WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.administrators
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can delete tickets"
  ON public.tickets
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.administrators
      WHERE user_id = auth.uid()
    )
  );

-- RLS Policies for print_history table
CREATE POLICY "Admins can view print history"
  ON public.print_history
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.administrators
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can insert print history"
  ON public.print_history
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.administrators
      WHERE user_id = auth.uid()
    )
  );

-- Grant permissions
GRANT ALL ON public.tickets TO authenticated;
GRANT ALL ON public.print_history TO authenticated;
GRANT USAGE ON SEQUENCE tickets_id_seq TO authenticated;
GRANT USAGE ON SEQUENCE print_history_id_seq TO authenticated;

-- Comments for documentation
COMMENT ON TABLE public.tickets IS 'Stores user tickets with generated barcodes';
COMMENT ON TABLE public.print_history IS 'Tracks each time a ticket label is printed';
COMMENT ON COLUMN public.tickets.base_code IS 'Base code format: PL0001, PL0002, etc.';
COMMENT ON COLUMN public.tickets.full_code IS 'Full code format: PL0001211225 (base_code + DDMMYY)';
