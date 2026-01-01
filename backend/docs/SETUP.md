# Setup & Deployment Guide

## Prerequisites

Before you begin, ensure you have:
- Node.js 18 or higher
- npm or yarn
- A Supabase account (free tier works)
- A Google Cloud account
- Redis server (local or cloud)

## Local Development Setup

### 1. Install Node.js Dependencies

```bash
cd backend
npm install
```

### 2. Set Up Supabase

#### A. Create Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Click "New Project"
3. Fill in project details:
   - Name: privacy-chat
   - Database Password: (choose strong password)
   - Region: (closest to you)
4. Wait for project to be created (~2 minutes)

#### B. Enable Email Authentication

1. In Supabase Dashboard, go to **Authentication > Providers**
2. Enable **Email** provider
3. Configure email templates (optional)
4. Save settings

#### C. Set Up Database Schema

1. Go to **SQL Editor** in Supabase Dashboard
2. Click "New Query"
3. Copy contents of `backend/database/schema.sql`
4. Paste and click "Run"
5. Verify tables created in **Table Editor**

#### D. Get API Keys

1. Go to **Settings > API**
2. Copy these values:
   - Project URL
   - `anon` `public` key
   - `service_role` `secret` key
   - JWT Secret (in Settings > API > JWT Settings)

### 3. Set Up Google Drive API

#### A. Create Google Cloud Project

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Click "Create Project"
3. Name: "privacy-chat-backend"
4. Click "Create"

#### B. Enable Google Drive API

1. In Google Cloud Console, go to **APIs & Services > Library**
2. Search for "Google Drive API"
3. Click and then "Enable"

#### C. Create OAuth 2.0 Credentials

1. Go to **APIs & Services > Credentials**
2. Click "+ CREATE CREDENTIALS" > "OAuth client ID"
3. Configure consent screen if prompted:
   - User Type: External
   - App name: Privacy Chat
   - User support email: (your email)
   - Developer contact: (your email)
   - Save and continue through scopes
4. Create OAuth client ID:
   - Application type: Web application
   - Name: privacy-chat-backend
   - Authorized redirect URIs: `http://localhost:3000/api/backup/auth/google/callback`
   - Click "Create"
5. Copy **Client ID** and **Client Secret**

### 4. Set Up Redis

#### Option A: Local Redis (Development)

**macOS:**
```bash
brew install redis
brew services start redis
```

**Ubuntu/Debian:**
```bash
sudo apt-get update
sudo apt-get install redis-server
sudo systemctl start redis
```

**Windows:**
```bash
# Use WSL or download Redis for Windows
wsl --install
# Then follow Ubuntu instructions
```

**Docker:**
```bash
docker run -d -p 6379:6379 --name redis redis:alpine
```

#### Option B: Cloud Redis

