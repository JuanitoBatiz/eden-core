-- Ensure the storage schema exists
CREATE SCHEMA IF NOT EXISTS storage;

-- Create the private bucket for payment proofs if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'payment-proofs', 
  'payment-proofs', 
  false, 
  5242880, -- 5MB limit at the bucket level as well
  ARRAY['image/jpeg', 'image/png', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE SET 
  public = false, 
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'application/pdf'];

-- We don't need RLS policies here since all interactions with this bucket
-- will be strictly handled by the Next.js server via SUPABASE_SERVICE_ROLE_KEY.
-- Leaving policies empty enforces the default deny-all behavior for anonymous/client requests.
