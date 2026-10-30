import React, { useState } from 'react';
import {
  Database,
  FileCode,
  Download,
  Copy,
  Check,
  Server,
  Layers,
  Shield,
  HelpCircle,
  Archive,
  RefreshCw
} from 'lucide-react';
import { generatePostgreSQLSchemaScript } from '../../server/db.ts';

export const ArchitectureDocs: React.FC = () => {
  const [copied, setCopied] = useState(false);
  const [activeDocTab, setActiveDocTab] = useState<'erd' | 'schema' | 'setup' | 'scaling' | 'backup'>('erd');
  const sqlScript = generatePostgreSQLSchemaScript();

  const handleCopySql = () => {
    navigator.clipboard.writeText(sqlScript);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadSql = () => {
    const blob = new Blob([sqlScript], { type: 'text/sql' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'jengapro_schema_postgresql.sql';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadBackup = async () => {
    try {
      const res = await fetch('/api/backup');
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `jengapro_backup_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-80px)] overflow-hidden bg-slate-50 p-4 space-y-4 text-slate-900">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-sky-100 shadow-xs">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Database className="w-5 h-5 text-sky-600" />
            <span>Architecture, Database Schema (ERD) & Production Guide</span>
          </h2>
          <p className="text-xs text-slate-500">
            Relational PostgreSQL blueprint, multi-branch scaling design, feature flag architecture, and backup/restore protocol
          </p>
        </div>

        {/* Tab Selector */}
        <div className="flex bg-sky-50/70 p-1 rounded-xl border border-sky-100 text-xs overflow-x-auto">
          <button
            onClick={() => setActiveDocTab('erd')}
            className={`px-3 py-1.5 rounded-lg font-medium transition ${
              activeDocTab === 'erd' ? 'bg-sky-600 text-white font-bold shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            1. Relational ERD
          </button>
          <button
            onClick={() => setActiveDocTab('schema')}
            className={`px-3 py-1.5 rounded-lg font-medium transition ${
              activeDocTab === 'schema' ? 'bg-sky-600 text-white font-bold shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            2. PostgreSQL DDL SQL
          </button>
          <button
            onClick={() => setActiveDocTab('scaling')}
            className={`px-3 py-1.5 rounded-lg font-medium transition ${
              activeDocTab === 'scaling' ? 'bg-sky-600 text-white font-bold shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            3. Scaling & Feature Flags
          </button>
          <button
            onClick={() => setActiveDocTab('setup')}
            className={`px-3 py-1.5 rounded-lg font-medium transition ${
              activeDocTab === 'setup' ? 'bg-sky-600 text-white font-bold shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            4. Setup & Deployment
          </button>
          <button
            onClick={() => setActiveDocTab('backup')}
            className={`px-3 py-1.5 rounded-lg font-medium transition ${
              activeDocTab === 'backup' ? 'bg-sky-600 text-white font-bold shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            5. Backup & Recovery
          </button>
        </div>
      </div>

      {/* BODY CONTENT */}
      <div className="flex-1 overflow-auto bg-white rounded-xl border border-sky-100 p-5 shadow-xs">
        {/* 1. RELATIONAL ERD */}
        {activeDocTab === 'erd' && (
          <div className="space-y-4 max-w-5xl">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Entity Relationship Diagram (ERD) Structure</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Normalized 3NF relational schema designed for high-concurrency counter checkout and audit integrity.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-mono">
              {/* Box 1: Core Organizations */}
              <div className="bg-sky-50/40 p-4 rounded-xl border border-sky-200 space-y-2">
                <div className="font-bold text-sky-800 text-sm border-b border-sky-200 pb-1">
                  1. Multi-Branch & Identity
                </div>
                <div className="text-slate-800 space-y-1">
                  <div><b>branches</b> (id, code, name, is_main_warehouse)</div>
                  <div className="text-slate-500 text-[11px]">└── 1:N with branch_inventory</div>
                  <div className="text-slate-500 text-[11px]">└── 1:N with users & sales</div>
                  <div className="pt-1.5"><b>users</b> (id, name, email, role, branch_id)</div>
                  <div className="text-slate-500 text-[11px]">Roles: owner, manager, cashier, storekeeper, dispatcher</div>
                  <div className="pt-1.5"><b>audit_logs</b> (id, timestamp, user_id, action, module)</div>
                </div>
              </div>

              {/* Box 2: Inventory & Multi-UoM */}
              <div className="bg-amber-50/40 p-4 rounded-xl border border-amber-200 space-y-2">
                <div className="font-bold text-amber-900 text-sm border-b border-amber-200 pb-1">
                  2. Products & Multi-UoM
                </div>
                <div className="text-slate-800 space-y-1">
                  <div><b>products</b> (id, sku, barcode, name, cost_price [WAC], retail_price, contractor_price, tax_rate 16%)</div>
                  <div className="pt-1.5"><b>product_units</b> (id, product_id, unit, conversion_factor, selling_price)</div>
                  <div className="text-slate-500 text-[11px]">e.g. 1 tonne = 20 bags, 1 box = 25 kg</div>
                  <div className="pt-1.5"><b>branch_inventory</b> (branch_id, product_id, quantity_on_hand)</div>
                  <div className="text-emerald-700 text-[11px] font-semibold">CONSTRAINT: quantity_on_hand &gt;= 0</div>
                  <div className="pt-1.5"><b>stock_adjustments</b> (product_id, branch_id, quantity_change, reason)</div>
                  <div className="pt-1.5"><b>stock_transfers</b> (transfer_no, source_branch, dest_branch, status)</div>
                </div>
              </div>

              {/* Box 3: POS, Sales & KRA eTIMS */}
              <div className="bg-emerald-50/40 p-4 rounded-xl border border-emerald-200 space-y-2">
                <div className="font-bold text-emerald-900 text-sm border-b border-emerald-200 pb-1">
                  3. Sales, eTIMS & Credit
                </div>
                <div className="text-slate-800 space-y-1">
                  <div><b>customers</b> (id, code, name, credit_limit, current_balance, terms)</div>
                  <div className="pt-1.5"><b>contractor_projects</b> (id, customer_id, project_name, site_location, balance)</div>
                  <div className="pt-1.5"><b>sales</b> (id, invoice_number, kra_control_code, kra_qr_url, subtotal, tax_total 16%, total_amount)</div>
                  <div className="pt-1.5"><b>sale_items</b> (sale_id, product_id, unit, sold_qty, base_unit_qty, unit_price, cost_price)</div>
                  <div className="pt-1.5"><b>sale_payments</b> (sale_id, payment_method, amount, reference [M-Pesa code], phone)</div>
                  <div className="pt-1.5"><b>deliveries</b> (sale_id, destination_address, vehicle_reg, driver_name, status, recipient_signature)</div>
                </div>
              </div>
            </div>

            {/* Architecture Invariants */}
            <div className="p-4 bg-sky-50/30 rounded-xl border border-sky-100 space-y-2 text-xs">
              <h4 className="font-bold text-slate-900 text-sm">Key Relational & Financial Invariants:</h4>
              <ul className="list-disc list-inside space-y-1 text-slate-700">
                <li><b className="text-sky-800">Strict Non-Negative Inventory:</b> The database enforces <code className="text-sky-700 font-mono">CHECK (quantity_on_hand &gt;= 0)</code> at the SQL engine level to prevent phantom stock and stockouts.</li>
                <li><b className="text-sky-800">Weighted Average Cost (WAC):</b> On each Goods Received Note (GRN), <code className="text-sky-700 font-mono">cost_price</code> automatically updates: <code className="text-sky-700 font-mono">((OldStock * OldCost) + (ReceivedQty * ReceivedUnitCost)) / TotalStock</code>.</li>
                <li><b className="text-sky-800">KRA eTIMS Compliance:</b> Every counter sale generates a sequential KRA Control Unit code, tax breakdown (16% VAT), and cryptographically signed QR code URL.</li>
                <li><b className="text-sky-800">Contractor Credit Protection:</b> Sales on credit verify <code className="text-sky-700 font-mono">current_balance + requested_credit &lt;= credit_limit</code> before committing stock deductions.</li>
              </ul>
            </div>
          </div>
        )}

        {/* 2. POSTGRESQL DDL SQL */}
        {activeDocTab === 'schema' && (
          <div className="space-y-3">
            <div className="flex justify-between items-center border-b border-sky-100 pb-2">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Production PostgreSQL Schema Script (schema.sql)</h3>
                <p className="text-xs text-slate-500">Ready to execute in PostgreSQL 14+ via psql or PgAdmin</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleCopySql}
                  className="px-3 py-1.5 bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied!' : 'Copy SQL'}</span>
                </button>
                <button
                  onClick={handleDownloadSql}
                  className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-lg text-xs flex items-center gap-1.5 transition shadow-xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download schema.sql</span>
                </button>
              </div>
            </div>

            <pre className="bg-slate-900 text-sky-300 p-4 rounded-xl font-mono text-[11px] overflow-x-auto max-h-[600px] border border-slate-800 shadow-inner">
              {sqlScript}
            </pre>
          </div>
        )}

        {/* 3. SCALING & FEATURE FLAGS */}
        {activeDocTab === 'scaling' && (
          <div className="space-y-4 max-w-4xl text-xs text-slate-700">
            <div>
              <h3 className="text-base font-bold text-slate-900">Scaling Architecture: From One Shop to Multi-Branch Enterprise</h3>
              <p className="text-slate-500 mt-1">
                JengaPro is engineered with the "Single-Codebase, Flagged Expansion" pattern. You never deploy separate code for a single hardware counter vs a 15-branch building materials group.
              </p>
            </div>

            <div className="space-y-3">
              <div className="p-4 bg-sky-50/40 rounded-xl border border-sky-100 space-y-1.5">
                <h4 className="font-bold text-sky-800 text-sm">Stage 1: Single Small Shop (Default Startup Mode)</h4>
                <p>Features active: POS Counter, Barcode scanner, M-Pesa / Cash payments, Thermal receipts, Basic retail & wholesale inventory.</p>
                <p className="text-slate-500">
                  Flags configuration: <code className="text-sky-700 font-mono">multiBranch: false, approvals: false, deliveryManagement: false, projectAccounts: false</code>.
                  The interface remains lightweight and instant for checkout staff.
                </p>
              </div>

              <div className="p-4 bg-sky-50/40 rounded-xl border border-sky-100 space-y-1.5">
                <h4 className="font-bold text-sky-800 text-sm">Stage 2: Growing Contractor Store</h4>
                <p>Enable <code className="text-sky-700 font-mono">contractorCredit: true</code> and <code className="text-sky-700 font-mono">projectAccounts: true</code>.</p>
                <p className="text-slate-500">
                  Allows sales on 30-day credit against authorized credit limits, project-level billing (e.g. Foundation slab phase, Roofing phase), and debtor ageing tracking.
                </p>
              </div>

              <div className="p-4 bg-sky-50/40 rounded-xl border border-sky-100 space-y-1.5">
                <h4 className="font-bold text-emerald-800 text-sm">Stage 3: Multi-Branch & Distribution Hub</h4>
                <p>Enable <code className="text-sky-700 font-mono">multiBranch: true, deliveryManagement: true, approvalWorkflows: true</code>.</p>
                <p className="text-slate-500">
                  Activates Central Industrial Area Depot with satellite branches (Mombasa Rd, Kisumu). Stock transfers between branches are handled with In-Transit status. Lorries and canters are assigned with digital Proof of Delivery (POD). Large discounts and purchase orders require branch manager/owner sign-off.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 4. SETUP & DEPLOYMENT INSTRUCTIONS */}
        {activeDocTab === 'setup' && (
          <div className="space-y-4 max-w-4xl text-xs text-slate-700">
            <div>
              <h3 className="text-base font-bold text-slate-900">Local Run & Production Deployment Instructions</h3>
            </div>

            <div className="space-y-4">
              <div className="bg-sky-50/40 p-4 rounded-xl border border-sky-100 space-y-2">
                <h4 className="font-bold text-sky-800 text-sm">1. Local Run (Development)</h4>
                <pre className="bg-slate-900 p-3 rounded-lg font-mono text-sky-300 text-[11px] overflow-x-auto">
{`# 1. Clone repository
git clone https://github.com/your-org/jengapro-hardware-erp.git
cd jengapro-hardware-erp

# 2. Install dependencies
npm install

# 3. Start local development server (Full-stack Express + Vite on port 3000)
npm run dev

# 4. Open browser at:
http://localhost:3000`}
                </pre>
              </div>

              <div className="bg-sky-50/40 p-4 rounded-xl border border-sky-100 space-y-2">
                <h4 className="font-bold text-sky-800 text-sm">2. Connecting to PostgreSQL Database</h4>
                <pre className="bg-slate-900 p-3 rounded-lg font-mono text-sky-300 text-[11px] overflow-x-auto">
{`# Create database
psql -U postgres -c "CREATE DATABASE jengapro_db;"

# Apply DDL schema and initial tables
psql -U postgres -d jengapro_db -f jengapro_schema_postgresql.sql

# Configure .env:
SQL_HOST=localhost
SQL_DB_NAME=jengapro_db
SQL_USER=postgres
SQL_PASSWORD=your_secure_password
PORT=3000`}
                </pre>
              </div>

              <div className="bg-sky-50/40 p-4 rounded-xl border border-sky-100 space-y-2">
                <h4 className="font-bold text-emerald-800 text-sm">3. Production Build & Deployment (Docker / Cloud Run)</h4>
                <pre className="bg-slate-900 p-3 rounded-lg font-mono text-sky-300 text-[11px] overflow-x-auto">
{`# Build frontend bundle
npm run build

# Start production server
NODE_ENV=production npm start`}
                </pre>
              </div>
            </div>
          </div>
        )}

        {/* 5. BACKUP & RECOVERY PROCESS */}
        {activeDocTab === 'backup' && (
          <div className="space-y-4 max-w-4xl text-xs text-slate-700">
            <div className="flex justify-between items-center border-b border-sky-100 pb-2">
              <div>
                <h3 className="text-base font-bold text-slate-900">Daily Database Backup & Disaster Recovery Protocol</h3>
                <p className="text-slate-500">Automated snapshot creation and point-in-time recovery</p>
              </div>
              <button
                onClick={handleDownloadBackup}
                className="px-3.5 py-1.5 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-lg text-xs flex items-center gap-1.5 transition shadow-xs"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export System Snapshot (JSON)</span>
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-sky-50/40 p-4 rounded-xl border border-sky-100 space-y-2">
                <h4 className="font-bold text-slate-900 text-sm">Automated Daily Backup Command (Cron Job):</h4>
                <p className="text-slate-500">Run daily at 23:00 EAT (Nairobi Time) to export compressed PostgreSQL dump:</p>
                <pre className="bg-slate-900 p-3 rounded-lg font-mono text-sky-300 text-[11px] overflow-x-auto">
{`# Daily pg_dump backup
0 23 * * * pg_dump -U postgres -Fc -b -v -f "/var/backups/jengapro_\$(date +\\%Y\\%m\\%d_\\%H\\%M).dump" jengapro_db

# Retention: Retain daily dumps for 30 days, monthly for 7 years (Kenya Tax Law requirements)`}
                </pre>
              </div>

              <div className="bg-sky-50/40 p-4 rounded-xl border border-sky-100 space-y-2">
                <h4 className="font-bold text-slate-900 text-sm">Disaster Recovery (Restore) Process:</h4>
                <pre className="bg-slate-900 p-3 rounded-lg font-mono text-sky-300 text-[11px] overflow-x-auto">
{`# 1. Stop web server
sudo systemctl stop jengapro

# 2. Restore database from backup dump
pg_restore -U postgres -d jengapro_db --clean --if-exists /var/backups/jengapro_20261029_2300.dump

# 3. Start web server and verify integrity
sudo systemctl start jengapro
curl http://localhost:3000/api/health`}
                </pre>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
