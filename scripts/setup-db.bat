@echo off
echo.
echo 🗃️  Database Setup for AI Coding Agent - Windows  
echo =============================================
echo.

REM Check if we're in the right directory
if not exist "prisma\schema.prisma" (
    echo ❌ Error: Please run this script from the project root directory
    pause
    exit /b 1
)

echo Choose your database provider:
echo 1) SQLite (Local development)
echo 2) PostgreSQL (Production/Vercel)  
echo 3) Railway PostgreSQL (Recommended for backend)
echo.
set /p choice=Enter your choice (1-3): 

if "%choice%"=="1" goto setup_sqlite
if "%choice%"=="2" goto setup_postgresql
if "%choice%"=="3" goto setup_railway
echo ❌ Invalid choice. Please run the script again.
pause
exit /b 1

:setup_sqlite
echo Setting up SQLite for local development...
set DATABASE_URL=file:./dev.db
echo DATABASE_URL=file:./dev.db > .env.local
npx prisma generate
npx prisma db push
echo ✅ SQLite database setup complete!
echo 📍 Database file: prisma\dev.db
goto end

:setup_postgresql
echo Setting up PostgreSQL for production...
if "%DATABASE_URL%"=="" (
    echo ❌ Error: DATABASE_URL environment variable not set
    echo Please set your PostgreSQL connection string:
    set /p DATABASE_URL=Enter your PostgreSQL URL: 
)
npx prisma generate
npx prisma db push
echo ✅ PostgreSQL database setup complete!
goto end

:setup_railway
echo Setting up Railway PostgreSQL...
echo ℹ️  Instructions:
echo    1. Go to railway.app and create account
echo    2. Create new project
echo    3. Add PostgreSQL database
echo    4. Copy the DATABASE_URL from Railway dashboard
echo.
set /p DATABASE_URL=Enter your Railway PostgreSQL URL: 
if "%DATABASE_URL%"=="" (
    echo ❌ Error: DATABASE_URL is required
    pause
    exit /b 1
)
npx prisma generate
npx prisma db push
echo ✅ Railway PostgreSQL database setup complete!
goto end

:end
echo.
echo 🎉 Database setup complete!
echo 💡 Next steps:
echo    • Start your development server: npm run dev
echo    • Create a test user account  
echo    • Test the task management pages
pause