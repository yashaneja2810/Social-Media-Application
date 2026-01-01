# API Reference

## Base URL
```
Development: http://localhost:3000
Production: https://your-api-domain.com
```

## Authentication

All authenticated endpoints require a JWT token from Supabase in the Authorization header:

```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## Response Format

### Success Response
```json
{
  "data": {},
  "success": true
}
```

### Error Response
```json
{
  "error": "Error message",
  "errors": [
    {
      "field": "email",
      "message": "Invalid email format"
    }
  ]
}
```

## Endpoints

### 1. Authentication & Users

#### Get Current User Profile
```http
GET /api/auth/me
Authorization: Bearer <token>
```

**Response:**
```json
{
  "profile": {
    "id": "uuid",
    "email": "user@example.com",
    "username": "johndoe",
    "display_name": "John Doe",
    "avatar_url": "https://...",
    "status": "online",
    "last_seen": "2024-12-31T12:00:00Z",
    "privacy_settings": {
      "who_can_add_friend": "everyone",
      "who_can_message": "friends",
      "read_receipts": true,
      "typing_indicators": true,
      "online_status": true
    }
  }
}
```

#### Update Profile
```http
PATCH /api/users/me
Authorization: Bearer <token>
Content-Type: application/json

{
  "username": "newusername",
  "display_name": "New Name",
  "avatar_url": "https://..."
}
```

#### Update Privacy Settings
```http
PATCH /api/users/me/privacy
Authorization: Bearer <token>
Content-Type: application/json

{
  "who_can_add_friend": "friends_of_friends",
  "who_can_message": "friends",
  "read_receipts": false,
  "typing_indicators": true,
  "online_status": false
}
```

#### Search Users
```http
GET /api/users/search/:query
Authorization: Bearer <token>
```

**Response:**
```json
{
  "users": [
    {
      "id": "uuid",
      "email": "user@example.com",
      "username": "johndoe",
      "display_name": "John Doe",
      "avatar_url": "https://...",
      "status": "online"
    }
  ]
}
```

### 2. Friends

#### Get Friend List
```http
GET /api/friends
Authorization: Bearer <token>
```

**Response:**
```json
{
  "friends": [
    {
      "id": "uuid",
      "user_id": "uuid",
      "friend_id": "uuid",
      "status": "accepted",
      "created_at": "2024-12-31T12:00:00Z",
      "friend": {
        "id": "uuid",
        "email": "friend@example.com",
        "username": "janedoe",
        "display_name": "Jane Doe",
        "avatar_url": "https://...",
        "status": "online",
        "last_seen": "2024-12-31T12:00:00Z"
      }
    }
  ]
}
```

#### Send Friend Request
```http
POST /api/friends/request
Authorization: Bearer <token>
Content-Type: application/json

{
  "friend_id": "uuid"
}
```

#### Accept Friend Request
```http
POST /api/friends/accept/:friendId
Authorization: Bearer <token>
```

#### Reject Friend Request
```http
POST /api/friends/reject/:friendId
Authorization: Bearer <token>
```

#### Block User
```http
POST /api/friends/block/:friendId
Authorization: Bearer <token>
```

### 3. Chats

#### Get All Chats
```http
GET /api/chats
Authorization: Bearer <token>
```

**Response:**
```json
{
  "chats": [
    {
      "id": "uuid",
      "type": "direct",
      "participants": ["uuid1", "uuid2"],
      "created_by": "uuid1",
      "created_at": "2024-12-31T12:00:00Z",
      "updated_at": "2024-12-31T14:00:00Z",
      "last_message": {
        "id": "uuid",
        "encrypted_content": "base64...",
        "message_type": "text",
        "created_at": "2024-12-31T14:00:00Z"
      }
    }
  ]
}
```

#### Create or Get Direct Chat
```http
POST /api/chats/direct/:userId
Authorization: Bearer <token>
```

### 4. Messages

#### Get Messages
```http
GET /api/messages/:chatId?limit=50&before=2024-12-31T12:00:00Z
Authorization: Bearer <token>
```

**Query Parameters:**
- `limit` (optional): Number of messages to fetch (default: 50)
- `before` (optional): ISO timestamp for pagination

**Response:**
```json
{
  "messages": [
    {
      "id": "uuid",
      "chat_id": "uuid",
      "sender_id": "uuid",
      "encrypted_content": "base64_encrypted_blob",
      "message_type": "text",
      "metadata": {},
      "status": "read",
      "encryption_key_id": "key_v1",
      "reply_to": null,
      "created_at": "2024-12-31T12:00:00Z",
      "expires_at": null
    }
  ]
}
```

#### Send Message
```http
POST /api/messages
Authorization: Bearer <token>
Content-Type: application/json

