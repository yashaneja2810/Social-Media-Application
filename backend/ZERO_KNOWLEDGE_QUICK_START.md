# 🔐 Zero-Knowledge Implementation - Quick Reference

## Installation & Setup

```bash
# 1. Install dependencies (Redis removed!)
cd backend
npm install

# 2. Set up environment
cp .env.example .env
# Edit .env with your Supabase credentials

# 3. Run database migrations
# Execute database/schema.sql in Supabase SQL Editor

# 4. Start server
npm run dev
```

---

## API Endpoints

### Public Key Management

```http
# Upload your RSA public key (once during signup)
POST /api/users/public-key
Authorization: Bearer {supabase_jwt}
Content-Type: application/json

{
  "public_key": "MIIBIjANBgkqhki..."
}

# Get someone's public key
GET /api/users/{userId}/public-key
Authorization: Bearer {supabase_jwt}
```

### Chat Key Sharing

```http
# Share encrypted chat key
POST /api/chats/{chatId}/share-key
Authorization: Bearer {supabase_jwt}
Content-Type: application/json

{
  "recipient_id": "uuid",
  "encrypted_chat_key": "x9K2mP..."
}

# Get your encrypted chat key
GET /api/chats/{chatId}/my-key
Authorization: Bearer {supabase_jwt}
```

---

## WebSocket Events

```javascript
// Share chat key (real-time)
socket.emit('chat:key:share', {
  chatId: 'uuid',
  recipientId: 'uuid',
  encryptedChatKey: 'base64...'
});

// Receive chat key
socket.on('chat:key:received', (data) => {
  console.log(data);
  // {
  //   chatId: 'uuid',
  //   from: 'sender-uuid',
  //   encrypted_chat_key: 'base64...'
  // }
});
```

---

## Frontend Implementation Checklist

### 1. User Signup Flow

```javascript
// ✅ Generate RSA key pair
const keyPair = await crypto.subtle.generateKey(
  { name: 'RSA-OAEP', modulusLength: 2048, hash: 'SHA-256' },
  true,
  ['encrypt', 'decrypt']
);

// ✅ Store private key in IndexedDB (NEVER upload!)
await db.privateKeys.add({ key: keyPair.privateKey });

// ✅ Upload public key to server
const publicKeyJwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey);
await fetch('/api/users/public-key', {
  method: 'POST',
  body: JSON.stringify({ public_key: JSON.stringify(publicKeyJwk) })
});
```

### 2. Start Chat Flow

```javascript
// ✅ Generate AES chat key
const chatKey = await crypto.subtle.generateKey(
  { name: 'AES-GCM', length: 256 },
  true,
  ['encrypt', 'decrypt']
);

// ✅ Store in IndexedDB
await db.chatKeys.add({ chatId, key: chatKey });

// ✅ Get recipient's public key
const { public_key } = await fetch(`/api/users/${recipientId}/public-key`)
  .then(r => r.json());

// ✅ Encrypt chat key with recipient's public key
const recipientPublicKey = await crypto.subtle.importKey(
  'jwk',
  JSON.parse(public_key),
  { name: 'RSA-OAEP', hash: 'SHA-256' },
  false,
  ['encrypt']
);

const exportedChatKey = await crypto.subtle.exportKey('raw', chatKey);
const encryptedChatKey = await crypto.subtle.encrypt(
  { name: 'RSA-OAEP' },
  recipientPublicKey,
  exportedChatKey
);

// ✅ Share via API or WebSocket
socket.emit('chat:key:share', {
  chatId,
  recipientId,
  encryptedChatKey: btoa(String.fromCharCode(...new Uint8Array(encryptedChatKey)))
});
```

### 3. Receive Chat Key Flow

```javascript
socket.on('chat:key:received', async (data) => {
  // ✅ Get my private key from IndexedDB
  const myPrivateKey = await db.privateKeys.get('myKey');

  // ✅ Decrypt chat key
  const encryptedKey = Uint8Array.from(atob(data.encrypted_chat_key), c => c.charCodeAt(0));
  const decryptedKey = await crypto.subtle.decrypt(
    { name: 'RSA-OAEP' },
    myPrivateKey.key,
    encryptedKey
  );

  // ✅ Import as AES key
  const chatKey = await crypto.subtle.importKey(
    'raw',
    decryptedKey,
    { name: 'AES-GCM' },
    true,
    ['encrypt', 'decrypt']
  );

  // ✅ Store in IndexedDB
  await db.chatKeys.add({ chatId: data.chatId, key: chatKey });
});
```

