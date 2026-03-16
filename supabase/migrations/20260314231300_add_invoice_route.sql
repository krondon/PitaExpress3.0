-- Add invoiceRoute column to orders table for payment invoice PDFs
ALTER TABLE orders ADD COLUMN IF NOT EXISTS "invoiceRoute" TEXT;

-- Add comment for documentation
COMMENT ON COLUMN orders."invoiceRoute" IS 'URL of the invoice PDF generated when payment is validated (state 4→5)';
