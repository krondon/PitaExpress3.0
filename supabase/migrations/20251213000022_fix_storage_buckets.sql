-- Ensure storage.buckets RLS doesn't block access
-- Allow public access to read buckets (metadata)
CREATE POLICY "Public Access to Buckets"
ON storage.buckets FOR SELECT
TO public
USING (true);

-- Ensure 'orders' and 'products' buckets exist and are public
INSERT INTO storage.buckets (id, name, public)
VALUES ('orders', 'orders', true)
ON CONFLICT (id) DO UPDATE SET public = true;

INSERT INTO storage.buckets (id, name, public)
VALUES ('products', 'products', true)
ON CONFLICT (id) DO UPDATE SET public = true;

INSERT INTO storage.buckets (id, name, public)
VALUES ('pdfs', 'pdfs', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Ensure authenticated users can insert into 'orders' bucket
DROP POLICY IF EXISTS "Authenticated users can upload to orders" ON storage.objects;
CREATE POLICY "Authenticated users can upload to orders"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( bucket_id = 'orders' );

-- Ensure authenticated users can update their own files or all files in orders?
-- For simplicy, allow update if authenticated for now, or match owner
DROP POLICY IF EXISTS "Authenticated users can update orders" ON storage.objects;
CREATE POLICY "Authenticated users can update orders"
ON storage.objects FOR UPDATE
TO authenticated
USING ( bucket_id = 'orders' );

-- Allow public to view files in orders (needed for PDFs/Images)
DROP POLICY IF EXISTS "Public access to orders" ON storage.objects;
CREATE POLICY "Public access to orders"
ON storage.objects FOR SELECT
TO public
USING ( bucket_id = 'orders' );

-- Same for products
DROP POLICY IF EXISTS "Authenticated users can upload to products" ON storage.objects;
CREATE POLICY "Authenticated users can upload to products"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( bucket_id = 'products' );

DROP POLICY IF EXISTS "Public access to products" ON storage.objects;
CREATE POLICY "Public access to products"
ON storage.objects FOR SELECT
TO public
USING ( bucket_id = 'products' );

-- Same for pdfs
DROP POLICY IF EXISTS "Authenticated users can upload to pdfs" ON storage.objects;
CREATE POLICY "Authenticated users can upload to pdfs"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( bucket_id = 'pdfs' );

DROP POLICY IF EXISTS "Public access to pdfs" ON storage.objects;
CREATE POLICY "Public access to pdfs"
ON storage.objects FOR SELECT
TO public
USING ( bucket_id = 'pdfs' );
