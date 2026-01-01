# Quick Reference Card

## 🚀 Start Backend

```bash
cd backend

# First time setup
npm install
cp .env.example .env
# Edit .env with your credentials

# Start Redis
redis-server

# Run backend
npm run dev
```

## 📡 API Quick Reference

### Base URL
```
http://localhost:3000
```

### Authentication
All requests (except auth) need:
```
Authorization: Bearer <supabase_jwt_token>
```

### Key Endpoints

**Health Check:**
```bash
curl http://localhost:3000/health
```

**Get Current User:**
```bash
curl -H "Authorization: Bearer TOKEN" \
  http://localhost:3000/api/auth/me
```

**Send Message (HTTP):**
```bash
curl -X POST http://localhost:3000/api/messages \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "chat_id": "uuid",
    "encrypted_content": "base64...",
    "message_type": "text"
  }'
```

**WebSocket Connection:**
```javascript
import io from 'socket.io-client';

const socket = io('http://localhost:3000', {
  auth: { token: 'supabase_jwt_token' }
});

// Send message
socket.emit('message:send', {
  chatId: 'uuid',
  encryptedContent: 'base64...',
  messageType: 'text'
});

// Receive messages
socket.on('message:receive', (message) => {
  console.log('New message:', message);
});
```

## 🔐 Encryption Flow

**Client Side (Frontend):**
```javascript
// 1. Generate chat key (once per chat)
const chatKey = await crypto.subtle.generateKey(
  { name: 'AES-GCM', length: 256 },
  true,
  ['encrypt', 'decrypt']
);

// 2. Encrypt message
const iv = crypto.getRandomValues(new Uint8Array(12));
const encrypted = await crypto.subtle.encrypt(
  { name: 'AES-GCM', iv },
  chatKey,
  new TextEncoder().encode(plaintext)
);

// 3. Send to server
const payload = {
  chat_id: chatId,
  encrypted_content: base64(iv + encrypted),
  message_type: 'text'
};
```

## 📦 Environment Variables

**Required:**
```env
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
SUPABASE_JWT_SECRET=xxx

REDIS_HOST=localhost
REDIS_PORT=6379

GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOxxx
GOOGLE_REDIRECT_URI=http://localhost:3000/api/backup/auth/google/callback
```

## 🗄️ Database Setup

**In Supabase SQL Editor:**
```sql
-- Run this file:
backend/database/schema.sql
```

## 🔧 Common Commands

```bash
# Development
npm run dev

# Build
npm run build

# Production
npm start

# Lint
npm run lint

# Check TypeScript
npx tsc --noEmit
```

## 📚 Documentation

| Document | Purpose |
|----------|---------|
| [README.md](README.md) | Getting started |
| [API_REFERENCE.md](docs/API_REFERENCE.md) | All endpoints |
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | System design |
| [ENCRYPTION.md](docs/ENCRYPTION.md) | Encryption guide |
| [SETUP.md](docs/SETUP.md) | Detailed setup |

## 🐛 Troubleshooting

**Server won't start:**
```bash
# Check port
lsof -i :3000

# Check env variables
node -e "console.log(require('dotenv').config())"
```

**Redis connection failed:**
```bash
# Test Redis
redis-cli ping

# Should return: PONG
```

**JWT verification fails:**
- Check SUPABASE_JWT_SECRET matches Supabase dashboard
- Verify token is fresh (not expired)

## 🔒 Security Checklist

- [ ] `.env` file created (not committed)
- [ ] Supabase RLS enabled
- [ ] Redis password set (production)
- [ ] HTTPS enabled (production)
- [ ] CORS configured
- [ ] Rate limiting enabled
- [ ] Google OAuth redirect URIs updated

## 📊 Project Structure

```
backend/
├── src/
│   ├── config/      # Supabase, Redis
│   ├── middleware/  # Auth, validation
│   ├── models/      # Database logic
│   ├── routes/      # API endpoints
│   ├── services/    # Google Drive
│   ├── socket/      # WebSocket
│   ├── types/       # TypeScript types
│   └── utils/       # Logger, encryption
├── database/
│   └── schema.sql   # PostgreSQL schema
└── docs/            # Documentation
```

## 🎯 Key Features

✅ Supabase Auth
✅ Real-time messaging
✅ Friend system
✅ Group chats
✅ Google Drive backups
✅ Device verification
✅ Self-destructing messages
✅ E2E encryption support
✅ Privacy controls

## 📞 Quick Help

**Can't connect to Supabase?**
- Check SUPABASE_URL is correct
- Verify API keys are from correct project
- Check network/firewall

**Messages not sending?**
- Verify user is authenticated
- Check user is in the chat
- Verify encrypted_content is valid base64

**WebSocket not connecting?**
- Check JWT token is valid
- Verify Socket.IO client version matches server
- Check CORS settings

---

**All docs:** `backend/docs/`
**Main README:** `backend/README.md`
