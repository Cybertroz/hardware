# JengaPro™ Hardware Store & Building Materials Management System
*Enterprise Single-Codebase Multi-Branch ERP & POS for Kenya (Ksh, 16% VAT, eTIMS, M-Pesa, Contractor Credit)*

---

## 1. System Architecture Overview

JengaPro is designed using a **Unified Domain-Driven Monolith** architecture with **Feature Flag Gates**. Rather than maintaining disjointed codebases for small shops and large distribution chains, JengaPro deploys as **one unified application**. 

- **A small independent store** runs with a single branch, hiding complex logistical and managerial layers.
- **A multi-location building materials enterprise** switches on multiple depots, inter-branch stock transfers, driver dispatch with digital Proof of Delivery (POD), tiered approval workflows, and contractor project sub-accounts.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                             JengaPro POS & ERP                              │
├─────────────────────────────────────────────────────────────────────────────┤
│  Client (React + Tailwind CSS)                                              │
│  ├── POS Counter (Barcode Wedge, Split Payment, eTIMS Thermal Printer)      │
│  ├── Offline Sync Service (IndexedDB / Local Storage Queue)                 │
│  ├── Multi-UoM Conversion Engine (e.g. Bag <-> Tonne, Piece <-> Metre)     │
│  └── Contractor Credit & Debtor Ageing (0-30, 31-60, 61-90, 90+ days)       │
├─────────────────────────────────────────────────────────────────────────────┤
│  Backend API (Node.js + Express)                                            │
│  ├── ACID Transaction Processor (Stock deduction, non-negative guards)      │
│  ├── Weighted Average Cost (WAC) Auto-recalculation on GRN                  │
│  ├── KRA eTIMS Tax Invoice & QR Verification Generator                     │
│  └── Multi-Branch Stock Rebalancing Engine                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│  Storage Layer (PostgreSQL 14+ / High-Performance Embedded Relational)      │
│  └── 3NF Normalized Schema (Branches, Products, Units, Sales, Customers)    │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Kenyan Context & Localization

1. **Currency**: Kenyan Shillings (`Ksh / KES`).
2. **Tax Engine**: Kenya VAT standard 16% (`tax_inclusive` or `tax_exclusive` support), Zero-rated raw building materials, and KRA eTIMS invoice numbering format (`ETIMS-XXXXX-KRA-XXXXXX-KE`).
3. **Payment Methods**:
   - **M-Pesa**: Direct Till / Paybill / STK Push simulation with instant validation & M-Pesa reference code (`QKD92HS81X`).
   - **Cash**: With quick Kenyan denomination tender counters (Ksh 1000, 500, 200, 100, 50 notes & coins) and change calculator.
   - **Credit (Contractor Account)**: Real-time credit limit enforcement, preventing checkout if `current_balance + credit_amount > credit_limit`.
   - **Split Payments**: Combine any combination (e.g., Ksh 20,000 Cash + Ksh 50,000 M-Pesa + Ksh 30,000 Credit on account).
4. **Hardware Peripherals**:
   - **Barcode Scanners**: Global keyboard wedge listener automatically captures fast scans without requiring user mouse focus on an input.
   - **Thermal Printers**: Formatted 80mm & 58mm ESC/POS command generator with shop PIN, eTIMS QR, itemized tax, and cash drawer kick pulse (`1B 70 00 19 FA`).

---

## 3. Database Schema (ERD Overview)

