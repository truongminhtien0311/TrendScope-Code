@echo off
cd /d "%~dp0"

echo [1/3] Kiem tra thu vien (npm install)...
call npm install

echo [2/3] Cap nhat database (prisma migrate)...
call npx prisma migrate deploy

echo [3/3] Khoi dong TrendScope (dev)...
call npm run dev

pause
