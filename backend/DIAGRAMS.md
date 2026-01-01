# System Architecture Diagrams

## 1. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT (Browser)                        │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────┐    │
│  │  React/Vue   │  │  Web Crypto  │  │    IndexedDB      │    │
│  │  Components  │  │  Encryption  │  │  (Encryption Keys)│    │
│  └──────┬───────┘  └──────┬───────┘  └─────────┬─────────┘    │
│         │                 │                     │              │
│         └─────────────────┴─────────────────────┘              │
│                           │                                    │
└───────────────────────────┼────────────────────────────────────┘
                            │
                            │ HTTPS/WSS
                            │ (Encrypted Blobs Only)
                            │
┌───────────────────────────▼────────────────────────────────────┐
│                      BACKEND (Node.js)                         │
│                                                                │
│  ┌────────────────────────────────────────────────────────┐   │
│  │              Express.js (REST API)                     │   │
│  │  - Authentication Middleware (JWT)                     │   │
│  │  - Rate Limiting                                       │   │
│  │  - Input Validation                                    │   │
│  │  - Route Handlers                                      │   │
│  └────────────────────────────────────────────────────────┘   │
│                                                                │
│  ┌────────────────────────────────────────────────────────┐   │
│  │            Socket.IO (Real-Time)                       │   │
│  │  - WebSocket Authentication                            │   │
│  │  - Room Management                                     │   │
│  │  - Event Broadcasting                                  │   │
│  │  - Presence Tracking                                   │   │
│  └────────────────────────────────────────────────────────┘   │
│                                                                │
│              ┌──────────────┬──────────────┐                  │
│              │              │              │                  │
└──────────────┼──────────────┼──────────────┼──────────────────┘
               │              │              │
               ▼              ▼              ▼
    ┌──────────────┐  ┌─────────────┐  ┌──────────────┐
    │   Supabase   │  │    Redis    │  │ Google Drive │
    │              │  │             │  │              │
    │ - Auth (JWT) │  │ - Presence  │  │ - Encrypted  │
    │ - PostgreSQL │  │ - Typing    │  │   Backups    │
    │ - RLS        │  │ - Queue     │  │ - OAuth 2.0  │
    └──────────────┘  └─────────────┘  └──────────────┘
```

## 2. Message Flow

```
┌──────────────┐                                    ┌──────────────┐
│   Sender     │                                    │  Receiver    │
│   Client     │                                    │   Client     │
└──────┬───────┘                                    └───────▲──────┘
       │                                                    │
       │ 1. Type message                                   │
       │ "Hello World"                                     │
       │                                                   │
       │ 2. Encrypt with chat key                         │
       │ AES-GCM(message, chatKey)                        │
       │ → "a8f3d2..."                                    │
       │                                                   │
       │ 3. Send via WebSocket                            │
       │                                                   │
       ▼                                                   │
┌─────────────────────────────────────────────────────────┐
│                    BACKEND                              │
│                                                         │
│  4. Verify JWT                                          │
│  5. Validate input                                      │
│  6. Store encrypted blob in DB                          │
│  7. Broadcast to chat room                              │
│                                                         │
└────────────────────────┬────────────────────────────────┘
                         │
                         │ 8. Emit 'message:receive'
                         │    { encrypted_content: "a8f3d2..." }
                         │
                         ▼
                    ┌─────────┐
                    │  Redis  │
                    │  Queue  │ (if receiver offline)
                    └─────────┘
                         │
                         │ 9. Deliver when online
                         │
                         ▼
       ┌─────────────────────────────────┐
       │                                 │
       │ 10. Receive encrypted blob      │
       │ 11. Fetch chat key from IndexedDB│
       │ 12. Decrypt message              │
       │     AES-GCM-decrypt("a8f3d2...", key)│
       │ 13. Display "Hello World"        │
       │                                 │
       └─────────────────────────────────┘
```

## 3. Authentication Flow

```
┌──────────────┐
│    User      │
└──────┬───────┘
       │
       │ 1. Enter email/password
       ▼
┌──────────────┐
│   Frontend   │
└──────┬───────┘
       │
       │ 2. supabase.auth.signInWithPassword()
       ▼
