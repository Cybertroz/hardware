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
    <div className="flex-1 flex flex-col min-h-[calc(100vh-80px)] lg:h-[calc(100vh-80px)] overflow-y-auto lg:overflow-hidden bg-slate-50 p-3 sm:p-4 space-y-4 text-slate-900">
      {/* Top Header & Navigation Sub-Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-sky-100 shadow-xs">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Boxes className="w-5 h-5 text-sky-600" />
            <span>Inventory & Units of Measure (UoM)</span>
          </h2>
          <p className="text-xs text-slate-500 font-medium">
            Multi-branch stock levels, conversions (e.g. cement bag/tonne, pipe pc/m), and price tiers
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Sub Tab buttons */}
          <div className="flex bg-sky-50 p-1 rounded-xl border border-sky-200 text-xs">
            <button
              onClick={() => setSubTab('catalog')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer ${
                subTab === 'catalog' ? 'bg-sky-600 text-white shadow-2xs' : 'text-slate-600 hover:text-sky-900'
              }`}
            >
              Product Catalog
            </button>
            <button
              onClick={() => setSubTab('uom')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer ${
                subTab === 'uom' ? 'bg-sky-600 text-white shadow-2xs' : 'text-slate-600 hover:text-sky-900'
              }`}
            >
              UoM Conversions
            </button>
            <button
              onClick={() => setSubTab('pricing')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer ${
                subTab === 'pricing' ? 'bg-sky-600 text-white shadow-2xs' : 'text-slate-600 hover:text-sky-900'
              }`}
            >
              Price Tiers
            </button>
            <button
              onClick={() => setSubTab('adjustments')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer ${
                subTab === 'adjustments' ? 'bg-sky-600 text-white shadow-2xs' : 'text-slate-600 hover:text-sky-900'
              }`}
            >
              Audit Trail ({adjustments.length})
            </button>
          </div>

          <button
            onClick={() => {
              setAdjustProductId(products[0]?.id || '');
              setAdjustQty(50);
              setAdjustReason('count_correction');
              setAdjustNotes('New stock received into warehouse');
              setAdjustMessage(null);
              setShowAdjustModal(true);
            }}
            className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition shadow-2xs cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Receive New Stock</span>
          </button>

          <button
            onClick={() => handleOpenAdjust()}
            className="px-3.5 py-1.5 bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-200 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5 text-sky-600" />
            <span>Stock Adjustment</span>
          </button>
        </div>
      </div>

      {/* SUB-TAB 1: PRODUCT CATALOG */}
      {subTab === 'catalog' && (
        <div className="flex-1 flex flex-col bg-white rounded-2xl border border-sky-100 overflow-hidden shadow-xs">
          {/* Search, Category & Filter Bar */}
          <div className="p-3 border-b border-sky-100 flex flex-wrap items-center justify-between gap-3 bg-sky-50/50">
            <div className="flex items-center gap-2 flex-1 min-w-[260px]">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filter by name, SKU, barcode, brand..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full bg-white border border-slate-200 focus:border-sky-500 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-900 focus:outline-none font-medium"
                />
              </div>

              <select
                value={selectedCategory}
                onChange={e => setSelectedCategory(e.target.value)}
                className="bg-white border border-slate-200 text-xs text-slate-800 rounded-lg px-2.5 py-1.5 focus:outline-none font-medium cursor-pointer"
              >
                {categories.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <button
                onClick={() => setFilterLowStock(!filterLowStock)}
                className={`px-3 py-1.5 rounded-lg border flex items-center gap-1.5 transition font-semibold cursor-pointer ${
                  filterLowStock
                    ? 'bg-amber-100 text-amber-900 border-amber-300'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-sky-50 hover:text-slate-900'
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                <span>Low Stock Only</span>
              </button>
            </div>
          </div>

          {/* Catalog Table */}
          <div className="flex-1 overflow-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-sky-50/80 text-slate-700 sticky top-0 border-b border-sky-200 uppercase tracking-wider text-[10px] font-bold">
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
              <tbody className="divide-y divide-sky-100 text-slate-800">
                {filteredProducts.map(p => {
                  const branchStock = p.stockByBranch[activeBranch.id] || 0;
                  const totalStock = Object.values(p.stockByBranch).reduce((a, b) => a + b, 0);
                  const isLow = branchStock <= p.minStockAlert;
                  const isOut = branchStock <= 0;

                  return (
                    <tr key={p.id} className="hover:bg-sky-50/50 transition">
                      <td className="p-3 font-mono text-[11px]">
                        <div className="text-slate-900 font-bold">{p.sku}</div>
                        <div className="text-slate-400">{p.barcode}</div>
                      </td>
                      <td className="p-3">
                        <div className="font-semibold text-slate-900">{p.name}</div>
                        <div className="text-[11px] text-slate-500">{p.brand}</div>
                      </td>
                      <td className="p-3">
                        <span className="bg-sky-50 text-sky-800 px-2 py-0.5 rounded text-[10px] font-semibold border border-sky-200">
                          {p.category}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <span
                          className={`font-bold px-2 py-0.5 rounded text-[11px] ${
                            isOut
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : isLow
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          }`}
                        >
                          {branchStock} {p.baseUnit}
                        </span>
                        {isLow && (
                          <div className="text-[10px] text-amber-700 font-semibold mt-0.5">Reorder at {p.minStockAlert}</div>
                        )}
                      </td>
                      {featureFlags.multiBranch && (
                        <td className="p-3 text-right text-slate-600 font-medium">
                          {totalStock} {p.baseUnit}
                        </td>
                      )}
                      <td className="p-3 text-right font-mono text-slate-600 font-medium">
                        {formatKsh(p.costPrice)}
                      </td>
                      <td className="p-3 text-right font-black text-sky-700 font-mono">
                        {formatKsh(p.retailPrice)}
                      </td>
                      <td className="p-3 text-right font-bold text-emerald-700 font-mono">
                        {formatKsh(p.contractorPrice)}
                      </td>
                      <td className="p-3 text-center">
                        <button
                          onClick={() => handleOpenAdjust(p)}
                          className="px-2.5 py-1 bg-sky-50 hover:bg-sky-100 text-sky-800 font-semibold rounded-md text-[10px] border border-sky-200 cursor-pointer"
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
        <div className="flex-1 overflow-auto bg-white rounded-2xl border border-sky-100 p-5 space-y-4 shadow-xs">
          <div className="max-w-4xl space-y-1">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <ArrowRightLeft className="w-4 h-4 text-sky-600" />
              <span>Multi-Unit Packaging & Conversion Multipliers</span>
            </h3>
            <p className="text-xs text-slate-500 font-medium">
              Kenyan hardware stores sell building materials in both wholesale packages and broken retail units. 
              The system tracks physical warehouse inventory in the <b className="text-sky-800">Base Unit</b>, while automatically converting sales and receipts in any customer-facing unit.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {products.map(prod => (
              <div key={prod.id} className="bg-sky-50/40 p-4 rounded-xl border border-sky-100 space-y-3 shadow-2xs">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-bold text-slate-900 text-xs">{prod.name}</h4>
                    <span className="text-[11px] text-slate-500">Base Unit: <b className="text-sky-800 uppercase">{prod.baseUnit}</b></span>
                  </div>
                  <span className="bg-sky-100 text-sky-800 border border-sky-200 text-[10px] px-2 py-0.5 rounded font-bold">
                    {prod.availableUnits.length} Selling Units
                  </span>
                </div>

                <div className="space-y-1.5 border-t border-sky-100 pt-2 text-xs">
                  {prod.availableUnits.map((u, i) => (
                    <div key={i} className="flex justify-between items-center bg-white p-2.5 rounded-lg border border-sky-100">
                      <div>
                        <span className="font-bold text-slate-900 capitalize">{u.unit}</span>
                        <div className="text-[10px] text-slate-500 font-medium">
                          {u.unit === prod.baseUnit ? (
                            '1x Base Warehouse Unit'
                          ) : (
                            `1 ${u.unit} = ${u.conversionFactor} ${prod.baseUnit}`
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-black text-sky-700 font-mono">{formatKsh(u.sellingPrice)}</div>
                        <div className="text-[10px] text-slate-400 font-medium">Selling Price</div>
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
        <div className="flex-1 overflow-auto bg-white rounded-2xl border border-sky-100 p-5 space-y-4 shadow-xs">
          <div className="max-w-4xl space-y-1">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-emerald-600" />
              <span>Multi-Tier Pricing Schedules & Gross Margin %</span>
            </h3>
            <p className="text-xs text-slate-500 font-medium">
              Automatic contractor discounts based on trade account agreements.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-sky-50/80 text-slate-700 uppercase text-[10px] border-b border-sky-200 font-bold">
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
              <tbody className="divide-y divide-sky-100 text-slate-800">
                {products.map(p => {
                  const retailMargin = Math.round(((p.retailPrice - p.costPrice) / p.retailPrice) * 100);
                  const contractorMargin = Math.round(((p.contractorPrice - p.costPrice) / p.contractorPrice) * 100);
                  return (
                    <tr key={p.id} className="hover:bg-sky-50/50 transition">
                      <td className="p-3 font-semibold text-slate-900">{p.name}</td>
                      <td className="p-3 text-right font-mono text-slate-500 font-medium">{formatKsh(p.costPrice)}</td>
                      <td className="p-3 text-right font-black text-sky-700 font-mono">{formatKsh(p.retailPrice)}</td>
                      <td className="p-3 text-right font-bold text-emerald-700">{retailMargin}%</td>
                      <td className="p-3 text-right font-mono text-sky-800 font-bold">{formatKsh(p.wholesalePrice)}</td>
                      <td className="p-3 text-right font-mono text-emerald-700 font-bold">{formatKsh(p.contractorPrice)}</td>
                      <td className="p-3 text-right font-bold text-emerald-600">{contractorMargin}%</td>
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
        <div className="flex-1 overflow-auto bg-white rounded-2xl border border-sky-100 p-5 space-y-4 shadow-xs">
          <div className="flex justify-between items-center border-b border-sky-100 pb-3">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <RotateCcw className="w-4 h-4 text-sky-600" />
              <span>Immutable Stock Adjustments & Damage Write-Off Log</span>
            </h3>
            <span className="text-xs text-slate-500 font-medium">Total Records: {adjustments.length}</span>
          </div>

          <div className="space-y-2">
            {adjustments.map(adj => (
              <div key={adj.id} className="p-3.5 bg-sky-50/50 rounded-xl border border-sky-100 flex justify-between items-center text-xs">
                <div>
                  <div className="font-bold text-slate-900 flex items-center gap-2">
                    <span>{adj.productName}</span>
                    <span className="font-mono text-slate-500">({adj.sku})</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${
                      adj.quantityChange < 0 ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'
                    }`}>
                      {adj.quantityChange > 0 ? `+${adj.quantityChange}` : adj.quantityChange} {adj.unit}
                    </span>
                  </div>
                  <div className="text-slate-600 text-[11px] mt-0.5">
                    Reason: <b className="capitalize text-slate-800">{adj.reason.replace(/_/g, ' ')}</b> • Notes: "{adj.notes}"
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1">
                    Logged by {adj.adjustedByName} @ {formatDate(adj.timestamp)} • Location: {adj.branchName}
                  </div>
                </div>

                {adj.approved && (
                  <span className="text-[10px] bg-emerald-50 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded-md font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
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
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-sky-200 rounded-2xl w-full max-w-md p-5 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-sky-100 pb-2">
              <h3 className="font-bold text-slate-900 text-sm">Record Stock Adjustment</h3>
              <button onClick={() => setShowAdjustModal(false)} className="text-slate-400 hover:text-slate-700 cursor-pointer font-bold">✕</button>
            </div>

            <form onSubmit={submitStockAdjustment} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-700 font-semibold block mb-1">Select Product:</label>
                <select
                  value={adjustProductId}
                  onChange={e => setAdjustProductId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 focus:bg-white focus:border-sky-500 rounded-lg p-2 text-slate-900 font-medium"
                >
                  {products.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.stockByBranch[activeBranch.id] || 0} {p.baseUnit} available)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-slate-700 font-semibold block mb-1">
                  Quantity Change (use negative for write-off/loss, positive for found):
                </label>
                <input
                  type="number"
                  step="any"
                  required
                  value={adjustQty}
                  onChange={e => setAdjustQty(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-50 border border-slate-300 focus:bg-white focus:border-sky-500 rounded-lg p-2 text-slate-900 font-extrabold"
                  placeholder="e.g. -5 or +10"
                />
              </div>

              <div>
                <label className="text-slate-700 font-semibold block mb-1">Adjustment Reason:</label>
                <select
                  value={adjustReason}
                  onChange={e => setAdjustReason(e.target.value as AdjustmentReason)}
                  className="w-full bg-slate-50 border border-slate-300 focus:bg-white focus:border-sky-500 rounded-lg p-2 text-slate-900 font-medium"
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
                <label className="text-slate-700 font-semibold block mb-1">Detailed Explanation & Audit Note:</label>
                <textarea
                  required
                  rows={2}
                  value={adjustNotes}
                  onChange={e => setAdjustNotes(e.target.value)}
                  placeholder="e.g. 4 bags hardened after water leak in bay 3..."
                  className="w-full bg-slate-50 border border-slate-300 focus:bg-white focus:border-sky-500 rounded-lg p-2 text-slate-900 font-medium"
                />
              </div>

              {adjustMessage && (
                <div className={`p-2.5 rounded-lg text-xs font-semibold ${
                  adjustMessage.startsWith('Error') ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                }`}>
                  {adjustMessage}
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAdjustModal(false)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold cursor-pointer transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingAdjust || adjustQty === 0}
                  className="flex-1 py-2.5 bg-sky-600 hover:bg-sky-500 text-white rounded-xl font-bold transition shadow-md shadow-sky-600/20 disabled:opacity-40 cursor-pointer"
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