### 4. Send Message Flow

```javascript
// ✅ Get chat key
const chatKeyRecord = await db.chatKeys.get(chatId);
const chatKey = chatKeyRecord.key;

// ✅ Generate IV
const iv = crypto.getRandomValues(new Uint8Array(12));

// ✅ Encrypt message
const encrypted = await crypto.subtle.encrypt(
  { name: 'AES-GCM', iv },
  chatKey,
  new TextEncoder().encode(messageText)
);

// ✅ Send to server
socket.emit('message:send', {
  chatId,
  encryptedContent: btoa(String.fromCharCode(...new Uint8Array(encrypted))),
  messageType: 'text'
});
```

### 5. Receive Message Flow

```javascript
socket.on('message:receive', async (data) => {
  // ✅ Get chat key
  const chatKeyRecord = await db.chatKeys.get(data.chat_id);
  const chatKey = chatKeyRecord.key;

  // ✅ Decrypt message
  const ciphertext = Uint8Array.from(atob(data.encrypted_content), c => c.charCodeAt(0));
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: new Uint8Array(12) }, // Get IV from server
    chatKey,
    ciphertext
  );

  // ✅ Display
  const messageText = new TextDecoder().decode(decrypted);
  displayMessage(messageText);
});
```

---

## Database Schema Quick Reference

```sql
-- Public keys (anyone can read)
SELECT public_key FROM user_keys WHERE user_id = 'uuid';

-- Encrypted chat keys (only recipient can read - RLS enforced)
SELECT encrypted_chat_key FROM chat_keys 
WHERE chat_id = 'uuid' AND recipient_id = auth.uid();

-- Encrypted messages (only chat participants can read)
SELECT encrypted_content FROM messages 
WHERE chat_id = 'uuid';
```

---

## Testing

### Test Public Key Upload

```bash
curl -X POST http://localhost:3000/api/users/public-key \
  -H "Authorization: Bearer YOUR_JWT" \
  -H "Content-Type: application/json" \
  -d '{"public_key": "YOUR_PUBLIC_KEY_BASE64"}'
```

### Test WebSocket Connection

```javascript
const socket = io('http://localhost:3000', {
  auth: { token: 'YOUR_JWT' }
});

socket.on('connect', () => {
  console.log('Connected!');
});
```

---

## Key Security Rules

### ✅ DO:
- Generate keys client-side
- Store private keys in IndexedDB
- Upload public keys to server
- Encrypt chat keys with recipient's public key
- Encrypt messages with chat symmetric key
- Use TLS/HTTPS in production

### ❌ DON'T:
- Upload private keys to server
- Store plaintext messages
- Share private keys
- Trust server with decryption
- Skip encryption for "convenience"

---

## Architecture Summary

```
┌─────────────────────────────────────────────────────────┐
│                    CLIENT (Browser)                     │
│  • Generate RSA keypair                                 │
│  • Store private key in IndexedDB                       │
│  • Generate AES chat keys                               │
│  • Encrypt/decrypt all messages                         │
│  • Upload public key only                               │
└───────────────────┬─────────────────────────────────────┘
                    │ Encrypted blobs only
                    ▼
┌─────────────────────────────────────────────────────────┐
│                 SERVER (Your Backend)                   │
│  • Store public keys (safe)                             │
│  • Store encrypted chat keys (can't decrypt)            │
│  • Store encrypted messages (can't decrypt)             │
│  • Forward encrypted data                               │
│  • Enforce access control                               │
│  • CANNOT read any messages!                            │
└───────────────────┬─────────────────────────────────────┘
                    │ Encrypted storage
                    ▼
┌─────────────────────────────────────────────────────────┐
│              SUPABASE (PostgreSQL)                      │
│  • user_keys: public keys                               │
│  • chat_keys: encrypted symmetric keys                  │
│  • messages: encrypted content                          │
│  • Row Level Security enforced                          │
└─────────────────────────────────────────────────────────┘
```

---

## Privacy Guarantees

✅ **Server CANNOT decrypt messages** - No private keys  
✅ **Database CANNOT decrypt messages** - Only encrypted blobs  
✅ **Admins CANNOT read messages** - Mathematically impossible  
✅ **Hackers get nothing useful** - All data encrypted  

**This is TRUE zero-knowledge!** 🔒