┌──────────────────────────────┐
│         Supabase             │
│                              │
│  3. Verify credentials       │
│  4. Generate JWT token       │
│                              │
└──────┬───────────────────────┘
       │
       │ 5. Return { access_token, user }
       ▼
┌──────────────┐
│   Frontend   │
│              │
│  6. Store token (memory)     │
│  7. Connect Socket.IO        │
│     with JWT                 │
│                              │
└──────┬───────────────────────┘
       │
       │ 8. socket.io({ auth: { token } })
       ▼
┌──────────────────────────────┐
│         Backend              │
│                              │
│  9. Socket middleware:       │
│     - Extract token          │
│     - supabase.auth.getUser()│
│     - Verify signature       │
│     - Attach userId to socket│
│                              │
│  10. If valid:               │
│      - Allow connection      │
│      - Join user rooms       │
│                              │
└──────────────────────────────┘
```

## 4. Group Chat Key Rotation

```
                    BEFORE MEMBER LEAVES
┌─────────────────────────────────────────────┐
│            Group: "Team Chat"               │
│                                             │
│  Members: Alice, Bob, Charlie               │
│  Group Key: key_v1                          │
│                                             │
│  ┌────────┐ ┌────────┐ ┌────────┐          │
│  │ Alice  │ │  Bob   │ │Charlie │          │
│  │ key_v1 │ │ key_v1 │ │ key_v1 │          │
│  └────────┘ └────────┘ └────────┘          │
└─────────────────────────────────────────────┘

                            │
                            │ Charlie leaves
                            ▼

┌─────────────────────────────────────────────┐
│         Backend Process                     │
│                                             │
│  1. Remove Charlie from group.member_ids    │
│  2. Emit 'group:member:removed'             │
│  3. Notify remaining members                │
│                                             │
└─────────────────┬───────────────────────────┘
                  │
                  ▼

                    AFTER MEMBER LEAVES
┌─────────────────────────────────────────────┐
│            Group: "Team Chat"               │
│                                             │
│  Members: Alice, Bob                        │
│                                             │
│  ┌─────────────────────────────────────┐   │
│  │  Alice (client-side)                │   │
│  │  1. Generate new key: key_v2        │   │
│  │  2. Encrypt key_v2 with Bob's pubkey│   │
│  │  3. Send encrypted key to Bob       │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  ┌────────┐ ┌────────┐    ┌────────┐       │
│  │ Alice  │ │  Bob   │    │Charlie │       │
│  │ key_v2 │ │ key_v2 │    │ key_v1 │       │
│  │        │ │        │    │ (old)  │       │
│  └────────┘ └────────┘    └────────┘       │
│                                             │
│  Old messages: encrypted with key_v1        │
│  New messages: encrypted with key_v2        │
│                                             │
│  Charlie: Can decrypt old, NOT new          │
└─────────────────────────────────────────────┘
```

## 5. Backup & Restore Flow

```
                        BACKUP CREATION

┌──────────────────────────────────────────┐
│           Client Side                    │
│                                          │
│  1. Export all chats from IndexedDB      │
│  2. Export all encryption keys           │
│  3. Package into JSON:                   │
│     {                                    │
│       chats: [...],                      │
│       keys: [...],                       │
│       settings: {...}                    │
│     }                                    │
│                                          │
│  4. Derive key from password:            │
│     PBKDF2(password, salt, 100k iter)    │
│                                          │
│  5. Encrypt backup:                      │
│     AES-GCM(backupData, derivedKey)      │
│                                          │
│  6. Send to backend:                     │
│     POST /api/backup                     │
│     { encrypted_data: "base64..." }      │
│                                          │
└──────────────┬───────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────┐
│           Backend                        │
│                                          │
│  7. Store metadata in PostgreSQL         │
│  8. Upload encrypted blob to Drive:      │
│     - Use user's OAuth token             │
│     - Upload to "ChatAppBackups" folder  │
│  9. Store Drive file_id                  │
│                                          │
└──────────────┬───────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────┐
│         Google Drive                     │
│                                          │
│  Encrypted backup stored                 │
│  User controls access                    │
│                                          │
└──────────────────────────────────────────┘


                        RESTORE

