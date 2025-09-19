# Vercel Deployment Guide

## 🚀 Environment Variables for Vercel

### Method 1: Via Vercel Dashboard
1. Go to your project in [Vercel Dashboard](https://vercel.com)
2. Navigate to **Settings** → **Environment Variables**
3. Add each variable:

### Method 2: Via Vercel CLI
```bash
# Install Vercel CLI if not already installed
npm i -g vercel

# Set environment variables
vercel env add DATABASE_URL
vercel env add JWT_SECRET
vercel env add NEXT_PUBLIC_API_URL
# ... continue for all variables
```

## 📊 Database Options for Vercel

**⚠️ Important**: SQLite doesn't work on Vercel. Choose one of these:

### Option 1: Vercel Postgres (Recommended)
```bash
# Connect your project to Vercel Postgres
vercel link
vercel env pull .env.local
```

DATABASE_URL will be automatically provided by Vercel Postgres.

### Option 2: PlanetScale (MySQL)
```
DATABASE_URL="mysql://username:password@host/database?sslaccept=strict"
```

### Option 3: Supabase (PostgreSQL)
```
DATABASE_URL="postgresql://username:password@host:5432/database"
```

### Option 4: Railway or Render PostgreSQL
```
DATABASE_URL="postgresql://username:password@host:5432/database"
```

## 🔧 Required Environment Variables for Vercel

```bash
# Database (choose one of the options above)
DATABASE_URL="your-production-database-url"

# JWT Authentication (generate a secure secret!)
JWT_SECRET="your-super-secure-jwt-secret-for-production"
SESSION_EXPIRY="7d"

# API Configuration (adjust domain to your Vercel deployment)
NEXT_PUBLIC_API_URL="https://your-app.vercel.app"
NEXT_PUBLIC_WS_URL="wss://your-app.vercel.app"

# Server Configuration
NODE_ENV="production"

# Rate Limiting
RATE_LIMIT_WINDOW="900000"
RATE_LIMIT_REQUESTS="100"

# OpenRouter API (optional - for AI features)
OPENROUTER_API_URL="https://openrouter.ai/api/v1"

# MCP Server Endpoints (optional - you may need to deploy these separately)
MCP_FILESYSTEM_SERVER="wss://your-mcp-filesystem.vercel.app"
MCP_GIT_SERVER="wss://your-mcp-git.vercel.app"
MCP_GITHUB_SERVER="wss://your-mcp-github.vercel.app"
```

## 🛠 Prisma Configuration for Production

Update your `prisma/schema.prisma` for production database:

### For PostgreSQL (Vercel Postgres, Supabase):
```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

### For MySQL (PlanetScale):
```prisma
datasource db {
  provider = "mysql"
  url      = env("DATABASE_URL")
  relationMode = "prisma" // Required for PlanetScale
}
```

## 🔐 Generate Secure Secrets

**Critical**: Generate secure secrets for production:

```bash
# Generate a secure JWT secret
openssl rand -base64 64

# Or using Node.js
node -e "console.log(require('crypto').randomBytes(64).toString('base64'))"
```

## 📦 Vercel Deployment Steps

1. **Connect your repo to Vercel**:
   ```bash
   vercel --prod
   ```

2. **Set up database** (example with Vercel Postgres):
   ```bash
   # In your Vercel dashboard, add Vercel Postgres
   # It will automatically provide DATABASE_URL
   ```

3. **Run database migrations**:
   ```bash
   # After deployment, run this to create tables
   npx prisma db push
   ```

4. **Update build command** in `vercel.json` (create if doesn't exist):
   ```json
   {
     "buildCommand": "npm run build && npx prisma generate",
     "devCommand": "npm run dev",
     "installCommand": "npm install"
   }
   ```

## 🌐 WebSocket Considerations

**Note**: Vercel's serverless functions don't support persistent WebSocket connections. Consider:

1. **Option 1**: Use polling instead of WebSockets for real-time updates
2. **Option 2**: Deploy WebSocket server separately (Railway, Render, or dedicated server)
3. **Option 3**: Use Vercel Edge Functions with Server-Sent Events (SSE)

## 🚀 Quick Vercel Setup Script

```bash
#!/bin/bash
# Quick setup for Vercel deployment

# 1. Link to Vercel project
vercel link

# 2. Set environment variables (interactive)
vercel env add DATABASE_URL
vercel env add JWT_SECRET
vercel env add NEXT_PUBLIC_API_URL

# 3. Deploy
vercel --prod
```

## 📋 Post-Deployment Checklist

- [ ] Database connected and migrated
- [ ] Environment variables set
- [ ] JWT_SECRET is secure and unique
- [ ] API URLs point to your Vercel domain
- [ ] WebSocket alternative implemented if needed
- [ ] Test user registration and login
- [ ] Test task creation and management

Choose your database provider and I can help you set up the specific configuration!