{
  "chat_id": "uuid",
  "encrypted_content": "base64_encrypted_blob",
  "message_type": "text",
  "metadata": {
    "file_name": "document.pdf",
    "file_size": 12345
  },
  "encryption_key_id": "key_v1",
  "expires_at": "2024-12-31T23:59:59Z",
  "reply_to": "message_uuid"
}
```

**Message Types:**
- `text`: Text message
- `image`: Image file
- `file`: Document/file
- `voice`: Voice message

#### Delete Message
```http
DELETE /api/messages/:messageId
Authorization: Bearer <token>
```

#### Mark Messages as Read
```http
POST /api/messages/:chatId/read
Authorization: Bearer <token>
```

### 5. Groups

#### Create Group
```http
POST /api/groups
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "My Group",
  "description": "Group description",
  "avatar_url": "https://...",
  "member_ids": ["uuid1", "uuid2"]
}
```

#### Update Group Info
```http
PATCH /api/groups/:groupId
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "New Group Name",
  "description": "New description"
}
```

#### Add Member
```http
POST /api/groups/:groupId/members/:userId
Authorization: Bearer <token>
```

#### Remove Member
```http
DELETE /api/groups/:groupId/members/:userId
Authorization: Bearer <token>
```

#### Promote to Admin
```http
POST /api/groups/:groupId/admins/:userId
Authorization: Bearer <token>
```

#### Update Group Settings
```http
PATCH /api/groups/:groupId/settings
Authorization: Bearer <token>
Content-Type: application/json

{
  "only_admins_can_message": true,
  "only_admins_can_add_members": true,
  "invite_link_enabled": true
}
```

#### Generate Invite Link
```http
POST /api/groups/:groupId/invite-link
Authorization: Bearer <token>
```

**Response:**
```json
{
  "invite_link": "group_uuid:random_token"
}
```

#### Join via Invite Link
```http
POST /api/groups/join/:inviteLink
Authorization: Bearer <token>
```

### 6. Backups

#### Get Google OAuth URL
```http
GET /api/backup/auth/google
Authorization: Bearer <token>
```

**Response:**
```json
{
  "auth_url": "https://accounts.google.com/o/oauth2/v2/auth?..."
}
```

#### Create Backup
```http
POST /api/backup
Authorization: Bearer <token>
Content-Type: application/json

{
  "encrypted_data": "base64_encrypted_backup",
  "backup_size": 1234567
}
```

#### Get Backups
```http
GET /api/backup
Authorization: Bearer <token>
```

**Response:**
```json
{
  "backups": [
    {
      "id": "uuid",
      "user_id": "uuid",
      "google_email": "user@gmail.com",
      "drive_file_id": "drive_file_id",
      "backup_size": 1234567,
      "encrypted_hash": "sha256_hash",
      "status": "completed",
      "created_at": "2024-12-31T12:00:00Z"
    }
  ]
}
```

#### Restore Backup
```http
GET /api/backup/restore/:backupId
Authorization: Bearer <token>
```

**Response:**
```json
{
  "encrypted_data": "base64_encrypted_backup",
  "backup": {
    "id": "uuid",
    "created_at": "2024-12-31T12:00:00Z"
  }
}
```

### 7. Device Verification

#### Request Verification
```http
POST /api/devices/verify/request
Authorization: Bearer <token>
Content-Type: application/json

{
  "device_id": "device_unique_id",
  "device_name": "iPhone 15"
}
```

**Response:**
```json
{
  "success": true,
  "verification_code": "123456",
  "expires_at": "2024-12-31T12:10:00Z"
}
```

#### Verify Device
```http
POST /api/devices/verify/confirm
Authorization: Bearer <token>
Content-Type: application/json

{
  "device_id": "device_unique_id",
  "verification_code": "123456"
}
```

#### Generate QR Code
```http
POST /api/devices/verify/qr
Authorization: Bearer <token>
Content-Type: application/json

{
  "device_id": "device_unique_id"
}
```

**Response:**
```json
{
  "qr_data": "user_id:device_id:verification_code"
}
```

## WebSocket Events Reference

### Connection
```javascript
const socket = io('http://localhost:3000', {
  auth: { token: 'supabase_jwt_token' }
});
```

### Events

#### message:send
```javascript
socket.emit('message:send', {
  chatId: 'uuid',
  encryptedContent: 'base64...',
  messageType: 'text',
  metadata: {},
  encryptionKeyId: 'key_v1',
  expiresAt: '2024-12-31T23:59:59Z', // optional
  replyTo: 'message_uuid' // optional
});
```

#### message:receive
```javascript
socket.on('message:receive', (message) => {
  // Handle new message
});
```

#### typing:start / typing:stop
```javascript
socket.emit('typing:start', { chatId: 'uuid' });
socket.emit('typing:stop', { chatId: 'uuid' });
```

#### typing:update
```javascript
socket.on('typing:update', (data) => {
  // data: { userId, chatId, isTyping }
});
```

#### presence:update
```javascript
socket.on('presence:update', (data) => {
  // data: { userId, status, timestamp }
});
```

## Error Codes

| Code | Description |
|------|-------------|
| 400  | Bad Request - Invalid input |
| 401  | Unauthorized - Invalid or missing token |
| 403  | Forbidden - Not authorized for this resource |
| 404  | Not Found - Resource doesn't exist |
| 429  | Too Many Requests - Rate limit exceeded |
| 500  | Internal Server Error |

## Rate Limits

- Global: 100 requests per 15 minutes
- Auth endpoints: 5 requests per minute
- Socket events: 10 per second per connection
