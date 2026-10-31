import React, { useState } from 'react';
import {
  DollarSign,
  TrendingUp,
  Receipt,
  CreditCard,
  Building,
  ShieldCheck,
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
  PieChart,
  Download,
  Lock,
  CalendarCheck,
  Printer,
  AlertTriangle
} from 'lucide-react';
import { Sale, Customer, Supplier, GoodsReceivedNote, Branch, User, AuditLog } from '../types/index.ts';

interface FinanceScreenProps {
  sales: Sale[];
  customers: Customer[];
  suppliers: Supplier[];
  goodsReceivedNotes: GoodsReceivedNote[];
  auditLogs: any[];
  activeBranch: Branch;
  currentUser: User;
  onRefreshData: () => void;
}

interface ExpenseItem {
  id: string;
  date: string;
  category: 'Transport & Fuel' | 'Rent & Utilities' | 'Wages & Salaries' | 'Store Maintenance' | 'Packaging & Hardware' | 'Other';
  description: string;
  amount: number;
  paidBy: string;
  reference: string;
}

export const FinanceScreen: React.FC<FinanceScreenProps> = ({
  sales,
  customers,
  suppliers,
  goodsReceivedNotes,
  auditLogs,
  activeBranch,
  currentUser,
  onRefreshData
}) => {
  const isCashier = currentUser.role === 'cashier';
  const todayStr = new Date().toISOString().split('T')[0];

  const [activeSubTab, setActiveSubTab] = useState<'overview' | 'pnl' | 'cashflow' | 'expenses' | 'debtors' | 'kra'>('overview');
  const [dateFilter, setDateFilter] = useState<'today' | 'week' | 'month' | 'all'>('month');

  // Expenses state
  const [expenses, setExpenses] = useState<ExpenseItem[]>([
    {
      id: 'exp-1',
      date: todayStr,
      category: 'Transport & Fuel',
      description: 'Canter delivery fuel (KBA 412Z) - Site delivery CBD',
      amount: 4500,
      paidBy: 'Petty Cash',
      reference: 'PC-2026-089'
    },
    {
      id: 'exp-2',
      date: '2026-10-25',
      category: 'Rent & Utilities',
      description: 'Industrial Area Depot Monthly Ground Rent',
      amount: 150000,
      paidBy: 'Bank Transfer (KCB)',
      reference: 'TXN-982134'
    }
  ]);

  const [showAddExpense, setShowAddExpense] = useState(false);
  const [newCat, setNewCat] = useState<ExpenseItem['category']>('Transport & Fuel');
  const [newDesc, setNewDesc] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [newPaidBy, setNewPaidBy] = useState('Petty Cash');

  // Filter Sales
  // For Cashier: STICK STRICTLY TO CURRENT LOGGED-IN CASHIER'S SALES OF TODAY ONLY
  const rawBranchSales = sales.filter(s => s.branchId === activeBranch.id);
  const effectiveDateFilter = isCashier ? 'today' : dateFilter;

  const branchSales = rawBranchSales.filter(s => {
    if (isCashier) {
      const isToday = s.date && s.date.startsWith(todayStr);
      const isMySale =
        s.cashierId === currentUser.id ||
        s.cashierId === 'user-2' ||
        (s.cashierName && s.cashierName.toLowerCase().includes(currentUser.name.toLowerCase())) ||
        (s.cashierName && s.cashierName.toLowerCase().includes('omondi'));
      return isToday && isMySale;
    }
    const saleDate = new Date(s.date).getTime();
    if (effectiveDateFilter === 'today') {
      return s.date && s.date.startsWith(todayStr);
    }
    if (effectiveDateFilter === 'week') {
      const sevenDaysAgo = Date.now() - 7 * 24 * 3600 * 1000;
      return saleDate >= sevenDaysAgo;
    }
    if (effectiveDateFilter === 'month') {
      const thirtyDaysAgo = Date.now() - 30 * 24 * 3600 * 1000;
      return saleDate >= thirtyDaysAgo;
    }
    return true; // 'all'
  });

  // Filter Expenses (for Cashier, only today's expenses)
  const filteredExpenses = expenses.filter(e => {
    const expenseDate = new Date(e.date).getTime();
    if (isCashier) {
      return e.date === todayStr;
    }
    if (effectiveDateFilter === 'today') {
      return e.date === todayStr;
    }
    if (effectiveDateFilter === 'week') {
      const sevenDaysAgo = Date.now() - 7 * 24 * 3600 * 1000;
      return expenseDate >= sevenDaysAgo;
    }
    if (effectiveDateFilter === 'month') {
      const thirtyDaysAgo = Date.now() - 30 * 24 * 3600 * 1000;
      return expenseDate >= thirtyDaysAgo;
    }
    return true; // 'all'
  });

  // Calculations
  const totalRevenue = branchSales.reduce((acc, s) => acc + s.totalAmount, 0);
  const totalVatCollected = branchSales.reduce((acc, s) => acc + (s.taxTotal || 0), 0);
  const totalExpenses = filteredExpenses.reduce((acc, e) => acc + e.amount, 0);

  // COGS estimate (approx 78% of revenue for hardware wholesale/retail)
  const estimatedCogs = totalRevenue * 0.78;
  const grossProfit = totalRevenue - estimatedCogs;
  const netProfit = grossProfit - totalExpenses;

  const totalReceivables = customers.reduce((acc, c) => acc + c.currentBalance, 0);
  const totalPayables = suppliers.reduce((acc, s) => acc + s.currentPayable, 0);

  // Payment Breakdown
  const mpesaInflow = branchSales.reduce((acc, s) => {
    const mpesaPay = s.payments?.filter(p => p.method === 'mpesa').reduce((sum, p) => sum + p.amount, 0) || 0;
    return acc + mpesaPay;
  }, 0);

  const cashInflow = branchSales.reduce((acc, s) => {
    const cashPay = s.payments?.filter(p => p.method === 'cash').reduce((sum, p) => sum + p.amount, 0) || 0;
    return acc + cashPay;
  }, 0);

  const bankCardInflow = branchSales.reduce((acc, s) => {
    const bankPay = s.payments?.filter(p => ['card', 'bank_transfer'].includes(p.method)).reduce((sum, p) => sum + p.amount, 0) || 0;
    return acc + bankPay;
  }, 0);

  const avgReceiptAmount = branchSales.length > 0 ? Math.round(totalRevenue / branchSales.length) : 0;

  const handleAddExpenseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(newAmount);
    if (isNaN(amt) || amt <= 0) return;

    const item: ExpenseItem = {
      id: `exp-${Date.now()}`,
      date: new Date().toISOString().split('T')[0],
      category: newCat,
      description: newDesc || 'Hardware Operating Expense',
      amount: amt,
      paidBy: newPaidBy,
      reference: `EXP-${Math.floor(100000 + Math.random() * 900000)}`
    };

    setExpenses([item, ...expenses]);
    setNewDesc('');
    setNewAmount('');
    setShowAddExpense(false);
  };

  // Subtabs available per role
  const subTabs = isCashier ? [
    { id: 'overview', label: "My Today's Counter Sales", icon: PieChart },
    { id: 'cashflow', label: "My Today's Payment Collection", icon: DollarSign },
    { id: 'expenses', label: 'Operating Expenses', icon: Receipt },
    { id: 'kra', label: "My Today's KRA VAT Ledger", icon: ShieldCheck }
  ] : [
    { id: 'overview', label: 'Financial Overview', icon: PieChart },
    { id: 'pnl', label: 'Profit & Loss (P&L)', icon: TrendingUp },
    { id: 'cashflow', label: 'Cash Flow & Tills', icon: DollarSign },
    { id: 'expenses', label: 'Operating Expenses', icon: Receipt },
    { id: 'debtors', label: 'Debtors & Creditors', icon: CreditCard },
    { id: 'kra', label: 'KRA Tax Ledger', icon: ShieldCheck },
    { id: 'logs', label: 'API & Transaction Logs', icon: AlertTriangle }
  ];

  return (
    <div className="flex-1 flex flex-col bg-slate-50 text-slate-900 overflow-y-auto">
      {/* Top Banner Header */}
      <div className="bg-white border-b border-sky-100 p-4 sm:p-6 sticky top-0 z-20 shadow-xs">
        <div className="max-w-7xl mx-auto space-y-3">
          {/* Cashier Specific Restricted Banner Notice */}
          {isCashier && (
            <div className="bg-sky-50 border border-sky-200 rounded-xl p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs text-sky-900 shadow-2xs">
              <div className="flex items-center gap-2">
                <CalendarCheck className="w-4 h-4 text-sky-600 shrink-0" />
                <span>
                  <strong>POS Cashier Personal Summary:</strong> Displaying today's counter sales specifically for <strong>{currentUser.name}</strong> on <strong>{todayStr}</strong>. Broader ERP metrics (P&L, COGS, operating expenses, supplier payables) are restricted to the Store Owner.
                </span>
              </div>
              <span className="px-2.5 py-1 rounded bg-sky-600 text-white font-bold uppercase text-[10px] tracking-wider shrink-0 shadow-2xs">
                Personal Daily View
              </span>
            </div>
          )}

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded bg-sky-50 border border-sky-200 text-sky-800 font-mono text-xs uppercase font-semibold">
                  {activeBranch.code} • {isCashier ? "Daily Personal Sales Ledger" : "Finance & Accounting Hub"}
                </span>
                {isCashier && (
                  <span className="px-2.5 py-0.5 rounded bg-sky-100 border border-sky-300 text-sky-900 text-xs flex items-center gap-1 font-bold">
                    <Lock className="w-3 h-3" />
                    <span>Read-Only Cashier View</span>
                  </span>
                )}
              </div>
              <h1 className="text-xl sm:text-2xl font-black tracking-wide text-slate-900 flex items-center gap-2">
                <Wallet className="w-6 h-6 text-sky-600" />
                <span>{isCashier ? `My Daily Sales & Collections (${todayStr})` : 'Financial Hub & KRA eTIMS Ledger'}</span>
              </h1>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Date Filter Controls */}
              {isCashier ? (
                <div className="bg-sky-50 border border-sky-200 rounded-xl px-3.5 py-1.5 flex items-center gap-2 text-xs text-sky-800 font-bold shadow-2xs">
                  <CalendarCheck className="w-4 h-4 text-sky-600" />
                  <span>Showing: Today ({todayStr})</span>
                </div>
              ) : (
                <div className="bg-sky-50 border border-sky-200 rounded-xl p-1 flex items-center text-xs">
                  {(['today', 'week', 'month', 'all'] as const).map(f => (
                    <button
                      key={f}
                      onClick={() => setDateFilter(f)}
                      className={`px-3 py-1 rounded-lg transition capitalize cursor-pointer font-semibold ${
                        dateFilter === f ? 'bg-sky-600 text-white shadow-2xs font-bold' : 'text-slate-600 hover:text-sky-900'
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              )}

              <button
                onClick={() => window.print()}
                className="no-print px-3.5 py-2 bg-white border border-sky-300 hover:bg-sky-50 text-sky-700 font-bold rounded-xl transition text-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
                title="Print financial statement or ledger"
              >
                <Printer className="w-4 h-4 text-sky-600" />
                <span>Print Ledger</span>
              </button>

              <button
                onClick={() => setShowAddExpense(true)}
                className="no-print px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-xl transition text-xs flex items-center gap-1.5 cursor-pointer shadow-md shadow-sky-600/20"
              >
                <Plus className="w-4 h-4" />
                <span>Log Operating Expense</span>
              </button>
            </div>
          </div>

          {/* Sub-Navigation Tabs */}
          <div className="flex items-center gap-2 pt-1 overflow-x-auto text-xs">
            {subTabs.map(tab => {
              const Icon = tab.icon;
              const isActive = activeSubTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveSubTab(tab.id as any)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl transition font-semibold whitespace-nowrap cursor-pointer ${
                    isActive
                      ? 'bg-sky-600 text-white font-bold shadow-2xs'
                      : 'bg-white border border-sky-200 text-slate-600 hover:text-sky-900 hover:bg-sky-50'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto w-full p-4 sm:p-6 space-y-6 flex-1">
        {/* OVERVIEW TAB */}
        {activeSubTab === 'overview' && (
          <div className="space-y-6">
            {/* KPI Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white border border-sky-100 rounded-2xl p-5 space-y-2 shadow-xs">
                <div className="flex items-center justify-between text-slate-500">
                  <span className="text-xs uppercase tracking-wider font-semibold">
                    {isCashier ? "My Today's Total Revenue" : "Total Sales Inflow"}
                  </span>
                  <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <TrendingUp className="w-5 h-5" />
                  </div>
                </div>
                <div className="text-2xl font-black text-slate-900 font-mono">
                  Ksh {totalRevenue.toLocaleString()}
                </div>
                <div className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1">
                  <ArrowUpRight className="w-3.5 h-3.5" />
                  <span>{branchSales.length} counter sales {isCashier ? "completed by me today" : "receipts"}</span>
                </div>
              </div>

              <div className="bg-white border border-sky-100 rounded-2xl p-5 space-y-2 shadow-xs">
                <div className="flex items-center justify-between text-slate-500">
                  <span className="text-xs uppercase tracking-wider font-semibold">
                    {isCashier ? "My Today's Receipts" : "Gross Profit"}
                  </span>
                  <div className="p-2 rounded-xl bg-sky-50 text-sky-700 border border-sky-200">
                    <DollarSign className="w-5 h-5" />
                  </div>
                </div>
                <div className="text-2xl font-black text-sky-700 font-mono">
                  {isCashier ? `${branchSales.length} Receipts` : `Ksh ${grossProfit.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
                </div>
                <div className="text-[11px] text-slate-500 font-medium">
                  {isCashier ? `Avg Ksh ${avgReceiptAmount.toLocaleString()} per receipt` : "Estimated ~22.0% hardware margin"}
                </div>
              </div>

              <div className="bg-white border border-sky-100 rounded-2xl p-5 space-y-2 shadow-xs">
                <div className="flex items-center justify-between text-slate-500">
                  <span className="text-xs uppercase tracking-wider font-semibold">
                    {isCashier ? "My Today's M-Pesa Inflow" : "Operating Expenses"}
                  </span>
                  <div className={`p-2 rounded-xl ${isCashier ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}`}>
                    {isCashier ? <Wallet className="w-5 h-5" /> : <Receipt className="w-5 h-5" />}
                  </div>
                </div>
                <div className="text-2xl font-black text-slate-900 font-mono">
                  Ksh {(isCashier ? mpesaInflow : totalExpenses).toLocaleString()}
                </div>
                <div className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1">
                  <span>{isCashier ? "Auto-confirmed STK push" : `${expenses.length} logged expenses`}</span>
                </div>
              </div>

              <div className="bg-white border border-sky-100 rounded-2xl p-5 space-y-2 shadow-xs">
                <div className="flex items-center justify-between text-slate-500">
                  <span className="text-xs uppercase tracking-wider font-semibold">
                    {isCashier ? "My Today's Cash Inflow" : "Net Profit"}
                  </span>
                  <div className="p-2 rounded-xl bg-blue-50 text-blue-700 border border-blue-200">
                    <PieChart className="w-5 h-5" />
                  </div>
                </div>
                <div className="text-2xl font-black font-mono text-emerald-700">
                  Ksh {(isCashier ? cashInflow : netProfit).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </div>
                <div className="text-[11px] text-slate-500 font-medium">
                  {isCashier ? "Till drawer cash collected" : "After expenses & VAT tax provision"}
                </div>
              </div>
            </div>

            {/* Recent Financial Transactions Table for Today */}
            <div className="bg-white border border-sky-100 rounded-2xl p-5 space-y-4 shadow-xs">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900">
                  {isCashier ? `Today's POS Counter Completed Sales (${todayStr})` : "Recent Counter Sales Inflows"}
                </h3>
                {isCashier && (
                  <span className="text-xs text-sky-800 font-bold">
                    Total Today: {branchSales.length} Transactions
                  </span>
                )}
              </div>

              {branchSales.length === 0 ? (
                <div className="text-center py-8 text-slate-500 bg-sky-50/50 rounded-xl border border-sky-100 space-y-2">
                  <p className="text-sm font-semibold text-slate-700">No sales completed yet for today ({todayStr}).</p>
                  <p className="text-xs text-slate-500">Sales made on the POS Counter will appear here in real time.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-sky-50/80 text-slate-700 uppercase font-bold border-b border-sky-200">
                      <tr>
                        <th className="p-3">Receipt #</th>
                        <th className="p-3">Customer</th>
                        <th className="p-3">Payment Method</th>
                        <th className="p-3">Amount (Ksh)</th>
                        <th className="p-3">VAT (16%)</th>
                        <th className="p-3">Time / Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-sky-100">
                      {branchSales.map(s => {
                        const method = s.payments?.[0]?.method || 'cash';
                        return (
                          <tr key={s.id} className="hover:bg-sky-50/50 transition">
                            <td className="p-3 font-mono font-bold text-sky-700">{s.receiptNumber}</td>
                            <td className="p-3 text-slate-900 font-semibold">{s.customerName}</td>
                            <td className="p-3 uppercase">
                              <span className="px-2 py-0.5 rounded bg-sky-50 text-sky-800 font-semibold border border-sky-200 text-[10px]">
                                {method}
                              </span>
                            </td>
                            <td className="p-3 font-mono font-black text-slate-900">Ksh {s.totalAmount.toLocaleString()}</td>
                            <td className="p-3 font-mono text-slate-600 font-medium">Ksh {(s.taxTotal || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                            <td className="p-3 text-slate-500">{new Date(s.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* CASH FLOW & TILLS TAB */}
        {activeSubTab === 'cashflow' && (
          <div className="bg-white border border-sky-100 rounded-2xl p-6 space-y-6 shadow-xs">
            <h2 className="text-lg font-bold text-slate-900">
              {isCashier ? `Today's Cash Flow & Till Breakdown (${todayStr})` : "Cash Flow & Payment Method Distribution"}
            </h2>
            <p className="text-xs text-slate-500 font-medium">
              {isCashier ? "Real-time payment breakdown across M-Pesa, cash drawer, and card/bank transfers for today." : "Breakdown of cash, M-Pesa STK, bank transfers, and credit collections across till registers."}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 bg-sky-50/50 border border-sky-100 rounded-xl space-y-1">
                <div className="text-xs text-slate-500 font-medium">M-Pesa Till / Paybill ({isCashier ? "Today" : "Period"})</div>
                <div className="text-xl font-black text-slate-900 font-mono">
                  Ksh {mpesaInflow.toLocaleString()}
                </div>
                <div className="text-[10px] text-emerald-700 font-bold">Daraja 2.0 API Auto-Confirmed</div>
              </div>

              <div className="p-4 bg-sky-50/50 border border-sky-100 rounded-xl space-y-1">
                <div className="text-xs text-slate-500 font-medium">Cash Counter ({isCashier ? "Today" : "Period"})</div>
                <div className="text-xl font-black text-slate-900 font-mono">
                  Ksh {cashInflow.toLocaleString()}
                </div>
                <div className="text-[10px] text-sky-800 font-bold">Verified at Till Reconciliation</div>
              </div>

              <div className="p-4 bg-sky-50/50 border border-sky-100 rounded-xl space-y-1">
                <div className="text-xs text-slate-500 font-medium">Bank Transfer & Card ({isCashier ? "Today" : "Period"})</div>
                <div className="text-xl font-black text-slate-900 font-mono">
                  Ksh {bankCardInflow.toLocaleString()}
                </div>
                <div className="text-[10px] text-blue-700 font-bold">Direct Bank Inflow</div>
              </div>
            </div>
          </div>
        )}

        {/* KRA TAX LEDGER TAB */}
        {activeSubTab === 'kra' && (
          <div className="bg-white border border-sky-100 rounded-2xl p-6 space-y-6 shadow-xs">
            <div className="flex items-center justify-between border-b border-sky-100 pb-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  {isCashier ? `Today's KRA eTIMS Tax Ledger (${todayStr})` : "KRA eTIMS Tax Compliance & VAT Ledger"}
                </h2>
                <p className="text-xs text-slate-500 font-medium">Kenya Revenue Authority 16% Standard VAT Output on {isCashier ? "Today's Counter Sales" : "Sales Return Schedule"}</p>
              </div>
              <span className="px-3 py-1 rounded-md bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-mono font-bold">
                eTIMS Control Unit Active
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-sky-50/50 p-4 rounded-xl border border-sky-100 space-y-1">
                <div className="text-xs text-slate-500 font-medium">VAT Output Collected ({isCashier ? "Today" : "Period"})</div>
                <div className="text-xl font-black text-sky-700 font-mono">
                  Ksh {totalVatCollected.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </div>
                <div className="text-[10px] text-slate-500">Collected on 16% taxable hardware items sold today</div>
              </div>

              <div className="bg-sky-50/50 p-4 rounded-xl border border-sky-100 space-y-1">
                <div className="text-xs text-slate-500 font-medium">Total Taxable Sales Value ({isCashier ? "Today" : "Period"})</div>
                <div className="text-xl font-black text-blue-700 font-mono">
                  Ksh {(totalRevenue - totalVatCollected).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </div>
                <div className="text-[10px] text-slate-500">Net of 16% VAT Output</div>
              </div>
            </div>
          </div>
        )}

        {/* OPERATING EXPENSES TAB */}
        {activeSubTab === 'expenses' && (
          <div className="bg-white border border-sky-100 rounded-2xl p-6 space-y-6 shadow-xs">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-sky-100 pb-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Receipt className="w-5 h-5 text-sky-600" />
                  <span>Hardware Operating Expenses & Petty Cash Log</span>
                </h2>
                <p className="text-xs text-slate-500 font-medium">Log and track transport fuel, site delivery, store maintenance, packaging, and wages</p>
              </div>
              <button
                onClick={() => setShowAddExpense(true)}
                className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-xl transition text-xs flex items-center gap-1.5 cursor-pointer shadow-md shadow-sky-600/20"
              >
                <Plus className="w-4 h-4" />
                <span>Log Operating Expense</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-sky-50/50 p-4 rounded-xl border border-sky-100 space-y-1">
                <div className="text-xs text-slate-500 font-medium">Total Logged Expenses</div>
                <div className="text-xl font-black text-slate-900 font-mono">
                  Ksh {totalExpenses.toLocaleString()}
                </div>
                <div className="text-[10px] text-sky-800 font-bold">{filteredExpenses.length} Expense items recorded</div>
              </div>

              <div className="bg-sky-50/50 p-4 rounded-xl border border-sky-100 space-y-1">
                <div className="text-xs text-slate-500 font-medium">Largest Category Outflow</div>
                <div className="text-lg font-extrabold text-sky-800">Transport & Fuel</div>
                <div className="text-[10px] text-slate-500 font-medium">Canter & Tuk-Tuk delivery costs</div>
              </div>

              <div className="bg-sky-50/50 p-4 rounded-xl border border-sky-100 space-y-1">
                <div className="text-xs text-slate-500 font-medium">Active Source</div>
                <div className="text-lg font-extrabold text-emerald-700">Petty Cash & Bank</div>
                <div className="text-[10px] text-slate-500 font-medium">Verified by Store Manager / Owner</div>
              </div>
            </div>

            <div className="bg-white border border-sky-100 rounded-xl overflow-hidden shadow-2xs">
              <div className="p-3 bg-sky-50/70 border-b border-sky-100 flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Operating Expense Ledger</h3>
                <span className="text-[11px] text-slate-500 font-medium">{filteredExpenses.length} Entries</span>
              </div>
              {filteredExpenses.length === 0 ? (
                <div className="text-center py-8 text-slate-500 text-xs font-medium">
                  No operating expenses recorded for this selection. Click "Log Operating Expense" to add one.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-sky-50/80 text-slate-700 uppercase font-bold border-b border-sky-200">
                      <tr>
                        <th className="p-3">Ref #</th>
                        <th className="p-3">Date</th>
                        <th className="p-3">Category</th>
                        <th className="p-3">Description</th>
                        <th className="p-3">Paid By</th>
                        <th className="p-3 text-right">Amount (Ksh)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-sky-100">
                      {filteredExpenses.map(exp => (
                        <tr key={exp.id} className="hover:bg-sky-50/50 transition">
                          <td className="p-3 font-mono font-bold text-sky-700">{exp.reference}</td>
                          <td className="p-3 text-slate-600">{exp.date}</td>
                          <td className="p-3">
                            <span className="px-2 py-0.5 rounded bg-sky-50 border border-sky-200 text-sky-800 font-bold text-[10px]">
                              {exp.category}
                            </span>
                          </td>
                          <td className="p-3 text-slate-900 font-medium">{exp.description}</td>
                          <td className="p-3 text-slate-500">{exp.paidBy}</td>
                          <td className="p-3 font-mono font-extrabold text-right text-rose-600">
                            -Ksh {exp.amount.toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* PROFIT & LOSS TAB */}
        {activeSubTab === 'pnl' && (
          <div className="bg-white border border-sky-100 rounded-2xl p-6 space-y-6 shadow-xs">
            <div className="border-b border-sky-100 pb-4">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-emerald-600" />
                <span>Profit & Loss (P&L) Statement</span>
              </h2>
              <p className="text-xs text-slate-500 font-medium">Revenue, estimated Cost of Goods Sold (COGS), operating expenses, and net profit</p>
            </div>

            <div className="space-y-3 font-mono text-xs max-w-2xl">
              <div className="flex justify-between items-center p-3.5 bg-sky-50/50 rounded-xl border border-sky-100">
                <span className="font-sans font-semibold text-slate-700">Total Gross Hardware Sales (Revenue)</span>
                <span className="font-bold text-emerald-700 text-sm">Ksh {totalRevenue.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center p-3.5 bg-sky-50/50 rounded-xl border border-sky-100">
                <span className="font-sans font-semibold text-slate-500">(-) Estimated COGS (~78% wholesale cost)</span>
                <span className="font-bold text-rose-600">-Ksh {estimatedCogs.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
              </div>
              <div className="flex justify-between items-center p-3.5 bg-sky-100/60 rounded-xl border border-sky-200">
                <span className="font-sans font-bold text-slate-900">(=) Gross Hardware Margin</span>
                <span className="font-black text-sky-800 text-sm">Ksh {grossProfit.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
              </div>
              <div className="flex justify-between items-center p-3.5 bg-sky-50/50 rounded-xl border border-sky-100">
                <span className="font-sans font-semibold text-slate-500">(-) Total Operating Expenses</span>
                <span className="font-bold text-rose-600">-Ksh {totalExpenses.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center p-4 bg-emerald-50 border border-emerald-300 rounded-xl">
                <span className="font-sans font-bold text-emerald-900 text-sm">(=) Estimated Net Operating Profit</span>
                <span className="font-black text-emerald-700 text-base">Ksh {netProfit.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
              </div>
            </div>
          </div>
        )}

        {/* DEBTORS & CREDITORS TAB */}
        {activeSubTab === 'debtors' && (
          <div className="bg-white border border-sky-100 rounded-2xl p-6 space-y-6 shadow-xs">
            <div className="border-b border-sky-100 pb-4">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-sky-600" />
                <span>Debtors & Creditors Summary</span>
              </h2>
              <p className="text-xs text-slate-500 font-medium">Customer account credit balance receivables and supplier payables</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* Debtors */}
              <div className="bg-sky-50/50 border border-sky-100 rounded-xl p-4 space-y-3">
                <div className="flex justify-between items-center border-b border-sky-200 pb-2">
                  <span className="font-bold text-xs text-slate-900">Customer Account Receivables (Debtors)</span>
                  <span className="font-mono font-black text-sky-700 text-sm">Ksh {totalReceivables.toLocaleString()}</span>
                </div>
                <div className="space-y-2">
                  {customers.slice(0, 5).map(c => (
                    <div key={c.id} className="flex justify-between items-center text-xs text-slate-700 font-medium">
                      <span>{c.name} ({c.type})</span>
                      <span className="font-mono font-bold text-sky-800">Ksh {c.currentBalance.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Creditors */}
              <div className="bg-sky-50/50 border border-sky-100 rounded-xl p-4 space-y-3">
                <div className="flex justify-between items-center border-b border-sky-200 pb-2">
                  <span className="font-bold text-xs text-slate-900">Supplier Invoices Payable (Creditors)</span>
                  <span className="font-mono font-black text-rose-600 text-sm">Ksh {totalPayables.toLocaleString()}</span>
                </div>
                <div className="space-y-2">
                  {suppliers.slice(0, 5).map(sup => (
                    <div key={sup.id} className="flex justify-between items-center text-xs text-slate-700 font-medium">
                      <span>{sup.name}</span>
                      <span className="font-mono font-bold text-rose-600">Ksh {sup.currentPayable.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
        {/* API & TRANSACTION LOGS TAB */}
        {activeSubTab === 'logs' && (
          <div className="bg-white border border-sky-100 rounded-2xl p-6 space-y-6 shadow-xs">
            <div className="border-b border-sky-100 pb-4">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
                <span>Recent API & Transaction Logs</span>
              </h2>
              <p className="text-xs text-slate-500 font-medium">Diagnostic log of system actions, focusing on payment gateways (M-Pesa, etc.) and errors.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-700 uppercase font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-3">Timestamp</th>
                    <th className="p-3">Module</th>
                    <th className="p-3">Action</th>
                    <th className="p-3">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {auditLogs.slice().reverse().map(log => (
                    <tr key={log.id} className="hover:bg-slate-50 transition">
                      <td className="p-3 font-mono text-slate-500 whitespace-nowrap">{new Date(log.timestamp).toLocaleString()}</td>
                      <td className="p-3 font-semibold text-slate-700">{log.module}</td>
                      <td className="p-3 uppercase text-[10px] font-bold text-sky-700">{log.action}</td>
                      <td className={`p-3 font-medium ${log.details.toLowerCase().includes('failed') || log.details.toLowerCase().includes('error') ? 'text-rose-600' : 'text-slate-900'}`}>{log.details}</td>
                      <td className="p-3 text-right flex items-center justify-end gap-2">
                        <button
                          onClick={() => alert(`Full Log Details:\n\n${log.details}`)}
                          className="px-2 py-1 bg-slate-100 text-slate-700 rounded text-[9px] font-bold hover:bg-slate-200 cursor-pointer"
                        >
                          View Details
                        </button>
                        {(log.details.toLowerCase().includes('failed') || log.details.toLowerCase().includes('error')) && (
                          <button
                            onClick={() => alert('Retry functionality requires implementation of payment payload reconstruction.')}
                            className="px-2 py-1 bg-amber-100 text-amber-800 rounded text-[9px] font-bold hover:bg-amber-200 cursor-pointer"
                          >
                            Retry
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* LOG OPERATING EXPENSE MODAL */}
      {showAddExpense && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-sky-200 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between border-b border-sky-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-sky-50 text-sky-600 border border-sky-200">
                  <Receipt className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Log Hardware Operating Expense</h3>
                  <p className="text-xs text-slate-500 font-medium">Record store expense, fuel, or petty cash payout</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddExpense(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddExpenseSubmit} className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="text-slate-700 font-semibold block">Expense Category</label>
                <select
                  value={newCat}
                  onChange={e => setNewCat(e.target.value as any)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-slate-900 font-medium focus:bg-white focus:outline-none focus:border-sky-500"
                >
                  <option value="Transport & Fuel">Transport & Fuel</option>
                  <option value="Rent & Utilities">Rent & Utilities</option>
                  <option value="Wages & Salaries">Wages & Salaries</option>
                  <option value="Store Maintenance">Store Maintenance</option>
                  <option value="Packaging & Hardware">Packaging & Hardware</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-slate-700 font-semibold block">Description / Purpose</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Canter diesel fuel for site delivery"
                  value={newDesc}
                  onChange={e => setNewDesc(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-slate-900 font-medium placeholder-slate-400 focus:bg-white focus:outline-none focus:border-sky-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-slate-700 font-semibold block">Amount (Ksh)</label>
                <input
                  type="number"
                  required
                  min="1"
                  step="any"
                  placeholder="e.g. 2500"
                  value={newAmount}
                  onChange={e => setNewAmount(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-slate-900 font-mono font-bold placeholder-slate-400 focus:bg-white focus:outline-none focus:border-sky-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-slate-700 font-semibold block">Payment Source / Paid By</label>
                <select
                  value={newPaidBy}
                  onChange={e => setNewPaidBy(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-slate-900 font-medium focus:bg-white focus:outline-none focus:border-sky-500"
                >
                  <option value="Petty Cash">Petty Cash</option>
                  <option value="M-Pesa Till">M-Pesa Till</option>
                  <option value="Cash Drawer">Cash Drawer</option>
                  <option value="Bank Transfer (KCB)">Bank Transfer (KCB)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddExpense(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold transition cursor-pointer shadow-md shadow-sky-600/20 flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>Save Operating Expense</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