**Upstash Redis (Free Tier):**
1. Go to [upstash.com](https://upstash.com)
2. Create free account
3. Create database
4. Copy connection details

**Redis Labs:**
1. Go to [redis.com](https://redis.com/try-free/)
2. Create free account
3. Create database
4. Copy connection details

### 5. Configure Environment Variables

```bash
cd backend
cp .env.example .env
```

Edit `.env` with your values:

```env
# Server
PORT=3000
NODE_ENV=development

# Supabase (from Step 2.D)
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_JWT_SECRET=your-jwt-secret-from-supabase

# Redis (from Step 4)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Google Drive (from Step 3.C)
GOOGLE_CLIENT_ID=xxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOxxxxxx
GOOGLE_REDIRECT_URI=http://localhost:3000/api/backup/auth/google/callback

# Generate these
JWT_SECRET=$(openssl rand -hex 32)
ENCRYPTION_SALT=$(openssl rand -hex 32)

# CORS
CORS_ORIGIN=http://localhost:5173
```

### 6. Test Redis Connection

```bash
redis-cli ping
# Should return: PONG
```

### 7. Start Backend Server

```bash
npm run dev
```

You should see:
```
Server running on port 3000
Environment: development
Redis connected successfully
```

### 8. Test the API

```bash
# Health check
curl http://localhost:3000/health

# Should return:
# {"status":"ok","timestamp":"2024-12-31T..."}
```

## Production Deployment

### Option 1: Railway

1. **Install Railway CLI:**
```bash
npm install -g @railway/cli
```

2. **Login:**
```bash
railway login
```

3. **Initialize Project:**
```bash
cd backend
railway init
```

4. **Add Redis:**
```bash
railway add redis
```

5. **Set Environment Variables:**
```bash
railway variables set SUPABASE_URL=https://...
railway variables set SUPABASE_ANON_KEY=...
# ... set all variables from .env
```

6. **Deploy:**
```bash
railway up
```

### Option 2: Heroku

1. **Install Heroku CLI:**
```bash
npm install -g heroku
```

2. **Login:**
```bash
heroku login
```

3. **Create App:**
```bash
cd backend
heroku create privacy-chat-backend
```

4. **Add Redis:**
```bash
heroku addons:create heroku-redis:mini
```

5. **Set Environment Variables:**
```bash
heroku config:set SUPABASE_URL=https://...
heroku config:set SUPABASE_ANON_KEY=...
# ... set all variables
```

6. **Deploy:**
```bash
git push heroku main
```

### Option 3: DigitalOcean App Platform

1. **Create Account:** [digitalocean.com](https://digitalocean.com)

2. **Create App:**
   - Go to Apps
   - Create App
   - Connect GitHub repo
   - Select `backend` folder

3. **Configure:**
   - Build Command: `npm run build`
   - Run Command: `npm start`
   - Environment: Node.js 18

4. **Add Redis:**
   - Add Component > Database
   - Choose Redis
   - Link to app

5. **Environment Variables:**
   - Add all variables from `.env`
   - Use Redis connection string from database

6. **Deploy:**
   - Click "Create Resources"

### Option 4: VPS (Ubuntu)

1. **Connect to Server:**
```bash
ssh root@your-server-ip
```

2. **Install Dependencies:**
```bash
# Update system
apt-get update
apt-get upgrade -y

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt-get install -y nodejs

# Install Redis
apt-get install -y redis-server

# Install PM2
npm install -g pm2

# Install Nginx
apt-get install -y nginx
```

3. **Clone Repository:**
```bash
cd /var/www
git clone https://github.com/your-repo.git
cd your-repo/backend
npm install
```

4. **Configure Environment:**
```bash
nano .env
# Paste your production environment variables
```

5. **Build:**
```bash
npm run build
```

6. **Start with PM2:**
```bash
pm2 start dist/server.js --name privacy-chat-backend
pm2 save
pm2 startup
```

7. **Configure Nginx:**
```bash
nano /etc/nginx/sites-available/privacy-chat-backend
```

```nginx
server {
    listen 80;
    server_name api.your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

```bash
ln -s /etc/nginx/sites-available/privacy-chat-backend /etc/nginx/sites-enabled/
nginx -t
systemctl restart nginx
```

8. **SSL with Let's Encrypt:**
```bash
apt-get install -y certbot python3-certbot-nginx
certbot --nginx -d api.your-domain.com
```

### Option 5: Docker

1. **Create Dockerfile** (already in project):
```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
```

2. **Create docker-compose.yml:**
```yaml
version: '3.8'

services:
  backend:
    build: .
    ports:
      - "3000:3000"
    env_file:
      - .env.production
    depends_on:
      - redis
    restart: unless-stopped

  redis:
    image: redis:alpine
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data
    restart: unless-stopped

volumes:
  redis-data:
```

3. **Build and Run:**
```bash
docker-compose up -d
```

## Environment-Specific Configurations

### Development
```env
NODE_ENV=development
LOG_LEVEL=debug
CORS_ORIGIN=http://localhost:5173
```

### Staging
```env
NODE_ENV=staging
LOG_LEVEL=info
CORS_ORIGIN=https://staging.your-app.com
```

### Production
```env
NODE_ENV=production
LOG_LEVEL=error
CORS_ORIGIN=https://your-app.com
```

## Monitoring & Logging

### Add Application Monitoring

**Option 1: Sentry**

1. Create account at [sentry.io](https://sentry.io)
2. Create project
3. Install SDK:
```bash
npm install @sentry/node
```

4. Configure:
```typescript
// src/server.ts
import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
});

app.use(Sentry.Handlers.requestHandler());
app.use(Sentry.Handlers.errorHandler());
```

**Option 2: LogDNA/LogRocket**

Similar process - sign up, install SDK, configure.

### PM2 Monitoring

```bash
# View logs
pm2 logs privacy-chat-backend

# Monitor
pm2 monit

# Web dashboard
pm2 install pm2-server-monit
```

## Database Migrations

For schema changes:

1. **Create migration file:**
```sql
-- migrations/002_add_reactions.sql
ALTER TABLE messages ADD COLUMN reactions JSONB DEFAULT '[]';
CREATE INDEX idx_messages_reactions ON messages USING GIN(reactions);
```

2. **Apply in Supabase:**
   - Go to SQL Editor
   - Run migration
   - Or use Supabase CLI: `supabase db push`

## Backup Strategy

### Database Backups

**Supabase Automatic Backups:**
- Free tier: Daily backups (retained 7 days)
- Pro tier: Daily backups (retained 30 days)
- Can manually download from dashboard

**Manual Backup:**
```bash
# Using pg_dump via Supabase
supabase db dump -f backup.sql
```

### Redis Backup

**Enable persistence:**
```bash
# Edit redis.conf
appendonly yes
appendfsync everysec
```

**Manual backup:**
```bash
redis-cli SAVE
# Backup file: /var/lib/redis/dump.rdb
```

## Scaling Considerations

### Horizontal Scaling

1. **Use Redis Adapter for Socket.IO:**
```typescript
import { createAdapter } from '@socket.io/redis-adapter';
const pubClient = redis.duplicate();
const subClient = redis.duplicate();
io.adapter(createAdapter(pubClient, subClient));
```

2. **Load Balancer:**
```nginx
upstream backend {
    server backend1:3000;
    server backend2:3000;
    server backend3:3000;
}

server {
    location / {
        proxy_pass http://backend;
    }
}
```

### Database Scaling

1. **Connection Pooling:**
   - Supabase includes Supavisor (PgBouncer)
   - Configure max connections in Supabase dashboard

2. **Read Replicas:**
   - Available on Supabase Pro tier
   - Route read queries to replicas

## Troubleshooting

### Server Won't Start

```bash
# Check if port is in use
lsof -i :3000
# Kill process if needed
kill -9 <PID>

# Check environment variables
node -e "require('dotenv').config(); console.log(process.env.SUPABASE_URL)"
```

### Redis Connection Failed

```bash
# Check if Redis is running
redis-cli ping

# Check port
netstat -an | grep 6379

# Restart Redis
sudo systemctl restart redis
```

### WebSocket Connection Failed

```bash
# Check if port is open
telnet localhost 3000

# Check firewall
sudo ufw allow 3000

# Check Nginx config for WebSocket
# Must have these headers:
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection 'upgrade';
```

### Supabase Auth Errors

```bash
# Verify JWT secret matches
# In Supabase: Settings > API > JWT Settings

# Test token verification
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:3000/api/auth/verify
```

## Security Checklist Before Production

- [ ] All environment variables set correctly
- [ ] HTTPS/TLS enabled (Let's Encrypt or CloudFlare)
- [ ] CORS configured to only allow your frontend domain
- [ ] Rate limiting enabled
- [ ] Helmet.js configured
- [ ] Redis password set
- [ ] Firewall rules configured (only 80, 443, 22)
- [ ] SSH key-based authentication (disable password auth)
- [ ] Regular automated backups configured
- [ ] Monitoring and alerts set up
- [ ] Secrets rotated from development
- [ ] Row Level Security enabled in Supabase
- [ ] Google OAuth redirect URIs updated
- [ ] Error messages don't expose sensitive info
- [ ] Logging doesn't include secrets or encrypted content

## Performance Optimization

### Enable Compression

```typescript
import compression from 'compression';
app.use(compression());
```

### Add Caching Headers

```typescript
app.use((req, res, next) => {
  if (req.url.startsWith('/static/')) {
    res.setHeader('Cache-Control', 'public, max-age=31536000');
  }
  next();
});
```

### Database Indexes

Already included in schema.sql, but verify:
```sql
-- Check if indexes exist
SELECT * FROM pg_indexes WHERE tablename = 'messages';
```

## Cost Estimation

### Free Tier (Development)

- Supabase: Free (500MB database, 2GB storage)
- Railway: Free (500 hours/month)
- Redis: Local or Upstash free tier
- **Total: $0/month**

### Small Scale (< 1000 users)

- Supabase Pro: $25/month
- Railway Pro: $5/month
- Upstash Redis: $10/month
- **Total: $40/month**

### Medium Scale (< 10,000 users)

- Supabase Pro: $25/month
- DigitalOcean Droplet: $12/month
- Redis Cloud: $15/month
- **Total: $52/month**

## Support & Resources

- [Supabase Docs](https://supabase.com/docs)
- [Socket.IO Docs](https://socket.io/docs/)
- [Redis Docs](https://redis.io/docs/)
- [Express.js Docs](https://expressjs.com/)

## Next Steps

1. Set up frontend (will be created separately)
2. Implement client-side encryption
3. Test end-to-end flow
4. Deploy to production
5. Monitor and optimize

