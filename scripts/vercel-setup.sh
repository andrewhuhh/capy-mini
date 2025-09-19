#!/bin/bash

# Vercel Environment Variables Setup Script

set -e

echo "🚀 Vercel Deployment Setup for AI Coding Agent"
echo "=============================================="

# Check if vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo "Installing Vercel CLI..."
    npm install -g vercel
fi

# Check if we're linked to a Vercel project
if [ ! -f ".vercel/project.json" ]; then
    echo "🔗 Linking to Vercel project..."
    vercel link
fi

echo ""
echo "Setting up environment variables for Vercel..."
echo ""

# Generate secure JWT secret
JWT_SECRET=$(openssl rand -base64 64 2>/dev/null || node -e "console.log(require('crypto').randomBytes(64).toString('base64'))")

echo "🔐 Generated secure JWT_SECRET"

# Get project domain (will be set after first deployment)
read -p "Enter your Vercel app domain (e.g., my-app.vercel.app): " VERCEL_DOMAIN

if [ -z "$VERCEL_DOMAIN" ]; then
    echo "ℹ️  No domain provided. You can update API URLs later after deployment."
    API_URL="https://your-app.vercel.app"
    WS_URL="wss://your-app.vercel.app"
else
    API_URL="https://$VERCEL_DOMAIN"
    WS_URL="wss://$VERCEL_DOMAIN"
fi

echo ""
echo "🗃️  Database Setup"
echo "Choose your database provider:"
echo "1) Vercel Postgres (Recommended)"
echo "2) Supabase PostgreSQL"
echo "3) PlanetScale MySQL"
echo "4) I'll set DATABASE_URL manually"
echo ""
read -p "Enter your choice (1-4): " db_choice

case $db_choice in
    1)
        echo "ℹ️  For Vercel Postgres:"
        echo "   1. Go to your Vercel dashboard"
        echo "   2. Navigate to Storage → Create Database → Postgres"
        echo "   3. DATABASE_URL will be automatically set"
        DATABASE_URL="vercel-postgres-will-provide-this"
        ;;
    2)
        read -p "Enter your Supabase DATABASE_URL: " DATABASE_URL
        ;;
    3)
        read -p "Enter your PlanetScale DATABASE_URL: " DATABASE_URL
        ;;
    4)
        read -p "Enter your DATABASE_URL: " DATABASE_URL
        ;;
    *)
        echo "❌ Invalid choice"
        exit 1
        ;;
esac

echo ""
echo "🔧 Setting environment variables in Vercel..."

# Set environment variables
vercel env add DATABASE_URL production <<< "$DATABASE_URL"
vercel env add JWT_SECRET production <<< "$JWT_SECRET"
vercel env add SESSION_EXPIRY production <<< "7d"
vercel env add NEXT_PUBLIC_API_URL production <<< "$API_URL"
vercel env add NEXT_PUBLIC_WS_URL production <<< "$WS_URL"
vercel env add NODE_ENV production <<< "production"
vercel env add RATE_LIMIT_WINDOW production <<< "900000"
vercel env add RATE_LIMIT_REQUESTS production <<< "100"
vercel env add OPENROUTER_API_URL production <<< "https://openrouter.ai/api/v1"

echo ""
echo "✅ Environment variables set!"
echo ""
echo "🚀 Ready to deploy!"
echo "   Run: vercel --prod"
echo ""
echo "📋 Post-deployment checklist:"
echo "   • Update API URLs with your actual domain"
echo "   • Run database migrations: npx prisma db push"
echo "   • Test user registration and login"
echo "   • Configure GitHub integration if needed"
echo ""

# Optional: Deploy immediately
read -p "Deploy to Vercel now? (y/N): " deploy_now

if [[ $deploy_now =~ ^[Yy]$ ]]; then
    echo "🚀 Deploying to Vercel..."
    vercel --prod
    
    echo ""
    echo "🎉 Deployment complete!"
    echo "💡 Don't forget to run database migrations in your production database"
fi

echo ""
echo "✨ Setup complete! Your app is ready for Vercel deployment."