@echo off
echo.
echo 🚀 Vercel Deployment Setup for AI Coding Agent - Windows
echo =====================================================
echo.

REM Check if vercel CLI is installed
vercel --version >nul 2>&1
if %errorlevel% neq 0 (
    echo Installing Vercel CLI...
    npm install -g vercel
)

REM Check if we're linked to a Vercel project
if not exist ".vercel\project.json" (
    echo 🔗 Linking to Vercel project...
    vercel link
)

echo.
echo Setting up environment variables for Vercel...
echo.

REM Generate secure JWT secret using Node.js
for /f "delims=" %%i in ('node -e "console.log(require('crypto').randomBytes(64).toString('base64'))"') do set JWT_SECRET=%%i

echo 🔐 Generated secure JWT_SECRET

set /p VERCEL_DOMAIN=Enter your Vercel app domain (e.g., my-app.vercel.app): 

if "%VERCEL_DOMAIN%"=="" (
    echo ℹ️  No domain provided. You can update API URLs later after deployment.
    set API_URL=https://your-app.vercel.app
    set WS_URL=wss://your-app.vercel.app
) else (
    set API_URL=https://%VERCEL_DOMAIN%
    set WS_URL=wss://%VERCEL_DOMAIN%
)

echo.
echo 🗃️  Database Setup
echo Choose your database provider:
echo 1) Railway PostgreSQL (Recommended for backend)
echo 2) Supabase PostgreSQL  
echo 3) PlanetScale MySQL
echo 4) I'll set DATABASE_URL manually
echo.
set /p db_choice=Enter your choice (1-4): 

if "%db_choice%"=="1" (
    echo ℹ️  For Railway PostgreSQL:
    echo    1. Go to railway.app and create a new project
    echo    2. Add PostgreSQL database
    echo    3. Copy the DATABASE_URL from Railway dashboard
    set /p DATABASE_URL=Enter your Railway PostgreSQL URL: 
)
if "%db_choice%"=="2" (
    set /p DATABASE_URL=Enter your Supabase DATABASE_URL: 
)
if "%db_choice%"=="3" (
    set /p DATABASE_URL=Enter your PlanetScale DATABASE_URL: 
)
if "%db_choice%"=="4" (
    set /p DATABASE_URL=Enter your DATABASE_URL: 
)

echo.
echo 🔧 Setting environment variables in Vercel...

REM Set environment variables in Vercel
echo %JWT_SECRET% | vercel env add JWT_SECRET production
echo 7d | vercel env add SESSION_EXPIRY production
echo %API_URL% | vercel env add NEXT_PUBLIC_API_URL production  
echo %WS_URL% | vercel env add NEXT_PUBLIC_WS_URL production
echo production | vercel env add NODE_ENV production

echo.
echo ✅ Environment variables set!
echo.
echo 🚀 Ready to deploy!
echo    Run: vercel --prod
echo.
echo 📋 Post-deployment checklist:
echo    • Deploy your Express server to Railway/Render separately
echo    • Update API URLs with your actual backend domain
echo    • Test user registration and login
echo.

set /p deploy_now=Deploy frontend to Vercel now? (y/N): 

if /i "%deploy_now%"=="y" (
    echo 🚀 Deploying frontend to Vercel...
    vercel --prod
    
    echo.
    echo 🎉 Frontend deployment complete!
    echo 💡 Don't forget to deploy your backend server separately
)

echo.
echo ✨ Setup complete! Your frontend is ready for Vercel deployment.
pause