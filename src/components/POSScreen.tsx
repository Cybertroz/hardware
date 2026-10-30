import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  Barcode,
  Trash2,
  Plus,
  Minus,
  CreditCard,
  DollarSign,
  Smartphone,
  RotateCcw,
  PauseCircle,
  FileText,
  Printer,
  Check,
  AlertTriangle,
  Layers,
  ArrowRight,
  Sparkles,
  HelpCircle,
  UserPlus
} from 'lucide-react';
import { Product, Customer, Sale, Branch, User, TillSession, FeatureFlags } from '../types/index.ts';
import { formatKsh, formatKshExact, formatDate } from '../utils/formatters.ts';
import { defaultPrinterConfig, generateEscPosHex } from '../utils/receiptPrinter.ts';
import { OfflineSyncService } from '../services/offlineSync.ts';

export interface CartItem {
  product: Product;
  selectedUnit: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  taxRate: number;
}

interface POSScreenProps {
  products: Product[];
  customers: Customer[];
  activeBranch: Branch;
  currentUser: User;
  activeTill?: TillSession;
  featureFlags: FeatureFlags;
  isOnline: boolean;
  onSaleCompleted: (sale: Sale) => void;
  onRefreshData: () => void;
  parkedSales: Sale[];
  onParkSale: (cart: CartItem[], customer?: Customer, notes?: string) => void;
  onRestoreParkedSale: (sale: Sale) => void;
}

