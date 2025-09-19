# Railway Deployment Guide for Backend

## 🚀 Deploy Express Backend to Railway

Railway is perfect for the Express server because it supports:
- ✅ WebSocket connections
- ✅ PostgreSQL database
- ✅ Automatic deployments from GitHub
- ✅ Environment variables
- ✅ Free tier available

## 📋 Step-by-Step Railway Deployment

### **Step 1: Create Railway Account**
1. Go to [railway.app](https://railway.app)
2. Sign up with GitHub
3. Connect your GitHub account

### **Step 2: Create New Project**
1. Click "New Project"
2. Select "Deploy from GitHub repo"
3. Choose `andrewhuhh/capy-mini`
4. Railway will automatically detect it's a Node.js project

### **Step 3: Add PostgreSQL Database**
1. In your Railway project dashboard
2. Click "New" → "Database" → "Add PostgreSQL"
3. Railway will create a PostgreSQL instance
4. Copy the `DATABASE_URL` from the database settings

### **Step 4: Configure Environment Variables**
In Railway dashboard → Variables, add:

```bash
# Database (auto-provided by Railway PostgreSQL)
DATABASE_URL=postgresql://username:password@host:port/database

# JWT Authentication
JWT_SECRET=CAABVAUwaugToN742glkQbAJ1yyyay+6D0MuK/dJfv8fnx2HxUbDTwV6H223nQgmWEzRBOzCpRkvizYml9p71Q==

# Server Configuration
NODE_ENV=production
PORT=3001

# Session Configuration  
SESSION_EXPIRY=7d

# Rate Limiting
RATE_LIMIT_WINDOW=900000
RATE_LIMIT_REQUESTS=100

# OpenRouter API (optional)
OPENROUTER_API_URL=https://openrouter.ai/api/v1

# CORS Origin (your Vercel frontend URL)
NEXT_PUBLIC_API_URL=https://your-frontend.vercel.app
```

### **Step 5: Configure Railway Start Command**
1. Create `railway.json` in project root:
```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS",
    "buildCommand": "npm install && npx prisma generate"
  },
  "deploy": {
    "startCommand": "npm run server",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

### **Step 6: Deploy Backend**
1. Railway will automatically deploy when you push to GitHub
2. Get your Railway backend URL (e.g., `https://your-backend.railway.app`)
3. Note this URL for your frontend configuration

### **Step 7: Run Database Migration**
In Railway dashboard → your service → Terminal:
```bash
npx prisma db push
```

## 🔗 Update Frontend Configuration

After Railway deployment, update your Vercel environment variables:

```bash
# In Vercel dashboard or via CLI
NEXT_PUBLIC_API_URL=https://your-backend.railway.app
NEXT_PUBLIC_WS_URL=wss://your-backend.railway.app
```

## 🎯 **Complete Deployment Architecture**

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │───▶│   Backend       │───▶│   Database      │
│   (Vercel)      │    │   (Railway)     │    │   (Railway)     │  
│   - Next.js     │    │   - Express     │    │   - PostgreSQL  │
│   - Task Pages  │    │   - WebSockets  │    │   - Prisma      │
│   - React Query │    │   - APIs        │    │   - Tables      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 🧪 **Testing Your Deployment**

1. **Frontend**: Visit your Vercel URL
2. **Backend**: Visit `https://your-backend.railway.app/api/health`
3. **WebSocket**: Test real-time features in task detail pages
4. **Database**: Create user account and tasks

## 💡 **Benefits of This Architecture**

- ✅ **Vercel**: Fast frontend with global CDN
- ✅ **Railway**: Full backend support with WebSockets  
- ✅ **PostgreSQL**: Scalable production database
- ✅ **Automatic deployments** from GitHub
- ✅ **Environment separation** (dev/prod)

This gives you the best of both worlds: Vercel's excellent frontend hosting and Railway's full backend support!