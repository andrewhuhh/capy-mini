#!/bin/bash

# Database setup script for different environments

set -e

echo "🗃️  Database Setup for AI Coding Agent"
echo "======================================"

# Check if we're in the right directory
if [ ! -f "prisma/schema.prisma" ]; then
    echo "❌ Error: Please run this script from the project root directory"
    exit 1
fi

# Function to setup SQLite (local development)
setup_sqlite() {
    echo "Setting up SQLite for local development..."
    
    # Update schema to use SQLite
    sed -i.bak 's|// datasource db {|datasource db {|g' prisma/schema.prisma
    sed -i.bak 's|//   provider = "sqlite"|  provider = "sqlite"|g' prisma/schema.prisma
    sed -i.bak 's|//   url      = env("DATABASE_URL")|  url      = env("DATABASE_URL")|g' prisma/schema.prisma
    sed -i.bak 's|// }|}|g' prisma/schema.prisma
    
    # Comment out other providers
    sed -i.bak 's|^datasource db {|// datasource db {|g; s|^  provider = "postgresql"|//   provider = "postgresql"|g; s|^  url      = env("DATABASE_URL")|//   url      = env("DATABASE_URL")|g' prisma/schema.prisma
    
    # Set SQLite DATABASE_URL
    export DATABASE_URL="file:./dev.db"
    echo "DATABASE_URL=file:./dev.db" > .env.local
    
    # Generate client and push schema
    npx prisma generate
    npx prisma db push
    
    echo "✅ SQLite database setup complete!"
    echo "📍 Database file: prisma/dev.db"
}

# Function to setup PostgreSQL (production)
setup_postgresql() {
    echo "Setting up PostgreSQL for production..."
    
    if [ -z "$DATABASE_URL" ]; then
        echo "❌ Error: DATABASE_URL environment variable not set"
        echo "Please set your PostgreSQL connection string:"
        echo "export DATABASE_URL='postgresql://username:password@host:5432/database'"
        exit 1
    fi
    
    # Update schema to use PostgreSQL
    sed -i.bak 's|^datasource db {|// datasource db {|g' prisma/schema.prisma
    sed -i.bak 's|^  provider = "sqlite"|//   provider = "sqlite"|g' prisma/schema.prisma
    
    # Enable PostgreSQL
    sed -i.bak 's|// datasource db {|datasource db {|g' prisma/schema.prisma
    sed -i.bak 's|//   provider = "postgresql"|  provider = "postgresql"|g' prisma/schema.prisma
    
    # Generate client and deploy
    npx prisma generate
    npx prisma db push
    
    echo "✅ PostgreSQL database setup complete!"
}

# Function to setup MySQL/PlanetScale
setup_mysql() {
    echo "Setting up MySQL/PlanetScale..."
    
    if [ -z "$DATABASE_URL" ]; then
        echo "❌ Error: DATABASE_URL environment variable not set"
        echo "Please set your MySQL connection string:"
        echo "export DATABASE_URL='mysql://username:password@host/database'"
        exit 1
    fi
    
    # Update schema to use MySQL
    sed -i.bak 's|^datasource db {|// datasource db {|g' prisma/schema.prisma
    
    # Enable MySQL with relationMode
    cat >> prisma/schema.prisma << 'EOF'

datasource db {
  provider = "mysql"
  url      = env("DATABASE_URL")
  relationMode = "prisma"
}
EOF
    
    npx prisma generate
    npx prisma db push
    
    echo "✅ MySQL database setup complete!"
}

# Main menu
echo "Choose your database provider:"
echo "1) SQLite (Local development)"
echo "2) PostgreSQL (Production/Vercel)"
echo "3) MySQL/PlanetScale"
echo ""
read -p "Enter your choice (1-3): " choice

case $choice in
    1)
        setup_sqlite
        ;;
    2)
        setup_postgresql
        ;;
    3)
        setup_mysql
        ;;
    *)
        echo "❌ Invalid choice. Please run the script again."
        exit 1
        ;;
esac

echo ""
echo "🎉 Database setup complete!"
echo "💡 Next steps:"
echo "   • Start your development server: npm run dev"
echo "   • Create a test user account"
echo "   • Test the task management pages"