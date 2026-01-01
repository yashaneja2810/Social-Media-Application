# Architecture & Design Decisions

## System Architecture

### High-Level Overview

```
┌──────────────────────────────────────────────────────────────┐
│                        Client Layer                           │
│  (Browser - React/Vue/etc with WebCrypto for encryption)     │
└────────────────┬─────────────────────────────────────────────┘
                 │
                 │ HTTPS/WSS
                 │ Encrypted Messages
                 ▼
┌──────────────────────────────────────────────────────────────┐
│                      Backend Layer                            │
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────────┐    │
│  │   Express    │  │  Socket.IO   │  │   Middleware    │    │
│  │   REST API   │  │   WebSocket  │  │  (Auth, Rate    │    │
│  │              │  │              │  │   Limiting)     │    │
│  └──────┬───────┘  └──────┬───────┘  └────────┬────────┘    │
│         │                 │                    │             │
│         └─────────────────┴────────────────────┘             │
│                          │                                   │
│         ┌────────────────┴────────────────┐                  │
│         │                                 │                  │
│         ▼                                 ▼                  │
│  ┌──────────────┐                  ┌──────────────┐         │
│  │   Business   │                  │    Redis     │         │
│  │    Logic     │◄─────────────────│   Caching    │         │
│  │   (Models)   │                  │   Presence   │         │
│  └──────┬───────┘                  │   Pub/Sub    │         │
│         │                          └──────────────┘         │
└─────────┼──────────────────────────────────────────────────┘
          │
          │ JWT Verification
          │ Encrypted Blobs Only
          ▼
┌──────────────────────────────────────────────────────────────┐
│                     Data Layer                                │
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────────┐    │
│  │   Supabase   │  │  PostgreSQL  │  │  Google Drive   │    │
│  │     Auth     │  │   Database   │  │    Backups      │    │
│  │              │  │  (Encrypted  │  │  (Encrypted)    │    │
│  │              │  │    Blobs)    │  │                 │    │
│  └──────────────┘  └──────────────┘  └─────────────────┘    │
└──────────────────────────────────────────────────────────────┘
```

## Core Design Principles

### 1. Privacy First

**Principle**: Server should never have access to plaintext message content.

**Implementation**:
- All encryption/decryption happens client-side
- Server stores only encrypted blobs as base64 strings
- No encryption keys stored on server
- Backups are encrypted before upload

**Trade-offs**:
- ✅ Maximum privacy
- ✅ Server breach doesn't expose messages
- ❌ No server-side search
- ❌ No server-side AI features on content

### 2. Authentication via Supabase

**Why Supabase**:
- Production-ready authentication
- Email verification built-in
- JWT tokens with automatic refresh
- Row Level Security in PostgreSQL
- No need to build custom auth

**Flow**:
```
1. Client → Supabase: Email/Password
2. Supabase → Client: JWT Token
3. Client → Backend: JWT in Authorization header
4. Backend → Supabase: Verify JWT
5. Backend: Extract user_id, proceed
```

### 3. Real-Time via Socket.IO

**Why Socket.IO**:
- Automatic reconnection
- Room-based broadcasting
- Fallback to long-polling
- Better DX than raw WebSocket

**Connection Flow**:
```javascript
// 1. Client connects with JWT
const socket = io('backend-url', {
  auth: { token: supabaseJwt }
});

// 2. Server middleware verifies JWT
io.use(async (socket, next) => {
  const user = await verifySupabaseToken(socket.handshake.auth.token);
  socket.userId = user.id;
  next();
});

// 3. User joins rooms
socket.join(`user:${userId}`);        // Personal notifications
socket.join(`chat:${chatId}`);        // Each chat they're in
```

### 4. Redis for Real-Time State

**Use Cases**:
- **Presence**: Who's online (5-min TTL)
- **Typing**: Who's typing (5-sec TTL)
- **Offline Messages**: Queue for offline users (7-day TTL)
- **Google Tokens**: OAuth credentials (7-day TTL)

**Why Redis**:
- Fast in-memory operations
- Automatic expiration
- Pub/Sub for multi-server scaling
- Atomic operations

### 5. Encryption Model

**Client-Side Encryption**:

```javascript
// Per-chat symmetric key (AES-256-GCM)
const chatKey = await generateChatKey();

// Encrypt message
const iv = crypto.getRandomValues(new Uint8Array(12));
const encrypted = await crypto.subtle.encrypt(
  { name: 'AES-GCM', iv },
  chatKey,
  messageBuffer
);

// Send to server
const payload = {
  encrypted_content: base64(iv + encrypted),
  encryption_key_id: 'chat_v1'
};
```

**Key Management** (Client-Side):
- Symmetric keys stored in IndexedDB
- Keys never leave client
- New key on key rotation (e.g., member change)

**Forward Secrecy**:
- Implement ratcheting for long-term chats
- Periodic key rotation
- Old keys deleted after rotation

### 6. Group Chat Key Rotation

**Problem**: When someone leaves a group, they shouldn't decrypt future messages.

**Solution**:
```
1. Admin removes member from group
2. Backend notifies remaining members
3. Remaining members generate new group key
4. Old messages: encrypted with old key (member can still decrypt)
5. New messages: encrypted with new key (member cannot decrypt)
```

## Database Design

### Row Level Security (RLS)

Every table has RLS policies:

```sql
-- Users can only view messages in their chats
CREATE POLICY "View own messages" ON messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM chats
      WHERE chats.id = messages.chat_id
      AND auth.uid() = ANY(chats.participants)
    )
  );
```

**Benefits**:
- Database-level security
- Cannot bypass with SQL injection
- Automatic enforcement

### Indexing Strategy