export const POSScreen: React.FC<POSScreenProps> = ({
  products,
  customers,
  activeBranch,
  currentUser,
  activeTill,
  featureFlags,
  isOnline,
  onSaleCompleted,
  onRefreshData,
  parkedSales,
  onParkSale,
  onRestoreParkedSale
}) => {
  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [barcodeInput, setBarcodeInput] = useState('');

  // Cart & Customer State
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('cust-retail-walkin');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [orderDiscount, setOrderDiscount] = useState<number>(0);
  const [deliveryRequired, setDeliveryRequired] = useState(false);
  const [deliveryAddress, setDeliveryAddress] = useState('');

  // Modals
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [showParkedModal, setShowParkedModal] = useState(false);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [showEscPosViewer, setShowEscPosViewer] = useState(false);

  // Active Completed Sale for Receipt
  const [lastCompletedSale, setLastCompletedSale] = useState<Sale | null>(null);

  // Payment Breakdown State
  const [cashAmount, setCashAmount] = useState<number>(0);
  const [cashTendered, setCashTendered] = useState<number>(0);
  const [mpesaAmount, setMpesaAmount] = useState<number>(0);
  const [mpesaPhone, setMpesaPhone] = useState<string>('0722000000');
  const [mpesaReference, setMpesaReference] = useState<string>('');
  const [cardAmount, setCardAmount] = useState<number>(0);
  const [bankAmount, setBankAmount] = useState<number>(0);
  const [creditAmount, setCreditAmount] = useState<number>(0);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [mpesaStatus, setMpesaStatus] = useState<'idle' | 'prompted' | 'received'>('idle');

  // Scanner Wedge buffer
  const barcodeBufferRef = useRef<string>('');
  const lastKeyTimeRef = useRef<number>(0);

  // Get Selected Customer details
  const selectedCustomer = customers.find(c => c.id === selectedCustomerId);

  // Categories list
  const categories = ['All', ...Array.from(new Set(products.map(p => p.category)))];

  // Filtered Products
  const filteredProducts = products.filter(p => {
    const matchesCat = selectedCategory === 'All' || p.category === selectedCategory;
    const query = searchQuery.toLowerCase().trim();
    const matchesQuery = !query || 
      p.name.toLowerCase().includes(query) ||
      p.sku.toLowerCase().includes(query) ||
      p.barcode.includes(query) ||
      p.brand.toLowerCase().includes(query);
    return matchesCat && matchesQuery && p.active;
  });

  // Calculate Cart Totals
  const cartSubtotal = cart.reduce((sum, item) => {
    const gross = (item.quantity * item.unitPrice) - item.discount;
    return sum + (gross / 1.16);
  }, 0);

  const cartTax = cart.reduce((sum, item) => {
    const gross = (item.quantity * item.unitPrice) - item.discount;
    return sum + (gross - (gross / 1.16));
  }, 0);

  const cartGross = cart.reduce((sum, item) => {
    return sum + (item.quantity * item.unitPrice) - item.discount;
  }, 0) - orderDiscount;

  const totalAmount = Math.max(0, Math.round(cartGross));

  // Auto-listen to USB/Bluetooth Barcode Scanner wedge
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is currently typing in an input text field (except for quick enter)
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';
      
      const now = Date.now();
      if (now - lastKeyTimeRef.current > 150) {
        barcodeBufferRef.current = '';
      }
      lastKeyTimeRef.current = now;

      if (e.key === 'Enter') {
        const scannedCode = barcodeBufferRef.current.trim();
        if (scannedCode.length >= 4) {
          handleBarcodeScan(scannedCode);
          barcodeBufferRef.current = '';
          if (!isInput) e.preventDefault();
        }
      } else if (e.key.length === 1) {
        barcodeBufferRef.current += e.key;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [products]);

  // Handle Barcode Scan match
  const handleBarcodeScan = (code: string) => {
    const foundProduct = products.find(p => 
      p.barcode === code || 
      p.sku === code || 
      p.availableUnits.some(u => u.barcode === code)
    );

    if (foundProduct) {
      // Find which unit matched barcode
      const matchedUnit = foundProduct.availableUnits.find(u => u.barcode === code)?.unit || foundProduct.baseUnit;
      addToCart(foundProduct, matchedUnit);
    }
  };

  // Add product to cart with chosen unit
  const addToCart = (product: Product, unitName?: string) => {
    const targetUnit = unitName || product.baseUnit;
    const unitConfig = product.availableUnits.find(u => u.unit === targetUnit);
    
    // Determine price based on customer price tier
    let unitPrice = unitConfig ? unitConfig.sellingPrice : product.retailPrice;
    if (selectedCustomer?.priceTier === 'contractor' && targetUnit === product.baseUnit) {
      unitPrice = product.contractorPrice;
    } else if (selectedCustomer?.priceTier === 'wholesale' && targetUnit === product.baseUnit) {
      unitPrice = product.wholesalePrice;
    }

    setCart(prev => {
      const existingIndex = prev.findIndex(item => item.product.id === product.id && item.selectedUnit === targetUnit);
      if (existingIndex > -1) {
        const next = [...prev];
        next[existingIndex].quantity += 1;
        return next;
      } else {
        return [...prev, {
          product,
          selectedUnit: targetUnit,
          quantity: 1,
          unitPrice,
          discount: 0,
          taxRate: product.taxRate || 0.16
        }];
      }
    });
  };

  // Update Cart line quantity
  const updateQuantity = (index: number, qty: number) => {
    if (qty <= 0) {
      removeFromCart(index);
      return;
    }
    setCart(prev => {
      const next = [...prev];
      next[index].quantity = qty;
      return next;
    });
  };

  // Switch Unit of Measure on Cart line item
  const switchItemUnit = (index: number, newUnit: string) => {
    setCart(prev => {
      const next = [...prev];
      const item = next[index];
      const unitDef = item.product.availableUnits.find(u => u.unit === newUnit);
      item.selectedUnit = newUnit;
      if (unitDef) {
        item.unitPrice = unitDef.sellingPrice;
      }
      return next;
    });
  };

  // Remove from cart
  const removeFromCart = (index: number) => {
    setCart(prev => prev.filter((_, i) => i !== index));
  };

  // Open Checkout / Split Payment Modal
  const initiateCheckout = () => {
    if (cart.length === 0) return;
    setPaymentError(null);
    setMpesaStatus('idle');

    // Default payment method: If customer is contractor, suggest M-Pesa or Split, or full cash
    setCashAmount(totalAmount);
    setCashTendered(totalAmount);
    setMpesaAmount(0);
    setMpesaReference(`QKD${Math.floor(100000 + Math.random() * 900000)}X`);
    setCardAmount(0);
    setBankAmount(0);
    setCreditAmount(0);

    if (selectedCustomer?.phone) {
      setMpesaPhone(selectedCustomer.phone);
    }

    setShowPaymentModal(true);
  };

  // Quick Preset buttons for Payment
  const setPaymentQuickMode = (mode: 'cash' | 'mpesa' | 'credit' | 'split') => {
    setPaymentError(null);
    if (mode === 'cash') {
      setCashAmount(totalAmount);
      setCashTendered(totalAmount);
      setMpesaAmount(0);
      setCardAmount(0);
      setBankAmount(0);
      setCreditAmount(0);
    } else if (mode === 'mpesa') {
      setCashAmount(0);
      setCashTendered(0);
      setMpesaAmount(totalAmount);
      setCardAmount(0);
      setBankAmount(0);
      setCreditAmount(0);
    } else if (mode === 'credit') {
      setCashAmount(0);
      setCashTendered(0);
      setMpesaAmount(0);
      setCardAmount(0);
      setBankAmount(0);
      setCreditAmount(totalAmount);
    } else if (mode === 'split') {
      // 50% Cash, 50% M-Pesa
      const half = Math.round(totalAmount / 2);
      setCashAmount(half);
      setCashTendered(half);
      setMpesaAmount(totalAmount - half);
      setCardAmount(0);
      setBankAmount(0);
      setCreditAmount(0);
    }
  };

  // Simulate M-Pesa STK Push
  const simulateMpesaPrompt = () => {
    setMpesaStatus('prompted');
    setTimeout(() => {
      setMpesaStatus('received');
      setMpesaReference(`QKD${Math.floor(100000 + Math.random() * 900000)}X`);
    }, 1200);
  };

  // Complete the Sale Transaction
  const handleFinalizeSale = async () => {
    const totalPaymentsEntered = cashAmount + mpesaAmount + cardAmount + bankAmount + creditAmount;
    
    if (Math.abs(totalPaymentsEntered - totalAmount) > 1.0) {
      setPaymentError(`Total payments entered (Ksh ${totalPaymentsEntered.toLocaleString()}) does not match sale total (Ksh ${totalAmount.toLocaleString()}). Difference: Ksh ${(totalAmount - totalPaymentsEntered).toLocaleString()}`);
      return;
    }

    // Contractor Credit validation check
    if (creditAmount > 0) {
      if (!selectedCustomer || !selectedCustomer.creditAllowed) {
        setPaymentError('Credit sale requires a registered customer with active credit allowance.');
        return;
      }
      const newBalance = selectedCustomer.currentBalance + creditAmount;
      if (newBalance > selectedCustomer.creditLimit) {
        setPaymentError(`Credit limit exceeded! Customer limit is Ksh ${selectedCustomer.creditLimit.toLocaleString()}. Current balance: Ksh ${selectedCustomer.currentBalance.toLocaleString()}. Attempting credit of Ksh ${creditAmount.toLocaleString()}.`);
        return;
      }
    }

    setIsProcessingPayment(true);
    setPaymentError(null);

    const paymentsArray: any[] = [];
    if (cashAmount > 0) {
      paymentsArray.push({ method: 'cash', amount: cashAmount, timestamp: new Date().toISOString() });
    }
    if (mpesaAmount > 0) {
      paymentsArray.push({
        method: 'mpesa',
        amount: mpesaAmount,
        reference: mpesaReference || `QKD${Math.floor(100000 + Math.random() * 900000)}X`,
        phone: mpesaPhone,
        timestamp: new Date().toISOString()
      });
    }
    if (cardAmount > 0) {
      paymentsArray.push({ method: 'card', amount: cardAmount, timestamp: new Date().toISOString() });
    }
    if (bankAmount > 0) {
      paymentsArray.push({ method: 'bank_transfer', amount: bankAmount, timestamp: new Date().toISOString() });
    }
    if (creditAmount > 0) {
      paymentsArray.push({ method: 'credit', amount: creditAmount, timestamp: new Date().toISOString() });
    }

    const salePayload = {
      branchId: activeBranch.id,
      customerId: selectedCustomerId,
      customerName: selectedCustomer?.name || 'Walk-in Retail Customer',
      isContractor: selectedCustomer?.type === 'contractor' || selectedCustomer?.type === 'developer',
      projectId: selectedProjectId || undefined,
      projectName: selectedCustomer?.projects?.find(p => p.id === selectedProjectId)?.projectName,
      cashierId: currentUser.id,
      cashierName: currentUser.name,
      items: cart.map(item => ({
        productId: item.product.id,
        unit: item.selectedUnit,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discountAmount: item.discount
      })),
      payments: paymentsArray,
      deliveryRequired,
      deliveryAddress,
      notes: deliveryRequired ? `Site delivery requested to ${deliveryAddress}` : undefined
    };

    // If Offline: Queue in OfflineSyncService
    if (!isOnline) {
      const queuedSale = OfflineSyncService.enqueueSale({
        branchId: salePayload.branchId,
        customerId: salePayload.customerId,
        customerName: salePayload.customerName,
        isContractor: salePayload.isContractor,
        projectId: salePayload.projectId,
        projectName: salePayload.projectName,
        cashierId: salePayload.cashierId,
        cashierName: salePayload.cashierName,
        items: salePayload.items,
        payments: salePayload.payments,
        totalAmount
      });

      // Construct simulated offline sale record for instant printing
      const offlineSale: Sale = {
        id: queuedSale.localQueueId,
        invoiceNumber: queuedSale.offlineReceiptNo,
        receiptNumber: queuedSale.offlineReceiptNo,
        branchId: activeBranch.id,
        branchName: activeBranch.name,
        customerName: salePayload.customerName,
        isContractor: !!salePayload.isContractor,
        cashierId: currentUser.id,
        cashierName: currentUser.name,
        date: new Date().toISOString(),
        items: cart.map(item => ({
          productId: item.product.id,
          sku: item.product.sku,
          name: item.product.name,
          unit: item.selectedUnit,
          soldQuantity: item.quantity,
          baseUnitQuantity: item.quantity,
          unitPrice: item.unitPrice,
          costPriceAtSale: item.product.costPrice,
          discountAmount: item.discount,
          taxRate: 0.16,
          taxAmount: Math.round((item.quantity * item.unitPrice * 0.16 / 1.16) * 100) / 100,
          total: (item.quantity * item.unitPrice) - item.discount
        })),
        subtotal: cartSubtotal,
        discountTotal: orderDiscount,
        taxTotal: cartTax,
        totalAmount,
        payments: paymentsArray,
        paymentStatus: creditAmount > 0 ? 'partial' : 'paid',
        kraControlCode: `OFFLINE-QUEUE-${Math.floor(1000 + Math.random() * 9000)}`,
        kraQrCodeUrl: `https://etims.kra.go.ke/offline-verify?no=${queuedSale.offlineReceiptNo}`,
        status: 'completed',
        isOfflineSync: true
      };

      setLastCompletedSale(offlineSale);
      setCart([]);
      setShowPaymentModal(false);
      setShowReceiptModal(true);
      setIsProcessingPayment(false);
      onSaleCompleted(offlineSale);
      return;
    }

    // Online HTTP POST to /api/sales
    try {
      const response = await fetch('/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(salePayload)
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to process sale');
      }

      const completedSale = await response.json();
      setLastCompletedSale(completedSale);
      setCart([]);
      setShowPaymentModal(false);
      setShowReceiptModal(true);
      onSaleCompleted(completedSale);
      onRefreshData();
    } catch (err: any) {
      setPaymentError(err.message || 'Payment processing error');
    } finally {
      setIsProcessingPayment(false);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-80px)] overflow-hidden bg-slate-950">
      {/* LEFT COLUMN: Product Catalog & Fast Lookup (60% width) */}
      <div className="flex-1 flex flex-col border-r border-slate-800 overflow-hidden">
        {/* Search Bar & Barcode Scanner wedge listener */}
        <div className="p-3 bg-slate-900 border-b border-slate-800 flex flex-wrap items-center gap-2.5">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="Search cement, steel rebar, paint, pipe, SKU or brand..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
            />
          </div>

          {/* Barcode Test Simulator input */}
          <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5">
            <Barcode className="w-4 h-4 text-amber-400" />
            <input
              type="text"
              placeholder="Scan Barcode..."
              value={barcodeInput}
              onChange={e => setBarcodeInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && barcodeInput.trim()) {
                  handleBarcodeScan(barcodeInput.trim());
                  setBarcodeInput('');
                }
              }}
              className="w-32 bg-transparent text-xs text-white focus:outline-none placeholder-slate-500 font-mono"
            />
          </div>
        </div>

        {/* Category Filter Chips */}
        <div className="px-3 py-2 bg-slate-900/60 border-b border-slate-800 flex items-center gap-1.5 overflow-x-auto scrollbar-thin">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition ${
                selectedCategory === cat
                  ? 'bg-amber-500 text-slate-950 font-semibold'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Products Grid */}
        <div className="flex-1 overflow-y-auto p-3 grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2.5">
          {filteredProducts.map(product => {
            const currentStock = product.stockByBranch[activeBranch.id] || 0;
            const isLowStock = currentStock <= product.minStockAlert;
            const isOutOfStock = currentStock <= 0;

            return (
              <div
                key={product.id}
                onClick={() => !isOutOfStock && addToCart(product)}
                className={`bg-slate-900 border rounded-lg p-2.5 flex flex-col justify-between cursor-pointer transition hover:border-amber-500 select-none ${
                  isOutOfStock
                    ? 'border-red-900/60 opacity-60 bg-red-950/10'
                    : isLowStock
                    ? 'border-amber-700/60 hover:bg-slate-850'
                    : 'border-slate-800 hover:bg-slate-850'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-1 mb-1">
                    <span className="text-[10px] font-mono text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded">
                      {product.sku}
                    </span>
                    <span
                      className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                        isOutOfStock
                          ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                          : isLowStock
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          : 'bg-emerald-500/20 text-emerald-400'
                      }`}
                    >
                      {currentStock} {product.baseUnit}
                    </span>
                  </div>

                  <h3 className="font-medium text-xs text-white line-clamp-2 leading-tight">
                    {product.name}
                  </h3>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    {product.brand}
                  </div>
                </div>

                <div className="mt-2.5 pt-2 border-t border-slate-800 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-amber-400">
                      {formatKsh(product.retailPrice)}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      per {product.baseUnit}
                    </div>
                  </div>

                  {/* Multi-unit indicator tag */}
                  {product.availableUnits.length > 1 && (
                    <span className="text-[10px] bg-slate-800 text-cyan-300 px-1.5 py-0.5 rounded border border-cyan-800/40">
                      +{product.availableUnits.length - 1} UoM
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* RIGHT COLUMN: Fast Checkout & Cart (40% width) */}
      <div className="w-full lg:w-[420px] xl:w-[460px] flex flex-col bg-slate-900 border-l border-slate-800">
        {/* Customer Selector & Contractor Project Header */}
        <div className="p-3 bg-slate-900 border-b border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <span>Customer Account</span>
              {selectedCustomer?.type === 'contractor' && (
                <span className="bg-amber-500/20 text-amber-300 text-[10px] px-1.5 py-0.5 rounded font-normal">
                  Contractor Tier
                </span>
              )}
            </span>

            {/* Held Sales Button */}
            {parkedSales.length > 0 && (
              <button
                onClick={() => setShowParkedModal(true)}
                className="text-xs bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded hover:bg-indigo-500/30 flex items-center gap-1"
              >
                <PauseCircle className="w-3 h-3 text-indigo-400" />
                <span>Held ({parkedSales.length})</span>
              </button>
            )}
          </div>

          <div className="flex gap-2">
            <select
              value={selectedCustomerId}
              onChange={e => {
                setSelectedCustomerId(e.target.value);
                setSelectedProjectId('');
              }}
              className="flex-1 bg-slate-950 text-white text-xs border border-slate-700 rounded-md px-2.5 py-1.5 focus:outline-none focus:border-amber-500"
            >
              {customers.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.creditAllowed ? `(Credit Ksh ${(c.creditLimit - c.currentBalance).toLocaleString()} avail)` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Project Account Selector if contractor has active projects */}
          {selectedCustomer?.projects && selectedCustomer.projects.length > 0 && (
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-slate-400 whitespace-nowrap">Site / Project:</span>
              <select
                value={selectedProjectId}
                onChange={e => setSelectedProjectId(e.target.value)}
                className="w-full bg-slate-950 text-amber-300 text-xs border border-slate-700 rounded px-2 py-1 focus:outline-none"
              >
                <option value="">-- General Contractor Account --</option>
                {selectedCustomer.projects.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.projectName} (Owed: Ksh {p.currentBalance.toLocaleString()})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Credit Limit & Balance Status Bar */}
          {selectedCustomer?.creditAllowed && (
            <div className="bg-slate-950 p-2 rounded border border-slate-800 text-[11px] flex justify-between items-center">
              <div>
                <span className="text-slate-400">Credit Limit: </span>
                <span className="font-semibold text-white">{formatKsh(selectedCustomer.creditLimit)}</span>
              </div>
              <div>
                <span className="text-slate-400">Avail: </span>
                <span className={`font-bold ${selectedCustomer.creditLimit - selectedCustomer.currentBalance < 50000 ? 'text-red-400' : 'text-emerald-400'}`}>
                  {formatKsh(Math.max(0, selectedCustomer.creditLimit - selectedCustomer.currentBalance))}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Cart Line Items List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-2 select-none">
              <Barcode className="w-10 h-10 opacity-30" />
              <p className="text-sm">Scan barcode or click items to add to cart</p>
              <span className="text-xs text-slate-600">Hardware counter checkout ready</span>
            </div>
          ) : (
            cart.map((item, index) => {
              const lineTotal = (item.quantity * item.unitPrice) - item.discount;
              return (
                <div
                  key={`${item.product.id}-${item.selectedUnit}-${index}`}
                  className="bg-slate-950 border border-slate-800 rounded-lg p-2.5 flex flex-col gap-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="font-medium text-xs text-white leading-tight">
                        {item.product.name}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                        {item.product.sku}
                      </div>
                    </div>
                    <button
                      onClick={() => removeFromCart(index)}
                      className="text-slate-500 hover:text-red-400 p-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-850">
                    {/* Unit of Measure Switcher (e.g. Bag vs Tonne, Pc vs Metre) */}
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-500 text-[11px]">UoM:</span>
                      <select
                        value={item.selectedUnit}
                        onChange={e => switchItemUnit(index, e.target.value)}
                        className="bg-slate-900 text-cyan-300 font-medium text-xs border border-slate-700 rounded px-1.5 py-0.5"
                      >
                        {item.product.availableUnits.map(u => (
                          <option key={u.unit} value={u.unit}>
                            {u.unit} (@ {formatKsh(u.sellingPrice)})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Quantity Controls */}
                    <div className="flex items-center border border-slate-700 rounded bg-slate-900">
                      <button
                        onClick={() => updateQuantity(index, item.quantity - 1)}
                        className="p-1 text-slate-400 hover:text-white"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={e => updateQuantity(index, parseFloat(e.target.value) || 1)}
                        className="w-12 text-center bg-transparent text-white font-bold text-xs focus:outline-none"
                      />
                      <button
                        onClick={() => updateQuantity(index, item.quantity + 1)}
                        className="p-1 text-slate-400 hover:text-white"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>

                    {/* Line Total */}
                    <div className="text-right font-bold text-amber-400 text-xs">
                      {formatKsh(lineTotal)}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Cart Summary & Checkout Action */}
        <div className="p-3 bg-slate-900 border-t border-slate-800 space-y-2.5">
          {/* Subtotal, VAT & Discount Breakdown */}
          <div className="space-y-1 text-xs">
            <div className="flex justify-between text-slate-400">
              <span>Subtotal (Net):</span>
              <span>{formatKsh(cartSubtotal)}</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Kenya VAT 16% (eTIMS):</span>
              <span>{formatKsh(cartTax)}</span>
            </div>
            {orderDiscount > 0 && (
              <div className="flex justify-between text-emerald-400 font-medium">
                <span>Discount:</span>
                <span>-{formatKsh(orderDiscount)}</span>
              </div>
            )}
            <div className="flex justify-between text-base font-extrabold text-white pt-1 border-t border-slate-800">
              <span>Total Payable:</span>
              <span className="text-amber-400">{formatKsh(totalAmount)}</span>
            </div>
          </div>

          {/* Quick Actions (Hold Sale, Delivery Flag) */}
          <div className="flex items-center justify-between text-xs pt-1">
            <button
              onClick={() => {
                if (cart.length > 0) {
                  onParkSale(cart, selectedCustomer);
                  setCart([]);
                }
              }}
              disabled={cart.length === 0}
              className="text-slate-400 hover:text-white flex items-center gap-1 disabled:opacity-40"
            >
              <PauseCircle className="w-3.5 h-3.5" />
              <span>Hold Sale</span>
            </button>

            {featureFlags.deliveryManagement && (
              <label className="flex items-center gap-1.5 cursor-pointer text-slate-300">
                <input
                  type="checkbox"
                  checked={deliveryRequired}
                  onChange={e => setDeliveryRequired(e.target.checked)}
                  className="rounded bg-slate-950 border-slate-700 text-amber-500"
                />
                <span>Requires Site Delivery</span>
              </label>
            )}
          </div>

          {deliveryRequired && (
            <input
              type="text"
              placeholder="Enter building site delivery address..."
              value={deliveryAddress}
              onChange={e => setDeliveryAddress(e.target.value)}
              className="w-full bg-slate-950 text-xs border border-slate-700 rounded px-2.5 py-1.5 text-white placeholder-slate-500"
            />
          )}

          {/* Main Checkout Button */}
          <button
            onClick={initiateCheckout}
            disabled={cart.length === 0}
            className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg transition flex items-center justify-center gap-2 shadow-lg disabled:opacity-40 cursor-pointer text-sm"
          >
            <span>Proceed to Payment</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ======================================================= */}
      {/* SPLIT PAYMENT MODAL (Cash, M-Pesa, Card, Bank, Credit) */}
      {/* ======================================================= */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-xl max-h-[90vh] overflow-y-auto p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <span>Checkout & Split Payment</span>
                  <span className="text-amber-400">{formatKsh(totalAmount)}</span>
                </h3>
                <p className="text-xs text-slate-400">
                  Customer: {selectedCustomer?.name} • Branch: {activeBranch.name}
                </p>
              </div>
              <button
                onClick={() => setShowPaymentModal(false)}
                className="text-slate-400 hover:text-white font-bold text-lg"
              >
                ✕
              </button>
            </div>

            {/* Quick 1-Click Payment Method Presets */}
            <div className="grid grid-cols-4 gap-2 text-xs">
              <button
                onClick={() => setPaymentQuickMode('cash')}
                className="p-2 rounded bg-slate-800 hover:bg-slate-700 text-white font-medium border border-slate-700 flex flex-col items-center gap-1"
              >
                <DollarSign className="w-4 h-4 text-emerald-400" />
                <span>100% Cash</span>
              </button>
              <button
                onClick={() => setPaymentQuickMode('mpesa')}
                className="p-2 rounded bg-emerald-950/60 hover:bg-emerald-900/60 text-emerald-300 font-medium border border-emerald-700 flex flex-col items-center gap-1"
              >
                <Smartphone className="w-4 h-4 text-emerald-400" />
                <span>100% M-Pesa</span>
              </button>
              <button
                onClick={() => setPaymentQuickMode('split')}
                className="p-2 rounded bg-cyan-950/60 hover:bg-cyan-900/60 text-cyan-300 font-medium border border-cyan-700 flex flex-col items-center gap-1"
              >
                <Layers className="w-4 h-4 text-cyan-400" />
                <span>Cash + M-Pesa</span>
              </button>
              <button
                onClick={() => setPaymentQuickMode('credit')}
                disabled={!selectedCustomer?.creditAllowed}
                className="p-2 rounded bg-purple-950/60 hover:bg-purple-900/60 text-purple-300 font-medium border border-purple-700 flex flex-col items-center gap-1 disabled:opacity-30"
              >
                <FileText className="w-4 h-4 text-purple-400" />
                <span>Contractor Credit</span>
              </button>
            </div>

            {/* Error Banner */}
            {paymentError && (
              <div className="p-3 bg-red-950/60 border border-red-700 rounded-lg text-xs text-red-200 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <span>{paymentError}</span>
              </div>
            )}

            {/* Split Breakdown Inputs */}
            <div className="space-y-3 bg-slate-950 p-3.5 rounded-lg border border-slate-800 text-xs">
              {/* 1. CASH */}
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 w-32 font-medium text-emerald-400">
                  <DollarSign className="w-4 h-4" />
                  <span>Cash:</span>
                </div>
                <div className="flex-1 flex gap-2">
                  <input
                    type="number"
                    min="0"
                    placeholder="Amount Ksh"
                    value={cashAmount || ''}
                    onChange={e => setCashAmount(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-white font-bold text-right"
                  />
                  {cashAmount > 0 && (
                    <input
                      type="number"
                      placeholder="Tendered"
                      value={cashTendered || ''}
                      onChange={e => setCashTendered(parseFloat(e.target.value) || 0)}
                      className="w-32 bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-amber-300 text-right text-xs"
                      title="Customer Tendered Cash (For Change calculation)"
                    />
                  )}
                </div>
              </div>
              {cashAmount > 0 && cashTendered > cashAmount && (
                <div className="text-right text-[11px] text-amber-400 font-semibold pr-1">
                  Change Due: {formatKsh(cashTendered - cashAmount)}
                </div>
              )}

              {/* 2. M-PESA */}
              <div className="space-y-1 pt-2 border-t border-slate-850">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 w-32 font-medium text-emerald-400">
                    <Smartphone className="w-4 h-4" />
                    <span>M-Pesa:</span>
                  </div>
                  <div className="flex-1 flex gap-2">
                    <input
                      type="number"
                      min="0"
                      placeholder="Amount Ksh"
                      value={mpesaAmount || ''}
                      onChange={e => setMpesaAmount(parseFloat(e.target.value) || 0)}
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-white font-bold text-right"
                    />
                    <input
                      type="text"
                      placeholder="Ref (e.g. QKD92HS)"
                      value={mpesaReference}
                      onChange={e => setMpesaReference(e.target.value)}
                      className="w-36 bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-emerald-400 text-xs font-mono uppercase"
                    />
                  </div>
                </div>

                {mpesaAmount > 0 && (
                  <div className="flex items-center justify-between bg-emerald-950/30 p-2 rounded border border-emerald-900/50 mt-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-400">Phone:</span>
                      <input
                        type="text"
                        value={mpesaPhone}
                        onChange={e => setMpesaPhone(e.target.value)}
                        className="bg-slate-900 border border-slate-700 rounded px-2 py-0.5 text-white text-xs w-28"
                      />
                    </div>
                    <button
                      onClick={simulateMpesaPrompt}
                      disabled={mpesaStatus === 'prompted'}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-semibold px-2.5 py-1 rounded transition"
                    >
                      {mpesaStatus === 'prompted' ? 'Awaiting PIN...' : mpesaStatus === 'received' ? '✓ Confirmed' : 'Trigger STK Push'}
                    </button>
                  </div>
                )}
              </div>

              {/* 3. CARD & BANK TRANSFER */}
              <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-850">
                <div className="flex items-center gap-2 w-32 font-medium text-cyan-400">
                  <CreditCard className="w-4 h-4" />
                  <span>Card / Bank:</span>
                </div>
                <div className="flex-1 flex gap-2">
                  <input
                    type="number"
                    min="0"
                    placeholder="Card Amount"
                    value={cardAmount || ''}
                    onChange={e => setCardAmount(parseFloat(e.target.value) || 0)}
                    className="w-1/2 bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-white text-right"
                  />
                  <input
                    type="number"
                    min="0"
                    placeholder="Bank Transfer"
                    value={bankAmount || ''}
                    onChange={e => setBankAmount(parseFloat(e.target.value) || 0)}
                    className="w-1/2 bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-white text-right"
                  />
                </div>
              </div>

              {/* 4. CONTRACTOR CREDIT (ON ACCOUNT) */}
              <div className="space-y-1 pt-2 border-t border-slate-850">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 w-32 font-medium text-purple-400">
                    <FileText className="w-4 h-4" />
                    <span>Credit (Account):</span>
                  </div>
                  <div className="flex-1">
                    <input
                      type="number"
                      min="0"
                      disabled={!selectedCustomer?.creditAllowed}
                      placeholder={selectedCustomer?.creditAllowed ? 'Credit on Account' : 'Credit Not Allowed'}
                      value={creditAmount || ''}
                      onChange={e => setCreditAmount(parseFloat(e.target.value) || 0)}
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-purple-300 font-bold text-right disabled:opacity-40"
                    />
                  </div>
                </div>
                {selectedCustomer?.creditAllowed && (
                  <div className="text-[11px] text-slate-400 flex justify-between px-1">
                    <span>Terms: {selectedCustomer.creditPeriodDays} Days Net</span>
                    <span>Max Allowable: {formatKsh(Math.max(0, selectedCustomer.creditLimit - selectedCustomer.currentBalance))}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Total Balance Check Meter */}
            {(() => {
              const enteredTotal = cashAmount + mpesaAmount + cardAmount + bankAmount + creditAmount;
              const diff = totalAmount - enteredTotal;
              const isBalanced = Math.abs(diff) <= 1.0;
              return (
                <div className={`p-3 rounded-lg border text-xs flex items-center justify-between font-bold ${
                  isBalanced
                    ? 'bg-emerald-950/40 border-emerald-700 text-emerald-300'
                    : 'bg-amber-950/40 border-amber-700 text-amber-300'
                }`}>
                  <div>
                    <span>Total Paid: {formatKsh(enteredTotal)}</span>
                    <span className="text-slate-400 font-normal ml-2">/ Due: {formatKsh(totalAmount)}</span>
                  </div>
                  <div>
                    {isBalanced ? (
                      <span className="flex items-center gap-1 text-emerald-400">
                        <Check className="w-4 h-4" /> Fully Balanced
                      </span>
                    ) : (
                      <span>Remaining: {formatKsh(diff)}</span>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Complete Sale CTA */}
            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowPaymentModal(false)}
                className="w-1/3 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm font-semibold transition"
              >
                Back to Cart
              </button>
              <button
                type="button"
                onClick={handleFinalizeSale}
                disabled={isProcessingPayment}
                className="w-2/3 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg text-sm font-extrabold transition shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isProcessingPayment ? (
                  <span>Generating Invoice & eTIMS...</span>
                ) : (
                  <>
                    <Printer className="w-4 h-4" />
                    <span>Finalize Sale & Print Invoice</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================= */}
      {/* THERMAL RECEIPT & KRA eTIMS INVOICE MODAL               */}
      {/* ======================================================= */}
      {showReceiptModal && lastCompletedSale && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-md p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h3 className="font-bold text-white text-sm flex items-center gap-1.5">
                <Printer className="w-4 h-4 text-amber-400" />
                <span>Thermal Receipt & KRA eTIMS</span>
              </h3>
              <button
                onClick={() => setShowReceiptModal(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            {/* Receipt Paper Simulation (80mm Thermal Printer) */}
            <div className="bg-white text-slate-900 p-4 rounded font-mono text-[11px] shadow-inner space-y-2 border border-slate-300 select-text">
              <div className="text-center space-y-0.5 border-b border-dashed border-slate-400 pb-2">
                <div className="font-extrabold text-xs">{defaultPrinterConfig.shopName}</div>
                <div>{activeBranch.name}</div>
                <div>{defaultPrinterConfig.address}</div>
                <div>TEL: {activeBranch.phone}</div>
                <div className="font-bold">KRA PIN: {defaultPrinterConfig.kraPin}</div>
                <div className="font-bold">eTIMS CU: {defaultPrinterConfig.etimsCuNumber}</div>
              </div>

              <div className="text-[10px] space-y-0.5 pt-1">
                <div>INVOICE: <b>{lastCompletedSale.invoiceNumber}</b></div>
                <div>DATE: {formatDate(lastCompletedSale.date)}</div>
                <div>CASHIER: {lastCompletedSale.cashierName}</div>
                <div>CUSTOMER: {lastCompletedSale.customerName}</div>
                {lastCompletedSale.projectName && (
                  <div>PROJECT: {lastCompletedSale.projectName}</div>
                )}
              </div>

              <div className="border-t border-b border-dashed border-slate-400 py-1.5 space-y-1">
                <div className="flex justify-between font-bold text-[10px]">
                  <span>ITEM</span>
                  <span>QTY x PRICE</span>
                  <span>TOTAL</span>
                </div>
                {lastCompletedSale.items.map((it, idx) => (
                  <div key={idx} className="flex justify-between text-[10px]">
                    <span className="truncate max-w-[150px]">{it.name}</span>
                    <span>{it.soldQuantity} {it.unit}</span>
                    <span className="font-bold">{formatKsh(it.total)}</span>
                  </div>
                ))}
              </div>

              <div className="space-y-0.5 pt-1 text-[11px]">
                <div className="flex justify-between">
                  <span>Net Subtotal:</span>
                  <span>{formatKsh(lastCompletedSale.subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Kenya VAT (16%):</span>
                  <span>{formatKsh(lastCompletedSale.taxTotal)}</span>
                </div>
                <div className="flex justify-between text-xs font-extrabold border-t border-slate-300 pt-1">
                  <span>TOTAL:</span>
                  <span>{formatKsh(lastCompletedSale.totalAmount)}</span>
                </div>
              </div>

              {/* Payments breakdown */}
              <div className="border-t border-dashed border-slate-400 pt-1 text-[10px] space-y-0.5">
                {lastCompletedSale.payments.map((p, idx) => (
                  <div key={idx} className="flex justify-between">
                    <span>PAID VIA {p.method.toUpperCase()}:</span>
                    <span className="font-semibold">{formatKsh(p.amount)} {p.reference ? `(${p.reference})` : ''}</span>
                  </div>
                ))}
              </div>

              {/* KRA eTIMS Verification & QR */}
              <div className="border-t border-dashed border-slate-400 pt-2 text-center space-y-1">
                <div className="text-[10px] font-bold text-slate-800">
                  KRA eTIMS Control Code:
                </div>
                <div className="text-[9px] font-mono bg-slate-100 p-1 rounded border border-slate-300">
                  {lastCompletedSale.kraControlCode}
                </div>
                <div className="text-[9px] text-slate-500 pt-1">
                  Scan to verify on KRA Taxpayer Portal
                </div>
                <div className="text-[9px] italic text-slate-600 pt-1">
                  {defaultPrinterConfig.footerNote}
                </div>
              </div>
            </div>

            {/* Receipt Modal Actions */}
            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() => window.print()}
                className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 transition"
              >
                <Printer className="w-4 h-4" />
                <span>Print Thermal Receipt</span>
              </button>
              <button
                onClick={() => setShowEscPosViewer(!showEscPosViewer)}
                className="px-3 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium border border-slate-700"
                title="View raw ESC/POS hex commands for hardware receipt printers"
              >
                Raw ESC/POS
              </button>
            </div>

            {showEscPosViewer && (
              <pre className="bg-slate-950 text-emerald-400 p-3 rounded font-mono text-[10px] overflow-x-auto max-h-40 border border-slate-800">
                {generateEscPosHex(lastCompletedSale, activeBranch)}
              </pre>
            )}
          </div>
        </div>
      )}

      {/* ======================================================= */}
      {/* PARKED / HELD SALES DRAWER                              */}
      {/* ======================================================= */}
      {showParkedModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-lg p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <PauseCircle className="w-4 h-4 text-indigo-400" />
                <span>Parked / Held Sales ({parkedSales.length})</span>
              </h3>
              <button onClick={() => setShowParkedModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <div className="space-y-2 max-h-80 overflow-y-auto">
              {parkedSales.map(sale => (
                <div key={sale.id} className="p-3 bg-slate-950 rounded border border-slate-800 flex items-center justify-between text-xs">
                  <div>
                    <div className="font-bold text-white">{sale.customerName}</div>
                    <div className="text-slate-400">{sale.items.length} items • {formatKsh(sale.totalAmount)}</div>
                    <div className="text-[10px] text-slate-500">{formatDate(sale.date)}</div>
                  </div>
                  <button
                    onClick={() => {
                      onRestoreParkedSale(sale);
                      setShowParkedModal(false);
                    }}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded font-medium"
                  >
                    Recall to Cart
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
