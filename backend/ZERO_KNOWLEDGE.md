# 🔐 Zero-Knowledge Encryption Architecture

## What is Zero-Knowledge?

**Zero-knowledge encryption** means:
- ✅ **ONLY** the sender and receiver can read messages
- ✅ Your company/backend **CANNOT** read any messages
- ✅ Database administrators **CANNOT** read any messages
- ✅ Even if someone hacks your servers, they get **NOTHING**

---

## How It Works (Simple Explanation)

```
┌────────────────────────────────────────────────────────────┐
│                     ALICE'S DEVICE                         │
│                                                            │
│  1. Alice types: "Hello Bob"                              │
│  2. Browser encrypts with chat key (stored locally)       │
│     → Result: "x8K3mP9..." (gibberish)                    │
│  3. Send encrypted gibberish to server                    │
│                                                            │
└──────────────────┬─────────────────────────────────────────┘
                   │
                   │ Encrypted: "x8K3mP9..."
                   ▼
┌────────────────────────────────────────────────────────────┐
│                    YOUR BACKEND SERVER                     │
│                                                            │
│  ❌ Server sees ONLY: "x8K3mP9..." (gibberish)            │
│  ❌ Server has NO KEY to decrypt                          │
│  ❌ Server just forwards encrypted data                   │
│                                                            │
│  Database stores:                                          │
│  {                                                         │
│    "encrypted_content": "x8K3mP9...",  ← GIBBERISH        │
│    "sender_id": "alice",                                   │
│    "timestamp": "2025-12-31"                               │
│  }                                                         │
│                                                            │
└──────────────────┬─────────────────────────────────────────┘
                   │
                   │ Still encrypted: "x8K3mP9..."
                   ▼
┌────────────────────────────────────────────────────────────┐
│                     BOB'S DEVICE                           │
│                                                            │
│  1. Bob receives: "x8K3mP9..."                            │
│  2. Browser decrypts with chat key (stored locally)       │
│     → Result: "Hello Bob"                                  │
│  3. Bob sees: "Hello Bob"                                  │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

---

## Technical Implementation

### 1. Key Generation (Client-Side ONLY)

```javascript
// frontend/src/crypto/keys.js

// Generate encryption key pair (never sent to server!)
async function generateUserKeys() {
  const keyPair = await crypto.subtle.generateKey(
    {
      name: 'RSA-OAEP',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['encrypt', 'decrypt']
  );

  // Store private key in IndexedDB (NEVER upload!)
  await storePrivateKey(keyPair.privateKey);

  // Upload public key to server (safe to share)
  await uploadPublicKey(keyPair.publicKey);

  return keyPair;
}

// Generate chat-specific symmetric key
async function generateChatKey() {
  const key = await crypto.subtle.generateKey(
    {
      name: 'AES-GCM',
      length: 256,
    },
    true,
    ['encrypt', 'decrypt']
  );

  // Store in IndexedDB locally
  await storeChatKey(chatId, key);

  return key;
}
```

### 2. Message Encryption (Client-Side)

```javascript
// frontend/src/crypto/encrypt.js

async function encryptMessage(plaintext, chatId) {
  // Get chat key from local storage (IndexedDB)
  const chatKey = await getChatKey(chatId);

  // Generate random IV (Initialization Vector)
  const iv = crypto.getRandomValues(new Uint8Array(12));

  // Encrypt the message
  const encoder = new TextEncoder();
  const data = encoder.encode(plaintext);

  const ciphertext = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv,
    },
    chatKey,
    data
  );

  // Package encrypted data
  return {
    encrypted_content: arrayBufferToBase64(ciphertext),
    iv: arrayBufferToBase64(iv),
    // NO plaintext included!
  };
}
```

### 3. Send to Backend (Encrypted Only)

```javascript
// frontend/src/api/messages.js

