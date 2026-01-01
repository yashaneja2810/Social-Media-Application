# Encryption & Security Guide

## Overview

This backend implements a **privacy-first architecture** where:
- ✅ All message content is encrypted client-side
- ✅ Server never sees plaintext messages
- ✅ Encryption keys never leave the client
- ✅ Backups are encrypted with user-controlled keys

## Encryption Flow

### 1. Message Encryption (Client-Side)

```javascript
// Client generates per-chat symmetric key
async function generateChatKey() {
  return await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,  // extractable
    ['encrypt', 'decrypt']
  );
}

// Encrypt a message
async function encryptMessage(plaintext, chatKey) {
  const encoder = new TextEncoder();
  const data = encoder.encode(plaintext);
  
  // Generate random IV
  const iv = crypto.getRandomValues(new Uint8Array(12));
  
  // Encrypt
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv },
    chatKey,
    data
  );
  
  // Combine IV + encrypted data
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(encrypted), iv.length);
  
  // Return base64
  return btoa(String.fromCharCode(...combined));
}

// Send to server
await fetch('/api/messages', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${supabaseToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    chat_id: chatId,
    encrypted_content: encryptedBase64,  // Server stores this
    message_type: 'text',
    encryption_key_id: 'chat_key_v1'
  })
});
```

### 2. Message Decryption (Client-Side)

```javascript
async function decryptMessage(encryptedBase64, chatKey) {
  // Decode base64
  const combined = Uint8Array.from(
    atob(encryptedBase64),
    c => c.charCodeAt(0)
  );
  
  // Extract IV and encrypted data
  const iv = combined.slice(0, 12);
  const encrypted = combined.slice(12);
  
  // Decrypt
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv },
    chatKey,
    encrypted
  );
  
  // Convert to string
  const decoder = new TextDecoder();
  return decoder.decode(decrypted);
}
```

### 3. Key Storage (Client-Side)

```javascript
// Store keys in IndexedDB (encrypted with master key)
async function storeKey(chatId, key) {
  const db = await openDB('chat-keys');
  const exported = await crypto.subtle.exportKey('raw', key);
  
  await db.put('keys', {
    chatId: chatId,
    key: Array.from(new Uint8Array(exported))
  });
}

// Retrieve key
async function getKey(chatId) {
  const db = await openDB('chat-keys');
  const stored = await db.get('keys', chatId);
  
  if (!stored) return null;
  
  return await crypto.subtle.importKey(
    'raw',
    new Uint8Array(stored.key),
    { name: 'AES-GCM' },
    true,
    ['encrypt', 'decrypt']
  );
}
```

## Group Chat Encryption

### Initial Setup

```javascript
// Creator generates group key
const groupKey = await generateChatKey();

// Export for sharing with members
const exportedKey = await crypto.subtle.exportKey('raw', groupKey);

// Encrypt group key for each member with their public key
for (const member of members) {
  const encryptedGroupKey = await encryptForMember(exportedKey, member.publicKey);
  await sendKeyToMember(member.id, encryptedGroupKey);
}
```

### Key Rotation (When Member Leaves)

```javascript
// 1. Backend notifies remaining members
socket.on('group:member:removed', async ({ groupId, removedUserId }) => {
  // 2. Generate new group key
  const newGroupKey = await generateChatKey();
  
  // 3. Re-encrypt for remaining members
  await redistributeGroupKey(groupId, newGroupKey);
  
  // 4. Store mapping: old key for old messages, new key for new messages
  await db.put('group-keys', {
    groupId: groupId,
    keys: [
      { keyId: 'v1', key: oldKey, validUntil: Date.now() },
      { keyId: 'v2', key: newGroupKey, validFrom: Date.now() }
    ]
  });
});
```

## Backup Encryption

### Creating Encrypted Backup

