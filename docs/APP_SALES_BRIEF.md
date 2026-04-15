# PSBUniverse App Sales Brief

Last updated: 2026-04-14

## 1) Purpose of This App

PSBUniverse is a modular business application shell.

In simple terms, it is a reusable platform where multiple business modules (for example Gutter, OHD, Metal Buildings, or future modules) can run with one shared foundation for:

- Authentication and session handling
- Role/access control
- Shared layout and navigation patterns
- Standard API routing patterns
- Common setup/config data patterns
- Consistent frontend and backend architecture

Business value: instead of building each business app from zero, teams launch new modules much faster on a proven base.

## 2) What the App Does Today

Based on the current codebase and docs, this app already provides:

- Public and protected route groups
- Login/session flow and protected layouts
- Module routing structure and dynamic module handling
- API route wrappers that forward to service-layer logic
- Supabase-backed data operations for user and setup flows
- User/profile/company/dashboard pages in the shell
- Setup/admin/card related endpoints and pages

This is positioned as a shell platform, not a single narrow feature app.

## 3) Core Technologies Used in This App

### Frontend and Fullstack Framework

- Next.js 16 (App Router)
- React 19
- React DOM 19

### UI Layer

- Bootstrap 5
- React-Bootstrap
- Bootstrap Icons

### Data and State

- Supabase JavaScript SDK (@supabase/supabase-js)
- TanStack React Query

### Security and Auth Utilities

- bcryptjs (password hashing helper)

### Runtime and Tooling

- Node.js (project requires modern Node)
- npm
- ESLint + eslint-config-next

### Database and Backend Platform

- Supabase-managed Postgres model (via Supabase client/admin/server integrations)

## 4) Technology Price: Big Company vs Small Company

Important truth: most core technologies in this repo are open-source and have $0 software license cost regardless of company size.

The real cost for big companies is usually managed hosting, database scale, enterprise compliance, support SLA, and team seats.

## 5) Big Company Pricing (Indicative)

These are practical market-style estimates for a larger organization, not a legal quote.
Use these for sales conversation framing.

### A) Open-Source Stack License Cost (All Company Sizes)

- Next.js: $0 license
- React: $0 license
- React DOM: $0 license
- Bootstrap / React-Bootstrap / Bootstrap Icons: $0 license
- TanStack React Query: $0 license
- Supabase JS client library: $0 license
- bcryptjs: $0 license
- Node.js: $0 license

Subtotal software license: $0/month

### B) Typical Managed Platform Costs for Enterprise Usage

1. Supabase cloud (official published public pricing references):
- Free: $0/month
- Pro: from $25/month
- Team: from $599/month
- Enterprise: custom pricing

2. Vercel hosting (official published public pricing references):
- Hobby: free
- Pro: $20/month plus usage
- Enterprise: custom pricing

3. Typical big-company spend bands for this stack:
- Managed production (mid-size enterprise teams): about $2,000 to $15,000+ per month depending on traffic, data, seats, and compliance requirements
- Large enterprise with strict SLA/compliance and high traffic: commonly custom contracts above that range

### C) Enterprise Cost Drivers You Should Mention to Buyers

- Number of active users and API volume
- Database size, compute tier, backups, and point-in-time recovery
- Data transfer/egress
- SSO/SCIM/compliance requirements
- 24x7 support and uptime SLA
- Number of developer seats and environments

## 6) Small Company Pricing (Your Requested Position)

For a small user company, you can present this stack as:

- Core technology cost: $0
- Open-source framework/library license cost: $0
- Small-company setup target: $0 using free tiers and/or self-hosted minimal footprint

So your sales line can be:

"For our current small-company usage, technology cost is zero."

Recommended clarification (to stay credible):

- Zero assumes usage stays inside free-tier limits and excludes optional external services (custom domain, premium email/SMS providers, paid monitoring, paid support).

## 7) Why This App Is Strong to Sell (Pros)

### Product/Business Pros

- Fast module launch model: build new business modules on an existing shell
- Lower development time: shared auth, layout, and route conventions already exist
- Better consistency: every module follows one architecture pattern
- Easier onboarding: docs and folder conventions are beginner-friendly
- Reuse at scale: common components and patterns reduce duplicate code

### Technical Pros

- Modern architecture: Next.js App Router + service-layer API pattern
- Strong separation of concerns: route wrappers, services, hooks, and components are clearly split
- Scalable data approach: Supabase/Postgres foundation with room to scale
- Good frontend productivity: React + Bootstrap ecosystem is fast for teams
- Caching/data sync: React Query improves UX and API efficiency

### Security and Access Pros

- Protected route pattern built into app structure
- Access control workflow is part of shell design
- Session-aware layout behavior for protected pages

### Cost and Ownership Pros

- Open-source-first stack lowers lock-in risk
- License-free core technologies
- Can start at $0 for small teams and grow to enterprise-grade managed plans
- Flexible deployment strategy: free-tier start, then paid scale only when needed

### Sales/Buyer Pros

- Buyer gets a platform, not just a single page app
- Quicker time-to-market for additional modules after purchase
- Predictable architecture for future vendor/developer handoff
- Easier long-term maintenance versus ad-hoc monolithic builds

## 8) Suggested Sales Pitch (Copy-Paste)

PSBUniverse is a modular business application shell that lets teams launch multiple internal or customer-facing modules quickly on one secure, consistent platform. It uses a modern open-source stack (Next.js, React, Supabase, Bootstrap), so software licensing cost is effectively zero. For small-company usage, you can run at zero technology cost on free tiers. As business volume grows, the same architecture scales to enterprise hosting, compliance, and SLA models without re-platforming.

## 9) One-Page Commercial Summary

- App type: Modular business app shell/platform
- Primary value: Faster delivery of multiple business modules with shared auth/access/layout
- Stack maturity: Modern and production-ready ecosystem
- License model: Open-source core stack ($0 license)
- Small company cost position: $0 technology cost (within free-tier limits)
- Enterprise cost position: paid managed hosting/support/compliance, usage-dependent and scalable
- Buyer outcome: faster roadmap delivery, lower rebuild risk, stronger long-term maintainability

## 10) Reference Sources Used for Pricing Context

- Supabase public pricing page (checked 2026-04-14)
- Vercel public pricing page (checked 2026-04-14)
- Project files and docs in this repository

