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
    <div className="flex-1 flex flex-col h-[calc(100vh-80px)] overflow-hidden bg-slate-950 p-4 space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900 p-3.5 rounded-xl border border-slate-800 shadow-sm">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Sliders className="w-5 h-5 text-amber-500" />
            <span>Scale-Up Features & Enterprise Modules (Behind Flags)</span>
          </h2>
          <p className="text-xs text-slate-400">
            A small shop uses a single branch with advanced modules switched off; a large business enables multiple branches, deliveries, and approvals.
          </p>
        </div>

        {/* Sub-tabs */}
        <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs overflow-x-auto">
          <button
            onClick={() => setSubTab('flags')}
            className={`px-3 py-1.5 rounded-md font-medium transition ${
              subTab === 'flags' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-300 hover:text-white'
            }`}
          >
            Feature Flags
          </button>
          <button
            onClick={() => setSubTab('transfers')}
            className={`px-3 py-1.5 rounded-md font-medium transition ${
              subTab === 'transfers' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-300 hover:text-white'
            }`}
          >
            Inter-Branch Transfers ({transfers.length})
          </button>
          <button
            onClick={() => setSubTab('approvals')}
            className={`px-3 py-1.5 rounded-md font-medium transition relative ${
              subTab === 'approvals' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-300 hover:text-white'
            }`}
          >
            Approvals Queue ({approvals.filter(a => a.status === 'pending').length})
          </button>
          <button
            onClick={() => setSubTab('deliveries')}
            className={`px-3 py-1.5 rounded-md font-medium transition ${
              subTab === 'deliveries' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-300 hover:text-white'
            }`}
          >
            Fleet & Deliveries ({deliveries.length})
          </button>
          <button
            onClick={() => setSubTab('api')}
            className={`px-3 py-1.5 rounded-md font-medium transition ${
              subTab === 'api' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-300 hover:text-white'
            }`}
          >
            REST API & Webhooks
          </button>
        </div>
      </div>

      {/* SUB-TAB 1: FEATURE FLAGS TOGGLES */}
      {subTab === 'flags' && (
        <div className="flex-1 overflow-auto bg-slate-900 rounded-xl border border-slate-800 p-5 space-y-4">
          <div className="max-w-3xl space-y-2">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Sliders className="w-4 h-4 text-amber-500" />
              <span>Unified Architecture Feature Flags</span>
            </h3>
            <p className="text-xs text-slate-400">
              Switch entire enterprise modules on or off without changing codebase.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl">
            {/* Multi-Branch Mode */}
            <div className="p-4 bg-slate-950 rounded-lg border border-slate-800 flex items-start justify-between gap-4">
              <div>
                <h4 className="font-bold text-white text-xs">Multi-Branch & Warehouses</h4>
                <p className="text-[11px] text-slate-400 mt-1">
                  Enables multiple depots, showrooms, and inter-branch inventory transfers. When disabled, operates in clean single-shop mode.
                </p>
              </div>
              <input
                type="checkbox"
                checked={featureFlags.multiBranch}
                onChange={e => onUpdateFeatureFlags({ multiBranch: e.target.checked })}
                className="w-5 h-5 rounded bg-slate-900 border-slate-700 text-amber-500 cursor-pointer"
              />
            </div>

            {/* Contractor Credit Module */}
            <div className="p-4 bg-slate-950 rounded-lg border border-slate-800 flex items-start justify-between gap-4">
              <div>
                <h4 className="font-bold text-white text-xs">Contractor Credit Accounts</h4>
                <p className="text-[11px] text-slate-400 mt-1">
                  Enables 30/60 day credit terms, debtor ageing analysis, and credit limit checks at checkout.
                </p>
              </div>
              <input
                type="checkbox"
                checked={featureFlags.contractorCredit}
                onChange={e => onUpdateFeatureFlags({ contractorCredit: e.target.checked })}
                className="w-5 h-5 rounded bg-slate-900 border-slate-700 text-amber-500 cursor-pointer"
              />
            </div>

            {/* Approval Workflows */}
            <div className="p-4 bg-slate-950 rounded-lg border border-slate-800 flex items-start justify-between gap-4">
              <div>
                <h4 className="font-bold text-white text-xs">Tiered Approval Workflows</h4>
                <p className="text-[11px] text-slate-400 mt-1">
                  Requires Owner/Manager authorization for discounts &gt; 10%, high POs (&gt; Ksh 500k), and stock write-offs.
                </p>
              </div>
              <input
                type="checkbox"
                checked={featureFlags.approvalWorkflows}
                onChange={e => onUpdateFeatureFlags({ approvalWorkflows: e.target.checked })}
                className="w-5 h-5 rounded bg-slate-900 border-slate-700 text-amber-500 cursor-pointer"
              />
            </div>

            {/* Delivery Management */}
            <div className="p-4 bg-slate-950 rounded-lg border border-slate-800 flex items-start justify-between gap-4">
              <div>
                <h4 className="font-bold text-white text-xs">Delivery & Fleet Logistics</h4>
                <p className="text-[11px] text-slate-400 mt-1">
                  Enables dispatch scheduling, lorry/canter vehicle allocation, delivery notes, and digital Proof of Delivery (POD).
                </p>
              </div>
              <input
                type="checkbox"
                checked={featureFlags.deliveryManagement}
                onChange={e => onUpdateFeatureFlags({ deliveryManagement: e.target.checked })}
                className="w-5 h-5 rounded bg-slate-900 border-slate-700 text-amber-500 cursor-pointer"
              />
            </div>

            {/* Project Accounts */}
            <div className="p-4 bg-slate-950 rounded-lg border border-slate-800 flex items-start justify-between gap-4">
              <div>
                <h4 className="font-bold text-white text-xs">Contractor Project Accounts</h4>
                <p className="text-[11px] text-slate-400 mt-1">
                  Enables project-level sub-allocations, staged deliveries, and site-level statements for developers.
                </p>
              </div>
              <input
                type="checkbox"
                checked={featureFlags.projectAccounts}
                onChange={e => onUpdateFeatureFlags({ projectAccounts: e.target.checked })}
                className="w-5 h-5 rounded bg-slate-900 border-slate-700 text-amber-500 cursor-pointer"
              />
            </div>

            {/* Strict Non-Negative Stock */}
            <div className="p-4 bg-slate-950 rounded-lg border border-slate-800 flex items-start justify-between gap-4">
              <div>
                <h4 className="font-bold text-white text-xs">Allow Negative Stock</h4>
                <p className="text-[11px] text-slate-400 mt-1">
                  Default OFF. Prevents sales when physical stock is zero, ensuring strict warehouse inventory integrity.
                </p>
              </div>
              <input
                type="checkbox"
                checked={featureFlags.allowNegativeStock}
                onChange={e => onUpdateFeatureFlags({ allowNegativeStock: e.target.checked })}
                className="w-5 h-5 rounded bg-slate-900 border-slate-700 text-amber-500 cursor-pointer"
              />
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 2: INTER-BRANCH STOCK TRANSFERS */}
      {subTab === 'transfers' && (
        <div className="flex-1 overflow-auto bg-slate-900 rounded-xl border border-slate-800 p-4 space-y-3">
          <div className="flex justify-between items-center border-b border-slate-800 pb-2">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <ArrowRightLeft className="w-4 h-4 text-cyan-400" />
                <span>Inter-Branch Stock Movement</span>
              </h3>
              <p className="text-xs text-slate-400">Dispatch and receive stock between Nairobi Main Depot, Mombasa Rd, and Kisumu</p>
            </div>
            <button
              onClick={() => setShowTransferModal(true)}
              className="px-3.5 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Stock Transfer</span>
            </button>
          </div>

          <div className="space-y-3">
            {transfers.map(trf => (
              <div key={trf.id} className="bg-slate-950 p-4 rounded-lg border border-slate-800 space-y-2 text-xs">
                <div className="flex justify-between items-center border-b border-slate-850 pb-2">
                  <div>
                    <span className="font-bold text-sm text-white">{trf.transferNumber}</span>
                    <span className="text-slate-400 ml-2">
                      From <b className="text-white">{trf.sourceBranchName}</b> ➔ To <b className="text-white">{trf.destinationBranchName}</b>
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      trf.status === 'received' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-cyan-500/20 text-cyan-400'
                    }`}>
                      {trf.status}
                    </span>
                    {trf.status === 'dispatched' && (
                      <button
                        onClick={() => receiveTransfer(trf.id)}
                        className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[11px] font-semibold"
                      >
                        Receive & Confirm Stock
                      </button>
                    )}
                  </div>
                </div>

                <div className="space-y-1">
                  {trf.items.map((it, idx) => (
                    <div key={idx} className="flex justify-between text-slate-300">
                      <span>{it.productName} ({it.sku})</span>
                      <span className="font-bold text-white">{it.quantity} {it.unit}</span>
                    </div>
                  ))}
                </div>

                {trf.notes && (
                  <div className="text-[11px] text-slate-400 italic">"{trf.notes}"</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SUB-TAB 3: APPROVALS QUEUE */}
      {subTab === 'approvals' && (
        <div className="flex-1 overflow-auto bg-slate-900 rounded-xl border border-slate-800 p-4 space-y-3">
          <div className="border-b border-slate-800 pb-2">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-amber-500" />
              <span>Owner & Management Approval Queue</span>
            </h3>
            <p className="text-xs text-slate-400">Authorization gates for discounts &gt; 10%, large POs, and damage write-offs</p>
          </div>

          <div className="space-y-3">
            {approvals.map(app => {
              const isPending = app.status === 'pending';
              return (
                <div key={app.id} className="bg-slate-950 p-4 rounded-lg border border-slate-800 space-y-2 text-xs">
                  <div className="flex justify-between items-start border-b border-slate-850 pb-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-white">{app.title}</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          app.status === 'approved'
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : app.status === 'rejected'
                            ? 'bg-red-500/20 text-red-400'
                            : 'bg-amber-500/20 text-amber-400'
                        }`}>
                          {app.status}
                        </span>
                      </div>
                      <div className="text-slate-400 text-[11px] mt-0.5">
                        Requested by <b>{app.requestedBy}</b> @ {formatDate(app.requestedAt)} • Branch: {app.branchName}
                      </div>
                    </div>

                    {isPending && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleResolveApproval(app.id, 'approved')}
                          className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-bold text-xs flex items-center gap-1"
                        >
                          <CheckCircle className="w-3.5 h-3.5" />
                          <span>Approve</span>
                        </button>
                        <button
                          onClick={() => handleResolveApproval(app.id, 'rejected', 'Rejected by Management')}
                          className="px-3 py-1 bg-red-600 hover:bg-red-500 text-white rounded font-bold text-xs flex items-center gap-1"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Reject</span>
                        </button>
                      </div>
                    )}
                  </div>

                  <p className="text-slate-300">{app.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SUB-TAB 4: DELIVERY MANAGEMENT & FLEET */}
      {subTab === 'deliveries' && (
        <div className="flex-1 overflow-auto bg-slate-900 rounded-xl border border-slate-800 p-4 space-y-3">
          <div className="border-b border-slate-800 pb-2">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Truck className="w-4 h-4 text-emerald-400" />
              <span>Building Materials Site Deliveries & Proof of Delivery (POD)</span>
            </h3>
            <p className="text-xs text-slate-400">Truck dispatch, driver allocation, and electronic gate recipient signatures</p>
          </div>

          <div className="space-y-3">
            {deliveries.map(del => {
              const isDelivered = del.status === 'delivered';
              return (
                <div key={del.id} className="bg-slate-950 p-4 rounded-lg border border-slate-800 space-y-2 text-xs">
                  <div className="flex justify-between items-start border-b border-slate-850 pb-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-white">{del.deliveryNumber}</span>
                        <span className="text-slate-400">(Invoice: {del.invoiceNumber})</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          isDelivered ? 'bg-emerald-500/20 text-emerald-400' : 'bg-cyan-500/20 text-cyan-400'
                        }`}>
                          {del.status}
                        </span>
                      </div>
                      <div className="text-slate-300 font-medium text-xs mt-0.5">
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
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-bold text-xs flex items-center gap-1.5"
                      >
                        <FileCheck2 className="w-3.5 h-3.5" />
                        <span>Confirm POD</span>
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-400">
                    <div>Site Address: <b className="text-slate-200">{del.destinationAddress}</b></div>
                    <div>Vehicle: <b className="text-amber-400">{del.vehicleRegistration}</b></div>
                    <div>Driver: <b className="text-slate-200">{del.driverName}</b> ({del.driverPhone})</div>
                    {isDelivered && (
                      <div className="text-emerald-400">
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
        <div className="flex-1 overflow-auto bg-slate-900 rounded-xl border border-slate-800 p-5 space-y-4 text-xs">
          <div className="max-w-3xl space-y-2">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Code2 className="w-4 h-4 text-amber-500" />
              <span>External Accounting & E-Commerce Integration Endpoints</span>
            </h3>
            <p className="text-slate-400">
              JengaPro exposes high-throughput authenticated REST APIs for QuickBooks, Xero, and contractor e-procurement portals.
            </p>
          </div>

          <div className="space-y-3 max-w-4xl">
            <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800 font-mono">
              <div className="flex items-center justify-between text-slate-300 mb-1">
                <span className="text-emerald-400 font-bold">GET /api/products</span>
                <span className="text-[10px] text-slate-500">Live inventory levels & pricing</span>
              </div>
              <div className="text-[11px] text-slate-400">Authorization: Bearer jp_live_839210928341</div>
            </div>

            <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800 font-mono">
              <div className="flex items-center justify-between text-slate-300 mb-1">
                <span className="text-amber-400 font-bold">POST /api/sales</span>
                <span className="text-[10px] text-slate-500">Ingest e-commerce orders & trigger eTIMS</span>
              </div>
              <div className="text-[11px] text-slate-400">Payload: items[], customerId, payments[]</div>
            </div>

            <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800 font-mono">
              <div className="flex items-center justify-between text-slate-300 mb-1">
                <span className="text-cyan-400 font-bold">POST /api/sync/offline</span>
                <span className="text-[10px] text-slate-500">Bulk offline queue sync gateway</span>
              </div>
              <div className="text-[11px] text-slate-400">Batch reconciles remote POS counters without network</div>
            </div>
          </div>
        </div>
      )}

      {/* CREATE STOCK TRANSFER MODAL */}
      {showTransferModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-md p-5 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2">
              <h3 className="font-bold text-white text-sm">Dispatch Stock Transfer</h3>
              <button onClick={() => setShowTransferModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={submitTransfer} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-slate-400 block mb-1">Source Depot:</label>
                  <select
                    value={sourceBranchId}
                    onChange={e => setSourceBranchId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white"
                  >
                    {branches.map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Destination Branch:</label>
                  <select
                    value={destBranchId}
                    onChange={e => setDestBranchId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white"
                  >
                    {branches.map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Select Product to Move:</label>
                <select
                  value={transferProductId}
                  onChange={e => setTransferProductId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white"
                >
                  {products.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.stockByBranch[sourceBranchId] || 0} {p.baseUnit} in source depot)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Quantity:</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={transferQuantity}
                  onChange={e => setTransferQuantity(parseFloat(e.target.value) || 1)}
                  className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white font-bold"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Transfer Purpose / Notes:</label>
                <input
                  type="text"
                  value={transferNotes}
                  onChange={e => setTransferNotes(e.target.value)}
                  placeholder="e.g. Replenish Cabanas showroom contractor demand..."
                  className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowTransferModal(false)}
                  className="flex-1 py-2 bg-slate-800 text-slate-300 rounded font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingTransfer}
                  className="flex-1 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded transition disabled:opacity-40"
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
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-md p-5 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2">
              <h3 className="font-bold text-white text-sm">Sign Proof of Delivery (POD)</h3>
              <button onClick={() => setShowPODModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={confirmDeliveryPOD} className="space-y-3 text-xs">
              <div className="text-slate-300">
                Delivery: <b>{activeDeliveryForPOD.deliveryNumber}</b> for {activeDeliveryForPOD.customerName}
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Site Recipient Full Name & Title:</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Eng. Kevin Mwangi (Site Supervisor)"
                  value={podRecipient}
                  onChange={e => setPodRecipient(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white"
                />
              </div>

              <div className="bg-slate-950 p-3 rounded border border-dashed border-slate-700 text-center text-slate-400 text-[11px]">
                ✍️ Digital Signature Stamp will be cryptographically locked with timestamp & GPS coordinates.
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPODModal(false)}
                  className="flex-1 py-2 bg-slate-800 text-slate-300 rounded font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingPOD || !podRecipient}
                  className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded transition disabled:opacity-40"
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
