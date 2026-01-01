# Master Key Architecture - Testing Guide

## 🎯 Implementation Complete!

The master key + password authentication architecture has been successfully implemented.

## 🏗️ Architecture Overview

### Key Components:
1. **Master Key**: Random AES-256-GCM key (independent of password)
2. **Password Wrapping**: PBKDF2 (100,000 iterations) + AES-GCM
3. **Double Encryption**: Master key encrypts RSA private key, password encrypts master key
4. **Device Storage**: Master key in IndexedDB (unencrypted locally)
5. **Server Storage**: Encrypted master key + encrypted RSA private key (server cannot decrypt)
6. **Auth Password**: Separate password derived from user password for Supabase authentication

### What the Server Sees:
- ✅ Encrypted master key (wrapped with password - cannot decrypt)
- ✅ Encrypted RSA private key (double encrypted - cannot decrypt)
- ✅ RSA public key (safe to share)
- ❌ Never sees: User password, master key, RSA private key, chat messages

## 📝 Setup Instructions

### Step 1: Database Migration
Run this SQL in Supabase SQL Editor:
```sql
ALTER TABLE user_keys 
ADD COLUMN IF NOT EXISTS encrypted_master_key TEXT,
ADD COLUMN IF NOT EXISTS encrypted_rsa_private_key TEXT;

COMMENT ON COLUMN user_keys.encrypted_master_key IS 'Master encryption key encrypted with password-derived key. Server cannot decrypt this.';
COMMENT ON COLUMN user_keys.encrypted_rsa_private_key IS 'RSA private key encrypted with master key for double encryption.';
```

### Step 2: Clear Old Data (Optional)
If testing with existing accounts, clear old keys:
```sql
-- Delete old user_keys (they don't have master key columns)
DELETE FROM user_keys;

-- Delete all Supabase auth users (start fresh)
-- Go to Supabase Dashboard → Authentication → Users → Delete users manually
```

### Step 3: Start Backend
```powershell
cd f:\Projects\backend
npm run dev
```

### Step 4: Start Frontend
```powershell
cd f:\Projects\frontend
npx http-server -p 5173 -c-1
```

### Step 5: Open Browser
Navigate to: http://localhost:5173

## 🧪 Testing Scenarios

### Test 1: New User Signup
1. Open http://localhost:5173
2. Enter email: `user1@test.com`, password: `password123`
3. Click **Signup**
4. Watch the debug log - should show:
   ```
   🔄 Step 1: Generating master encryption key...
   ✅ Step 1: Master key generated! (256-bit AES-GCM, random)
   🔄 Step 2: Encrypting master key with password...
   ✅ Step 2: Master key encrypted! (PBKDF2 100k iterations)
   🔄 Step 3: Deriving auth password...
   ✅ Step 3: Auth password derived! (SHA-256)
   🔄 Step 4: Creating Supabase account...
   ✅ Step 4: Account created!
   🔄 Step 5: Creating user profile...
   ✅ Step 5: Profile created!
   🔄 Step 6: Generating RSA key pair (2048-bit)...
   ✅ Step 6: RSA keys generated!
   🔄 Step 7: Encrypting RSA private key with master key...
   ✅ Step 7: RSA private key encrypted! (Double encryption)
   🔄 Step 8: Storing master key on device (IndexedDB)...
   ✅ Step 8: Master key stored locally! (Fast login next time)
   🔄 Step 9: Uploading encrypted keys to server...
   ✅ Step 9: All encrypted keys uploaded!
   🎉 Zero-Knowledge setup complete!
   ```
5. Verify in Supabase:
   - Check `user_keys` table - should have `encrypted_master_key` and `encrypted_rsa_private_key` (both JSON strings)
   - Data should look like encrypted gibberish

### Test 2: Login (Same Device - Fast Path)
1. Logout from user1
2. Login with same credentials
3. Watch debug log - should show:
   ```
   🔄 Step 1: Checking for master key on device...
   ✅ Step 1: Master key found on device! (Fast login)
   🔄 Step 2: Deriving auth password...
   ✅ Step 2: Auth password derived!
   🔄 Step 3: Logging into Supabase...
   ✅ Step 3: Logged in!
   🔄 Step 4: Loading RSA keys from server...
   ✅ Step 4: RSA keys downloaded!
   🔄 Step 5: Decrypting RSA private key with master key...
   ✅ Step 5: RSA private key decrypted!
   🎉 Login complete! All encryption keys ready.
   ```
4. **No password decryption** - master key was already on device!

