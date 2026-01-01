# Privacy-First Chat Application - Backend

A secure, privacy-focused WhatsApp-like chat application backend built with modern technologies including Supabase authentication, Socket.IO for real-time messaging, end-to-end encryption support, and encrypted Google Drive backups.

## 🚀 Features

### Core Features
- ✅ **Supabase Email Authentication** - Secure user authentication with email signup/login
- ✅ **Real-Time Messaging** - WebSocket-based messaging with Socket.IO
- ✅ **End-to-End Encryption** - Client-side encryption with server storing only encrypted blobs
- ✅ **Friend System** - Send/accept/reject friend requests, block/unblock users
- ✅ **Group Chats** - Create and manage group conversations with admin roles
- ✅ **Message Status** - Sent, delivered, and read receipts
- ✅ **Typing Indicators** - Real-time typing status
- ✅ **Presence System** - Online/offline/away status tracking
- ✅ **Google Drive Backups** - Encrypted backup storage with OAuth 2.0

### Advanced Features
- ✅ **Self-Destructing Messages** - Time-based message expiration
- ✅ **Device Verification** - Multi-device support with QR code verification
- ✅ **Invite-Link Based Chats** - Join groups via invite links
- ✅ **Offline Message Queueing** - Messages stored in Redis for offline users
- ✅ **Privacy Controls** - Granular privacy settings per user

## 🏗️ Architecture

### Tech Stack
- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js
- **Real-time**: Socket.IO
- **Database**: Supabase (PostgreSQL)
- **Cache/Pub-Sub**: Redis (ioredis)
- **Authentication**: Supabase Auth (JWT-based)
- **Storage**: Google Drive API
- **Logging**: Winston

### Security Model
```
┌─────────────┐         ┌──────────────┐         ┌─────────────┐
│   Client    │◄───────►│   Backend    │◄───────►│  Supabase   │
│ (Encrypts)  │  HTTPS  │ (Never sees  │   JWT   │   (Auth)    │
│             │ WSS     │  plaintext)  │  Verify │             │
└─────────────┘         └──────────────┘         └─────────────┘
                               │
                               │ Encrypted Blobs
                               ▼
                        ┌──────────────┐
                        │  PostgreSQL  │
                        │  (Metadata)  │
                        └──────────────┘
```

## 📋 Prerequisites

- Node.js 18+ 
- PostgreSQL (via Supabase)
- Redis server
- Supabase account
- Google Cloud Project (for Drive API)

## 🛠️ Installation

### 1. Clone and Install Dependencies

```bash
cd backend
npm install
```

### 2. Environment Setup

Create a `.env` file in the backend directory:

```bash
cp .env.example .env
```

Configure the following variables:

```env
# Server
PORT=3000
NODE_ENV=development

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_JWT_SECRET=your-jwt-secret

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Google Drive API
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3000/api/backup/auth/google/callback

# Security
JWT_SECRET=your-internal-jwt-secret
ENCRYPTION_SALT=your-encryption-salt

# CORS
CORS_ORIGIN=http://localhost:5173
```

### 3. Database Setup

Run the database schema in Supabase:

```bash
# Execute the schema.sql in Supabase SQL Editor
# File: database/schema.sql
```

Or use Supabase CLI:

```bash
supabase db push
```

### 4. Start Services

**Start Redis:**
```bash
# macOS/Linux
redis-server

# Windows (WSL or Redis for Windows)
redis-server.exe
```

**Start Backend:**
```bash
# Development
npm run dev

# Production
npm run build
npm start
```

## 📚 API Documentation

### Authentication

All authenticated routes require a Bearer token in the Authorization header:

```
Authorization: Bearer <supabase_jwt_token>
```

### REST API Endpoints

#### Auth & Users

```http
GET    /api/auth/me                    # Get current user profile
GET    /api/auth/verify                # Verify JWT token
GET    /api/users/:userId              # Get user profile
PATCH  /api/users/me                   # Update own profile
PATCH  /api/users/me/privacy           # Update privacy settings
GET    /api/users/search/:query        # Search users
```

#### Friends

