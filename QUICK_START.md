# 🚀 Quick Start - Test Your Zero-Knowledge Chat

## ✅ Both Servers Are Running!

### Backend (Node.js)
- **URL:** http://localhost:3000
- **Status:** Check http://localhost:3000/health

### Frontend (HTML/JS)
- **URL:** http://localhost:5173
- **Status:** Ready to test!

---

## 🧪 Test Instructions

### 1. Open the Frontend
Go to: **http://localhost:5173**

### 2. Sign Up
1. Enter email: `alice@test.com`
2. Enter password: `test123`
3. Click **"Sign Up & Generate Keys"**

**Watch the debug panel:**
```
✅ Step 1: Account created!
✅ Step 2: Keys generated! Private key stored locally
✅ Step 3: Public key uploaded!
🎉 Zero-Knowledge setup complete!
```

### 3. Test Message Encryption
1. Click **"Test User"** to start demo chat
2. Type: `Hello, this message is encrypted!`
3. Click **"Send 🔒"**

**Watch the encryption debug:**
```
🔄 Encrypting: "Hello, this message is encrypted!"
✅ Encrypted: x8K3mP9nF2zQ7wL1...
📤 Sending encrypted blob to server...
✅ Encrypted message sent!
⚠️ Server sees: x8K3mP9nF2zQ7wL1... (gibberish!)
```

### 4. Two-User Test (Real E2E)

**Browser Window 1:**
1. Sign up as `alice@test.com`
2. Keep this window open

**Browser Window 2 (Incognito/Different Browser):**
1. Go to http://localhost:5173
2. Sign up as `bob@test.com`
3. Both users now see each other!

**Send encrypted messages:**
- Alice → Bob: "Hi Bob!"
- Bob → Alice: "Hi Alice!"
- **Watch both debug panels show encryption/decryption!**

---

## 🔐 What's Happening Behind the Scenes

### Client-Side (Your Browser):
```javascript
// 1. Generate RSA key pair
privateKey (NEVER uploaded!) 
publicKey (uploaded to server)

// 2. Encrypt message
"Hello" → AES-GCM → "x8K3mP9..." (gibberish)

// 3. Send to server
socket.emit({ encrypted_content: "x8K3mP9..." })
```

### Server-Side (Backend):
```javascript
// Receives ONLY:
{
  "encrypted_content": "x8K3mP9...",  // ← Gibberish!
  "chat_id": "..."
}

// Server CANNOT decrypt (no key!)
// Server just forwards encrypted blob
```

### Recipient (Bob's Browser):
```javascript
// 1. Receive encrypted blob
"x8K3mP9..."

// 2. Decrypt with chat key
AES-GCM-decrypt → "Hello"

// 3. Display plaintext
```

---

## 🛠️ Debugging

### Check Backend Logs
The backend terminal shows:
- Connection events
- API requests
- **Encrypted content** (gibberish!)

### Check Frontend Console (F12)
```javascript
// Browser DevTools → Console
// You'll see:
🔐 Generating RSA key pair...
✅ Chat key generated!
📤 Sending encrypted blob...
📥 Received encrypted blob...
✅ Decrypted: "Your message"
```

### Check Network Tab (F12)
```
POST /api/users/public-key
{
  "public_key": "MIIBIjANBgkqhki..." // ✅ Safe to upload
}

WebSocket → message:send
{
  "encrypted_content": "x8K3mP9..." // ❌ Server can't decrypt!
}
```

### Check LocalStorage (F12)
```javascript
// Application → Local Storage → http://localhost:5173
privateKey: {...}  // ← NEVER uploaded to server!
chatKey_demo-chat-123: "..."  // ← Chat symmetric key
```

---

## ✅ Verification Checklist

Test these to verify zero-knowledge:

- [ ] **Sign up creates RSA keys** ✅
- [ ] **Private key stays in browser** ✅ (Check localStorage)
- [ ] **Public key uploaded to server** ✅ (Check Network tab)
- [ ] **Messages encrypted before sending** ✅ (Check debug panel)
- [ ] **Server receives gibberish** ✅ (Check backend logs)
- [ ] **Recipient decrypts successfully** ✅ (Check chat)
- [ ] **Server logs show NO plaintext** ✅ (Check terminal)

---

## 🎯 Key Features Demonstrated

| Feature | Status | How to Test |
|---------|--------|-------------|
| Supabase Auth | ✅ | Sign up/login |
| RSA Key Generation | ✅ | Check debug log |
| Private Key Storage | ✅ | Check localStorage (F12) |
| Public Key Upload | ✅ | Check Network tab |
| AES Chat Keys | ✅ | Start a chat |
| Message Encryption | ✅ | Send a message |
| Real-time Delivery | ✅ | Socket.IO connection |
| Zero-Knowledge | ✅ | Server sees gibberish! |

---

## 🚨 Common Issues

### "Connection failed"
- Make sure backend is running: `npm run dev` in backend/
- Check http://localhost:3000/health

### "CORS error"
- Backend .env has: `CORS_ORIGIN=http://localhost:5173`
- Restart backend if you changed it

### "Keys not found"
- You logged in from a different device/browser
- Keys are stored in localStorage (device-specific)
- Sign up again to generate new keys

### "Cannot decrypt message"
- Make sure you have the chat key
- For demo, it's generated when you start chat
- For real users, keys are shared via RSA encryption

---

## 🎉 Success!

If you can:
1. ✅ Sign up and see keys generated
2. ✅ Send a message and see it encrypted
3. ✅ See encrypted blob in debug panel
4. ✅ Receive and decrypt message

**Congratulations! You have a working zero-knowledge chat!**

The server CANNOT read your messages - mathematically impossible! 🔒
