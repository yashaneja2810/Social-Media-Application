# 🚀 Deployment Guide

## 📋 Prerequisites

- GitHub account
- Render account (free tier)
- Vercel account (free tier)
- Supabase project (already set up)

---

## 🔧 Backend Deployment (Render)

### Step 1: Push Code to GitHub

```bash
git add .
git commit -m "Add deployment configurations"
git push origin main
```

### Step 2: Deploy to Render

1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Click **New +** → **Web Service**
3. Connect your GitHub repository
4. Select your repository
5. Render will auto-detect `render.yaml` configuration

### Step 3: Set Environment Variables

In Render dashboard, add these environment variables:

```
NODE_ENV=production
PORT=3000
SUPABASE_URL=https://ethxvptzasiezviuvfwv.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV0aHh2cHR6YXNpZXp2aXV2Znd2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcxOTg3NDIsImV4cCI6MjA4Mjc3NDc0Mn0.XikHP2O24anokFNxPs9Y1CNTbjn4xEnosVMs7KGZOSE
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
SUPABASE_JWT_SECRET=<your-jwt-secret>
FRONTEND_URL=<will-add-after-vercel-deployment>
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

**Where to find Supabase secrets:**
- Go to Supabase Dashboard → Project Settings → API
- Service Role Key: Copy from "service_role" section
- JWT Secret: Copy from "JWT Settings" section

### Step 4: Deploy

Click **Create Web Service** and wait for deployment to complete.

Your backend URL will be: `https://privacy-chat-backend.onrender.com` (or similar)

---

## 🎨 Frontend Deployment (Vercel)

### Step 1: Update Backend URL in config.js

After backend is deployed, update [frontend/config.js](frontend/config.js):

```javascript
BACKEND_URL: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3000'
    : 'https://your-actual-backend-url.onrender.com', // Replace with your Render URL
```

Commit and push:
```bash
git add frontend/config.js
git commit -m "Update backend URL"
git push origin main
```

### Step 2: Deploy to Vercel

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click **Add New** → **Project**
3. Import your GitHub repository
4. Configure project:
   - **Framework Preset**: Other
   - **Root Directory**: `frontend`
   - **Build Command**: (leave empty)
   - **Output Directory**: `.` (current directory)
5. Click **Deploy**

Your frontend URL will be: `https://your-app.vercel.app`

### Step 3: Update Backend CORS

After Vercel deployment, update Render environment variable:

```
FRONTEND_URL=https://your-actual-app.vercel.app
```

Then redeploy the backend in Render dashboard.

---

## ✅ Verification Steps

### Test Backend Health:
```bash
curl https://your-backend.onrender.com/health
# Should return: {"status":"ok","timestamp":"..."}
```

### Test Frontend:
1. Open `https://your-app.vercel.app`
2. Sign up with test account
3. Create chat with another test user
4. Send encrypted messages
5. Reload page → Messages should persist

---

## 🔐 Security Checklist

- ✅ Environment variables set in Render (not in code)
- ✅ CORS configured for production frontend URL
- ✅ HTTPS enabled (automatic on Render/Vercel)
- ✅ Rate limiting enabled
- ✅ Helmet security headers enabled
- ✅ Supabase service role key kept secret

---

## 🐛 Troubleshooting

### Backend Issues:

**Build fails:**
- Check `npm install` logs in Render
- Verify `package.json` has all dependencies
- Ensure `tsconfig.json` is committed

**Runtime errors:**
- Check Render logs: Dashboard → Logs
- Verify all environment variables are set
- Check Supabase connection

### Frontend Issues:

**Can't connect to backend:**
- Verify `config.js` has correct backend URL
- Check browser console for CORS errors
- Verify backend CORS allows frontend URL

**WebSocket not connecting:**
- Check Socket.IO client version matches server
- Verify backend URL includes `https://` (not `http://`)
- Check Render logs for WebSocket upgrade errors

### CORS Errors:

Update backend environment variable:
```
FRONTEND_URL=https://your-exact-vercel-url.vercel.app
```

Redeploy backend on Render.

---

## 📊 Monitoring

### Backend (Render):
- Dashboard → Metrics: CPU, Memory, Response times
- Dashboard → Logs: Real-time application logs
- Set up alerts for downtime

### Frontend (Vercel):
- Analytics: Page views, performance
- Functions: (not used in this app)
- Deployments: Rollback if needed

---

## 💰 Cost Breakdown

| Service | Free Tier | Limits |
|---------|-----------|--------|
| **Render** | ✅ Yes | 750 hrs/month, sleeps after 15min inactivity |
| **Vercel** | ✅ Yes | 100 GB bandwidth, unlimited requests |
| **Supabase** | ✅ Yes | 500 MB database, 2 GB bandwidth |

**Total Monthly Cost: $0** (with free tiers)

---

## 🔄 Future Updates

### Deploy New Changes:

**Backend:**
```bash
git add .
git commit -m "Update backend"
git push origin main
# Render auto-deploys from GitHub
```

**Frontend:**
```bash
git add .
git commit -m "Update frontend"
git push origin main
# Vercel auto-deploys from GitHub
```

Both platforms have **automatic deployments** enabled by default!

---

## 🎯 Quick Reference

| Service | URL | Purpose |
|---------|-----|---------|
| **Backend** | `https://privacy-chat-backend.onrender.com` | API + WebSocket |
| **Frontend** | `https://your-app.vercel.app` | Web app |
| **Database** | Supabase Dashboard | User data, messages |

---

## 📝 Post-Deployment Tasks

1. ✅ Test signup/login flow
2. ✅ Test message encryption/decryption
3. ✅ Test multi-device sync
4. ✅ Test WebSocket real-time messaging
5. ✅ Test password change
6. ✅ Test recovery key generation
7. ✅ Monitor logs for errors
8. ✅ Set up custom domain (optional)

---

## 🎉 You're Live!

Your end-to-end encrypted chat app is now deployed and accessible worldwide!

Share the URL with users and enjoy zero-knowledge privacy! 🔐
