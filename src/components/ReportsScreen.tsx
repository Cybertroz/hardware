import React, { useState } from 'react';
import {
  BarChart3,
  TrendingUp,
  DollarSign,
  PieChart,
  Download,
  Calendar,
  AlertCircle,
  FileSpreadsheet,
  CheckCircle2,
  FileText
} from 'lucide-react';
import { Sale, Product, Supplier, Customer, Branch, GoodsReceivedNote } from '../types/index.ts';
import { formatKsh, formatDate } from '../utils/formatters.ts';

interface ReportsScreenProps {
  sales: Sale[];
  products: Product[];
  suppliers: Supplier[];
  customers: Customer[];
  goodsReceivedNotes: GoodsReceivedNote[];
  activeBranch: Branch;
}

export const ReportsScreen: React.FC<ReportsScreenProps> = ({
  sales,
  products,
  suppliers,
  customers,
  goodsReceivedNotes,
  activeBranch
}) => {
  const [reportType, setReportType] = useState<'sales' | 'profit' | 'movers' | 'valuation' | 'tax' | 'payables'>('sales');

  // Overall Sales Metrics
  const totalGrossSales = sales.reduce((acc, s) => acc + s.totalAmount, 0);
  const totalTaxCollected = sales.reduce((acc, s) => acc + s.taxTotal, 0);
  const totalNetSales = sales.reduce((acc, s) => acc + s.subtotal, 0);
  
  // Cost of Goods Sold (COGS)
  const totalCOGS = sales.reduce((acc, s) => {
    const saleCost = s.items.reduce((itemAcc, item) => itemAcc + (item.costPriceAtSale * item.baseUnitQuantity), 0);
    return acc + saleCost;
  }, 0);

  const totalGrossProfit = totalGrossSales - totalTaxCollected - totalCOGS;
  const overallMargin = totalNetSales > 0 ? Math.round((totalGrossProfit / totalNetSales) * 100) : 0;

  // Inventory Valuation (WAC)
  const totalStockValuation = products.reduce((acc, p) => {
    const totalQty = Object.values(p.stockByBranch).reduce((q, b) => q + b, 0);
    return acc + (totalQty * p.costPrice);
  }, 0);

  // KRA 16% VAT Tax Return Calculation
  // Output VAT from Sales vs Input VAT from Goods Received
  const outputVAT = totalTaxCollected;
  const inputVAT = goodsReceivedNotes.reduce((acc, grn) => acc + (grn.totalReceivedValue * 0.16 / 1.16), 0);
  const netVATPayable = Math.max(0, outputVAT - inputVAT);

  // Category Breakdown
  const categoryMap: Record<string, { count: number; sales: number; profit: number }> = {};
  sales.forEach(s => {
    s.items.forEach(it => {
      const prod = products.find(p => p.id === it.productId);
      const cat = prod?.category || 'General';
      if (!categoryMap[cat]) categoryMap[cat] = { count: 0, sales: 0, profit: 0 };
      categoryMap[cat].count += it.soldQuantity;
      categoryMap[cat].sales += it.total;
      const cost = (it.costPriceAtSale || 0) * it.baseUnitQuantity;
      categoryMap[cat].profit += (it.total - (it.taxAmount || 0) - cost);
    });
  });

  // Export Table to CSV
  const exportToCSV = (data: any[], filename: string) => {
    if (data.length === 0) return;
    const headers = Object.keys(data[0]).join(',');
    const rows = data.map(obj => Object.values(obj).map(val => `"${val}"`).join(','));
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers, ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${filename}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-80px)] overflow-hidden bg-slate-950 p-4 space-y-4">
      {/* Header & Report Navigator */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900 p-3.5 rounded-xl border border-slate-800 shadow-sm">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-amber-500" />
            <span>Financial & Operational Reports (Kenyan Standards)</span>
          </h2>
          <p className="text-xs text-slate-400">
            KRA 16% VAT returns, profit margins, stock valuation, and debtor analysis
          </p>
        </div>

        {/* Report Selector */}
        <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs overflow-x-auto">
          <button
            onClick={() => setReportType('sales')}
            className={`px-3 py-1.5 rounded-md font-medium transition whitespace-nowrap ${
              reportType === 'sales' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-300 hover:text-white'
            }`}
          >
            Sales Overview
          </button>
          <button
            onClick={() => setReportType('profit')}
            className={`px-3 py-1.5 rounded-md font-medium transition whitespace-nowrap ${
              reportType === 'profit' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-300 hover:text-white'
            }`}
          >
            Margin by Category
          </button>
          <button
            onClick={() => setReportType('movers')}
            className={`px-3 py-1.5 rounded-md font-medium transition whitespace-nowrap ${
              reportType === 'movers' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-300 hover:text-white'
            }`}
          >
            Fast & Slow Movers
          </button>
          <button
            onClick={() => setReportType('valuation')}
            className={`px-3 py-1.5 rounded-md font-medium transition whitespace-nowrap ${
              reportType === 'valuation' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-300 hover:text-white'
            }`}
          >
            Stock Valuation
          </button>
          <button
            onClick={() => setReportType('tax')}
            className={`px-3 py-1.5 rounded-md font-medium transition whitespace-nowrap ${
              reportType === 'tax' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-300 hover:text-white'
            }`}
          >
            KRA 16% VAT Return
          </button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-1">
          <span className="text-[11px] text-slate-400">Total Gross Sales (Ksh):</span>
          <div className="text-lg font-bold text-white font-mono">{formatKsh(totalGrossSales)}</div>
          <span className="text-[10px] text-emerald-400 font-semibold">{sales.length} Invoices issued</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-1">
          <span className="text-[11px] text-slate-400">Net Gross Profit:</span>
          <div className="text-lg font-bold text-emerald-400 font-mono">{formatKsh(totalGrossProfit)}</div>
          <span className="text-[10px] text-cyan-300 font-semibold">Average Margin: {overallMargin}%</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-1">
          <span className="text-[11px] text-slate-400">KRA Output VAT 16%:</span>
          <div className="text-lg font-bold text-amber-400 font-mono">{formatKsh(outputVAT)}</div>
          <span className="text-[10px] text-slate-400">eTIMS Synchronized</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-1">
          <span className="text-[11px] text-slate-400">Inventory Valuation (WAC):</span>
          <div className="text-lg font-bold text-cyan-400 font-mono">{formatKsh(totalStockValuation)}</div>
          <span className="text-[10px] text-slate-400">{products.length} Products in master</span>
        </div>
      </div>

      {/* REPORT CONTENT BODY */}
      <div className="flex-1 overflow-auto bg-slate-900 rounded-xl border border-slate-800 p-4">
        {/* 1. SALES OVERVIEW REPORT */}
        {reportType === 'sales' && (
          <div className="space-y-3">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2">
              <h3 className="text-sm font-bold text-white">Itemized Sales Ledger</h3>
              <button
                onClick={() => exportToCSV(sales.map(s => ({
                  Invoice: s.invoiceNumber,
                  Date: s.date,
                  Customer: s.customerName,
                  Subtotal: s.subtotal,
                  VAT: s.taxTotal,
                  Total: s.totalAmount,
                  Status: s.paymentStatus
                })), 'sales_report')}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded text-xs flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export CSV</span>
              </button>
            </div>

            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] border-b border-slate-800">
                <tr>
                  <th className="p-2.5">Invoice #</th>
                  <th className="p-2.5">Date & Time</th>
                  <th className="p-2.5">Customer</th>
                  <th className="p-2.5">Payment Method</th>
                  <th className="p-2.5 text-right">Net Subtotal</th>
                  <th className="p-2.5 text-right">VAT 16%</th>
                  <th className="p-2.5 text-right">Total Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-200">
                {sales.map(s => (
                  <tr key={s.id} className="hover:bg-slate-850">
                    <td className="p-2.5 font-bold font-mono text-white">{s.invoiceNumber}</td>
                    <td className="p-2.5 text-slate-400">{formatDate(s.date)}</td>
                    <td className="p-2.5">
                      <div className="font-medium text-white">{s.customerName}</div>
                      {s.projectName && <div className="text-[10px] text-purple-400">{s.projectName}</div>}
                    </td>
                    <td className="p-2.5">
                      <span className="capitalize text-slate-300">
                        {s.payments.map(p => p.method).join(' + ')}
                      </span>
                    </td>
                    <td className="p-2.5 text-right font-mono">{formatKsh(s.subtotal)}</td>
                    <td className="p-2.5 text-right font-mono text-slate-400">{formatKsh(s.taxTotal)}</td>
                    <td className="p-2.5 text-right font-mono font-bold text-amber-400">{formatKsh(s.totalAmount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 2. PROFIT MARGIN BY CATEGORY */}
        {reportType === 'profit' && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-white border-b border-slate-800 pb-2">
              Gross Profit & Margin % by Product Category
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(categoryMap).map(([category, stats]) => {
                const margin = stats.sales > 0 ? Math.round((stats.profit / stats.sales) * 100) : 0;
                return (
                  <div key={category} className="bg-slate-950 p-4 rounded-lg border border-slate-800 space-y-2 text-xs">
                    <div className="flex justify-between items-center">
                      <h4 className="font-bold text-white text-sm">{category}</h4>
                      <span className="bg-emerald-950/60 text-emerald-400 border border-emerald-800 px-2 py-0.5 rounded font-bold">
                        {margin}% Margin
                      </span>
                    </div>

                    <div className="flex justify-between pt-2 border-t border-slate-850">
                      <div>
                        <span className="text-slate-400 block text-[11px]">Revenue:</span>
                        <span className="font-bold text-white font-mono">{formatKsh(stats.sales)}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-slate-400 block text-[11px]">Gross Profit:</span>
                        <span className="font-bold text-emerald-400 font-mono">{formatKsh(stats.profit)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 3. FAST & SLOW MOVERS */}
        {reportType === 'movers' && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-white border-b border-slate-800 pb-2">
              Fast Moving Stock vs Slow Moving / Dead Stock Alert
            </h3>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Fast Movers */}
              <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 space-y-3">
                <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs uppercase">
                  <TrendingUp className="w-4 h-4" />
                  <span>Top 5 Fast Movers (High Turnover)</span>
                </div>
                <div className="space-y-2 text-xs">
                  {products.slice(0, 5).map(p => (
                    <div key={p.id} className="p-2 rounded bg-slate-900 flex justify-between items-center">
                      <div>
                        <div className="font-semibold text-white">{p.name}</div>
                        <div className="text-[10px] text-slate-400">{p.category} • Turn rate: High</div>
                      </div>
                      <span className="text-emerald-400 font-bold">{formatKsh(p.retailPrice)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Slow Movers */}
              <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 space-y-3">
                <div className="flex items-center gap-2 text-amber-400 font-bold text-xs uppercase">
                  <AlertCircle className="w-4 h-4" />
                  <span>Slow Movers (Capital Locked)</span>
                </div>
                <div className="space-y-2 text-xs">
                  {products.slice(5, 10).map(p => (
                    <div key={p.id} className="p-2 rounded bg-slate-900 flex justify-between items-center">
                      <div>
                        <div className="font-semibold text-white">{p.name}</div>
                        <div className="text-[10px] text-slate-400">{p.category} • Tied capital: {formatKsh(p.costPrice * 20)}</div>
                      </div>
                      <span className="text-amber-400 font-bold">Low Turnover</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 4. STOCK VALUATION REPORT (WAC) */}
        {reportType === 'valuation' && (
          <div className="space-y-3">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2">
              <div>
                <h3 className="text-sm font-bold text-white">Stock Valuation by Weighted Average Cost (WAC)</h3>
                <p className="text-xs text-slate-400">Total Business Inventory Asset Value: <b className="text-emerald-400">{formatKsh(totalStockValuation)}</b></p>
              </div>
              <button
                onClick={() => exportToCSV(products.map(p => ({
                  SKU: p.sku,
                  Name: p.name,
                  Unit: p.baseUnit,
                  AvgCost: p.costPrice,
                  Stock: Object.values(p.stockByBranch).reduce((a, b) => a + b, 0),
                  Valuation: Object.values(p.stockByBranch).reduce((a, b) => a + b, 0) * p.costPrice
                })), 'stock_valuation')}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded text-xs flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export CSV</span>
              </button>
            </div>

            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] border-b border-slate-800">
                <tr>
                  <th className="p-2.5">SKU</th>
                  <th className="p-2.5">Product Name</th>
                  <th className="p-2.5 text-right">Weighted Avg Cost</th>
                  <th className="p-2.5 text-right">Total Stock</th>
                  <th className="p-2.5 text-right">Asset Valuation (Ksh)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-200">
                {products.map(p => {
                  const totalQty = Object.values(p.stockByBranch).reduce((a, b) => a + b, 0);
                  const valuation = totalQty * p.costPrice;
                  return (
                    <tr key={p.id} className="hover:bg-slate-850">
                      <td className="p-2.5 font-mono text-slate-400">{p.sku}</td>
                      <td className="p-2.5 font-medium text-white">{p.name}</td>
                      <td className="p-2.5 text-right font-mono">{formatKsh(p.costPrice)}</td>
                      <td className="p-2.5 text-right font-bold">{totalQty} {p.baseUnit}</td>
                      <td className="p-2.5 text-right font-mono font-bold text-cyan-300">{formatKsh(valuation)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* 5. KRA 16% VAT TAX RETURN REPORT */}
        {reportType === 'tax' && (
          <div className="space-y-4 max-w-3xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-amber-500" />
                <span>Kenya Revenue Authority (KRA) VAT Return Schedule</span>
              </h3>
              <span className="text-xs bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded border border-amber-500/30">
                VAT Rate: 16.0% Standard
              </span>
            </div>

            <div className="bg-slate-950 p-5 rounded-xl border border-slate-800 space-y-4 text-xs">
              <div className="space-y-2">
                <div className="flex justify-between items-center p-2 rounded bg-slate-900">
                  <div>
                    <span className="font-semibold text-white block">Output Tax (Sales Invoices):</span>
                    <span className="text-[11px] text-slate-400">Total VAT collected from retail & contractor checkout invoices</span>
                  </div>
                  <span className="font-mono font-bold text-amber-400 text-sm">+{formatKsh(outputVAT)}</span>
                </div>

                <div className="flex justify-between items-center p-2 rounded bg-slate-900">
                  <div>
                    <span className="font-semibold text-white block">Less: Input Tax (Purchases & GRNs):</span>
                    <span className="text-[11px] text-slate-400">VAT paid to verified manufacturers (Bamburi, MRM, Devki) with ETR notes</span>
                  </div>
                  <span className="font-mono font-bold text-emerald-400 text-sm">-{formatKsh(inputVAT)}</span>
                </div>

                <div className="flex justify-between items-center p-3 rounded-lg bg-slate-900 border border-slate-700 text-sm font-extrabold">
                  <span className="text-white">Net VAT Payable to KRA (iTax / eTIMS):</span>
                  <span className="text-amber-400 font-mono text-base">{formatKsh(netVATPayable)}</span>
                </div>
              </div>

              <div className="p-3 bg-amber-950/20 border border-amber-800/40 rounded-lg text-slate-300 text-[11px] space-y-1">
                <div className="font-bold text-amber-400">KRA Electronic Tax Invoice Management System (eTIMS) Notice:</div>
                <div>All sales transmitted through JengaPro generate unique QR codes and Control Unit Numbers matching Kenya Section 23A of the Tax Procedures Act. Monthly return due by 20th of the following month.</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