async function sendMessage(chatId, plaintext) {
  // 1. Encrypt on client
  const encrypted = await encryptMessage(plaintext, chatId);

  // 2. Send ONLY encrypted data to server
  socket.emit('message:send', {
    chat_id: chatId,
    encrypted_content: encrypted.encrypted_content, // ← Gibberish
    iv: encrypted.iv,
    // Server NEVER sees plaintext!
  });

  // 3. Server cannot decrypt - it has no key!
}
```

### 4. Backend Storage (Encrypted Blobs)

```typescript
// backend/src/socket/index.ts

socket.on('message:send', async (data) => {
  // Server receives ONLY encrypted gibberish
  const message = {
    chat_id: data.chat_id,
    sender_id: socket.userId,
    encrypted_content: data.encrypted_content, // ← Cannot decrypt!
    iv: data.iv,
    timestamp: new Date().toISOString(),
  };

  // Store encrypted blob in database
  await MessageModel.create(message);

  // Forward encrypted blob to recipient
  io.to(recipientSocketId).emit('message:receive', message);

  // ❌ Server NEVER sees plaintext
  // ❌ Database NEVER stores plaintext
});
```

### 5. Decryption (Client-Side)

```javascript
// frontend/src/crypto/decrypt.js

async function decryptMessage(encryptedData, chatId) {
  // Get chat key from local IndexedDB
  const chatKey = await getChatKey(chatId);

  // Convert from base64
  const ciphertext = base64ToArrayBuffer(encryptedData.encrypted_content);
  const iv = base64ToArrayBuffer(encryptedData.iv);

  // Decrypt
  const plaintext = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: iv,
    },
    chatKey,
    ciphertext
  );

  // Convert back to text
  const decoder = new TextDecoder();
  return decoder.decode(plaintext);
}
```

---

## ❌ CRITICAL: Private Keys Are NEVER Shared!

**Each user has their OWN private key that NEVER leaves their device.**

### How Key Sharing Actually Works:

1. **User Keys (RSA)** - Each user has a key pair:
   - **Private Key** → Never shared, stays on device forever
   - **Public Key** → Uploaded to server, everyone can access

2. **Chat Keys (AES)** - Symmetric key for each chat:
   - Generated by chat initiator
   - Encrypted using recipient's PUBLIC key
   - Only recipient can decrypt using their PRIVATE key

---

## 1-on-1 Chat: How Alice Shares Chat Key with Bob

### Step 1: Alice Generates and Encrypts Chat Key

```javascript
// frontend/src/crypto/directChat.js - Alice's Device

async function startChatWithBob(bobUserId) {
  // 1. Generate a NEW symmetric key for this chat
  const chatKey = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );

  // 2. Store chat key locally (Alice's device)
  await storeChatKey('chat_with_bob', chatKey);

  // 3. Fetch Bob's PUBLIC key from server
  const response = await fetch(`/api/users/${bobUserId}/public-key`);
  const { public_key } = await response.json();
  const bobPublicKey = await importPublicKey(public_key);

  // 4. Encrypt chat key with Bob's PUBLIC key
  const exportedChatKey = await crypto.subtle.exportKey('raw', chatKey);
  const encryptedChatKey = await crypto.subtle.encrypt(
    { name: 'RSA-OAEP' },
    bobPublicKey, // ← Bob's PUBLIC key (NOT private!)
    exportedChatKey
  );

  // 5. Send encrypted chat key to server
  await fetch('/api/chats/share-key', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      recipient_id: bobUserId,
      encrypted_chat_key: arrayBufferToBase64(encryptedChatKey)
    })
  });

  // Server stores encrypted key but CANNOT decrypt it!
}
```

### Step 2: Bob Receives and Decrypts Chat Key

```javascript
// frontend/src/crypto/directChat.js - Bob's Device

