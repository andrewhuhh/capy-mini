#!/bin/bash

echo "🚀 Setting up AI Coding Agent..."

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Setup environment
if [ ! -f .env ]; then
  echo "🔧 Creating .env file..."
  cp .env.example .env
  echo "⚠️  Please update .env with your configuration"
fi

# Initialize database
echo "🗄️  Setting up database..."
npx prisma db push
npx prisma generate

echo "✅ Setup complete!"
echo ""
echo "To start the application:"
echo "  Development: npm run dev:all"
echo "  Production: npm run build && npm start"
echo ""
echo "Remember to:"
echo "  1. Update .env with your OpenRouter API key"
echo "  2. Configure GitHub token for GitHub features"
echo "  3. Set up MCP servers if using MCP features"