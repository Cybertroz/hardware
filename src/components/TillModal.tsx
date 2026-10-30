import React, { useState } from 'react';
import {
  DollarSign,
  Printer,
  CheckCircle,
  AlertTriangle,
  RotateCcw
} from 'lucide-react';
import { TillSession, Branch, User } from '../types/index.ts';
import { formatKsh, formatDate } from '../utils/formatters.ts';

interface TillModalProps {
  activeTill?: TillSession;
  activeBranch: Branch;
  currentUser: User;
  onClose: () => void;
  onRefreshData: () => void;
}

export const TillModal: React.FC<TillModalProps> = ({
  activeTill,
  activeBranch,
  currentUser,
  onClose,
  onRefreshData
}) => {
  // Cash denomination counters (Kenyan currency notes & coins)
  const [note1000, setNote1000] = useState<number>(0);
  const [note500, setNote500] = useState<number>(0);
  const [note200, setNote200] = useState<number>(0);
  const [note100, setNote100] = useState<number>(0);
  const [note50, setNote50] = useState<number>(0);
  const [coins, setCoins] = useState<number>(0);
  const [closingNotes, setClosingNotes] = useState('');
  const [isClosing, setIsClosing] = useState(false);

  // Total counted cash
  const countedCash = (note1000 * 1000) + (note500 * 500) + (note200 * 200) + (note100 * 100) + (note50 * 50) + coins;
  const expectedCash = activeTill?.expectedCash || 0;
  const cashVariance = countedCash - expectedCash;

  const handleCloseTill = async () => {
    if (!activeTill) return;
    setIsClosing(true);

    try {
      const response = await fetch('/api/till/close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: activeTill.id,
          countedCash,
          notes: closingNotes
        })
      });

      if (response.ok) {
        onRefreshData();
        onClose();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsClosing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white border border-sky-200 rounded-2xl w-full max-w-lg p-5 space-y-4 shadow-2xl text-slate-900">
        <div className="flex justify-between items-center border-b border-sky-100 pb-2">
          <div>
            <h3 className="font-bold text-slate-900 text-sm">
              Daily Cash-Up & Till Reconciliation (Z-Report)
            </h3>
            <p className="text-xs text-slate-500">
              Branch: {activeBranch.name} • Cashier: {activeTill?.cashierName || currentUser.name}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
        </div>

        {/* Sales by Payment Method Breakdown */}
        <div className="bg-sky-50/50 p-3.5 rounded-xl border border-sky-100 grid grid-cols-2 gap-2.5 text-xs">
          <div>
            <span className="text-slate-500 block text-[11px]">Opening Cash Float:</span>
            <span className="font-bold text-slate-900 font-mono">{formatKsh(activeTill?.openingFloat)}</span>
          </div>
          <div>
            <span className="text-slate-500 block text-[11px]">Cash Sales:</span>
            <span className="font-bold text-emerald-700 font-mono">{formatKsh(activeTill?.cashSales)}</span>
          </div>
          <div>
            <span className="text-slate-500 block text-[11px]">M-Pesa Collections:</span>
            <span className="font-bold text-emerald-700 font-mono">{formatKsh(activeTill?.mpesaSales)}</span>
          </div>
          <div>
            <span className="text-slate-500 block text-[11px]">Contractor Credit Sales:</span>
            <span className="font-bold text-purple-700 font-mono">{formatKsh(activeTill?.creditSales)}</span>
          </div>
          <div className="col-span-2 pt-2 border-t border-sky-200 flex justify-between items-center">
            <span className="font-bold text-slate-800">Expected Drawer Cash:</span>
            <span className="font-extrabold text-sky-700 font-mono text-sm">{formatKsh(expectedCash)}</span>
          </div>
        </div>

        {/* Physical Cash Count Denominations */}
        <div className="space-y-2 text-xs">
          <label className="font-bold text-slate-800 block">Physical Cash Drawer Count (Kenyan Notes & Coins):</label>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <span className="text-[10px] text-slate-500">Ksh 1,000 Notes:</span>
              <input
                type="number"
                min="0"
                value={note1000 || ''}
                onChange={e => setNote1000(parseInt(e.target.value, 10) || 0)}
                className="w-full bg-white border border-sky-200 rounded-lg p-1.5 text-slate-900 text-right font-mono focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
              />
            </div>
            <div>
              <span className="text-[10px] text-slate-500">Ksh 500 Notes:</span>
              <input
                type="number"
                min="0"
                value={note500 || ''}
                onChange={e => setNote500(parseInt(e.target.value, 10) || 0)}
                className="w-full bg-white border border-sky-200 rounded-lg p-1.5 text-slate-900 text-right font-mono focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
              />
            </div>
            <div>
              <span className="text-[10px] text-slate-500">Ksh 200 Notes:</span>
              <input
                type="number"
                min="0"
                value={note200 || ''}
                onChange={e => setNote200(parseInt(e.target.value, 10) || 0)}
                className="w-full bg-white border border-sky-200 rounded-lg p-1.5 text-slate-900 text-right font-mono focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
              />
            </div>
            <div>
              <span className="text-[10px] text-slate-500">Ksh 100 Notes:</span>
              <input
                type="number"
                min="0"
                value={note100 || ''}
                onChange={e => setNote100(parseInt(e.target.value, 10) || 0)}
                className="w-full bg-white border border-sky-200 rounded-lg p-1.5 text-slate-900 text-right font-mono focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
              />
            </div>
            <div>
              <span className="text-[10px] text-slate-500">Ksh 50 Notes:</span>
              <input
                type="number"
                min="0"
                value={note50 || ''}
                onChange={e => setNote50(parseInt(e.target.value, 10) || 0)}
                className="w-full bg-white border border-sky-200 rounded-lg p-1.5 text-slate-900 text-right font-mono focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
              />
            </div>
            <div>
              <span className="text-[10px] text-slate-500">Coins (Ksh 20/10/5):</span>
              <input
                type="number"
                min="0"
                value={coins || ''}
                onChange={e => setCoins(parseFloat(e.target.value) || 0)}
                className="w-full bg-white border border-sky-200 rounded-lg p-1.5 text-slate-900 text-right font-mono focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
              />
            </div>
          </div>
        </div>

        {/* Counted Cash & Variance Indicator */}
        <div className={`p-3 rounded-xl border text-xs flex justify-between items-center font-bold ${
          cashVariance === 0
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
            : cashVariance < 0
            ? 'bg-rose-50 border-rose-200 text-rose-800'
            : 'bg-amber-50 border-amber-200 text-amber-800'
        }`}>
          <div>
            <span>Counted Cash: {formatKsh(countedCash)}</span>
          </div>
          <div>
            {cashVariance === 0 ? (
              <span>✓ Perfect Balance (Zero Variance)</span>
            ) : cashVariance < 0 ? (
              <span>Shortage: -{formatKsh(Math.abs(cashVariance))}</span>
            ) : (
              <span>Overage: +{formatKsh(cashVariance)}</span>
            )}
          </div>
        </div>

        <div>
          <label className="text-slate-600 block text-xs mb-1">Supervisor Closing Notes:</label>
          <input
            type="text"
            value={closingNotes}
            onChange={e => setClosingNotes(e.target.value)}
            placeholder="e.g. End of day shift balanced and verified by supervisor..."
            className="w-full bg-white border border-sky-200 rounded-lg p-2 text-slate-900 text-xs focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
          />
        </div>

        <div className="flex gap-2 pt-2">
          <button
            onClick={() => window.print()}
            className="px-3.5 py-2 bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Z-Report</span>
          </button>
          <button
            onClick={handleCloseTill}
            disabled={isClosing}
            className="flex-1 py-2 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-lg text-xs transition shadow-xs disabled:opacity-50"
          >
            {isClosing ? 'Closing Till...' : 'Close Till & Lock Register'}
          </button>
        </div>
      </div>
    </div>
  );
};