socket.on('chat_key_received', async (data) => {
  // 1. Receive encrypted chat key from server
  const encryptedChatKey = base64ToArrayBuffer(data.encrypted_chat_key);

  // 2. Get Bob's PRIVATE key from local IndexedDB
  const bobPrivateKey = await getMyPrivateKey();

  // 3. Decrypt chat key using Bob's PRIVATE key
  const decryptedChatKey = await crypto.subtle.decrypt(
    { name: 'RSA-OAEP' },
    bobPrivateKey, // ← Only Bob can decrypt with HIS private key
    encryptedChatKey
  );

  // 4. Import and store the chat key locally
  const chatKey = await crypto.subtle.importKey(
    'raw',
    decryptedChatKey,
    { name: 'AES-GCM' },
    true,
    ['encrypt', 'decrypt']
  );

  await storeChatKey('chat_with_alice', chatKey);

  // Now both Alice and Bob have the same chat key!
  // But server NEVER had access to it!
});
```

---

## Group Chat Key Sharing

### Problem: How do group members get the chat key?

```javascript
// frontend/src/crypto/groupKeys.js

async function shareGroupKey(groupId, newMemberId) {
  // 1. Get group's symmetric key from local storage
  const groupKey = await getChatKey(groupId);

  // 2. Fetch new member's PUBLIC key from server
  const response = await fetch(`/api/users/${newMemberId}/public-key`);
  const { public_key } = await response.json();
  const memberPublicKey = await importPublicKey(public_key);

  // 3. Encrypt group key with member's PUBLIC key (NOT private!)
  const exportedKey = await crypto.subtle.exportKey('raw', groupKey);
  const encryptedKey = await crypto.subtle.encrypt(
    { name: 'RSA-OAEP' },
    memberPublicKey, // ← Member's PUBLIC key
    exportedKey
  );

  // 4. Send encrypted key to server (server still can't decrypt!)
  await fetch('/api/groups/share-key', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      group_id: groupId,
      recipient_id: newMemberId,
      encrypted_group_key: arrayBufferToBase64(encryptedKey)
    })
  });
}

// New member decrypts the group key
async function receiveGroupKey(data) {
  // 1. Receive encrypted group key
  const encryptedKey = base64ToArrayBuffer(data.encrypted_group_key);

  // 2. Get MY private key from local IndexedDB (never shared!)
  const myPrivateKey = await getMyPrivateKey();

  // 3. Decrypt group key using MY private key
  const decryptedKey = await crypto.subtle.decrypt(
    { name: 'RSA-OAEP' },
    myPrivateKey, // ← My PRIVATE key (never left my device)
    encryptedKey
  );

  // 4. Import and store group key locally
  const groupKey = await crypto.subtle.importKey(
    'raw',
    decryptedKey,
    { name: 'AES-GCM' },
    true,
    ['encrypt', 'decrypt']
  );

  await storeChatKey(data.group_id, groupKey);

  // Now I can read group messages!
}
```

---

## Backend API Reference

### 1. Public Key Management

#### Upload Your Public Key (Once during signup)

```http
POST /api/users/public-key
Authorization: Bearer <supabase_jwt>
Content-Type: application/json

{
  "public_key": "MIIBIjANBgkqhki...base64_encoded_RSA_public_key"
}

Response:
{
  "success": true,
  "message": "Public key stored successfully"
}
```

#### Get Someone's Public Key

```http
GET /api/users/:userId/public-key
Authorization: Bearer <supabase_jwt>

Response:
{
  "public_key": "MIIBIjANBgkqhki...base64_encoded_RSA_public_key"
}
```

### 2. Chat Key Sharing

#### Share Encrypted Chat Key with Participant

```http
POST /api/chats/:chatId/share-key
Authorization: Bearer <supabase_jwt>
Content-Type: application/json

{
  "recipient_id": "uuid-of-recipient",
  "encrypted_chat_key": "x9K2mP...base64_encrypted_AES_key"
}

Response:
{
  "success": true,
  "message": "Chat key shared successfully"
}
```

#### Get Your Encrypted Chat Key

```http
GET /api/chats/:chatId/my-key
Authorization: Bearer <supabase_jwt>

