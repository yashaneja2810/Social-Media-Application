# Privacy-First Chat Application - Backend

## 🎯 Project Overview

A production-ready backend for a privacy-first, WhatsApp-like web chat application featuring:
- Supabase email authentication
- Real-time WebSocket messaging with Socket.IO
- End-to-end encryption support
- Google Drive encrypted backups
- Friend system, group chats, and advanced privacy features

## 📁 Project Structure

```
backend/
├── src/
│   ├── config/              # Configuration files
│   │   ├── supabase.ts      # Supabase client setup
│   │   └── redis.ts         # Redis connection
│   │
│   ├── middleware/          # Express middleware
│   │   ├── auth.ts          # JWT verification
│   │   ├── errorHandler.ts # Global error handling
│   │   ├── rateLimiter.ts  # Rate limiting
│   │   └── validation.ts   # Input validation
│   │
│   ├── models/              # Database models
│   │   ├── user.model.ts    # User profiles
│   │   ├── friend.model.ts  # Friend relationships
│   │   ├── chat.model.ts    # Chats (direct & group)
│   │   ├── message.model.ts # Messages (encrypted)
│   │   ├── group.model.ts   # Group management
│   │   ├── backup.model.ts  # Backup metadata
│   │   └── device.model.ts  # Device verification
│   │
│   ├── routes/              # API routes
│   │   ├── auth.routes.ts   # Authentication
│   │   ├── user.routes.ts   # User management
│   │   ├── friend.routes.ts # Friend system
│   │   ├── chat.routes.ts   # Chat operations
│   │   ├── message.routes.ts# Messaging
│   │   ├── group.routes.ts  # Group management
│   │   ├── backup.routes.ts # Google Drive backups
│   │   └── device.routes.ts # Device verification
│   │
│   ├── services/            # Business logic services
│   │   └── googleDrive.service.ts # Google Drive integration
│   │
│   ├── socket/              # WebSocket handlers
│   │   └── index.ts         # Socket.IO setup & events
│   │
│   ├── types/               # TypeScript type definitions
│   │   └── index.ts         # All app types
│   │
│   ├── utils/               # Utility functions
│   │   ├── logger.ts        # Winston logger
│   │   └── encryption.ts   # Encryption utilities
│   │
│   └── server.ts            # Main server file
│
├── database/
│   └── schema.sql           # PostgreSQL schema
│
├── docs/
│   ├── API_REFERENCE.md     # Complete API documentation
│   ├── ARCHITECTURE.md      # System architecture
│   ├── ENCRYPTION.md        # Encryption guide
│   └── SETUP.md             # Setup & deployment guide
│
├── logs/                    # Log files (gitignored)
├── dist/                    # Compiled TypeScript (gitignored)
├── node_modules/            # Dependencies (gitignored)
│
├── .env.example             # Environment template
├── .gitignore
├── package.json
├── tsconfig.json
└── README.md
```

## 🔑 Key Components

### 1. Authentication (Supabase)
- Email signup/login via Supabase Auth
- JWT token verification on all protected routes
- User profile management post-authentication

### 2. Real-Time Messaging (Socket.IO)
- WebSocket connections authenticated via JWT
- Room-based messaging (user rooms + chat rooms)
- Typing indicators and presence tracking
- Offline message queueing in Redis

### 3. Encryption Support
- Backend stores ONLY encrypted message blobs
- No plaintext content ever touches the server
- Backup encryption with user password-derived keys

### 4. Friend System
- Send/accept/reject friend requests
- Block/unblock users
- Privacy controls (who can message, add friend, etc.)

### 5. Group Chats
- Create groups with admin roles
- Add/remove members
- Group settings (admin-only messaging, etc.)
- Invite link generation

### 6. Google Drive Backups
- OAuth 2.0 integration
- Encrypted backup upload/download
- Backup integrity verification
- Multiple backup versions

### 7. Advanced Features
- **Self-Destructing Messages**: Auto-delete after TTL
- **Device Verification**: QR code or 6-digit code
- **Anonymous Chats**: Time-limited temporary chats
- **Offline Queueing**: Messages delivered when user comes online

## 🔐 Security Features

### Authentication & Authorization
- Supabase JWT verification middleware
- Row Level Security (RLS) in PostgreSQL
- Service role key for admin operations only

### Rate Limiting
- Global: 100 req/15min
- Strict (auth): 5 req/min
- Socket: 10 events/sec

### Data Protection
- All messages encrypted client-side
- Server never sees encryption keys
- HTTPS/WSS in production
- Helmet.js security headers
- CORS protection

### Privacy Controls
- Granular user privacy settings
- Who can add friend
- Who can message
- Read receipts toggle
- Typing indicators toggle
- Online status visibility

## 🚀 Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js 18+ |
| Language | TypeScript |
| Framework | Express.js |
| Real-time | Socket.IO |
| Auth | Supabase Auth |
| Database | PostgreSQL (Supabase) |
| Cache | Redis (ioredis) |
| Storage | Google Drive API |
| Logging | Winston |
| Validation | Joi |
| Security | Helmet, CORS, Rate Limiting |

## 📊 Database Schema