**High-Read Tables**:
```sql
-- Messages are queried by chat frequently
CREATE INDEX idx_messages_chat_id ON messages(chat_id);
CREATE INDEX idx_messages_created_at ON messages(created_at DESC);

-- Participants array searched often
CREATE INDEX idx_chats_participants ON chats USING GIN(participants);
```

**Write Optimization**:
- Minimal indexes on write-heavy tables
- Batch inserts where possible

## Security Architecture

### 1. JWT Verification

Every authenticated request:
```typescript
// Middleware extracts and verifies
const token = req.headers.authorization?.split(' ')[1];
const { data: { user } } = await supabase.auth.getUser(token);

if (!user) {
  return res.status(401).json({ error: 'Unauthorized' });
}

req.user = user;
```

### 2. Rate Limiting

**Strategy**:
- IP-based for global endpoints
- User-based for authenticated endpoints
- Socket event rate limiting

```typescript
// Different limits for different routes
app.use('/api/auth', strictRateLimiter);  // 5/min
app.use('/api/*', rateLimiter);           // 100/15min
```

### 3. Input Validation

Using Joi schemas:
```typescript
const messageSchema = Joi.object({
  chat_id: Joi.string().uuid().required(),
  encrypted_content: Joi.string().required(),
  message_type: Joi.string().valid('text', 'image', 'file', 'voice'),
});
```

### 4. CORS & Headers

```typescript
app.use(helmet());  // Security headers
app.use(cors({
  origin: process.env.CORS_ORIGIN,
  credentials: true,
}));
```

## Scalability Considerations

### Horizontal Scaling

**Current**: Single server
**Future**: Multiple servers with:

```typescript
// Redis Adapter for Socket.IO
import { createAdapter } from '@socket.io/redis-adapter';

const pubClient = redis.duplicate();
const subClient = redis.duplicate();

io.adapter(createAdapter(pubClient, subClient));
```

This allows:
- Multiple backend instances
- Load balancing
- Cross-server socket events

### Database Scaling

**Current**: Single Supabase instance
**Future**:
- Read replicas for queries
- Connection pooling (PgBouncer)
- Sharding by user_id for very large scale

### File Storage

**Current**: Google Drive for backups
**Future**: 
- S3/CloudFlare R2 for media
- CDN for avatar images
- Separate bucket per region

## Google Drive Backup Design

### Why Google Drive?

- Users already have Google accounts
- Familiar interface
- Free 15GB storage
- OAuth 2.0 integration

### Backup Flow

```
1. User initiates backup
2. Frontend exports all chat data from IndexedDB
3. Frontend encrypts with password-derived key
4. Frontend sends encrypted blob to backend
5. Backend uploads to user's Google Drive
6. Backend stores metadata (file_id, hash)
```

### Restore Flow

```
1. User requests restore
2. Backend downloads from Google Drive
3. Backend verifies hash integrity
4. Backend returns encrypted blob
5. Frontend decrypts with password
6. Frontend imports to IndexedDB
```

## Advanced Features

### 1. Self-Destructing Messages

**Implementation**:
- `expires_at` timestamp on message
- Background job checks every minute
- Hard delete from database when expired
- Frontend removes from UI when time reached

### 2. Device Verification

**Flow**:
```
1. User logs in on new device
2. Backend generates 6-digit code
3. Shows QR code OR numeric code
4. User scans QR on verified device
5. Verified device confirms to backend
6. Backend marks new device as verified
```

**Security**:
- Codes expire in 10 minutes
- One-time use
- Stored in separate table

### 3. Offline Message Queue

**Problem**: User offline when message sent

**Solution**:
```typescript
// On message send
await redis.lpush(`offline:${chatId}`, JSON.stringify(message));

// On user connect
const offlineMessages = await redis.lrange(`offline:${chatId}`, 0, -1);
socket.emit('offline:messages', offlineMessages);
await redis.del(`offline:${chatId}`);
```

## Monitoring & Logging

### Winston Logger

```typescript
logger.info('User connected', { userId, socketId });
logger.error('Message send failed', { error, chatId });
```

**Levels**:
- `error`: System errors
- `warn`: Suspicious activity
- `info`: Important events
- `debug`: Development only

**Transport**:
- Console (development)
- File (production)
- Future: Cloud logging service

## Testing Strategy

### Unit Tests
- Models: CRUD operations
- Utils: Encryption helpers
- Validators: Input validation

### Integration Tests
- API endpoints with test database
- Socket.IO events
- Auth middleware

### E2E Tests
- Full user flows
- Message sending
- Group creation

## Trade-offs & Limitations

### ✅ Advantages

1. **Privacy**: End-to-end encryption
2. **Scalability**: Stateless design ready for scaling
3. **Security**: Multiple layers of protection
4. **Real-time**: Instant message delivery
5. **Reliability**: Offline message queueing

### ❌ Limitations

1. **No server-side search**: Can't search encrypted content
2. **Key management complexity**: Client must handle keys
3. **No message recovery**: Lost password = lost messages
4. **Higher client load**: Encryption done on client
5. **Limited analytics**: Can't analyze message content

### Future Improvements

1. **Message Search**: 
   - Encrypt search index with user key
   - Store on client or encrypted on server

2. **Media Optimization**:
   - Client-side image compression
   - Thumbnail generation
   - Progressive uploads

3. **Voice/Video Calls**:
   - WebRTC integration
   - TURN/STUN servers
   - Encrypted peer-to-peer

4. **Multi-Device Sync**:
   - Sync encryption keys across devices
   - Device-to-device key exchange
   - Session management

5. **Better Offline Support**:
   - Service Worker for PWA
   - Background sync
   - Conflict resolution
