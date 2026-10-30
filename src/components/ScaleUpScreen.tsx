import React, { useState } from 'react';
import {
  Sliders,
  ArrowRightLeft,
  ShieldCheck,
  CheckCircle,
  XCircle,
  Truck,
  Code2,
  Lock,
  Plus,
  Building2,
  FileCheck2,
  Send
} from 'lucide-react';
import {
  FeatureFlags,
  Branch,
  StockTransfer,
  ApprovalRequest,
  Delivery,
  Product,
  User,
  Role
} from '../types/index.ts';
import { formatKsh, formatDate } from '../utils/formatters.ts';

interface ScaleUpScreenProps {
  featureFlags: FeatureFlags;
  onUpdateFeatureFlags: (flags: Partial<FeatureFlags>) => void;
  branches: Branch[];
  transfers: StockTransfer[];
  approvals: ApprovalRequest[];
  deliveries: Delivery[];
  products: Product[];
  currentUser: User;
  onRefreshData: () => void;
}

export const ScaleUpScreen: React.FC<ScaleUpScreenProps> = ({
  featureFlags,
  onUpdateFeatureFlags,
  branches,
  transfers,
  approvals,
  deliveries,
  products,
  currentUser,
  onRefreshData
}) => {
  const [subTab, setSubTab] = useState<'flags' | 'transfers' | 'approvals' | 'deliveries' | 'api'>('flags');

  // Stock Transfer Modal
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [sourceBranchId, setSourceBranchId] = useState(branches[0]?.id || '');
  const [destBranchId, setDestBranchId] = useState(branches[1]?.id || branches[0]?.id || '');
  const [transferProductId, setTransferProductId] = useState(products[0]?.id || '');
  const [transferQuantity, setTransferQuantity] = useState<number>(50);
  const [transferNotes, setTransferNotes] = useState('');
  const [isSubmittingTransfer, setIsSubmittingTransfer] = useState(false);

  // Delivery POD Modal
  const [showPODModal, setShowPODModal] = useState(false);
  const [activeDeliveryForPOD, setActiveDeliveryForPOD] = useState<Delivery | null>(null);
  const [podRecipient, setPodRecipient] = useState('');
  const [isSubmittingPOD, setIsSubmittingPOD] = useState(false);

  // Approval Resolution
  const handleResolveApproval = async (approvalId: string, status: 'approved' | 'rejected', reason?: string) => {
    try {
      const response = await fetch(`/api/approvals/${approvalId}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status,
          resolvedBy: currentUser.name,
          rejectionReason: reason
        })
      });
      if (response.ok) {
        onRefreshData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Submit Stock Transfer
  const submitTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sourceBranchId === destBranchId) {
      alert('Source and destination branches cannot be the same.');
      return;
    }

    setIsSubmittingTransfer(true);
    const prod = products.find(p => p.id === transferProductId);

    try {
      const response = await fetch('/api/inventory/transfers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceBranchId,
          destinationBranchId: destBranchId,
          dispatchedBy: currentUser.name,
          notes: transferNotes,
          items: [{
            productId: transferProductId,
            sku: prod?.sku || 'SKU',
            productName: prod?.name || 'Product',
            unit: prod?.baseUnit || 'unit',
            quantity: transferQuantity
          }]
        })
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to dispatch transfer');
      }

      setShowTransferModal(false);
      onRefreshData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSubmittingTransfer(false);
    }
  };

  // Receive Transfer
  const receiveTransfer = async (transferId: string) => {
    try {
      const response = await fetch(`/api/inventory/transfers/${transferId}/receive`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ receivedBy: currentUser.name })
      });
      if (response.ok) {
        onRefreshData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Confirm Delivery POD
  const confirmDeliveryPOD = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeDeliveryForPOD || !podRecipient) return;

    setIsSubmittingPOD(true);
    try {
      const response = await fetch(`/api/deliveries/${activeDeliveryForPOD.id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'delivered',
          recipientName: podRecipient,
          signatureStamp: `VERIFIED_POD_${Date.now()}_GPS`
        })
      });
      if (response.ok) {
        setShowPODModal(false);
        onRefreshData();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmittingPOD(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-[calc(100vh-80px)] lg:h-[calc(100vh-80px)] overflow-y-auto lg:overflow-hidden bg-slate-50 p-3 sm:p-4 space-y-4 text-slate-900">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-sky-100 shadow-xs">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Sliders className="w-5 h-5 text-sky-600" />
            <span>Scale-Up Features & Enterprise Modules (Behind Flags)</span>
          </h2>
          <p className="text-xs text-slate-500">
            A small shop uses a single branch with advanced modules switched off; a large business enables multiple branches, deliveries, and approvals.
          </p>
        </div>

        {/* Sub-tabs */}
        <div className="flex bg-sky-50/70 p-1 rounded-xl border border-sky-100 text-xs overflow-x-auto">
          <button
            onClick={() => setSubTab('flags')}
            className={`px-3 py-1.5 rounded-lg font-medium transition ${
              subTab === 'flags' ? 'bg-sky-600 text-white font-bold shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Feature Flags
          </button>
          <button
            onClick={() => setSubTab('transfers')}
            className={`px-3 py-1.5 rounded-lg font-medium transition ${
              subTab === 'transfers' ? 'bg-sky-600 text-white font-bold shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Inter-Branch Transfers ({transfers.length})
          </button>
          <button
            onClick={() => setSubTab('approvals')}
            className={`px-3 py-1.5 rounded-lg font-medium transition relative ${
              subTab === 'approvals' ? 'bg-sky-600 text-white font-bold shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Approvals Queue ({approvals.filter(a => a.status === 'pending').length})
          </button>
          <button
            onClick={() => setSubTab('deliveries')}
            className={`px-3 py-1.5 rounded-lg font-medium transition ${
              subTab === 'deliveries' ? 'bg-sky-600 text-white font-bold shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Fleet & Deliveries ({deliveries.length})
          </button>
          <button
            onClick={() => setSubTab('api')}
            className={`px-3 py-1.5 rounded-lg font-medium transition ${
              subTab === 'api' ? 'bg-sky-600 text-white font-bold shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            REST API & Webhooks
          </button>
        </div>
      </div>

      {/* SUB-TAB 1: FEATURE FLAGS TOGGLES */}
      {subTab === 'flags' && (
        <div className="flex-1 overflow-auto bg-white rounded-xl border border-sky-100 p-5 space-y-4 shadow-xs">
          <div className="max-w-3xl space-y-1">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Sliders className="w-4 h-4 text-sky-600" />
              <span>Unified Architecture Feature Flags</span>
            </h3>
            <p className="text-xs text-slate-500">
              Switch entire enterprise modules on or off without changing codebase.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl">
            {/* Multi-Branch Mode */}
            <div className="p-4 bg-sky-50/40 rounded-xl border border-sky-100 flex items-start justify-between gap-4 hover:border-sky-300 transition">
              <div>
                <h4 className="font-bold text-slate-900 text-xs">Multi-Branch & Warehouses</h4>
                <p className="text-[11px] text-slate-500 mt-1">
                  Enables multiple depots, showrooms, and inter-branch inventory transfers. When disabled, operates in clean single-shop mode.
                </p>
              </div>
              <input
                type="checkbox"
                checked={featureFlags.multiBranch}
                onChange={e => onUpdateFeatureFlags({ multiBranch: e.target.checked })}
                className="w-5 h-5 rounded border-sky-300 text-sky-600 focus:ring-sky-500 cursor-pointer accent-sky-600"
              />
            </div>

            {/* Contractor Credit Module */}
            <div className="p-4 bg-sky-50/40 rounded-xl border border-sky-100 flex items-start justify-between gap-4 hover:border-sky-300 transition">
              <div>
                <h4 className="font-bold text-slate-900 text-xs">Contractor Credit Accounts</h4>
                <p className="text-[11px] text-slate-500 mt-1">
                  Enables 30/60 day credit terms, debtor ageing analysis, and credit limit checks at checkout.
                </p>
              </div>
              <input
                type="checkbox"
                checked={featureFlags.contractorCredit}
                onChange={e => onUpdateFeatureFlags({ contractorCredit: e.target.checked })}
                className="w-5 h-5 rounded border-sky-300 text-sky-600 focus:ring-sky-500 cursor-pointer accent-sky-600"
              />
            </div>

            {/* Approval Workflows */}
            <div className="p-4 bg-sky-50/40 rounded-xl border border-sky-100 flex items-start justify-between gap-4 hover:border-sky-300 transition">
              <div>
                <h4 className="font-bold text-slate-900 text-xs">Tiered Approval Workflows</h4>
                <p className="text-[11px] text-slate-500 mt-1">
                  Requires Owner/Manager authorization for discounts &gt; 10%, high POs (&gt; Ksh 500k), and stock write-offs.
                </p>
              </div>
              <input
                type="checkbox"
                checked={featureFlags.approvalWorkflows}
                onChange={e => onUpdateFeatureFlags({ approvalWorkflows: e.target.checked })}
                className="w-5 h-5 rounded border-sky-300 text-sky-600 focus:ring-sky-500 cursor-pointer accent-sky-600"
              />
            </div>

            {/* Delivery Management */}
            <div className="p-4 bg-sky-50/40 rounded-xl border border-sky-100 flex items-start justify-between gap-4 hover:border-sky-300 transition">
              <div>
                <h4 className="font-bold text-slate-900 text-xs">Delivery & Fleet Logistics</h4>
                <p className="text-[11px] text-slate-500 mt-1">
                  Enables dispatch scheduling, lorry/canter vehicle allocation, delivery notes, and digital Proof of Delivery (POD).
                </p>
              </div>
              <input
                type="checkbox"
                checked={featureFlags.deliveryManagement}
                onChange={e => onUpdateFeatureFlags({ deliveryManagement: e.target.checked })}
                className="w-5 h-5 rounded border-sky-300 text-sky-600 focus:ring-sky-500 cursor-pointer accent-sky-600"
              />
            </div>

            {/* Project Accounts */}
            <div className="p-4 bg-sky-50/40 rounded-xl border border-sky-100 flex items-start justify-between gap-4 hover:border-sky-300 transition">
              <div>
                <h4 className="font-bold text-slate-900 text-xs">Contractor Project Accounts</h4>
                <p className="text-[11px] text-slate-500 mt-1">
                  Enables project-level sub-allocations, staged deliveries, and site-level statements for developers.
                </p>
              </div>
              <input
                type="checkbox"
                checked={featureFlags.projectAccounts}
                onChange={e => onUpdateFeatureFlags({ projectAccounts: e.target.checked })}
                className="w-5 h-5 rounded border-sky-300 text-sky-600 focus:ring-sky-500 cursor-pointer accent-sky-600"
              />
            </div>

            {/* Strict Non-Negative Stock */}
            <div className="p-4 bg-sky-50/40 rounded-xl border border-sky-100 flex items-start justify-between gap-4 hover:border-sky-300 transition">
              <div>
                <h4 className="font-bold text-slate-900 text-xs">Allow Negative Stock</h4>
                <p className="text-[11px] text-slate-500 mt-1">
                  Default OFF. Prevents sales when physical stock is zero, ensuring strict warehouse inventory integrity.
                </p>
              </div>
              <input
                type="checkbox"
                checked={featureFlags.allowNegativeStock}
                onChange={e => onUpdateFeatureFlags({ allowNegativeStock: e.target.checked })}
                className="w-5 h-5 rounded border-sky-300 text-sky-600 focus:ring-sky-500 cursor-pointer accent-sky-600"
              />
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 2: INTER-BRANCH STOCK TRANSFERS */}
      {subTab === 'transfers' && (
        <div className="flex-1 overflow-auto bg-white rounded-xl border border-sky-100 p-4 space-y-3 shadow-xs">
          <div className="flex justify-between items-center border-b border-sky-100 pb-2">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <ArrowRightLeft className="w-4 h-4 text-sky-600" />
                <span>Inter-Branch Stock Movement</span>
              </h3>
              <p className="text-xs text-slate-500">Dispatch and receive stock between Nairobi Main Depot, Mombasa Rd, and Kisumu</p>
            </div>
            <button
              onClick={() => setShowTransferModal(true)}
              className="px-3.5 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Stock Transfer</span>
            </button>
          </div>

          <div className="space-y-3">
            {transfers.map(trf => (
              <div key={trf.id} className="bg-sky-50/40 p-4 rounded-xl border border-sky-100 space-y-2 text-xs">
                <div className="flex justify-between items-center border-b border-sky-100 pb-2">
                  <div>
                    <span className="font-bold text-sm text-slate-900">{trf.transferNumber}</span>
                    <span className="text-slate-500 ml-2">
                      From <b className="text-slate-800">{trf.sourceBranchName}</b> ➔ To <b className="text-slate-800">{trf.destinationBranchName}</b>
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      trf.status === 'received' ? 'bg-emerald-100 text-emerald-800' : 'bg-sky-100 text-sky-800'
                    }`}>
                      {trf.status}
                    </span>
                    {trf.status === 'dispatched' && (
                      <button
                        onClick={() => receiveTransfer(trf.id)}
                        className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[11px] font-semibold transition"
                      >
                        Receive & Confirm Stock
                      </button>
                    )}
                  </div>
                </div>

                <div className="space-y-1">
                  {trf.items.map((it, idx) => (
                    <div key={idx} className="flex justify-between text-slate-700">
                      <span>{it.productName} ({it.sku})</span>
                      <span className="font-bold text-slate-900">{it.quantity} {it.unit}</span>
                    </div>
                  ))}
                </div>

                {trf.notes && (
                  <div className="text-[11px] text-slate-500 italic">"{trf.notes}"</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SUB-TAB 3: APPROVALS QUEUE */}
      {subTab === 'approvals' && (
        <div className="flex-1 overflow-auto bg-white rounded-xl border border-sky-100 p-4 space-y-3 shadow-xs">
          <div className="border-b border-sky-100 pb-2">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-sky-600" />
              <span>Owner & Management Approval Queue</span>
            </h3>
            <p className="text-xs text-slate-500">Authorization gates for discounts &gt; 10%, large POs, and damage write-offs</p>
          </div>

          <div className="space-y-3">
            {approvals.map(app => {
              const isPending = app.status === 'pending';
              return (
                <div key={app.id} className="bg-sky-50/40 p-4 rounded-xl border border-sky-100 space-y-2 text-xs">
                  <div className="flex justify-between items-start border-b border-sky-100 pb-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-slate-900">{app.title}</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          app.status === 'approved'
                            ? 'bg-emerald-100 text-emerald-800'
                            : app.status === 'rejected'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}>
                          {app.status}
                        </span>
                      </div>
                      <div className="text-slate-500 text-[11px] mt-0.5">
                        Requested by <b>{app.requestedBy}</b> @ {formatDate(app.requestedAt)} • Branch: {app.branchName}
                      </div>
                    </div>

                    {isPending && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleResolveApproval(app.id, 'approved')}
                          className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold text-xs flex items-center gap-1 shadow-2xs"
                        >
                          <CheckCircle className="w-3.5 h-3.5" />
                          <span>Approve</span>
                        </button>
                        <button
                          onClick={() => handleResolveApproval(app.id, 'rejected', 'Rejected by Management')}
                          className="px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded-lg font-bold text-xs flex items-center gap-1 shadow-2xs"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Reject</span>
                        </button>
                      </div>
                    )}
                  </div>

                  <p className="text-slate-700">{app.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SUB-TAB 4: DELIVERY MANAGEMENT & FLEET */}
      {subTab === 'deliveries' && (
        <div className="flex-1 overflow-auto bg-white rounded-xl border border-sky-100 p-4 space-y-3 shadow-xs">
          <div className="border-b border-sky-100 pb-2">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Truck className="w-4 h-4 text-sky-600" />
              <span>Building Materials Site Deliveries & Proof of Delivery (POD)</span>
            </h3>
            <p className="text-xs text-slate-500">Truck dispatch, driver allocation, and electronic gate recipient signatures</p>
          </div>

          <div className="space-y-3">
            {deliveries.map(del => {
              const isDelivered = del.status === 'delivered';
              return (
                <div key={del.id} className="bg-sky-50/40 p-4 rounded-xl border border-sky-100 space-y-2 text-xs">
                  <div className="flex justify-between items-start border-b border-sky-100 pb-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-slate-900">{del.deliveryNumber}</span>
                        <span className="text-slate-500">(Invoice: {del.invoiceNumber})</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          isDelivered ? 'bg-emerald-100 text-emerald-800' : 'bg-sky-100 text-sky-800'
                        }`}>
                          {del.status}
                        </span>
                      </div>
                      <div className="text-slate-700 font-medium text-xs mt-0.5">
                        Client: {del.customerName} ({del.customerPhone})
                      </div>
                    </div>

                    {!isDelivered && (
                      <button
                        onClick={() => {
                          setActiveDeliveryForPOD(del);
                          setPodRecipient('');
                          setShowPODModal(true);
                        }}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 shadow-xs"
                      >
                        <FileCheck2 className="w-3.5 h-3.5" />
                        <span>Confirm POD</span>
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-500">
                    <div>Site Address: <b className="text-slate-800">{del.destinationAddress}</b></div>
                    <div>Vehicle: <b className="text-amber-700 font-semibold">{del.vehicleRegistration}</b></div>
                    <div>Driver: <b className="text-slate-800">{del.driverName}</b> ({del.driverPhone})</div>
                    {isDelivered && (
                      <div className="text-emerald-700 font-semibold">
                        Received by: <b>{del.recipientName}</b> @ {formatDate(del.deliveredAt)}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SUB-TAB 5: REST API & WEBHOOKS */}
      {subTab === 'api' && (
        <div className="flex-1 overflow-auto bg-white rounded-xl border border-sky-100 p-5 space-y-4 text-xs shadow-xs">
          <div className="max-w-3xl space-y-1">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Code2 className="w-4 h-4 text-sky-600" />
              <span>External Accounting & E-Commerce Integration Endpoints</span>
            </h3>
            <p className="text-slate-500">
              JengaPro exposes high-throughput authenticated REST APIs for QuickBooks, Xero, and contractor e-procurement portals.
            </p>
          </div>

          <div className="space-y-3 max-w-4xl">
            <div className="bg-sky-50/50 p-3.5 rounded-xl border border-sky-100 font-mono">
              <div className="flex items-center justify-between text-slate-800 mb-1">
                <span className="text-emerald-700 font-bold">GET /api/products</span>
                <span className="text-[10px] text-slate-500">Live inventory levels & pricing</span>
              </div>
              <div className="text-[11px] text-slate-500">Authorization: Bearer jp_live_839210928341</div>
            </div>

            <div className="bg-sky-50/50 p-3.5 rounded-xl border border-sky-100 font-mono">
              <div className="flex items-center justify-between text-slate-800 mb-1">
                <span className="text-amber-700 font-bold">POST /api/sales</span>
                <span className="text-[10px] text-slate-500">Ingest e-commerce orders & trigger eTIMS</span>
              </div>
              <div className="text-[11px] text-slate-500">Payload: items[], customerId, payments[]</div>
            </div>

            <div className="bg-sky-50/50 p-3.5 rounded-xl border border-sky-100 font-mono">
              <div className="flex items-center justify-between text-slate-800 mb-1">
                <span className="text-sky-700 font-bold">POST /api/sync/offline</span>
                <span className="text-[10px] text-slate-500">Bulk offline queue sync gateway</span>
              </div>
              <div className="text-[11px] text-slate-500">Batch reconciles remote POS counters without network</div>
            </div>
          </div>
        </div>
      )}

      {/* CREATE STOCK TRANSFER MODAL */}
      {showTransferModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-sky-200 rounded-2xl w-full max-w-md p-5 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-sky-100 pb-2">
              <h3 className="font-bold text-slate-900 text-sm">Dispatch Stock Transfer</h3>
              <button onClick={() => setShowTransferModal(false)} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
            </div>

            <form onSubmit={submitTransfer} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-slate-600 block mb-1">Source Depot:</label>
                  <select
                    value={sourceBranchId}
                    onChange={e => setSourceBranchId(e.target.value)}
                    className="w-full bg-white border border-sky-200 rounded-lg p-2 text-slate-900 focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                  >
                    {branches.map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-slate-600 block mb-1">Destination Branch:</label>
                  <select
                    value={destBranchId}
                    onChange={e => setDestBranchId(e.target.value)}
                    className="w-full bg-white border border-sky-200 rounded-lg p-2 text-slate-900 focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                  >
                    {branches.map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-slate-600 block mb-1">Select Product to Move:</label>
                <select
                  value={transferProductId}
                  onChange={e => setTransferProductId(e.target.value)}
                  className="w-full bg-white border border-sky-200 rounded-lg p-2 text-slate-900 focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                >
                  {products.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.stockByBranch[sourceBranchId] || 0} {p.baseUnit} in source depot)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-slate-600 block mb-1">Quantity:</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={transferQuantity}
                  onChange={e => setTransferQuantity(parseFloat(e.target.value) || 1)}
                  className="w-full bg-white border border-sky-200 rounded-lg p-2 text-slate-900 font-bold focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                />
              </div>

              <div>
                <label className="text-slate-600 block mb-1">Transfer Purpose / Notes:</label>
                <input
                  type="text"
                  value={transferNotes}
                  onChange={e => setTransferNotes(e.target.value)}
                  placeholder="e.g. Replenish Cabanas showroom contractor demand..."
                  className="w-full bg-white border border-sky-200 rounded-lg p-2 text-slate-900 focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowTransferModal(false)}
                  className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingTransfer}
                  className="flex-1 py-2 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-lg transition disabled:opacity-40 shadow-xs"
                >
                  {isSubmittingTransfer ? 'Dispatching...' : 'Dispatch Transfer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONFIRM POD MODAL */}
      {showPODModal && activeDeliveryForPOD && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-sky-200 rounded-2xl w-full max-w-md p-5 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-sky-100 pb-2">
              <h3 className="font-bold text-slate-900 text-sm">Sign Proof of Delivery (POD)</h3>
              <button onClick={() => setShowPODModal(false)} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
            </div>

            <form onSubmit={confirmDeliveryPOD} className="space-y-3 text-xs">
              <div className="text-slate-700">
                Delivery: <b>{activeDeliveryForPOD.deliveryNumber}</b> for {activeDeliveryForPOD.customerName}
              </div>

              <div>
                <label className="text-slate-600 block mb-1">Site Recipient Full Name & Title:</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Eng. Kevin Mwangi (Site Supervisor)"
                  value={podRecipient}
                  onChange={e => setPodRecipient(e.target.value)}
                  className="w-full bg-white border border-sky-200 rounded-lg p-2 text-slate-900 focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                />
              </div>

              <div className="bg-sky-50 p-3 rounded-xl border border-dashed border-sky-200 text-center text-slate-600 text-[11px]">
                ✍️ Digital Signature Stamp will be cryptographically locked with timestamp & GPS coordinates.
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPODModal(false)}
                  className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingPOD || !podRecipient}
                  className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg transition disabled:opacity-40 shadow-xs"
                >
                  {isSubmittingPOD ? 'Saving POD...' : 'Confirm Delivery & Sign'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