### Main Tables
- `user_profiles` - User information & privacy settings
- `friends` - Friend relationships (pending, accepted, blocked)
- `chats` - Direct and group chats
- `messages` - Encrypted message blobs with metadata
- `groups` - Group metadata and settings
- `backups` - Backup metadata (Drive file IDs, hashes)
- `device_verifications` - Multi-device support
- `anonymous_chats` - Temporary chat tracking

All tables have Row Level Security (RLS) enabled.

## 🔄 API Endpoints

### REST API
```
/api/auth/*         - Authentication & session
/api/users/*        - User profiles & search
/api/friends/*      - Friend management
/api/chats/*        - Chat operations
/api/messages/*     - Message CRUD
/api/groups/*       - Group management
/api/backup/*       - Google Drive backups
/api/devices/*      - Device verification
```

### WebSocket Events
```
message:send        - Send encrypted message
message:receive     - Receive new message
message:delivered   - Delivery confirmation
message:read        - Read receipt
typing:start        - User started typing
typing:stop         - User stopped typing
typing:update       - Typing status update
presence:update     - Online/offline status
friend:request      - New friend request
friend:accept       - Request accepted
group:created       - New group
group:member:added  - Member added to group
```

## 🧪 Environment Variables

Required configuration in `.env`:

```env
# Server
PORT=3000
NODE_ENV=development

# Supabase
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_JWT_SECRET=

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Google Drive
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=

# Security
JWT_SECRET=
ENCRYPTION_SALT=

# CORS
CORS_ORIGIN=http://localhost:5173
```

## 📚 Documentation

- [README.md](README.md) - Quick start guide
- [docs/API_REFERENCE.md](docs/API_REFERENCE.md) - Complete API documentation
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) - System design & decisions
- [docs/ENCRYPTION.md](docs/ENCRYPTION.md) - Encryption implementation guide
- [docs/SETUP.md](docs/SETUP.md) - Detailed setup & deployment

## 🚦 Getting Started

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment:**
   ```bash
   cp .env.example .env
   # Edit .env with your credentials
   ```

3. **Set up Supabase:**
   - Create project at supabase.com
   - Run `database/schema.sql` in SQL Editor
   - Copy API keys to `.env`

4. **Start Redis:**
   ```bash
   redis-server
   ```

5. **Run development server:**
   ```bash
   npm run dev
   ```

6. **Test API:**
   ```bash
   curl http://localhost:3000/health
   ```

## 📈 Performance Features

### Caching Strategy (Redis)
- User presence: 5-min TTL
- Typing indicators: 5-sec TTL
- Offline messages: 7-day TTL
- OAuth tokens: 7-day TTL

### Database Optimization
- Indexes on frequently queried columns
- GIN indexes for array searches
- Connection pooling via Supabase
- Row Level Security for automatic filtering

### Scheduled Cleanup
- Expired messages deleted every 1 minute
- Expired device verifications auto-cleaned
- Anonymous chats auto-deleted on expiry

## 🎯 Design Principles

1. **Privacy First** - Server never sees plaintext
2. **Zero Trust** - Verify everything, trust nothing
3. **Fail Secure** - Errors don't expose data
4. **Minimal Data** - Collect only what's necessary
5. **User Control** - Users own their data

## 🔒 Security Best Practices

✅ **DO:**
- Verify JWT on every request
- Use HTTPS/WSS in production
- Rotate secrets regularly
- Log security events (not content)
- Validate all inputs
- Use parameterized queries
- Enable RLS on all tables

❌ **DON'T:**
- Log encrypted content
- Store encryption keys on server
- Trust client input
- Expose service role key to client
- Use weak passwords
- Skip input validation
- Disable security headers

## 🛠️ Development Commands

```bash
# Development
npm run dev          # Start with auto-reload

# Build
npm run build        # Compile TypeScript

# Production
npm start            # Run compiled code

# Linting
npm run lint         # Check code style

# Testing
npm test             # Run tests
```

## 📦 Deployment Options

- **Railway** - Easiest, one-click deploy
- **Heroku** - Traditional PaaS
- **DigitalOcean** - App Platform
- **VPS** - Full control (Ubuntu + PM2 + Nginx)
- **Docker** - Containerized deployment

See [docs/SETUP.md](docs/SETUP.md) for detailed deployment guides.

## 🔮 Future Enhancements

Potential additions:
- [ ] Voice/Video calls (WebRTC)
- [ ] Message search (encrypted index)
- [ ] Media compression
- [ ] Message reactions
- [ ] Mentions and hashtags
- [ ] Channels (broadcast mode)
- [ ] Bots and integrations
- [ ] End-to-end encrypted calls

## 📄 License

MIT

## 🤝 Contributing

Contributions welcome! Please:
1. Follow existing code style
2. Add tests for new features
3. Update documentation
4. Follow security best practices

## ⚠️ Important Notes

1. **Frontend Required**: This is backend only. You need to build a frontend that implements client-side encryption.

2. **Encryption is Client-Side**: The backend expects encrypted blobs. Implement WebCrypto API encryption in your frontend.

3. **Google Drive Setup**: Users must authorize Google Drive access for backup functionality.

4. **Supabase Required**: This backend depends on Supabase for authentication and database.

5. **Redis Required**: Presence tracking and offline messaging require Redis.

## 📞 Support

For issues or questions:
- Check [docs/](docs/) folder
- Review code comments
- Open GitHub issue

---

**Built with security and privacy in mind.** 🔐
