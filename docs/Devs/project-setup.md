# Project Setup Guide

## Prerequisites

- **Node.js** v18+ (tested with v24.14.0)
- **npm** v9+ (tested with v11.9.0)
- A **Supabase** project (hosted or local via Docker)

## Steps to Run

### 1. Install Dependencies

```bash
npm install
```

Installs 386 packages including Next.js 16, React 19, Supabase JS, Bootstrap, TanStack Query/Table, FontAwesome, and dnd-kit.

### 2. Create `.env.local`

Create a `.env.local` file in the project root with the following required variables:

```env
# === REQUIRED ===
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

Get these values from your Supabase dashboard: **Settings → API**.

#### Optional Variables (have defaults)

```env
NEXT_PUBLIC_ENV=local                                        # local | dev | prod
CARD_MODULE_SETUP_APP_ID=1
STATUS_SETUP_APP_ID=1
USER_MASTER_SETUP_APP_ID=2
COMPANY_DEPARTMENT_SETUP_APP_ID=1
USER_MASTER_APP_CARD_GROUP_TABLE=psb_m_appcardgroup
USER_MASTER_APP_CARD_TABLE=psb_s_appcard
USER_MASTER_APP_CARD_ROLE_ACCESS_TABLE=psb_m_appcardroleaccess
```

### 3. Start the Dev Server

```bash
npm run dev
```

Opens at **http://localhost:3000** using webpack (not turbopack).

## Notes

- `.env*` files are excluded by `.gitignore` — never commit credentials.
- No database migrations or seed files exist in `supabase/`. Tables must already exist on your Supabase project.
- The webpack cache warning on first start (`PackFileCacheStrategy` rename error) is harmless and resolves automatically.
