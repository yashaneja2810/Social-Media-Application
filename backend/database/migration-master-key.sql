-- Add master key columns to user_keys table
-- Run this SQL in Supabase SQL Editor

ALTER TABLE user_keys 
ADD COLUMN IF NOT EXISTS encrypted_master_key TEXT,
ADD COLUMN IF NOT EXISTS encrypted_rsa_private_key TEXT;

COMMENT ON COLUMN user_keys.encrypted_master_key IS 'Master encryption key encrypted with password-derived key. Server cannot decrypt this.';
COMMENT ON COLUMN user_keys.encrypted_rsa_private_key IS 'RSA private key encrypted with master key for double encryption.';

-- Show updated schema
SELECT 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'user_keys'
ORDER BY ordinal_position;