┌──────────────────────────────────────────┐
│           Client Side                    │
│                                          │
│  1. Request restore:                     │
│     GET /api/backup/restore/:id          │
│                                          │
└──────────────┬───────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────┐
│           Backend                        │
│                                          │
│  2. Download from Google Drive           │
│  3. Verify hash                          │
│  4. Return encrypted blob                │
│                                          │
└──────────────┬───────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────┐
│           Client Side                    │
│                                          │
│  5. Prompt for password                  │
│  6. Derive key: PBKDF2(password, salt)   │
│  7. Decrypt backup                       │
│  8. Import to IndexedDB:                 │
│     - Restore chats                      │
│     - Restore keys                       │
│     - Restore settings                   │
│                                          │
└──────────────────────────────────────────┘
```

## 6. Presence System

```
┌────────────────────┐
│   User Connects    │
└─────────┬──────────┘
          │
          ▼
┌─────────────────────────────────────┐
│        Socket.IO Server             │
│                                     │
│  1. Verify JWT                      │
│  2. Extract userId                  │
│  3. Join user to rooms:             │
│     - socket.join(`user:${userId}`) │
│     - socket.join(`chat:${chatId}`) │
│                                     │
└─────────────┬───────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│           Redis                     │
│                                     │
│  4. Store presence:                 │
│     SET presence:userId             │
│     {                               │
│       status: "online",             │
│       lastSeen: now,                │
│       socketId: "xyz"               │
│     }                               │
│     TTL: 5 minutes                  │
│                                     │
└─────────────┬───────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│      Update Database                │
│                                     │
│  5. UPDATE user_profiles            │
│     SET status = 'online',          │
│         last_seen = NOW()           │
│     WHERE id = userId               │
│                                     │
└─────────────┬───────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│    Broadcast to Friends             │
│                                     │
│  6. Get user's friends              │
│  7. For each friend:                │
│     io.to(`user:${friendId}`)       │
│       .emit('presence:update', {    │
│         userId,                     │
│         status: 'online'            │
│       })                            │
│                                     │
└─────────────────────────────────────┘


          USER DISCONNECTS

┌────────────────────┐
│  Socket Disconnect │
└─────────┬──────────┘
          │
          ▼
┌─────────────────────────────────────┐
│     Check Active Sockets            │
│                                     │
│  if (userSockets.size === 0) {      │
│    // No more active connections    │
│    status = 'offline'               │
│  }                                  │
│                                     │
└─────────────┬───────────────────────┘
              │
              ▼
         [Update Redis]
              │
              ▼
         [Update DB]
              │
              ▼
     [Broadcast to Friends]
```

## 7. Database Relationships

```
┌─────────────────────┐
│   user_profiles     │
│─────────────────────│
│ id (PK)             │◄────┐
│ email               │     │
│ username            │     │
│ privacy_settings    │     │
│ status              │     │
└─────────────────────┘     │
                            │
         ┌──────────────────┼────────────────┐
         │                  │                │
         │                  │                │
┌────────▼──────┐  ┌────────▼──────┐  ┌─────▼──────┐
│   friends     │  │     chats     │  │   groups   │
│───────────────│  │───────────────│  │────────────│
│ id (PK)       │  │ id (PK)       │  │ id (PK)    │
│ user_id (FK)  │  │ participants[]│  │ member_ids[]│
│ friend_id(FK) │  │ created_by(FK)│  │ admin_ids[]│
│ status        │  │ type          │  └────────────┘
└───────────────┘  └────┬──────────┘
                        │
                        │
                 ┌──────▼──────────┐
                 │    messages     │
                 │─────────────────│
                 │ id (PK)         │
                 │ chat_id (FK)    │
                 │ sender_id (FK)  │
                 │ encrypted_content│ ← ENCRYPTED!
                 │ message_type    │
                 │ status          │
                 │ expires_at      │
                 └─────────────────┘
```

## Legend

```
─────►  Data Flow
═════►  Encrypted Data Flow
┌────┐  Component/Service
│    │
└────┘
  │
  ▼    Sequential Step
```