The production schema is located in `jengapro_schema_postgresql.sql` and includes:
- `branches`: Multi-depot and warehouse locations (`NBO-MAIN`, `MSA-RD`, `KSM-YARD`).
- `products`: Master catalog with SKU, barcode, category, brand, and base inventory unit.
- `product_units`: Multi-Unit of Measure table with conversion factors (e.g. 1 Tonne = 20 Bags of Cement; 1 Metre = 0.25 Piece of PPR Pipe; 1 Box = 25 Kg of Nails).
- `branch_inventory`: Quantity on hand per location with strict non-negative check (`CHECK (quantity_on_hand >= 0)`).
- `customers`: Retail vs Contractor accounts, KRA PIN, credit limits, terms (14, 30, 60 days).
- `contractor_projects`: Staged deliveries and site-specific budget allocations (e.g., "Kilimani Heights Tower A").
- `sales`, `sale_items`, `sale_payments`: Immutable double-entry financial audit trail.
- `suppliers`, `purchase_orders`, `goods_received_notes`: Procure-to-pay workflow with automated **Weighted Average Cost (WAC)** updates.
- `deliveries`: Fleet dispatch (Isuzu 10-Tonne Tipper, Canters), drivers, and digital Proof of Delivery (POD) recipient signature stamps.
- `stock_adjustments`: Reasons for damage, theft/shrinkage, or physical count corrections.
- `audit_logs`: Complete chronological ledger of all cashier and administrative operations.

---

## 4. Feature Flags: Scaling from 1 Shop to Many Branches

Feature flags are configured in `server/db.ts` or via the UI under **Scale-Up & Approvals**:

| Feature Flag | Small Shop Setting | Multi-Branch Enterprise | Purpose |
|---|---|---|---|
| `multiBranch` | `false` | `true` | Hides branch selector; operates as a single counter POS or unlocks multi-depot routing. |
| `contractorCredit` | Optional (`false`) | `true` | Allows selling on credit to contractors with credit limit guards and debtor ageing. |
| `approvalWorkflows` | `false` | `true` | Mandates Owner/Manager sign-off for discounts > 10%, high POs, and write-offs. |
| `deliveryManagement` | `false` | `true` | Activates dispatch scheduling, vehicle registration, and mobile recipient POD signatures. |
| `projectAccounts` | `false` | `true` | Enables contractors to segregate purchases by building site (e.g. Foundation vs Roofing). |
| `allowNegativeStock` | `false` | `false` | Strict inventory discipline: blocks sales when warehouse stock is zero. |

---

## 5. Offline-Tolerant Resilience

Kenyan hardware stores and construction sites frequently experience power or network cuts. JengaPro features an **Offline Sync Service**:
1. When connectivity drops, POS continues to ring sales seamlessly.
2. Temporary offline receipts are assigned (`OFFLINE-REC-0001`).
3. Sales are safely stored in browser `localStorage` / `IndexedDB`.
4. As soon as the network returns, 1-click or automated background synchronization batch-transmits queued transactions to `/api/sync/offline`, updates inventory on the server, and secures official KRA eTIMS codes.

---

## 6. Setup & Local Run Instructions

### Prerequisites
- Node.js 18+
- npm 9+
- (Optional for full DB) PostgreSQL 14+

### Installation
```bash
# 1. Install dependencies
npm install

# 2. Run Full-Stack Express + Vite Development Server
npm run dev

# 3. Access in browser
http://localhost:3000
```

### PostgreSQL Database Deployment
```bash
# Connect to PostgreSQL and execute the DDL script:
psql -U postgres -d your_database_name -f server/schema.sql
```

---

## 7. Daily Database Backup & Disaster Recovery

### Automated Daily Backup (Cron)
Configure a daily cron job at 23:00 EAT (Nairobi time):
```bash
0 23 * * * pg_dump -U postgres -Fc -b -v -f "/var/backups/jengapro_$(date +\%Y\%m\%d).dump" jengapro_db
```

### Restore Procedure
```bash
# 1. Stop app process
systemctl stop jengapro

# 2. Restore database
pg_restore -U postgres -d jengapro_db --clean --if-exists /var/backups/jengapro_20261029.dump

# 3. Restart app and verify health
systemctl start jengapro
curl http://localhost:3000/api/health
```

---

## 8. Automated Test Suite

An interactive in-app automated test runner is embedded under **Automated Tests** in the navigation bar. It executes and verifies:
1. Non-negative stock movement guard.
2. Weighted Average Cost (WAC) formula precision.
3. Multi-unit conversion multipliers (Cement: bag/tonne, Pipe: piece/metre).
4. Kenya VAT 16% tax-inclusive breakdown formula.
5. Contractor credit limit over-allocation protection.
6. Split payment balance matching.
