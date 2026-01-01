# Frontend - Privacy-First Chat Application

## Status: Pending Implementation

The frontend for this privacy-first chat application will be built separately.

## What the Frontend Needs to Do

### 1. Client-Side Encryption (CRITICAL)
- Implement Web Crypto API for AES-256-GCM encryption
- Generate and manage per-chat symmetric keys
- Store keys securely in IndexedDB
- Encrypt all messages before sending to backend
- Decrypt all received messages

### 2. Supabase Authentication
- Email signup/login UI
- Email verification flow
- Password reset
- Session management
- JWT token storage

### 3. Socket.IO Integration
- Connect with JWT authentication
- Handle real-time message events
- Typing indicators
- Presence updates
- Reconnection handling

### 4. Core UI Components
- Chat list
- Message thread
- Friend list
- Group management
- User settings
- Privacy controls

### 5. Features to Implement
- Send/receive messages
- Image/file sharing
- Voice messages
- Friend requests
- Group creation
- Google Drive backup
- Device verification
- Self-destructing messages

## Recommended Tech Stack

```json
{
  "framework": "React/Vue/Svelte",
  "language": "TypeScript",
  "styling": "TailwindCSS",
  "state": "Zustand/Pinia/Redux",
  "database": "IndexedDB (Dexie.js)",
  "encryption": "Web Crypto API",
  "realtime": "Socket.IO Client",
  "auth": "Supabase JS Client",
  "build": "Vite"
}
```

## Example Encryption Implementation

```typescript
// encryption.ts
class MessageEncryption {
  async generateChatKey(): Promise<CryptoKey> {
    return await crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );
  }

  async encrypt(plaintext: string, key: CryptoKey): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(plaintext);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      data
    );
    
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(encrypted), iv.length);
    
    return btoa(String.fromCharCode(...combined));
  }

  async decrypt(encrypted: string, key: CryptoKey): Promise<string> {
    const combined = Uint8Array.from(atob(encrypted), c => c.charCodeAt(0));
    const iv = combined.slice(0, 12);
    const data = combined.slice(12);
    
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      data
    );
    
    return new TextDecoder().decode(decrypted);
  }
}
```

## Getting Started (When Ready)

```bash
# Create Vite project
npm create vite@latest frontend -- --template react-ts

cd frontend
npm install

# Install dependencies
npm install @supabase/supabase-js socket.io-client dexie

# Install UI dependencies
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p

# Start development
npm run dev
```

## Integration with Backend

```typescript
// Connect to backend
const socket = io('http://localhost:3000', {
  auth: {
    token: supabaseSession.access_token
  }
});

// Send encrypted message
const chatKey = await getChatKey(chatId);
const encrypted = await encrypt(message, chatKey);

socket.emit('message:send', {
  chatId,
  encryptedContent: encrypted,
  messageType: 'text'
});

// Receive and decrypt
socket.on('message:receive', async (message) => {
  const chatKey = await getChatKey(message.chat_id);
  const plaintext = await decrypt(message.encrypted_content, chatKey);
  displayMessage(plaintext);
});
```

## Security Checklist

- [ ] All encryption/decryption client-side
- [ ] Keys stored in IndexedDB (never localStorage)
- [ ] No plaintext sent to server
- [ ] JWT tokens stored securely
- [ ] HTTPS in production
- [ ] CSP headers configured
- [ ] No sensitive data in logs
- [ ] Key rotation on member changes

## Resources

- [Web Crypto API Docs](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API)
- [Socket.IO Client Docs](https://socket.io/docs/v4/client-api/)
- [Supabase Auth Docs](https://supabase.com/docs/guides/auth)
- [Dexie.js (IndexedDB)](https://dexie.org/)

## Contact Backend

The backend is running at:
- **Development**: http://localhost:3000
- **API Docs**: See [../backend/docs/API_REFERENCE.md](../backend/docs/API_REFERENCE.md)
- **Encryption Guide**: See [../backend/docs/ENCRYPTION.md](../backend/docs/ENCRYPTION.md)

---

**Note**: This is a placeholder. Frontend implementation will begin after backend is fully tested and deployed.