```javascript
async function createBackup(userPassword) {
  // 1. Export all chat data
  const allChats = await exportAllChats();
  const allKeys = await exportAllKeys();
  
  const backupData = {
    version: 1,
    timestamp: Date.now(),
    chats: allChats,
    keys: allKeys,
    settings: userSettings
  };
  
  // 2. Derive encryption key from password
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const backupKey = await deriveKeyFromPassword(userPassword, salt);
  
  // 3. Encrypt backup
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv },
    backupKey,
    new TextEncoder().encode(JSON.stringify(backupData))
  );
  
  // 4. Package: salt + iv + encrypted
  const backup = {
    salt: Array.from(salt),
    iv: Array.from(iv),
    data: Array.from(new Uint8Array(encrypted))
  };
  
  // 5. Send to server
  const backupBase64 = btoa(JSON.stringify(backup));
  
  await fetch('/api/backup', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${supabaseToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      encrypted_data: backupBase64,
      backup_size: backupBase64.length
    })
  });
}

// Password-based key derivation
async function deriveKeyFromPassword(password, salt) {
  const encoder = new TextEncoder();
  const passwordKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );
  
  return await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,  // High iteration count for security
      hash: 'SHA-256'
    },
    passwordKey,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
}
```

### Restoring from Backup

```javascript
async function restoreBackup(backupBase64, userPassword) {
  // 1. Parse backup
  const backup = JSON.parse(atob(backupBase64));
  const salt = new Uint8Array(backup.salt);
  const iv = new Uint8Array(backup.iv);
  const encrypted = new Uint8Array(backup.data);
  
  // 2. Derive key from password
  const backupKey = await deriveKeyFromPassword(userPassword, salt);
  
  // 3. Decrypt
  try {
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv },
      backupKey,
      encrypted
    );
    
    const backupData = JSON.parse(new TextDecoder().decode(decrypted));
    
    // 4. Restore to IndexedDB
    await restoreChats(backupData.chats);
    await restoreKeys(backupData.keys);
    await restoreSettings(backupData.settings);
    
    return true;
  } catch (error) {
    console.error('Decryption failed - wrong password?', error);
    return false;
  }
}
```

## Authentication Security

### JWT Verification (Backend)

```typescript
import { supabaseAdmin } from './config/supabase';

async function verifySupabaseToken(token: string) {
  try {
    // Supabase verifies JWT signature using its secret
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    
    if (error || !user) {
      throw new Error('Invalid token');
    }
    
    return user;
  } catch (error) {
    throw new Error('Authentication failed');
  }
}
```

### Socket Authentication

```typescript
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    
    if (!token) {
      return next(new Error('Authentication required'));
    }
    
    const user = await verifySupabaseToken(token);
    
    socket.userId = user.id;
    socket.email = user.email;
    
    next();
  } catch (error) {
    next(new Error('Authentication failed'));
  }
});
```

## Security Best Practices

### 1. Never Log Encrypted Content

```typescript
// ❌ BAD
logger.info('Message sent', { encryptedContent: message.encrypted_content });

// ✅ GOOD
logger.info('Message sent', {
  messageId: message.id,
  chatId: message.chat_id,
  messageType: message.message_type
});
```

### 2. Validate All Inputs

```typescript
const messageSchema = Joi.object({
  chat_id: Joi.string().uuid().required(),
  encrypted_content: Joi.string().max(1000000).required(), // 1MB limit
  message_type: Joi.string().valid('text', 'image', 'file', 'voice').required(),
});
```

### 3. Rate Limiting

```typescript
// Prevent brute force and DDoS
const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 100,  // 100 requests per window
});

app.use('/api/', rateLimiter);
```

### 4. Secure Headers

```typescript
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
}));
```

## Threat Model

### What We Protect Against

✅ **Server Compromise**
- Even if backend is hacked, messages remain encrypted
- Keys never stored on server

✅ **Man-in-the-Middle**
- HTTPS/TLS for transport
- End-to-end encryption for content

✅ **Database Breach**
- Only encrypted blobs in database
- No plaintext messages or keys

✅ **Unauthorized Access**
- JWT verification on every request
- Row Level Security in database

### What We Don't Protect Against

❌ **Client Compromise**
- If client device is hacked, keys can be stolen
- Mitigation: Device verification

❌ **Password Loss**
- Lost password = lost backup access
- Mitigation: Password recovery questions (weakens security)

