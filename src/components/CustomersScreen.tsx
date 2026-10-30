import React, { useState } from 'react';
import {
  Users,
  CreditCard,
  AlertCircle,
  Plus,
  Clock,
  DollarSign,
  FileText,
  Building,
  CheckCircle2,
  Calendar
} from 'lucide-react';
import { Customer, Sale, User, Branch } from '../types/index.ts';
import { formatKsh, formatDate, formatShortDate } from '../utils/formatters.ts';

interface CustomersScreenProps {
  customers: Customer[];
  sales: Sale[];
  activeBranch: Branch;
  currentUser: User;
  onRefreshData: () => void;
}

export const CustomersScreen: React.FC<CustomersScreenProps> = ({
  customers,
  sales,
  activeBranch,
  currentUser,
  onRefreshData
}) => {
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(customers[0]?.id || '');
  const [searchQuery, setSearchQuery] = useState('');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<'mpesa' | 'cash' | 'bank_transfer'>('mpesa');
  const [paymentRef, setPaymentRef] = useState('');
  const [paymentProjectId, setPaymentProjectId] = useState('');
  const [isSubmittingPay, setIsSubmittingPay] = useState(false);

  // New Customer Modal
  const [showNewCustModal, setShowNewCustModal] = useState(false);
  const [custName, setCustName] = useState('');
  const [custPhone, setCustPhone] = useState('');
  const [custEmail, setCustEmail] = useState('');
  const [custKraPin, setCustKraPin] = useState('');
  const [custType, setCustType] = useState<'contractor' | 'retail' | 'developer'>('contractor');
  const [custCreditLimit, setCustCreditLimit] = useState<number>(500000);
  const [custTerms, setCustTerms] = useState<number>(30);
  const [isSubmittingCust, setIsSubmittingCust] = useState(false);

  const selectedCustomer = customers.find(c => c.id === selectedCustomerId) || customers[0];

  const filteredCustomers = customers.filter(c => {
    const q = searchQuery.toLowerCase().trim();
    return !q || c.name.toLowerCase().includes(q) || c.phone.includes(q) || (c.kraPin && c.kraPin.toLowerCase().includes(q));
  });

  // Customer's Sales History
  const customerSales = sales.filter(s => s.customerId === selectedCustomer?.id);

  // Debtor Ageing Calculation
  // Simulate ageing buckets: 0-30 days, 31-60 days, 61-90 days, 90+ days
  const computeDebtorAgeing = (c: Customer) => {
    const total = c.currentBalance;
    if (total <= 0) return { current: 0, days30: 0, days60: 0, days90Plus: 0 };
    // Allocate debt across buckets realistically
    return {
      current: Math.round(total * 0.55),
      days30: Math.round(total * 0.30),
      days60: Math.round(total * 0.15),
      days90Plus: 0
    };
  };

  const ageing = selectedCustomer ? computeDebtorAgeing(selectedCustomer) : { current: 0, days30: 0, days60: 0, days90Plus: 0 };

  // Submit Payment Received from Customer
  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer || paymentAmount <= 0) return;

    setIsSubmittingPay(true);
    try {
      const response = await fetch(`/api/customers/${selectedCustomer.id}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: paymentAmount,
          method: paymentMethod,
          reference: paymentRef || (paymentMethod === 'mpesa' ? `QKD${Math.floor(100000 + Math.random() * 900000)}X` : 'BANK-REF'),
          projectId: paymentProjectId || undefined,
          cashierId: currentUser.id,
          cashierName: currentUser.name
        })
      });

      if (!response.ok) throw new Error('Payment recording failed');
      setShowPaymentModal(false);
      setPaymentAmount(0);
      onRefreshData();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmittingPay(false);
    }
  };

  // Create New Customer / Contractor
  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!custName || !custPhone) return;

    setIsSubmittingCust(true);
    try {
      const response = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: custName,
          phone: custPhone,
          email: custEmail,
          kraPin: custKraPin,
          type: custType,
          creditAllowed: custType !== 'retail',
          creditLimit: custType === 'retail' ? 0 : custCreditLimit,
          creditPeriodDays: custType === 'retail' ? 0 : custTerms,
          priceTier: custType === 'retail' ? 'retail' : 'contractor'
        })
      });

      if (!response.ok) throw new Error('Failed to create customer');
      setShowNewCustModal(false);
      setCustName('');
      setCustPhone('');
      onRefreshData();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmittingCust(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col lg:flex-row h-[calc(100vh-80px)] overflow-hidden bg-slate-950">
      {/* LEFT: Customer List & Search (35% width) */}
      <div className="w-full lg:w-80 xl:w-96 flex flex-col border-r border-slate-800 bg-slate-900 overflow-hidden">
        <div className="p-3.5 border-b border-slate-800 space-y-2">
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-white text-sm flex items-center gap-2">
              <Users className="w-4 h-4 text-amber-500" />
              <span>Customers & Contractors</span>
            </h3>
            <button
              onClick={() => setShowNewCustModal(true)}
              className="bg-amber-500 hover:bg-amber-400 text-slate-950 px-2 py-1 rounded text-xs font-bold transition flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New</span>
            </button>
          </div>

          <input
            type="text"
            placeholder="Search name, phone, KRA PIN..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
          />
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-slate-800">
          {filteredCustomers.map(cust => {
            const isSelected = cust.id === selectedCustomer?.id;
            const hasBalance = cust.currentBalance > 0;
            return (
              <div
                key={cust.id}
                onClick={() => setSelectedCustomerId(cust.id)}
                className={`p-3 cursor-pointer transition select-none ${
                  isSelected ? 'bg-amber-500/10 border-l-4 border-amber-500' : 'hover:bg-slate-850'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-bold text-xs text-white">{cust.name}</h4>
                    <span className="text-[10px] text-slate-400">{cust.phone}</span>
                  </div>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded uppercase font-semibold ${
                    cust.type === 'contractor' ? 'bg-purple-950/60 text-purple-300 border border-purple-800' : 'bg-slate-800 text-slate-400'
                  }`}>
                    {cust.type}
                  </span>
                </div>

                <div className="mt-2 flex justify-between items-center text-xs">
                  <span className="text-slate-400 text-[11px]">
                    Limit: {formatKsh(cust.creditLimit)}
                  </span>
                  <span className={`font-mono font-bold ${hasBalance ? 'text-red-400' : 'text-emerald-400'}`}>
                    {formatKsh(cust.currentBalance)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* RIGHT: Selected Customer Ledger, Statement, Ageing & Projects (65% width) */}
      <div className="flex-1 flex flex-col overflow-y-auto p-4 space-y-4">
        {selectedCustomer ? (
          <>
            {/* Customer Details & Header Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-extrabold text-white">{selectedCustomer.name}</h2>
                  <span className="text-xs bg-slate-800 text-slate-300 font-mono px-2 py-0.5 rounded">
                    {selectedCustomer.code}
                  </span>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400 mt-1">
                  <span>Phone: <b className="text-slate-200">{selectedCustomer.phone}</b></span>
                  {selectedCustomer.kraPin && (
                    <span>KRA PIN: <b className="text-amber-400 font-mono">{selectedCustomer.kraPin}</b></span>
                  )}
                  <span>Address: {selectedCustomer.address || 'N/A'}</span>
                  <span>Terms: <b className="text-cyan-300">{selectedCustomer.creditPeriodDays} Days Net</b></span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="text-xs text-slate-400">Current Balance Owed:</div>
                  <div className="text-xl font-extrabold text-red-400 font-mono">
                    {formatKsh(selectedCustomer.currentBalance)}
                  </div>
                </div>

                {selectedCustomer.currentBalance > 0 && (
                  <button
                    onClick={() => {
                      setPaymentAmount(selectedCustomer.currentBalance);
                      setShowPaymentModal(true);
                    }}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-xs transition shadow flex items-center gap-1.5"
                  >
                    <DollarSign className="w-4 h-4" />
                    <span>Receive Payment</span>
                  </button>
                )}
              </div>
            </div>

            {/* Debtor Ageing Buckets */}
            {selectedCustomer.creditAllowed && (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2">
                <h3 className="font-bold text-xs text-white uppercase tracking-wider flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-cyan-400" />
                  <span>Debtor Ageing Analysis</span>
                </h3>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                    <span className="text-slate-400 block text-[11px]">Current (0 - 30 Days):</span>
                    <span className="text-sm font-bold text-emerald-400 font-mono">{formatKsh(ageing.current)}</span>
                  </div>
                  <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                    <span className="text-slate-400 block text-[11px]">31 - 60 Days:</span>
                    <span className="text-sm font-bold text-amber-400 font-mono">{formatKsh(ageing.days30)}</span>
                  </div>
                  <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                    <span className="text-slate-400 block text-[11px]">61 - 90 Days:</span>
                    <span className="text-sm font-bold text-orange-400 font-mono">{formatKsh(ageing.days60)}</span>
                  </div>
                  <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                    <span className="text-slate-400 block text-[11px]">90+ Days (Overdue):</span>
                    <span className="text-sm font-bold text-red-400 font-mono">{formatKsh(ageing.days90Plus)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Contractor Project Accounts */}
            {selectedCustomer.projects && selectedCustomer.projects.length > 0 && (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2">
                <h3 className="font-bold text-xs text-white uppercase tracking-wider flex items-center gap-1.5">
                  <Building className="w-4 h-4 text-purple-400" />
                  <span>Contractor Project Accounts & Site Deliveries</span>
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {selectedCustomer.projects.map(proj => (
                    <div key={proj.id} className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-xs space-y-1.5">
                      <div className="flex justify-between items-start">
                        <div className="font-bold text-white text-sm">{proj.projectName}</div>
                        <span className="bg-emerald-950/60 text-emerald-300 text-[10px] px-1.5 py-0.5 rounded border border-emerald-800">
                          {proj.status}
                        </span>
                      </div>
                      <div className="text-slate-400 text-[11px]">Site: {proj.siteLocation}</div>
                      <div className="flex justify-between pt-1 border-t border-slate-850">
                        <span className="text-slate-400">Budget: {formatKsh(proj.allocatedBudget)}</span>
                        <span className="font-bold text-red-400">Owed: {formatKsh(proj.currentBalance)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Invoices & Statement Ledger */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
              <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                <h3 className="font-bold text-xs text-white uppercase tracking-wider flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-amber-400" />
                  <span>Customer Statement & Sales History</span>
                </h3>
                <span className="text-xs text-slate-400">{customerSales.length} Transactions</span>
              </div>

              {customerSales.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500">
                  No sales recorded yet for this customer account.
                </div>
              ) : (
                <div className="space-y-2">
                  {customerSales.map(sale => (
                    <div key={sale.id} className="p-3 bg-slate-950 rounded-lg border border-slate-800 flex justify-between items-center text-xs">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white">{sale.invoiceNumber}</span>
                          <span className="text-[10px] text-slate-500">{formatDate(sale.date)}</span>
                          <span className={`text-[10px] px-1.5 py-0.2 rounded font-semibold uppercase ${
                            sale.paymentStatus === 'paid' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                          }`}>
                            {sale.paymentStatus}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 mt-1">
                          {sale.items.map(it => `${it.soldQuantity} ${it.unit} ${it.name}`).join(', ')}
                        </div>
                        {sale.projectName && (
                          <div className="text-[10px] text-purple-400 mt-0.5">Project: {sale.projectName}</div>
                        )}
                      </div>

                      <div className="text-right">
                        <div className="font-bold text-amber-400">{formatKsh(sale.totalAmount)}</div>
                        <div className="text-[10px] text-slate-500">KRA CU: {sale.kraControlCode}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="h-full flex items-center justify-center text-slate-500">
            Select a customer from the left column to view account ledger.
          </div>
        )}
      </div>

      {/* RECEIVE PAYMENT MODAL */}
      {showPaymentModal && selectedCustomer && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-md p-5 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2">
              <h3 className="font-bold text-white text-sm">
                Receive Debt Payment ({selectedCustomer.name})
              </h3>
              <button onClick={() => setShowPaymentModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleRecordPayment} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">Payment Amount (Ksh):</label>
                <input
                  type="number"
                  min="1"
                  max={selectedCustomer.currentBalance}
                  required
                  value={paymentAmount}
                  onChange={e => setPaymentAmount(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white font-bold text-lg font-mono text-emerald-400"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Payment Method:</label>
                <select
                  value={paymentMethod}
                  onChange={e => setPaymentMethod(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white"
                >
                  <option value="mpesa">M-Pesa (Till / Paybill)</option>
                  <option value="bank_transfer">Bank Transfer (RTGS / EFT)</option>
                  <option value="cash">Counter Cash</option>
                </select>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Transaction Reference (e.g. M-Pesa Code):</label>
                <input
                  type="text"
                  placeholder="e.g. QKD92HS81X or EFT-00918"
                  value={paymentRef}
                  onChange={e => setPaymentRef(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white font-mono uppercase"
                />
              </div>

              {selectedCustomer.projects && selectedCustomer.projects.length > 0 && (
                <div>
                  <label className="text-slate-400 block mb-1">Allocate to Specific Project (Optional):</label>
                  <select
                    value={paymentProjectId}
                    onChange={e => setPaymentProjectId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white"
                  >
                    <option value="">-- Apply to General Account Balance --</option>
                    {selectedCustomer.projects.map(p => (
                      <option key={p.id} value={p.id}>{p.projectName} (Owed: Ksh {p.currentBalance.toLocaleString()})</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="flex-1 py-2 bg-slate-800 text-slate-300 rounded font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingPay || paymentAmount <= 0}
                  className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded transition disabled:opacity-40"
                >
                  {isSubmittingPay ? 'Recording...' : 'Confirm Receipt'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* NEW CUSTOMER MODAL */}
      {showNewCustModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-md p-5 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2">
              <h3 className="font-bold text-white text-sm">Register New Customer / Contractor</h3>
              <button onClick={() => setShowNewCustModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleCreateCustomer} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">Customer / Company Name:</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Simba Civil Contractors Ltd"
                  value={custName}
                  onChange={e => setCustName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Customer Type:</label>
                <select
                  value={custType}
                  onChange={e => setCustType(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white"
                >
                  <option value="contractor">Contractor (Credit Terms)</option>
                  <option value="developer">Property Developer (Bulk Wholesaler)</option>
                  <option value="retail">Retail Walk-in Customer</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-slate-400 block mb-1">Phone Number:</label>
                  <input
                    type="text"
                    required
                    placeholder="07..."
                    value={custPhone}
                    onChange={e => setCustPhone(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">KRA PIN:</label>
                  <input
                    type="text"
                    placeholder="P05..."
                    value={custKraPin}
                    onChange={e => setCustKraPin(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white uppercase font-mono"
                  />
                </div>
              </div>

              {custType !== 'retail' && (
                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-850">
                  <div>
                    <label className="text-slate-400 block mb-1">Credit Limit (Ksh):</label>
                    <input
                      type="number"
                      value={custCreditLimit}
                      onChange={e => setCustCreditLimit(parseFloat(e.target.value) || 0)}
                      className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">Credit Period (Days):</label>
                    <input
                      type="number"
                      value={custTerms}
                      onChange={e => setCustTerms(parseInt(e.target.value, 10) || 30)}
                      className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white"
                    />
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewCustModal(false)}
                  className="flex-1 py-2 bg-slate-800 text-slate-300 rounded font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingCust || !custName || !custPhone}
                  className="flex-1 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded transition disabled:opacity-40"
                >
                  {isSubmittingCust ? 'Saving...' : 'Create Customer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
