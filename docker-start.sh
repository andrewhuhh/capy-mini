#!/bin/sh

# Run database migrations
npx prisma db push

# Start both the Next.js app and the backend server
npm run dev:all