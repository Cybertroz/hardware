import React, { useState } from 'react';
import {
  Truck,
  Plus,
  FileCheck,
  Building,
  CheckCircle,
  Clock,
  DollarSign,
  AlertCircle
} from 'lucide-react';
import { Supplier, PurchaseOrder, GoodsReceivedNote, Product, Branch, User } from '../types/index.ts';
import { formatKsh, formatDate } from '../utils/formatters.ts';

interface PurchasingScreenProps {
  suppliers: Supplier[];
  purchaseOrders: PurchaseOrder[];
  goodsReceivedNotes: GoodsReceivedNote[];
  products: Product[];
  activeBranch: Branch;
  currentUser: User;
  onRefreshData: () => void;
}

export const PurchasingScreen: React.FC<PurchasingScreenProps> = ({
  suppliers,
  purchaseOrders,
  goodsReceivedNotes,
  products,
  activeBranch,
  currentUser,
  onRefreshData
}) => {
  const [subTab, setSubTab] = useState<'orders' | 'grn' | 'suppliers'>('orders');

  // New PO Modal
  const [showPOModal, setShowPOModal] = useState(false);
  const [selectedSupplierId, setSelectedSupplierId] = useState(suppliers[0]?.id || '');
  const [poItems, setPoItems] = useState<{ productId: string; quantity: number; unitCost: number }[]>([
    { productId: products[0]?.id || '', quantity: 100, unitCost: products[0]?.costPrice || 500 }
  ]);
  const [poNotes, setPoNotes] = useState('');
  const [isSubmittingPO, setIsSubmittingPO] = useState(false);

  // GRN Receipt Modal
  const [showGRNModal, setShowGRNModal] = useState(false);
  const [activePOForGRN, setActivePOForGRN] = useState<PurchaseOrder | null>(null);
  const [grnDeliveryNoteNo, setGrnDeliveryNoteNo] = useState('');
  const [receiptQuantities, setReceiptQuantities] = useState<Record<string, number>>({});
  const [isSubmittingGRN, setIsSubmittingGRN] = useState(false);

  // Supplier Payment Modal
  const [showPayModal, setShowPayModal] = useState(false);
  const [paySupplier, setPaySupplier] = useState<Supplier | null>(null);
  const [payAmount, setPayAmount] = useState<number>(0);
  const [payRef, setPayRef] = useState('');

  // Handle PO Item changes
  const addPOLine = () => {
    setPoItems(prev => [
      ...prev,
      { productId: products[0]?.id || '', quantity: 50, unitCost: products[0]?.costPrice || 500 }
    ]);
  };

  const removePOLine = (idx: number) => {
    setPoItems(prev => prev.filter((_, i) => i !== idx));
  };

  const updatePOLine = (idx: number, field: string, val: any) => {
    setPoItems(prev => {
      const next = [...prev];
      const line = { ...next[idx], [field]: val };
      if (field === 'productId') {
        const prod = products.find(p => p.id === val);
        if (prod) line.unitCost = prod.costPrice;
      }
      next[idx] = line;
      return next;
    });
  };

  // Submit New Purchase Order
  const submitPurchaseOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupplierId || poItems.length === 0) return;

    setIsSubmittingPO(true);
    const totalAmount = poItems.reduce((acc, it) => acc + (it.quantity * it.unitCost), 0);

    try {
      const response = await fetch('/api/purchase-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierId: selectedSupplierId,
          branchId: activeBranch.id,
          items: poItems.map(it => {
            const p = products.find(prod => prod.id === it.productId);
            return {
              productId: it.productId,
              sku: p?.sku || 'SKU',
              productName: p?.name || 'Product',
              unit: p?.baseUnit || 'unit',
              quantityOrdered: it.quantity,
              unitCost: it.unitCost
            };
          }),
          totalAmount,
          notes: poNotes,
          requestedBy: currentUser.name
        })
      });

      if (!response.ok) throw new Error('Failed to create purchase order');
      setShowPOModal(false);
      onRefreshData();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmittingPO(false);
    }
  };

  // Open Receive Goods Modal for a PO
  const openGRNForPO = (po: PurchaseOrder) => {
    setActivePOForGRN(po);
    const initialQty: Record<string, number> = {};
    po.items.forEach(it => {
      const remaining = Math.max(0, it.quantityOrdered - it.quantityReceived);
      initialQty[it.productId] = remaining;
    });
    setReceiptQuantities(initialQty);
    setGrnDeliveryNoteNo(`DN-${Math.floor(100000 + Math.random() * 900000)}`);
    setShowGRNModal(true);
  };

  // Submit Goods Receipt Note (GRN) with WAC updates
  const submitGRNReceipt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePOForGRN) return;

    setIsSubmittingGRN(true);
    try {
      const itemsToReceive = activePOForGRN.items.map(it => ({
        productId: it.productId,
        quantityReceived: Number(receiptQuantities[it.productId]) || 0,
        unitCost: it.unitCost
      })).filter(it => it.quantityReceived > 0);

      const response = await fetch('/api/goods-receipts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          poId: activePOForGRN.id,
          branchId: activeBranch.id,
          supplierDeliveryNoteNo: grnDeliveryNoteNo,
          receivedBy: currentUser.name,
          items: itemsToReceive
        })
      });

      if (!response.ok) throw new Error('Failed to process GRN');
      setShowGRNModal(false);
      onRefreshData();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmittingGRN(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-80px)] overflow-hidden bg-slate-950 p-4 space-y-4">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900 p-3.5 rounded-xl border border-slate-800 shadow-sm">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Truck className="w-5 h-5 text-amber-500" />
            <span>Purchasing, Suppliers & Goods Received (GRN)</span>
          </h2>
          <p className="text-xs text-slate-400">
            Purchase orders, partial delivery handling, and automatic Weighted Average Cost (WAC) recalibration
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
            <button
              onClick={() => setSubTab('orders')}
              className={`px-3 py-1.5 rounded-md font-medium transition ${
                subTab === 'orders' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-300 hover:text-white'
              }`}
            >
              Purchase Orders ({purchaseOrders.length})
            </button>
            <button
              onClick={() => setSubTab('grn')}
              className={`px-3 py-1.5 rounded-md font-medium transition ${
                subTab === 'grn' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-300 hover:text-white'
              }`}
            >
              Goods Received Notes ({goodsReceivedNotes.length})
            </button>
            <button
              onClick={() => setSubTab('suppliers')}
              className={`px-3 py-1.5 rounded-md font-medium transition ${
                subTab === 'suppliers' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-300 hover:text-white'
              }`}
            >
              Supplier Directory ({suppliers.length})
            </button>
          </div>

          <button
            onClick={() => setShowPOModal(true)}
            className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs flex items-center gap-1.5 transition shadow"
          >
            <Plus className="w-4 h-4" />
            <span>New Purchase Order</span>
          </button>
        </div>
      </div>

      {/* SUB-TAB 1: PURCHASE ORDERS */}
      {subTab === 'orders' && (
        <div className="flex-1 overflow-auto bg-slate-900 rounded-xl border border-slate-800 p-4 space-y-3">
          <div className="space-y-3">
            {purchaseOrders.map(po => {
              const allReceived = po.items.every(it => it.quantityReceived >= it.quantityOrdered);
              const isPartial = po.items.some(it => it.quantityReceived > 0) && !allReceived;

              return (
                <div key={po.id} className="bg-slate-950 border border-slate-800 rounded-lg p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-850 pb-2.5">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-white">{po.poNumber}</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          po.status === 'received'
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : po.status === 'partially_received'
                            ? 'bg-cyan-500/20 text-cyan-400'
                            : 'bg-amber-500/20 text-amber-400'
                        }`}>
                          {po.status.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        Supplier: <b className="text-slate-200">{po.supplierName}</b> • Branch: {po.branchName}
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className="text-xs font-bold text-amber-400">{formatKsh(po.totalAmount)}</div>
                        <div className="text-[10px] text-slate-500">Ordered: {formatDate(po.orderDate)}</div>
                      </div>

                      {po.status !== 'received' && (
                        <button
                          onClick={() => openGRNForPO(po)}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-semibold flex items-center gap-1.5 transition"
                        >
                          <FileCheck className="w-3.5 h-3.5" />
                          <span>Receive Goods (GRN)</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Line Items Progress */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="text-[10px] text-slate-400 uppercase border-b border-slate-850">
                        <tr>
                          <th className="py-1.5">Item</th>
                          <th className="py-1.5 text-right">Unit Cost</th>
                          <th className="py-1.5 text-right">Ordered</th>
                          <th className="py-1.5 text-right">Received</th>
                          <th className="py-1.5 text-right">Remaining</th>
                          <th className="py-1.5 text-right">Total (Ksh)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-850 text-slate-300">
                        {po.items.map((it, idx) => {
                          const remaining = it.quantityOrdered - it.quantityReceived;
                          return (
                            <tr key={idx}>
                              <td className="py-1.5 font-medium text-white">{it.productName}</td>
                              <td className="py-1.5 text-right font-mono">{formatKsh(it.unitCost)}</td>
                              <td className="py-1.5 text-right">{it.quantityOrdered} {it.unit}</td>
                              <td className="py-1.5 text-right text-emerald-400 font-bold">{it.quantityReceived} {it.unit}</td>
                              <td className="py-1.5 text-right text-amber-400">{remaining} {it.unit}</td>
                              <td className="py-1.5 text-right font-bold text-slate-200">{formatKsh(it.lineTotal)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SUB-TAB 2: GOODS RECEIVED NOTES (GRN) */}
      {subTab === 'grn' && (
        <div className="flex-1 overflow-auto bg-slate-900 rounded-xl border border-slate-800 p-4 space-y-3">
          <div className="space-y-3">
            {goodsReceivedNotes.map(grn => (
              <div key={grn.id} className="bg-slate-950 border border-slate-800 rounded-lg p-4 space-y-2 text-xs">
                <div className="flex justify-between items-center border-b border-slate-850 pb-2">
                  <div>
                    <span className="font-bold text-sm text-emerald-400">{grn.grnNumber}</span>
                    <span className="text-slate-400 ml-2">(Ref PO: {grn.poNumber} • Delivery Note: {grn.supplierDeliveryNoteNo})</span>
                    <div className="text-[11px] text-slate-400">Supplier: <b className="text-white">{grn.supplierName}</b> • Received by: {grn.receivedBy}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-amber-400">{formatKsh(grn.totalReceivedValue)}</div>
                    <div className="text-[10px] text-slate-500">{formatDate(grn.receivedDate)}</div>
                  </div>
                </div>

                <div className="space-y-1 pt-1">
                  {grn.items.map((it, idx) => (
                    <div key={idx} className="flex justify-between text-slate-300">
                      <span>{it.productName}</span>
                      <span className="font-bold text-white">{it.quantityReceived} {it.unit} @ {formatKsh(it.unitCost)} = {formatKsh(it.totalCost)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SUB-TAB 3: SUPPLIER DIRECTORY */}
      {subTab === 'suppliers' && (
        <div className="flex-1 overflow-auto bg-slate-900 rounded-xl border border-slate-800 p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {suppliers.map(s => (
              <div key={s.id} className="bg-slate-950 p-4 rounded-lg border border-slate-800 space-y-2.5 text-xs">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-bold text-sm text-white">{s.name}</h4>
                    <span className="text-slate-400 text-[11px]">KRA PIN: <b className="text-amber-400 font-mono">{s.kraPin}</b></span>
                  </div>
                  <span className="bg-slate-800 text-slate-300 px-2 py-0.5 rounded text-[10px] font-mono">
                    {s.code}
                  </span>
                </div>

                <div className="space-y-1 text-slate-300 text-[11px]">
                  <div>Contact: <b>{s.contactPerson}</b> ({s.phone})</div>
                  <div>Email: {s.email}</div>
                  <div>Payment Terms: <span className="text-cyan-300 font-semibold">{s.paymentTerms}</span></div>
                </div>

                <div className="pt-2 border-t border-slate-850 flex justify-between items-center">
                  <div>
                    <span className="text-slate-400">Accounts Payable Owed: </span>
                    <span className="font-bold text-red-400 font-mono text-sm">{formatKsh(s.currentPayable)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CREATE PURCHASE ORDER MODAL */}
      {showPOModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-5 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2">
              <h3 className="font-bold text-white text-sm">Create Supplier Purchase Order (PO)</h3>
              <button onClick={() => setShowPOModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={submitPurchaseOrder} className="space-y-4 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">Select Supplier:</label>
                <select
                  value={selectedSupplierId}
                  onChange={e => setSelectedSupplierId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white"
                >
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} (PIN: {s.kraPin} • Terms: {s.paymentTerms})
                    </option>
                  ))}
                </select>
              </div>

              {/* Items Table */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-slate-300">Order Line Items:</span>
                  <button
                    type="button"
                    onClick={addPOLine}
                    className="text-xs bg-slate-800 text-amber-400 px-2.5 py-1 rounded border border-slate-700"
                  >
                    + Add Item
                  </button>
                </div>

                <div className="space-y-2">
                  {poItems.map((line, idx) => (
                    <div key={idx} className="flex items-center gap-2 bg-slate-950 p-2 rounded border border-slate-800">
                      <select
                        value={line.productId}
                        onChange={e => updatePOLine(idx, 'productId', e.target.value)}
                        className="flex-1 bg-slate-900 border border-slate-700 rounded p-1.5 text-white text-xs"
                      >
                        {products.map(p => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>

                      <input
                        type="number"
                        min="1"
                        placeholder="Qty"
                        value={line.quantity}
                        onChange={e => updatePOLine(idx, 'quantity', parseFloat(e.target.value) || 1)}
                        className="w-20 bg-slate-900 border border-slate-700 rounded p-1.5 text-white text-right"
                      />

                      <input
                        type="number"
                        min="1"
                        placeholder="Cost"
                        value={line.unitCost}
                        onChange={e => updatePOLine(idx, 'unitCost', parseFloat(e.target.value) || 0)}
                        className="w-24 bg-slate-900 border border-slate-700 rounded p-1.5 text-amber-300 text-right font-mono"
                      />

                      <button
                        type="button"
                        onClick={() => removePOLine(idx)}
                        className="text-slate-500 hover:text-red-400 p-1"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Notes / Instructions:</label>
                <input
                  type="text"
                  value={poNotes}
                  onChange={e => setPoNotes(e.target.value)}
                  placeholder="e.g. Deliver to Industrial Area depot. Offload bay 2."
                  className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPOModal(false)}
                  className="flex-1 py-2 bg-slate-800 text-slate-300 rounded font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingPO}
                  className="flex-1 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded transition disabled:opacity-40"
                >
                  {isSubmittingPO ? 'Creating...' : 'Submit Purchase Order'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* GOODS RECEIVED NOTE (GRN) MODAL */}
      {showGRNModal && activePOForGRN && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-xl p-5 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2">
              <h3 className="font-bold text-white text-sm">
                Receive Goods (GRN) for {activePOForGRN.poNumber}
              </h3>
              <button onClick={() => setShowGRNModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={submitGRNReceipt} className="space-y-4 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">Supplier Delivery Note Number (DN):</label>
                <input
                  type="text"
                  required
                  value={grnDeliveryNoteNo}
                  onChange={e => setGrnDeliveryNoteNo(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white font-mono"
                />
              </div>

              <div className="space-y-2">
                <label className="text-slate-400 block">Verify Quantities Actually Offloaded at {activeBranch.name}:</label>
                {activePOForGRN.items.map(it => (
                  <div key={it.productId} className="flex justify-between items-center bg-slate-950 p-2.5 rounded border border-slate-800">
                    <div>
                      <div className="font-semibold text-white">{it.productName}</div>
                      <div className="text-[10px] text-slate-400">
                        Ordered: {it.quantityOrdered} {it.unit} • Already Received: {it.quantityReceived} {it.unit}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400 text-xs">Offloaded:</span>
                      <input
                        type="number"
                        min="0"
                        max={it.quantityOrdered - it.quantityReceived}
                        value={receiptQuantities[it.productId] || 0}
                        onChange={e => setReceiptQuantities({
                          ...receiptQuantities,
                          [it.productId]: parseFloat(e.target.value) || 0
                        })}
                        className="w-20 bg-slate-900 border border-slate-700 rounded p-1 text-emerald-400 font-bold text-right"
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="bg-amber-950/30 border border-amber-900/60 p-2.5 rounded text-[11px] text-amber-300">
                ⚡ <b>Automatic Cost Recalibration:</b> This receipt will automatically update the product's Weighted Average Cost (WAC) based on the supplier unit cost and update your Accounts Payable ledger.
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowGRNModal(false)}
                  className="flex-1 py-2 bg-slate-800 text-slate-300 rounded font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingGRN}
                  className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded transition disabled:opacity-40"
                >
                  {isSubmittingGRN ? 'Processing...' : 'Confirm Goods Receipt & Update WAC'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