```http
GET    /api/friends                    # Get friend list
GET    /api/friends/requests           # Get pending requests
POST   /api/friends/request            # Send friend request
POST   /api/friends/accept/:friendId   # Accept request
POST   /api/friends/reject/:friendId   # Reject request
POST   /api/friends/block/:friendId    # Block user
POST   /api/friends/unblock/:friendId  # Unblock user
```

#### Chats

```http
GET    /api/chats                      # Get all user chats
GET    /api/chats/:chatId              # Get specific chat
POST   /api/chats                      # Create new chat
POST   /api/chats/direct/:userId       # Get/create direct chat
```

#### Messages

```http
GET    /api/messages/:chatId           # Get messages (supports pagination)
POST   /api/messages                   # Send message
DELETE /api/messages/:messageId        # Delete message
GET    /api/messages/:chatId/unread    # Get unread count
POST   /api/messages/:chatId/read      # Mark as read
```

#### Groups

```http
GET    /api/groups                           # Get user's groups
GET    /api/groups/:groupId                  # Get group details
POST   /api/groups                           # Create group
PATCH  /api/groups/:groupId                  # Update group info
POST   /api/groups/:groupId/members/:userId  # Add member
DELETE /api/groups/:groupId/members/:userId  # Remove member
POST   /api/groups/:groupId/admins/:userId   # Promote to admin
PATCH  /api/groups/:groupId/settings         # Update settings
POST   /api/groups/:groupId/invite-link      # Generate invite link
POST   /api/groups/join/:inviteLink          # Join via invite
```

#### Backups

```http
GET    /api/backup/auth/google                # Get Google OAuth URL
GET    /api/backup/auth/google/callback       # OAuth callback
POST   /api/backup                            # Create backup
GET    /api/backup                            # List backups
GET    /api/backup/latest                     # Get latest backup
GET    /api/backup/restore/:backupId          # Restore backup
DELETE /api/backup/:backupId                  # Delete backup
GET    /api/backup/drive/list                 # List Drive backups
```

#### Devices

```http
POST   /api/devices/verify/request      # Request device verification
POST   /api/devices/verify/confirm      # Verify with code
POST   /api/devices/verify/qr           # Generate QR code
POST   /api/devices/verify/qr/scan      # Verify via QR
GET    /api/devices                     # Get verified devices
DELETE /api/devices/:deviceId           # Remove device
```

### WebSocket Events

#### Connection

```javascript
// Client connects with JWT
const socket = io('http://localhost:3000', {
  auth: {
    token: '<supabase_jwt_token>'
  }
});
```

#### Message Events

```javascript
// Send message
socket.emit('message:send', {
  chatId: 'uuid',
  encryptedContent: 'base64_encrypted_blob',
  messageType: 'text',
  metadata: {},
  encryptionKeyId: 'key_id',
  expiresAt: '2024-12-31T23:59:59Z', // Optional
  replyTo: 'message_uuid' // Optional
});

// Receive message
socket.on('message:receive', (message) => {
  console.log('New message:', message);
});

// Message delivered
socket.emit('message:delivered', { messageId: 'uuid' });

// Mark as read
socket.emit('message:read', { chatId: 'uuid' });
socket.on('message:read', (data) => {
  console.log('Messages read:', data);
});
```

#### Typing Indicators

```javascript
// Start typing
socket.emit('typing:start', { chatId: 'uuid' });

// Stop typing
socket.emit('typing:stop', { chatId: 'uuid' });

// Receive typing updates
socket.on('typing:update', (data) => {
  console.log('User typing:', data.userId, data.isTyping);
});
```

#### Presence

```javascript
// Receive presence updates
socket.on('presence:update', (data) => {
  console.log('User status:', data.userId, data.status);
});
```

#### Friend Events

```javascript
socket.on('friend:request', (data) => {
  console.log('Friend request from:', data.from);
});

socket.on('friend:accept', (data) => {
  console.log('Friend request accepted:', data.from);
});
```

#### Group Events

```javascript
socket.on('group:created', (data) => {
  console.log('New group:', data.group);
});

socket.on('group:member:added', (data) => {
  console.log('Member added:', data.userId);
});
```

## 🔐 Encryption Flow

### Message Encryption (Client-Side)

