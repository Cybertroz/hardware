import React, { useState } from 'react';
import {
  Boxes,
  Plus,
  Search,
  Filter,
  AlertTriangle,
  RotateCcw,
  Sliders,
  DollarSign,
  ArrowRightLeft,
  CheckCircle2,
  FileSpreadsheet
} from 'lucide-react';
import { Product, Branch, StockAdjustment, AdjustmentReason, User, FeatureFlags } from '../types/index.ts';
import { formatKsh, formatDate } from '../utils/formatters.ts';

interface InventoryScreenProps {
  products: Product[];
  branches: Branch[];
  activeBranch: Branch;
  currentUser: User;
  featureFlags: FeatureFlags;
  adjustments: StockAdjustment[];
  onRefreshData: () => void;
}

export const InventoryScreen: React.FC<InventoryScreenProps> = ({
  products,
  branches,
  activeBranch,
  currentUser,
  featureFlags,
  adjustments,
  onRefreshData
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [filterLowStock, setFilterLowStock] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  // Stock Adjustment Modal
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [adjustProductId, setAdjustProductId] = useState('');
  const [adjustQty, setAdjustQty] = useState<number>(0);
  const [adjustReason, setAdjustReason] = useState<AdjustmentReason>('damage');
  const [adjustNotes, setAdjustNotes] = useState('');
  const [isSubmittingAdjust, setIsSubmittingAdjust] = useState(false);
  const [adjustMessage, setAdjustMessage] = useState<string | null>(null);

  // View Tab (Products vs Audit Logs)
  const [subTab, setSubTab] = useState<'catalog' | 'uom' | 'adjustments' | 'pricing'>('catalog');

  const categories = ['All', ...Array.from(new Set(products.map(p => p.category)))];

  const filteredProducts = products.filter(p => {
    const matchesCat = selectedCategory === 'All' || p.category === selectedCategory;
    const query = searchQuery.toLowerCase().trim();
    const matchesQuery = !query ||
      p.name.toLowerCase().includes(query) ||
      p.sku.toLowerCase().includes(query) ||
      p.barcode.includes(query) ||
      p.brand.toLowerCase().includes(query);
    const currentStock = p.stockByBranch[activeBranch.id] || 0;
    const matchesLowStock = !filterLowStock || currentStock <= p.minStockAlert;
    return matchesCat && matchesQuery && matchesLowStock;
  });

  const handleOpenAdjust = (prod?: Product) => {
    setAdjustProductId(prod ? prod.id : (products[0]?.id || ''));
    setAdjustQty(0);
    setAdjustReason('count_correction');
    setAdjustNotes('');
    setAdjustMessage(null);
    setShowAdjustModal(true);
  };

  const submitStockAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustProductId || adjustQty === 0) return;

    setIsSubmittingAdjust(true);
    setAdjustMessage(null);

    try {
      const response = await fetch('/api/inventory/adjustments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: adjustProductId,
          branchId: activeBranch.id,
          quantityChange: adjustQty,
          reason: adjustReason,
          notes: adjustNotes,
          adjustedBy: currentUser.id,
          adjustedByName: currentUser.name
        })
      });

      const resData = await response.json();
      if (!response.ok) {
        throw new Error(resData.error || 'Failed to perform stock adjustment');
      }

      setAdjustMessage('Stock adjustment applied successfully!');
      setTimeout(() => {
        setShowAdjustModal(false);
        onRefreshData();
      }, 1000);
    } catch (err: any) {
      setAdjustMessage(`Error: ${err.message}`);
    } finally {
      setIsSubmittingAdjust(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-80px)] overflow-hidden bg-slate-950 p-4 space-y-4">
      {/* Top Header & Navigation Sub-Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900 p-3.5 rounded-xl border border-slate-800 shadow-sm">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Boxes className="w-5 h-5 text-amber-500" />
            <span>Inventory & Units of Measure (UoM)</span>
          </h2>
          <p className="text-xs text-slate-400">
            Multi-branch stock levels, conversions (e.g. cement bag/tonne, pipe pc/m), and price tiers
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Sub Tab buttons */}
          <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
            <button
              onClick={() => setSubTab('catalog')}
              className={`px-3 py-1.5 rounded-md font-medium transition ${
                subTab === 'catalog' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-300 hover:text-white'
              }`}
            >
              Product Catalog
            </button>
            <button
              onClick={() => setSubTab('uom')}
              className={`px-3 py-1.5 rounded-md font-medium transition ${
                subTab === 'uom' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-300 hover:text-white'
              }`}
            >
              UoM Conversions
            </button>
            <button
              onClick={() => setSubTab('pricing')}
              className={`px-3 py-1.5 rounded-md font-medium transition ${
                subTab === 'pricing' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-300 hover:text-white'
              }`}
            >
              Price Tiers
            </button>
            <button
              onClick={() => setSubTab('adjustments')}
              className={`px-3 py-1.5 rounded-md font-medium transition ${
                subTab === 'adjustments' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-300 hover:text-white'
              }`}
            >
              Audit Trail ({adjustments.length})
            </button>
          </div>

          <button
            onClick={() => handleOpenAdjust()}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Stock Adjustment</span>
          </button>
        </div>
      </div>

      {/* SUB-TAB 1: PRODUCT CATALOG */}
      {subTab === 'catalog' && (
        <div className="flex-1 flex flex-col bg-slate-900 rounded-xl border border-slate-800 overflow-hidden shadow-sm">
          {/* Search, Category & Filter Bar */}
          <div className="p-3 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-slate-900/60">
            <div className="flex items-center gap-2 flex-1 min-w-[260px]">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filter by name, SKU, barcode, brand..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <select
                value={selectedCategory}
                onChange={e => setSelectedCategory(e.target.value)}
                className="bg-slate-950 border border-slate-700 text-xs text-white rounded-lg px-2.5 py-1.5 focus:outline-none"
              >
                {categories.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <button
                onClick={() => setFilterLowStock(!filterLowStock)}
                className={`px-2.5 py-1.5 rounded-lg border flex items-center gap-1.5 transition ${
                  filterLowStock
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500'
                    : 'bg-slate-950 text-slate-400 border-slate-700 hover:text-white'
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Low Stock Only</span>
              </button>
            </div>
          </div>

          {/* Catalog Table */}
          <div className="flex-1 overflow-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-950 text-slate-400 sticky top-0 border-b border-slate-800 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="p-3">SKU / Barcode</th>
                  <th className="p-3">Product Name & Brand</th>
                  <th className="p-3">Category</th>
                  <th className="p-3 text-right">{activeBranch.name} Stock</th>
                  {featureFlags.multiBranch && (
                    <th className="p-3 text-right">Total (All Branches)</th>
                  )}
                  <th className="p-3 text-right">Avg Cost (WAC)</th>
                  <th className="p-3 text-right">Retail Price</th>
                  <th className="p-3 text-right">Contractor Price</th>
                  <th className="p-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-200">
                {filteredProducts.map(p => {
                  const branchStock = p.stockByBranch[activeBranch.id] || 0;
                  const totalStock = Object.values(p.stockByBranch).reduce((a, b) => a + b, 0);
                  const isLow = branchStock <= p.minStockAlert;
                  const isOut = branchStock <= 0;

                  return (
                    <tr key={p.id} className="hover:bg-slate-850/60 transition">
                      <td className="p-3 font-mono text-[11px]">
                        <div className="text-white font-semibold">{p.sku}</div>
                        <div className="text-slate-400">{p.barcode}</div>
                      </td>
                      <td className="p-3">
                        <div className="font-medium text-white">{p.name}</div>
                        <div className="text-[11px] text-slate-400">{p.brand}</div>
                      </td>
                      <td className="p-3">
                        <span className="bg-slate-800 text-slate-300 px-2 py-0.5 rounded text-[10px]">
                          {p.category}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <span
                          className={`font-bold px-2 py-0.5 rounded text-[11px] ${
                            isOut
                              ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                              : isLow
                              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                              : 'text-emerald-400'
                          }`}
                        >
                          {branchStock} {p.baseUnit}
                        </span>
                        {isLow && (
                          <div className="text-[10px] text-amber-500">Reorder at {p.minStockAlert}</div>
                        )}
                      </td>
                      {featureFlags.multiBranch && (
                        <td className="p-3 text-right text-slate-400">
                          {totalStock} {p.baseUnit}
                        </td>
                      )}
                      <td className="p-3 text-right font-mono text-slate-300">
                        {formatKsh(p.costPrice)}
                      </td>
                      <td className="p-3 text-right font-bold text-amber-400 font-mono">
                        {formatKsh(p.retailPrice)}
                      </td>
                      <td className="p-3 text-right font-medium text-cyan-300 font-mono">
                        {formatKsh(p.contractorPrice)}
                      </td>
                      <td className="p-3 text-center">
                        <button
                          onClick={() => handleOpenAdjust(p)}
                          className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[10px] border border-slate-700"
                        >
                          Adjust
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUB-TAB 2: UNITS OF MEASURE (UoM) CONVERSIONS */}
      {subTab === 'uom' && (
        <div className="flex-1 overflow-auto bg-slate-900 rounded-xl border border-slate-800 p-5 space-y-4">
          <div className="max-w-4xl space-y-2">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <ArrowRightLeft className="w-4 h-4 text-cyan-400" />
              <span>Multi-Unit Packaging & Conversion Multipliers</span>
            </h3>
            <p className="text-xs text-slate-400">
              Kenyan hardware stores sell building materials in both wholesale packages and broken retail units. 
              The system tracks physical warehouse inventory in the <b className="text-amber-400">Base Unit</b>, while automatically converting sales and receipts in any customer-facing unit.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {products.map(prod => (
              <div key={prod.id} className="bg-slate-950 p-4 rounded-lg border border-slate-800 space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-bold text-white text-xs">{prod.name}</h4>
                    <span className="text-[11px] text-slate-400">Base Unit: <b className="text-amber-400 uppercase">{prod.baseUnit}</b></span>
                  </div>
                  <span className="bg-cyan-950/60 text-cyan-300 border border-cyan-800 text-[10px] px-2 py-0.5 rounded">
                    {prod.availableUnits.length} Selling Units
                  </span>
                </div>

                <div className="space-y-1.5 border-t border-slate-850 pt-2 text-xs">
                  {prod.availableUnits.map((u, i) => (
                    <div key={i} className="flex justify-between items-center bg-slate-900/60 p-2 rounded">
                      <div>
                        <span className="font-semibold text-white capitalize">{u.unit}</span>
                        <div className="text-[10px] text-slate-400">
                          {u.unit === prod.baseUnit ? (
                            '1x Base Warehouse Unit'
                          ) : (
                            `1 ${u.unit} = ${u.conversionFactor} ${prod.baseUnit}`
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-amber-400">{formatKsh(u.sellingPrice)}</div>
                        <div className="text-[10px] text-slate-400">Selling Price</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SUB-TAB 3: PRICE TIERS (Retail, Wholesale, Contractor A/B) */}
      {subTab === 'pricing' && (
        <div className="flex-1 overflow-auto bg-slate-900 rounded-xl border border-slate-800 p-5 space-y-4">
          <div className="max-w-4xl space-y-1">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-emerald-400" />
              <span>Multi-Tier Pricing Schedules & Gross Margin %</span>
            </h3>
            <p className="text-xs text-slate-400">
              Automatic contractor discounts based on trade account agreements.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] border-b border-slate-800">
                <tr>
                  <th className="p-3">Product Name</th>
                  <th className="p-3 text-right">Cost Price (WAC)</th>
                  <th className="p-3 text-right">Retail Price</th>
                  <th className="p-3 text-right">Retail Margin %</th>
                  <th className="p-3 text-right">Wholesale Tier</th>
                  <th className="p-3 text-right">Contractor Tier</th>
                  <th className="p-3 text-right">Contractor Margin %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-200">
                {products.map(p => {
                  const retailMargin = Math.round(((p.retailPrice - p.costPrice) / p.retailPrice) * 100);
                  const contractorMargin = Math.round(((p.contractorPrice - p.costPrice) / p.contractorPrice) * 100);
                  return (
                    <tr key={p.id} className="hover:bg-slate-850 transition">
                      <td className="p-3 font-medium text-white">{p.name}</td>
                      <td className="p-3 text-right font-mono text-slate-400">{formatKsh(p.costPrice)}</td>
                      <td className="p-3 text-right font-bold text-amber-400 font-mono">{formatKsh(p.retailPrice)}</td>
                      <td className="p-3 text-right font-semibold text-emerald-400">{retailMargin}%</td>
                      <td className="p-3 text-right font-mono text-blue-300">{formatKsh(p.wholesalePrice)}</td>
                      <td className="p-3 text-right font-mono text-cyan-300">{formatKsh(p.contractorPrice)}</td>
                      <td className="p-3 text-right font-semibold text-cyan-400">{contractorMargin}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUB-TAB 4: STOCK ADJUSTMENTS AUDIT TRAIL */}
      {subTab === 'adjustments' && (
        <div className="flex-1 overflow-auto bg-slate-900 rounded-xl border border-slate-800 p-5 space-y-4">
          <div className="flex justify-between items-center border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <RotateCcw className="w-4 h-4 text-amber-400" />
              <span>Immutable Stock Adjustments & Damage Write-Off Log</span>
            </h3>
            <span className="text-xs text-slate-400">Total Records: {adjustments.length}</span>
          </div>

          <div className="space-y-2">
            {adjustments.map(adj => (
              <div key={adj.id} className="p-3 bg-slate-950 rounded-lg border border-slate-800 flex justify-between items-center text-xs">
                <div>
                  <div className="font-semibold text-white flex items-center gap-2">
                    <span>{adj.productName}</span>
                    <span className="font-mono text-slate-400">({adj.sku})</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      adj.quantityChange < 0 ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'
                    }`}>
                      {adj.quantityChange > 0 ? `+${adj.quantityChange}` : adj.quantityChange} {adj.unit}
                    </span>
                  </div>
                  <div className="text-slate-400 text-[11px] mt-0.5">
                    Reason: <b className="capitalize text-slate-300">{adj.reason.replace(/_/g, ' ')}</b> • Notes: "{adj.notes}"
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1">
                    Logged by {adj.adjustedByName} @ {formatDate(adj.timestamp)} • Location: {adj.branchName}
                  </div>
                </div>

                {adj.approved && (
                  <span className="text-[10px] bg-emerald-950/60 text-emerald-300 border border-emerald-800 px-2 py-0.5 rounded flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    <span>Approved</span>
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* STOCK ADJUSTMENT MODAL */}
      {showAdjustModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-md p-5 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2">
              <h3 className="font-bold text-white text-sm">Record Stock Adjustment</h3>
              <button onClick={() => setShowAdjustModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={submitStockAdjustment} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">Select Product:</label>
                <select
                  value={adjustProductId}
                  onChange={e => setAdjustProductId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white"
                >
                  {products.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.stockByBranch[activeBranch.id] || 0} {p.baseUnit} available)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">
                  Quantity Change (use negative for write-off/loss, positive for found):
                </label>
                <input
                  type="number"
                  step="any"
                  required
                  value={adjustQty}
                  onChange={e => setAdjustQty(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white font-bold"
                  placeholder="e.g. -5 or +10"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Adjustment Reason:</label>
                <select
                  value={adjustReason}
                  onChange={e => setAdjustReason(e.target.value as AdjustmentReason)}
                  className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white"
                >
                  <option value="damage">Damage / Breakage on Site</option>
                  <option value="breakage_in_transit">Breakage in Transit / Offloading</option>
                  <option value="theft_shrinkage">Shrinkage / Unaccounted Shortage</option>
                  <option value="count_correction">Physical Stock-Take Correction</option>
                  <option value="expired_cement_hardened">Expired / Cement Hardened by Moisture</option>
                  <option value="customer_return_restock">Customer Return Restock</option>
                </select>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Detailed Explanation & Audit Note:</label>
                <textarea
                  required
                  rows={2}
                  value={adjustNotes}
                  onChange={e => setAdjustNotes(e.target.value)}
                  placeholder="e.g. 4 bags hardened after water leak in bay 3..."
                  className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white"
                />
              </div>

              {adjustMessage && (
                <div className={`p-2.5 rounded text-xs ${
                  adjustMessage.startsWith('Error') ? 'bg-red-950/60 text-red-300' : 'bg-emerald-950/60 text-emerald-300'
                }`}>
                  {adjustMessage}
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAdjustModal(false)}
                  className="flex-1 py-2 bg-slate-800 text-slate-300 rounded font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingAdjust || adjustQty === 0}
                  className="flex-1 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded font-bold transition disabled:opacity-40"
                >
                  {isSubmittingAdjust ? 'Updating...' : 'Save Adjustment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
