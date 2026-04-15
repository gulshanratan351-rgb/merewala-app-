# Monetize Stream Dashboard - PRD

## Problem Statement
Build a full-stack web app "Monetize Stream Dashboard" similar to DiskWala/Terabox earning system. Users can upload files via Telegram bot, get earning links, track views & earnings, and withdraw money.

## Architecture
- **Backend**: FastAPI + MongoDB (motor async driver)
- **Frontend**: React + Tailwind CSS + Shadcn UI + Recharts
- **Auth**: JWT email/password + Emergent Google OAuth
- **Database**: MongoDB collections: users, links, daily_analytics, monthly_analytics, withdrawals, user_sessions, login_attempts

## User Personas
1. **Content Creator** - Uploads files, creates monetized links, tracks earnings
2. **Admin** - Manages platform, reviews withdrawals

## Core Requirements
- Dashboard with analytics (views, earnings, CPM)
- Link CRUD with copy/share functionality
- Billing with multiple withdrawal methods
- Bot/API integration for Telegram
- Auth system with JWT + Google OAuth

## What's Been Implemented (Apr 15, 2026)
- [x] JWT auth (login/register/logout/me/refresh)
- [x] Google OAuth via Emergent Auth
- [x] Dashboard with 4 stat cards + monthly/yearly charts (Recharts)
- [x] Link Manager with CRUD, search, copy link
- [x] Billing page with balance + withdrawal (UPI, Bank, PayPal, Crypto)
- [x] Bot & API page with API key management + webhook instructions
- [x] Responsive sidebar navigation
- [x] Demo seed data for admin user
- [x] Dark premium UI with Outfit/Manrope fonts

## Prioritized Backlog
### P0 (Critical)
- None remaining

### P1 (Important)
- Real Telegram bot webhook integration
- File upload/storage integration
- Ad system integration (AdMob/Banner)
- Password reset flow
- User profile/settings page

### P2 (Nice to Have)
- Referral system with unique referral codes
- Download tracking for files
- Email notifications for withdrawals
- Admin panel for withdrawal approval
- Multi-language support
- Advanced analytics (geo, device breakdown)

## Next Tasks
1. Connect real Telegram bot with webhook
2. Implement file storage (object storage)
3. Add ad system integration
4. Build admin panel for withdrawal management
