# 🚀 Frontend Testing Guide

## Quick Start

### 1. Start the Backend
```bash
cd backend
npm run dev
```

### 2. Start the Frontend
```bash
cd frontend
npm start
```

### 3. Open in Browser
Go to: **http://localhost:5173**

---

## Testing Zero-Knowledge Encryption

### Test 1: Sign Up & Key Generation

1. Enter email: `test@example.com`
2. Enter password: `password123`
3. Click **"Sign Up & Generate Keys"**

**Watch the debug log:**
- ✅ Account created with Supabase
- ✅ RSA key pair generated (2048-bit)
- ✅ Private key stored locally (NEVER uploaded!)
- ✅ Public key uploaded to server

### Test 2: Send Encrypted Message

1. Click "Test User" to start demo chat
2. Type a message: `Hello, this is encrypted!`
3. Click **"Send 🔒"**

**Watch the encryption debug:**
- 🔄 Message encrypted client-side
- ✅ Encrypted blob: `x8K3mP9...` (gibberish!)
- 📤 Server receives ONLY encrypted blob
- ⚠️ Server CANNOT decrypt it!

### Test 3: Two Users (Real E2E Test)

1. **Window 1:** Sign up as `alice@test.com`
2. **Window 2 (Incognito):** Sign up as `bob@test.com`
3. Alice sends message to Bob
4. Bob receives encrypted blob
5. Bob decrypts it automatically

---

## What You'll See

### Auth Screen
- Email/password input
- Sign up generates RSA keys
- Login loads keys from storage
- **Debug log shows all crypto operations**

### Chat Screen
- Demo chat to test encryption
- Send/receive encrypted messages
- **Encryption debug shows:**
  - Plaintext message
  - Encrypted blob (gibberish)
  - Server receives only gibberish
  - Client-side decryption

---

## Features Demonstrated

✅ **Supabase Auth** - Email/password signup & login
✅ **RSA Key Pair Generation** - 2048-bit on client
✅ **Private Key Storage** - localStorage (never uploaded!)
✅ **Public Key Upload** - POST /api/users/public-key
✅ **AES Chat Key Generation** - 256-bit symmetric key
✅ **Message Encryption** - AES-GCM on client
✅ **Socket.IO Real-time** - Encrypted message delivery
✅ **Zero-Knowledge** - Server sees only encrypted blobs

---

## Debug Information

The frontend shows two debug panels:

### 1. Auth Debug (Bottom of login screen)
- Shows key generation steps
- Shows public key upload
- Shows crypto operations

### 2. Chat Debug (Bottom of chat screen)
- Shows encryption process
- Shows encrypted blob sent to server
- Shows decryption process
- **Proves server cannot decrypt!**

---

## Zero-Knowledge Proof

### What Frontend Does:
```javascript
// 1. Generate keys
RSA KeyPair → { privateKey, publicKey }

// 2. Store private key locally
localStorage.setItem('privateKey', ...) // NEVER uploaded!

// 3. Upload public key
POST /api/users/public-key { public_key: "..." } // Safe!

// 4. Encrypt message
plaintext → AES-GCM → "x8K3mP9..." (encrypted)

// 5. Send to server
socket.emit('message:send', { 
  encrypted_content: "x8K3mP9..." // Gibberish!
})
```

### What Server Receives:
```json
{
  "encrypted_content": "x8K3mP9nF2zQ7wL1kM...",
  "chat_id": "demo-chat-123"
}
```

**Server CANNOT decrypt this without:**
- ❌ Chat AES key (stored only on client!)
- ❌ User's private key (never uploaded!)

---

## Troubleshooting

### CORS Error?
Make sure backend is running with CORS enabled:
```
CORS_ORIGIN=http://localhost:5173
```

### Connection Failed?
Check backend is running on port 3000:
```bash
cd backend
npm run dev
```

### Keys Not Found?
Clear localStorage and sign up again:
```javascript
// In browser console:
localStorage.clear()
location.reload()
```

---

## Next Steps

1. ✅ Test signup and login
2. ✅ Test message encryption
3. ✅ Open DevTools → Network → See encrypted blobs
4. ✅ Open DevTools → Application → localStorage → See private key
5. ✅ Verify server logs show only encrypted content

**You now have a working zero-knowledge chat!** 🎉