Response:
{
  "encrypted_chat_key": "x9K2mP...base64_encrypted_AES_key"
}
```

### 3. WebSocket Events

#### Share Chat Key via Socket

```javascript
// Client emits
socket.emit('chat:key:share', {
  chatId: 'chat-uuid',
  recipientId: 'user-uuid',
  encryptedChatKey: 'base64_encrypted_key'
});

// Recipient receives
socket.on('chat:key:received', (data) => {
  // data = {
  //   chatId: 'chat-uuid',
  //   from: 'sender-uuid',
  //   encrypted_chat_key: 'base64_encrypted_key'
  // }
});
```

---

## What Backend Stores (All Encrypted)

### Database Schema

```sql
-- User public keys table (safe to store - public!)
CREATE TABLE user_keys (
  user_id UUID PRIMARY KEY,
  public_key TEXT NOT NULL,  -- ✅ Safe to store (public key)
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Chat keys table (encrypted per recipient)
CREATE TABLE chat_keys (
  id UUID PRIMARY KEY,
  chat_id UUID NOT NULL,
  sender_id UUID NOT NULL,
  recipient_id UUID NOT NULL,
  encrypted_chat_key TEXT NOT NULL,  -- ❌ Server cannot decrypt!
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Messages table
CREATE TABLE messages (
  id UUID PRIMARY KEY,
  chat_id UUID NOT NULL,
  sender_id UUID NOT NULL,
  encrypted_content TEXT NOT NULL,  -- ❌ Backend cannot decrypt!
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  status TEXT DEFAULT 'sent'
);

-- Example row in database:
{
  "id": "abc-123",
  "chat_id": "chat-456",
  "sender_id": "user-789",
  "encrypted_content": "x8K3mP9nF2zQ7wL1...",  ← GIBBERISH
  "iv": "kL9mX2p...",
  "timestamp": "2025-12-31T10:30:00Z"
}
```

### What If Someone Hacks Your Database?

```
Hacker gets:
✅ encrypted_content: "x8K3mP9..." ← Useless gibberish
✅ sender_id, timestamp            ← Metadata only
❌ Plaintext message                ← NEVER stored!
❌ Encryption keys                  ← NEVER uploaded!

Result: Hacker gains NOTHING useful!
```

---

## Key Storage Locations

| Item | Stored Where | Who Has Access? |
|------|--------------|-----------------|
| **Private Key** | Client IndexedDB | ✅ User only |
| **Public Key** | Server database | ✅ Everyone (safe) |
| **Chat Symmetric Key** | Client IndexedDB | ✅ Chat participants |
| **Encrypted Messages** | Server database | ❌ Nobody (encrypted) |
| **Plaintext Messages** | Client memory (temp) | ✅ User only |

---

## Backend Cannot Decrypt Because:

```typescript
// backend/src/socket/index.ts

socket.on('message:send', async (data) => {
  // Received: "x8K3mP9..." (encrypted)
  
  // ❌ Server has NO private key
  // ❌ Server has NO chat symmetric key
  // ❌ Server CANNOT call decrypt()
  
  // ✅ Server can only:
  const message = {
    encrypted_content: data.encrypted_content, // Just store gibberish
    sender_id: socket.userId,
    timestamp: new Date(),
  };
  
  await saveToDatabase(message); // Saves encrypted blob
  forwardToRecipient(message);   // Forwards encrypted blob
  
  // Server is a "dumb pipe" - just moves encrypted data around
});
```

---

## Backup Encryption (Also Zero-Knowledge)

```javascript
// frontend/src/backup/encrypt.js

async function createBackup(password) {
  // 1. Export all keys and messages from IndexedDB
  const data = {
    privateKey: await exportPrivateKey(),
    chatKeys: await exportAllChatKeys(),
    messages: await exportMessages(),
  };

  // 2. Derive encryption key from user's password
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const passwordKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  const encryptionKey = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,
      hash: 'SHA-256',
    },
    passwordKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  );

  // 3. Encrypt the backup with password-derived key
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv },
    encryptionKey,
    new TextEncoder().encode(JSON.stringify(data))
  );

  // 4. Upload encrypted backup to Google Drive
  await uploadToGoogleDrive({
    encrypted_data: arrayBufferToBase64(encrypted),
    salt: arrayBufferToBase64(salt),
    iv: arrayBufferToBase64(iv),
  });

  // ❌ Server cannot decrypt backup without user's password!
}
```

---

## Comparison: Regular vs Zero-Knowledge

### Regular Chat App (WhatsApp Web, Telegram Web)

```
Database stores:
{
  "message": "Hello Bob",      ← ❌ PLAINTEXT!
  "sender": "Alice"
}