```javascript
// 1. Client generates/retrieves chat key
const chatKey = getChatKey(chatId);

// 2. Encrypt message
const encryptedContent = await encryptMessage(plaintext, chatKey);

// 3. Send to server
await fetch('/api/messages', {
  method: 'POST',
  body: JSON.stringify({
    chat_id: chatId,
    encrypted_content: encryptedContent, // Base64
    message_type: 'text',
    encryption_key_id: 'key_v1'
  })
});

// 4. Server stores encrypted blob (never sees plaintext)
```

### Backup Encryption

```javascript
// 1. Client exports all data
const chatData = await exportChats();

// 2. Encrypt with user password
const backupKey = await deriveKey(userPassword);
const encryptedBackup = await encrypt(chatData, backupKey);

// 3. Upload to server
const response = await fetch('/api/backup', {
  method: 'POST',
  body: JSON.stringify({
    encrypted_data: encryptedBackup, // Base64
    backup_size: encryptedBackup.length
  })
});

// 4. Server uploads to Google Drive (still encrypted)
```

## 🔧 Configuration

### Supabase Setup

1. Create a new Supabase project
2. Enable Email authentication in Authentication > Providers
3. Run the `database/schema.sql` in SQL Editor
4. Get your project URL and keys from Settings > API

### Google Drive Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project
3. Enable Google Drive API
4. Create OAuth 2.0 credentials
5. Add authorized redirect URI: `http://localhost:3000/api/backup/auth/google/callback`
6. Copy Client ID and Secret to `.env`

### Redis Setup

**macOS:**
```bash
brew install redis
brew services start redis
```

**Ubuntu:**
```bash
sudo apt-get install redis-server
sudo systemctl start redis
```

**Docker:**
```bash
docker run -d -p 6379:6379 redis:alpine
```

## 🧪 Testing

```bash
# Run tests
npm test

# Run with coverage
npm run test:coverage
```

## 📊 Database Schema

See [database/schema.sql](database/schema.sql) for complete schema with:
- User profiles
- Friends/relationships
- Chats (direct and group)
- Messages (encrypted)
- Groups with admin roles
- Backups metadata
- Device verifications
- Row Level Security policies

## 🔒 Security Features

### Authentication
- Supabase JWT verification on every request
- Socket.IO authentication middleware
- Service role key for admin operations

### Rate Limiting
- Global: 100 requests per 15 minutes
- Strict: 5 requests per minute (auth endpoints)
- Socket: 10 events per second

### Data Protection
- All messages stored as encrypted blobs
- No plaintext message content on server
- Backup encryption with user-derived keys
- HTTPS/WSS in production
- CORS protection
- Helmet.js security headers

### Privacy Controls
- Who can add friend
- Who can message
- Read receipts toggle
- Typing indicators toggle
- Online status visibility

## 📈 Performance

### Redis Caching
- User presence (5-minute TTL)
- Typing indicators (5-second TTL)
- Offline messages (7-day TTL)
- Google tokens (7-day TTL)

### Database Indexes
- Messages: chat_id, sender_id, created_at
- Friends: user_id, friend_id, status
- Chats: participants (GIN index)
- Groups: member_ids, admin_ids (GIN index)

### Cleanup Tasks
- Expired messages (every 1 minute)
- Expired verifications (database function)
- Anonymous chats (database function)

## 🚀 Deployment

### Environment Variables (Production)

```env
NODE_ENV=production
PORT=3000
CORS_ORIGIN=https://your-frontend-domain.com
```

### Docker Deployment

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
CMD ["npm", "start"]
```

### Docker Compose

```yaml
version: '3.8'
services:
  backend:
    build: .
    ports:
      - "3000:3000"
    env_file:
      - .env
    depends_on:
      - redis
  
  redis:
    image: redis:alpine
    ports:
      - "6379:6379"
```

## 📝 License

MIT

## 🤝 Contributing

Contributions welcome! Please follow security best practices and maintain encryption standards.

## ⚠️ Important Security Notes

1. **Never log encrypted content** in production
2. **Never store plaintext messages** in database
3. **Never expose service role key** to clients
4. **Always use HTTPS/WSS** in production
5. **Rotate JWT secrets** regularly
6. **Implement proper key management** on client side
7. **Use strong password** for backup encryption
8. **Enable 2FA** on Supabase account

## 📞 Support

For issues and questions, please open a GitHub issue.