❌ **Malicious Group Admin**
- Admin could add attacker before rotating keys
- Mitigation: Audit logs

## Key Rotation Strategy

### When to Rotate

1. **Member Leaves Group**: Immediate rotation
2. **Suspected Compromise**: Manual rotation
3. **Periodic Rotation**: Every 30 days (optional)
4. **Device Removed**: Rotate on next message

### Implementation

```javascript
async function rotateGroupKey(groupId) {
  // 1. Generate new key
  const newKey = await generateChatKey();
  const newKeyId = `v${Date.now()}`;
  
  // 2. Get current members
  const members = await getGroupMembers(groupId);
  
  // 3. Distribute new key to members
  for (const member of members) {
    await sendEncryptedKey(member.id, newKey, newKeyId);
  }
  
  // 4. Update local mapping
  await updateKeyMapping(groupId, {
    oldKeyId: currentKeyId,
    newKeyId: newKeyId,
    rotatedAt: Date.now()
  });
  
  return newKeyId;
}
```

## Forward Secrecy

### Double Ratchet (Signal Protocol Concept)

For maximum security, implement Signal's Double Ratchet:

```javascript
// Simplified concept
class DoubleRatchet {
  async initiate(theirPublicKey) {
    this.rootKey = await deriveSharedSecret(this.privateKey, theirPublicKey);
    this.sendChain = await deriveChainKey(this.rootKey, 'send');
    this.receiveChain = await deriveChainKey(this.rootKey, 'receive');
  }
  
  async encryptMessage(plaintext) {
    const messageKey = await this.sendChain.next();
    const encrypted = await encrypt(plaintext, messageKey);
    
    // Delete message key immediately
    await secureDelete(messageKey);
    
    return encrypted;
  }
}
```

**Benefits**:
- Past messages safe even if current key compromised
- Each message encrypted with unique key
- Keys deleted after use

## Security Checklist

### Backend

- [x] Supabase JWT verification on all routes
- [x] Rate limiting enabled
- [x] CORS configured
- [x] Helmet.js security headers
- [x] Input validation with Joi
- [x] No logging of encrypted content
- [x] HTTPS in production
- [x] Environment variables for secrets
- [x] Row Level Security enabled

### Client (Frontend Implementation)

- [ ] WebCrypto API for encryption
- [ ] Keys stored in IndexedDB (encrypted)
- [ ] No keys in localStorage
- [ ] No plaintext in network requests
- [ ] Secure password requirements
- [ ] Key rotation on member changes
- [ ] Device verification
- [ ] Secure backup with strong password

### Infrastructure

- [ ] HTTPS/TLS certificates
- [ ] WSS for WebSocket
- [ ] Redis password set
- [ ] Database credentials rotated
- [ ] Firewall rules configured
- [ ] Monitoring and alerts
- [ ] Regular security updates

## Compliance Considerations

### GDPR

- ✅ User can export data (via backup)
- ✅ User can delete data (delete account)
- ✅ Minimal data collection
- ✅ Encryption at rest and in transit

### Data Retention

```sql
-- Automatically delete expired messages
CREATE OR REPLACE FUNCTION cleanup_expired_messages()
RETURNS void AS $$
BEGIN
  DELETE FROM messages
  WHERE expires_at IS NOT NULL
  AND expires_at < NOW();
END;
$$ LANGUAGE plpgsql;
```

## Incident Response

### If Server is Compromised

1. **Immediate Actions**:
   - Rotate all JWT secrets
   - Revoke all active sessions
   - Notify users
   - Enable maintenance mode

2. **Investigation**:
   - Check access logs
   - Identify breach vector
   - Assess data exposure

3. **Recovery**:
   - Patch vulnerability
   - Restore from clean backup
   - Force password resets
   - Re-verify all devices

### If Encryption Weakness Found

1. **Immediate**:
   - Notify users
   - Provide migration tool
   - Keep old system running

2. **Migration**:
   - Implement new encryption
   - Re-encrypt all data
   - Verify integrity

## Resources

- [Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API)
- [Signal Protocol](https://signal.org/docs/)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Supabase Auth](https://supabase.com/docs/guides/auth)
