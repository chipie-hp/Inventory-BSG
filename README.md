# StockGuard — Hotel Inventory Management System

Multi-store inventory management built with **Next.js 14 + Supabase**, deployable to Vercel for free.

---

## Stores
| Store | Code | Location |
|-------|------|----------|
| Alliance 1 | A1 | Zone A |
| JTI | JTI | Zone B |
| Area 10 | A10 | Zone C |

---

## Features
- **Multi-store dashboard** — Managers see all 3 stores; clerks see only their assigned store
- **Role-based access** — Admin → Manager → Store Manager → Clerk → Requester
- **Receive Stock (GRN)** — Goods Received Notes with line items, weighted average costing
- **Issue / Requisitions** — Approval workflow, department tracking
- **Stock Adjustments** — Spoilage, damage, theft, transfers — all with audit trail
- **Physical Count** — Auto-compares to system stock, raises alert on variance
- **Theft Alerts** — Auto-flagged discrepancies with investigation workflow
- **Stock Valuation** — FIFO/LIFO/Weighted Avg, by store and category
- **Movement Log** — Every transaction logged: who, when, what, how much
- **Users & Roles** — Admin grants store access per user

---

## Quick Start

### 1. Create a Supabase project
1. Go to [supabase.com](https://supabase.com) → New project
2. Note your **Project URL** and **Anon Key** from Settings → API

### 2. Run the database migration
In your Supabase project → **SQL Editor** → paste and run:
```
supabase/migrations/001_initial_schema.sql
```
This creates all tables, functions, RLS policies, views, and seeds the 3 stores + sample items.

### 3. Create your first admin user
In Supabase → **Authentication** → Users → **Invite user**
Then in SQL Editor:
```sql
INSERT INTO profiles (id, full_name, role)
VALUES ('paste-the-user-uuid-here', 'Your Name', 'admin');
```

### 4. Clone and run locally
```bash
git clone <your-repo>
cd stockguard
npm install

# Copy env file and fill in your Supabase credentials
cp .env.example .env.local

npm run dev
```
Open [http://localhost:3000](http://localhost:3000)

---

## Deploy to Vercel (free)

```bash
npm install -g vercel
vercel
```

Or connect your GitHub repo to [vercel.com](https://vercel.com):
1. Import repository
2. Add environment variables from `.env.example`
3. Deploy → done

---

## Project Structure

```
stockguard/
├── supabase/
│   └── migrations/
│       └── 001_initial_schema.sql   ← Full DB schema, RLS, functions
├── src/
│   ├── app/
│   │   ├── login/          ← Login page
│   │   ├── dashboard/      ← Main dashboard (all stores or single)
│   │   ├── alerts/         ← Theft & discrepancy alerts
│   │   ├── stock/          ← Current stock + physical count
│   │   ├── receive/        ← Goods received notes (GRN)
│   │   ├── issue/          ← Requisitions & issuing
│   │   ├── adjustments/    ← Stock adjustments
│   │   ├── valuation/      ← Stock valuation report
│   │   ├── movements/      ← Full movement audit log
│   │   ├── users/          ← User & role management (admin)
│   │   └── items/          ← Item master list
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx
│   │   │   └── AppLayout.tsx
│   │   └── ui/
│   │       └── index.tsx   ← Badge, Button, Card, KpiCard, etc.
│   ├── hooks/
│   │   ├── useAuth.tsx     ← Auth context + user profile
│   │   └── useStore.tsx    ← Active store context
│   ├── lib/
│   │   └── supabase/
│   │       ├── client.ts   ← Browser client
│   │       └── server.ts   ← Server client
│   └── types/
│       └── index.ts        ← All TypeScript types
└── middleware.ts            ← Auth protection for all routes
```

---

## Database Schema Overview

| Table | Purpose |
|-------|---------|
| `stores` | Alliance 1, JTI, Area 10 |
| `profiles` | User profiles + roles |
| `user_store_access` | Which stores each user can access |
| `items` | Master item list |
| `item_categories` | Item categories |
| `store_items` | Stock levels per store per item |
| `grns` | Goods Received Notes |
| `grn_lines` | Line items for each GRN |
| `requisitions` | Issue requisitions |
| `requisition_lines` | Line items per requisition |
| `stock_movements` | Append-only audit log of every movement |
| `stock_adjustments` | Approved/pending adjustments |
| `physical_counts` | Physical count entries |
| `alerts` | Theft/discrepancy alerts |
| `transfers` | Inter-store transfers |
| `suppliers` | Supplier directory |

### Key Database Functions
| Function | What it does |
|----------|-------------|
| `post_grn(grn_id, user_id)` | Posts a GRN, updates stock, logs movement |
| `post_requisition(req_id, user_id)` | Issues stock, deducts qty, logs movement |
| `post_adjustment(adj_id, approver_id)` | Applies adjustment, auto-raises theft alert if needed |
| `process_physical_count(...)` | Compares count to system, raises alert on variance |

---

## User Roles

| Role | Dashboard | Receive | Issue | Adjust | Reports | Users |
|------|-----------|---------|-------|--------|---------|-------|
| Admin | All stores | ✓ | ✓ | ✓ | ✓ | ✓ |
| Manager | All stores (if granted) | ✓ | ✓ | Approve | ✓ | — |
| Store Manager | Own store | ✓ | ✓ | Own store | ✓ | — |
| Clerk | Own store | — | With approval | Request | — | — |
| Requester | Own store | — | — | — | — | — |

---

## Anti-Theft Features
1. **Physical count auto-flagging** — Any variance between counted and system qty raises an alert immediately
2. **Full audit trail** — Every transaction logged with user ID and timestamp, never editable
3. **Repeat alert detection** — System flags when same item shows variance multiple times
4. **Who was on duty** — Alerts capture the last person to issue from that store
5. **Approval workflow** — Clerks cannot self-approve adjustments or issues
6. **User flagging** — Suspicious users can be flagged and suspended by admin
7. **Immutable movement log** — `stock_movements` table insert-only via RLS

---

## Adding More Stores
```sql
INSERT INTO stores (name, code, location, zone)
VALUES ('New Store', 'NS', 'Location Address', 'Zone D');
```
Then assign users via the Users & Roles page.