### Test 3: Login (New Device - Slow Path)
1. Open IndexedDB in DevTools (Application → IndexedDB → EncryptionDB)
2. Delete the `EncryptionDB` database (simulate new device)
3. Refresh page and login
4. Watch debug log - should show:
   ```
   🔄 Step 1: Checking for master key on device...
   ⚠️ Step 1: Master key not on device (first login on this device)
   🔄 Step 2: Deriving auth password...
   ✅ Step 2: Auth password derived!
   🔄 Step 3: Logging into Supabase...
   ✅ Step 3: Logged in!
   🔄 Step 4: Downloading encrypted master key from server...
   ✅ Step 4: Encrypted keys downloaded!
   🔄 Step 5: Decrypting master key with password...
   ✅ Step 5: Master key decrypted!
   🔄 Step 6: Storing master key on device for next time...
   ✅ Step 6: Master key stored! (Login will be faster next time)
   🔄 Step 7: Decrypting RSA private key...
   ✅ Step 7: RSA private key decrypted! (Double decryption)
   🎉 Login complete! All encryption keys ready.
   ```
5. Master key downloaded from server, decrypted with password, stored locally

### Test 4: Two-User E2EE Chat
1. Open two browser windows (or incognito)
2. Window 1: Signup as `alice@test.com`
3. Window 2: Signup as `bob@test.com`
4. Window 1: Enter Bob's user ID, click "Start Chat"
5. Window 1: Send message "Hello Bob!"
6. Window 2: Should receive encrypted message and decrypt it
7. Window 2: Reply "Hello Alice!"
8. Both windows should show decrypted messages
9. Check `messages` table in Supabase - should see only encrypted data

### Test 5: Session Restore (Refresh Page)
1. Login as user1
2. Start chat, send messages
3. Refresh page (F5)
4. Should auto-restore session using master key from IndexedDB
5. Messages should decrypt successfully

### Test 6: Wrong Password
1. Logout
2. Try to login with wrong password
3. Should fail at Supabase auth step (before trying to decrypt master key)
4. Error message should appear

## 🔍 What to Verify in Database

### user_keys table:
```sql
SELECT 
    user_id,
    LENGTH(encrypted_master_key) as master_key_length,
    LENGTH(encrypted_rsa_private_key) as rsa_key_length,
    LENGTH(public_key) as public_key_length
FROM user_keys;
```

Expected output:
- `master_key_length`: ~200-300 (JSON with wrapped, iv, salt)
- `rsa_key_length`: ~3000-4000 (encrypted PKCS8)
- `public_key_length`: ~400-500 (base64 RSA public key)

### Verify Encryption:
```sql
SELECT 
    encrypted_master_key::json->>'wrapped' as encrypted_blob,
    encrypted_rsa_private_key::json->>'encrypted' as rsa_blob
FROM user_keys
LIMIT 1;
```

Both should be long base64 strings - completely unintelligible.

## 🎉 Success Criteria

✅ Signup creates master key + encrypts it + stores on device  
✅ Login (same device) uses local master key (no password decryption)  
✅ Login (new device) downloads encrypted master key, decrypts with password  
✅ Two users can chat with E2EE (RSA key exchange + AES-GCM messages)  
✅ Page refresh restores session using IndexedDB master key  
✅ Server never sees unencrypted data (check Supabase tables)  
✅ Wrong password fails at auth (before decryption attempt)  
✅ Debug logs show detailed cryptographic steps  

## 🚀 Next Steps (Future Enhancements)

1. **Password Change**: Re-wrap master key without re-encrypting messages
2. **Multi-Device Sync**: QR code to transfer master key to new device
3. **Backup/Export**: Download encrypted master key + save securely
4. **Key Rotation**: Generate new RSA keys without losing master key
5. **Recovery Code**: Generate one-time recovery key for password reset

## 🔐 Security Properties

- **Zero-Knowledge**: Server cannot decrypt any user data
- **Password Independence**: Master key random, not derived from password
- **Password Change Support**: Re-wrap master key, no re-encryption needed
- **Multi-Device**: Download encrypted master key, decrypt with password
- **Device Persistence**: Fast login using IndexedDB (no password decryption)
- **Double Encryption**: RSA private key encrypted twice (master key + password)
- **Separate Auth**: Derived auth password prevents password exposure

## 📚 Architecture Comparison

### Old Architecture (RSA-only):
❌ Key regeneration on every login  
❌ Old messages undecryptable  
❌ No device persistence  
❌ Password change requires new keys  

### New Architecture (Master Key):
✅ Master key persistent across devices  
✅ All messages always decryptable  
✅ Fast login with IndexedDB  
✅ Password change just re-wraps master key  
✅ Zero-knowledge maintained  

---

**Implementation Date**: January 2025  
**Status**: ✅ Complete - Ready for Testing
