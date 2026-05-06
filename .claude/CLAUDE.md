# Anajak Suite โ€” Factory ERP Platform

## Project
Monorepo เธชเธณเธซเธฃเธฑเธเนเธฃเธเธเธฒเธ Anajak DTF/DTG/Silkscreen โ€” เธเธฃเธญเธเธเธฅเธธเธก order management (ERP), inventory (stock), เนเธฅเธฐ print-on-demand (POD)

## Business
**Anajak** โ€” เนเธฃเธเธเธฒเธเธชเธเธฃเธตเธเน€เธชเธทเนเธญ (DTF 70%, DTG 30%, Silkscreen outsource)

## Sub-Projects

### `/erp` โ€” Core Order Management
Order intake โ’ production โ’ billing โ’ CRM เธเธฃเธเธงเธเธเธฃ
- Status: ๐ง In development โ€” modules เธซเธฅเธฑเธเธ—เธณเธเธฒเธเนเธ”เนเนเธฅเนเธง
- Last updated: Mar 2026

### `/anajaktshirt-stock` โ€” Inventory Management  
Stock tracking, PR/PO/GRN, RBAC 6 roles
- Status: ๐ง Phase 2 (reports) โ€” MVP complete เนเธฅเนเธง
- Last updated: May 2026

### `/POD` โ€” Print-on-Demand Platform
Customer storefront, designer tool, marketplace integrations (Shopee, Lazada, TikTok)
- Status: ๐ฑ Early stage โ€” mock data only, backend pending
- Last updated: Mar 2026

## Shared Stack
| Layer | Tech |
|-------|------|
| Framework | Next.js 15/16 (App Router) |
| Language | TypeScript 5.5+ |
| Frontend | React 19, Tailwind CSS 3-4, shadcn/ui, Radix UI |
| Database | PostgreSQL (Supabase) |
| ORM | Prisma 6-7 |
| Auth | Supabase Auth (ERP + stock) |
| Forms | React Hook Form + Zod |
| Charts | Recharts |
| Icons | Lucide React |

## How to Run
```bash
# erp
cd erp && npm install && npm run dev    # localhost:3000
npm run db:push && npm run db:seed

# stock
cd anajaktshirt-stock && npm install && npm run dev
npm run db:push && npm run db:seed

# POD
cd POD && npm install && npm run dev
```

## Conventions
- เธ—เธธเธ project เนเธเน Prisma migrations
- Auth: Supabase (erp + stock) โ€” POD เธขเธฑเธเนเธกเนเธกเธต auth
- Anajak brand colors: blue #3973b2, yellow #fec91b, red #e72f27
- Structure: `src/app`, `src/components`, `src/lib`, `src/types`
- Stock: RBAC 6 roles (Admin, Inventory, Requester, Approver, Purchasing, Viewer)