Risk: Database admin can read all messages!
```

### Your Zero-Knowledge App

```
Database stores:
{
  "encrypted_content": "x8K3mP9...",  ← ✅ GIBBERISH!
  "sender": "Alice"
}

Risk: Even if hacked, attacker gets nothing!
```

---

## Security Guarantees

### ✅ What Zero-Knowledge Guarantees:

1. **Server cannot read messages** - No decryption keys on server
2. **Database admin cannot read messages** - Only encrypted blobs stored
3. **Hackers cannot read messages** - Even with full database access
4. **Government cannot read messages** - No backdoor possible
5. **Company employees cannot read messages** - Not technically possible

### ⚠️ What Zero-Knowledge CANNOT Prevent:

1. **Keylogger on user's device** - If device is compromised, keys are exposed
2. **Malicious browser extension** - Can steal keys from memory
3. **Man-in-the-middle on first key exchange** - If server is malicious from start
4. **User sharing their password** - Backup decryption becomes possible

---

## Implementation Checklist

### Client-Side (Frontend)

```javascript
✅ Generate RSA key pair locally
✅ Store private key in IndexedDB (never upload!)
✅ Upload public key to server
✅ Generate AES-GCM keys for each chat
✅ Encrypt messages before sending
✅ Decrypt messages after receiving
✅ Encrypt backups with password
✅ Never send plaintext to server
```

### Server-Side (Backend)

```typescript
✅ Store only encrypted blobs
✅ Store only public keys (not private!)
✅ Never attempt to decrypt messages
✅ Forward encrypted data as-is
✅ Log only metadata (sender, timestamp)
✅ Encrypted backups to Google Drive
❌ NEVER store plaintext
❌ NEVER store private keys
❌ NEVER store chat symmetric keys
```

---

## Verification

### How to Verify Your App is Zero-Knowledge:

```bash
# 1. Inspect database
SELECT encrypted_content FROM messages LIMIT 1;
# Should return: "x8K3mP9..." (gibberish)

# 2. Check network traffic (browser DevTools)
# WebSocket messages should show:
{
  "encrypted_content": "kL9mX2p...",  ← Gibberish
  "iv": "..."
}

# 3. Verify backend logs
# Should NEVER show plaintext messages

# 4. Try to decrypt from backend
# Attempt to decrypt in backend code → Should fail (no keys)
```

---

## Summary

**Your architecture is ZERO-KNOWLEDGE because:**

1. ✅ Encryption happens **CLIENT-SIDE** (browser)
2. ✅ Keys stored **CLIENT-SIDE** (IndexedDB)
3. ✅ Server sees **ONLY ENCRYPTED BLOBS**
4. ✅ Database stores **ONLY ENCRYPTED BLOBS**
5. ✅ Decryption happens **CLIENT-SIDE** (browser)

**Nobody can read messages except:**
- The sender (has the key)
- The recipient(s) (have the key)

**Not even:**
- ❌ Your company
- ❌ Database admins
- ❌ Server operators
- ❌ Hackers
- ❌ Government

This is **true end-to-end encryption** with **zero-knowledge** architecture! 🎉
