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
import { Product, Customer, Sale, Branch, User, TillSession, FeatureFlags, CartItem } from '../types/index.ts';
import { formatKsh, formatKshExact, formatDate } from '../utils/formatters.ts';
import { defaultPrinterConfig, generateEscPosHex } from '../utils/receiptPrinter.ts';
import { OfflineSyncService } from '../services/offlineSync.ts';
import { MpesaService } from '../services/mpesaService.ts';

export type { CartItem };


interface POSScreenProps {
  products: Product[];
  customers: Customer[];
  sales: Sale[];
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
  sales,
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
  const [reportPeriod, setReportPeriod] = useState<'day' | 'week' | 'month' | 'all'>('day');

  // KPI Calculations based on selected period
  const now = new Date();
  const filteredPeriodSales = sales.filter(s => {
    const saleDate = new Date(s.date);
    if (reportPeriod === 'day') {
      return saleDate.toDateString() === now.toDateString();
    } else if (reportPeriod === 'week') {
      const diffDays = (now.getTime() - saleDate.getTime()) / (1000 * 3600 * 24);
      return diffDays <= 7;
    } else if (reportPeriod === 'month') {
      const diffDays = (now.getTime() - saleDate.getTime()) / (1000 * 3600 * 24);
      return diffDays <= 30;
    }
    return true;
  });

  const grossSalesPeriod = filteredPeriodSales.reduce((acc, s) => acc + s.totalAmount, 0);
  const kraVatPeriod = filteredPeriodSales.reduce((acc, s) => acc + s.taxTotal, 0);
  const cogsPeriod = filteredPeriodSales.reduce((acc, s) => {
    return acc + s.items.reduce((iAcc, item) => iAcc + (item.costPriceAtSale * item.baseUnitQuantity), 0);
  }, 0);
  const netGrossProfitPeriod = grossSalesPeriod - kraVatPeriod - cogsPeriod;
  const estimatedExpenses = Math.round(grossSalesPeriod * 0.06); // estimated operational / logistics expenses
  const totalInventoryValue = products.reduce((acc, p) => {
    const totalQty = Object.values(p.stockByBranch).reduce((q, b) => q + b, 0);
    return acc + (totalQty * p.costPrice);
  }, 0);

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
  const [mpesaStatus, setMpesaStatus] = useState<'idle' | 'pushing' | 'prompted' | 'received' | 'failed'>('idle');
  const [mpesaCheckoutReqId, setMpesaCheckoutReqId] = useState<string>('');
  const [mpesaStatusMsg, setMpesaStatusMsg] = useState<string>('');

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
    const gross = (item.quantity * item.unitPrice) - item.lineDiscountAmount - (item.discountKsh || 0);
    return sum + (gross / 1.16);
  }, 0);

  const cartTax = cart.reduce((sum, item) => {
    const gross = (item.quantity * item.unitPrice) - item.lineDiscountAmount - (item.discountKsh || 0);
    return sum + (gross - (gross / 1.16));
  }, 0);

  const cartGross = cart.reduce((sum, item) => {
    return sum + (item.quantity * item.unitPrice) - item.lineDiscountAmount - (item.discountKsh || 0);
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
          lineDiscountAmount: 0,
          discountKsh: 0,
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

  // Update Cart line discount Ksh
  const updateDiscountKsh = (index: number, discountKsh: number) => {
    const cleanDiscount = Math.max(0, discountKsh);
    setCart(prev => {
      const next = [...prev];
      next[index].discountKsh = cleanDiscount;
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
        let price = unitDef.sellingPrice;
        if (selectedCustomer?.priceTier === 'contractor' && newUnit === item.product.baseUnit) {
          price = item.product.contractorPrice;
        } else if (selectedCustomer?.priceTier === 'wholesale' && newUnit === item.product.baseUnit) {
          price = item.product.wholesalePrice;
        }
        item.unitPrice = price;
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
    setMpesaStatusMsg('');
    setMpesaCheckoutReqId('');

    // Default payment method: If customer is contractor, suggest M-Pesa or Split, or full cash
    setCashAmount(totalAmount);
    setCashTendered(totalAmount);
    setMpesaAmount(0);
    setMpesaReference('');
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
    setMpesaStatus('idle');
    setMpesaStatusMsg('');

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

  // Trigger M-Pesa Daraja 2.0 STK Push and poll payment status
  const handleTriggerSTKPush = async () => {
    if (!mpesaAmount || mpesaAmount <= 0) {
      setPaymentError('Please enter a valid M-Pesa amount to request payment.');
      return;
    }
    if (!mpesaPhone || mpesaPhone.trim().length < 8) {
      setPaymentError('Please enter a valid customer phone number (e.g. 0712345678).');
      return;
    }

    setPaymentError(null);
    setMpesaStatus('pushing');
    setMpesaStatusMsg('Connecting to Safaricom Daraja 2.0 Gateway...');

    try {
      const response = await MpesaService.initiateSTKPush({
        phone: mpesaPhone,
        amount: mpesaAmount,
        accountReference: `INV-${Date.now().toString().slice(-5)}`,
        transactionDesc: `Hardware Sale Payment for ${selectedCustomer?.name || 'Walk-in Customer'}`
      });

      setMpesaCheckoutReqId(response.CheckoutRequestID);
      setMpesaStatus('prompted');
      setMpesaStatusMsg(`📱 STK PIN prompt sent to ${MpesaService.formatPhoneNumber(mpesaPhone)}. Waiting for customer authorization on handset...`);

      // Poll Daraja API for live transaction confirmation
      MpesaService.pollTransactionStatus(response.CheckoutRequestID, {
        onStatusUpdate: (res) => {
          if (res.Status === 'PENDING') {
            setMpesaStatusMsg(`📱 STK Prompt active on ${MpesaService.formatPhoneNumber(mpesaPhone)} (Ksh ${mpesaAmount.toLocaleString()}). Waiting for customer M-Pesa PIN...`);
          }
        },
        onSuccess: (res) => {
          setMpesaStatus('received');
          const receiptCode = res.MpesaReceiptNumber || `QKD${Math.floor(100000 + Math.random() * 900000)}X`;
          setMpesaReference(receiptCode);
          setMpesaStatusMsg(`✓ Payment Confirmed! Safaricom Receipt #${receiptCode}. Amount Ksh ${res.Amount.toLocaleString()} received.`);
        },
        onFailure: (errorMsg) => {
          setMpesaStatus('failed');
          setMpesaStatusMsg(errorMsg || 'M-Pesa payment failed or was cancelled by user.');
        }
      });
    } catch (err: any) {
      setMpesaStatus('failed');
      setMpesaStatusMsg(err.message || 'Failed to trigger M-Pesa STK Push');
      setPaymentError(err.message || 'STK Push Initiation Failed');
    }
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
        discountQuantity: item.discountQuantity || 0,
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
        items: cart.map(item => {
          const unitDef = item.product.availableUnits.find(u => u.unit === item.selectedUnit);
          const factor = unitDef?.conversionFactor || 1;
          const manualDiscountAmount = item.discountQuantity || 0;
          const totalPhysicalQty = item.quantity + manualDiscountAmount;
          const baseQty = totalPhysicalQty * factor;
          const lineTotal = (item.quantity * item.unitPrice) - item.discount;
          const taxAmt = Math.round((lineTotal * 0.16 / 1.16) * 100) / 100;

          return {
            productId: item.product.id,
            sku: item.product.sku,
            name: item.product.name,
            unit: item.selectedUnit,
            soldQuantity: item.quantity,
            discountQuantity: manualDiscountAmount,
            baseUnitQuantity: baseQty,
            unitPrice: item.unitPrice,
            costPriceAtSale: item.product.costPrice,
            discountAmount: item.discount,
            taxRate: 0.16,
            taxAmount: taxAmt,
            total: lineTotal
          };
        }),
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
        body: JSON.stringify({
          ...salePayload,
          items: salePayload.items.map(i => ({
            ...i,
            discountQuantity: i.discountQuantity || 0
          }))
        })
      });

      if (!response.ok) {
        let errorMessage = 'Failed to process sale';
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.indexOf("application/json") !== -1) {
            const errData = await response.json();
            errorMessage = errData.error || errorMessage;
        } else {
            errorMessage = await response.text();
        }
        throw new Error(errorMessage);
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
    <div className="flex flex-col lg:flex-row min-h-[calc(100vh-80px)] lg:h-[calc(100vh-80px)] overflow-y-auto lg:overflow-hidden bg-slate-50">
      {/* LEFT COLUMN: Dashboard KPI Bar & Product Catalog */}
      <div className="flex-1 flex flex-col border-b lg:border-b-0 lg:border-r border-sky-100 min-h-0 lg:h-full lg:overflow-hidden">
        {/* POS Dashboard KPI Summary Bar with Period Filter */}
        <div className="shrink-0 p-3 bg-white border-b border-sky-100 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-sky-800 uppercase tracking-wider">
              📊 Live Business Performance KPIs
            </span>
            {/* Period Filter Buttons (Day, Week, Month, All) */}
            <div className="flex bg-sky-50 p-1 rounded-lg border border-sky-200 text-[11px]">
              <button
                onClick={() => setReportPeriod('day')}
                className={`px-2.5 py-0.5 rounded font-medium transition cursor-pointer ${
                  reportPeriod === 'day' ? 'bg-sky-600 text-white font-bold shadow-2xs' : 'text-slate-600 hover:text-sky-900'
                }`}
              >
                Day
              </button>
              <button
                onClick={() => setReportPeriod('week')}
                className={`px-2.5 py-0.5 rounded font-medium transition cursor-pointer ${
                  reportPeriod === 'week' ? 'bg-sky-600 text-white font-bold shadow-2xs' : 'text-slate-600 hover:text-sky-900'
                }`}
              >
                Week
              </button>
              <button
                onClick={() => setReportPeriod('month')}
                className={`px-2.5 py-0.5 rounded font-medium transition cursor-pointer ${
                  reportPeriod === 'month' ? 'bg-sky-600 text-white font-bold shadow-2xs' : 'text-slate-600 hover:text-sky-900'
                }`}
              >
                Month
              </button>
              <button
                onClick={() => setReportPeriod('all')}
                className={`px-2.5 py-0.5 rounded font-medium transition cursor-pointer ${
                  reportPeriod === 'all' ? 'bg-sky-600 text-white font-bold shadow-2xs' : 'text-slate-600 hover:text-sky-900'
                }`}
              >
                All
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
            <div className="bg-sky-50/60 p-2 rounded-lg border border-sky-100 shadow-2xs">
              <span className="text-slate-500 block text-[10px] font-medium">Inventory Value:</span>
              <span className="font-bold text-sky-700 font-mono text-xs">{formatKsh(totalInventoryValue)}</span>
            </div>
            <div className="bg-sky-50/60 p-2 rounded-lg border border-sky-100 shadow-2xs">
              <span className="text-slate-500 block text-[10px] font-medium">Gross Sales ({reportPeriod}):</span>
              <span className="font-bold text-slate-900 font-mono text-xs">{formatKsh(grossSalesPeriod)}</span>
            </div>
            <div className="bg-sky-50/60 p-2 rounded-lg border border-sky-100 shadow-2xs">
              <span className="text-slate-500 block text-[10px] font-medium">Net Gross Profit:</span>
              <span className="font-bold text-emerald-700 font-mono text-xs">{formatKsh(netGrossProfitPeriod)}</span>
            </div>
            <div className="bg-sky-50/60 p-2 rounded-lg border border-sky-100 shadow-2xs">
              <span className="text-slate-500 block text-[10px] font-medium">Est. Expenses:</span>
              <span className="font-bold text-rose-600 font-mono text-xs">{formatKsh(estimatedExpenses)}</span>
            </div>
            <div className="bg-sky-50/60 p-2 rounded-lg border border-sky-100 shadow-2xs col-span-2 sm:col-span-1">
              <span className="text-slate-500 block text-[10px] font-medium">KRA VAT (16%):</span>
              <span className="font-bold text-sky-800 font-mono text-xs">{formatKsh(kraVatPeriod)}</span>
            </div>
          </div>
        </div>

        {/* Search Bar & Barcode Scanner wedge listener */}
        <div className="shrink-0 p-3 bg-white border-b border-sky-100 flex flex-wrap items-center gap-2.5">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="Search cement, steel rebar, paint, pipe, SKU or brand..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 focus:bg-white rounded-lg pl-9 pr-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition"
            />
          </div>

          {/* Barcode Test Simulator input */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5">
            <Barcode className="w-4 h-4 text-sky-600" />
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
              className="w-32 bg-transparent text-xs text-slate-900 focus:outline-none placeholder-slate-400 font-mono"
            />
          </div>
        </div>

        {/* Category Filter Chips */}
        <div className="shrink-0 px-3 py-2 bg-sky-50/50 border-b border-sky-100 flex items-center gap-1.5 overflow-x-auto scrollbar-thin">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                selectedCategory === cat
                  ? 'bg-sky-600 text-white shadow-2xs'
                  : 'bg-white text-slate-600 border border-sky-200 hover:bg-sky-50 hover:text-sky-900'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Products Grid */}
        <div className="flex-1 overflow-y-auto p-3 grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2.5 scrollbar-thin">
          {filteredProducts.map(product => {
            const currentStock = product.stockByBranch[activeBranch.id] || 0;
            const isLowStock = currentStock <= product.minStockAlert;
            const isOutOfStock = currentStock <= 0;

            return (
              <div
                key={product.id}
                onClick={() => !isOutOfStock && addToCart(product)}
                className={`bg-white border rounded-xl p-3 flex flex-col justify-between transition select-none shadow-2xs hover:shadow-md ${
                  isOutOfStock
                    ? 'border-rose-200 opacity-60 bg-rose-50/30 cursor-not-allowed'
                    : isLowStock
                    ? 'border-amber-300 hover:border-sky-500 cursor-pointer'
                    : 'border-sky-100 hover:border-sky-400 cursor-pointer'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-1 mb-1">
                    <span className="text-[10px] font-mono text-slate-500 bg-sky-50 px-1.5 py-0.5 rounded border border-sky-200">
                      {product.sku}
                    </span>
                    <span
                      className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                        isOutOfStock
                          ? 'bg-rose-50 text-rose-700 border border-rose-200'
                          : isLowStock
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      }`}
                    >
                      {isOutOfStock ? 'Out of stock' : `In stock: ${currentStock} ${product.baseUnit}`}
                    </span>
                  </div>

                  <h3 className="font-semibold text-xs text-slate-900 line-clamp-2 leading-tight">
                    {product.name}
                  </h3>
                  <div className="flex items-center justify-between text-[11px] text-slate-500 mt-0.5">
                    <span>{product.brand}</span>
                    <span className="text-[10px] text-slate-400 font-medium">VAT 16% Inc.</span>
                  </div>
                </div>

                <div className="mt-2.5 pt-2 border-t border-sky-100 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-black text-sky-700">
                      {formatKsh(product.retailPrice)}
                    </div>
                    <div className="text-[10px] text-slate-500">
                      per {product.baseUnit}
                    </div>
                  </div>

                  {/* Multi-unit indicator tag */}
                  {product.availableUnits.length > 1 && (
                    <span className="text-[10px] bg-sky-50 text-sky-800 font-semibold px-1.5 py-0.5 rounded border border-sky-200">
                      {product.availableUnits.map(u => u.unit).join(' / ')}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* RIGHT COLUMN: Fast Checkout & Cart (Dedicated Flex-Column Structure) */}
      <div className="w-full lg:w-[420px] xl:w-[460px] flex flex-col bg-white border-t lg:border-t-0 lg:border-l border-sky-100 shrink-0 min-h-[450px] lg:h-full overflow-visible lg:overflow-hidden">
        {/* Fixed Header: Customer Selector & Contractor Project */}
        <div className="shrink-0 p-3 bg-white border-b border-sky-100 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <span>Customer Account</span>
              {selectedCustomer?.type === 'contractor' && (
                <span className="bg-sky-100 text-sky-800 text-[10px] px-1.5 py-0.5 rounded font-bold">
                  Contractor Tier
                </span>
              )}
            </span>

            {/* Held Sales Button */}
            {parkedSales.length > 0 && (
              <button
                onClick={() => setShowParkedModal(true)}
                className="text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 px-2.5 py-1 rounded-md hover:bg-indigo-100 flex items-center gap-1 font-semibold cursor-pointer"
              >
                <PauseCircle className="w-3.5 h-3.5 text-indigo-600" />
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
              className="flex-1 bg-sky-50/50 text-slate-900 text-xs border border-sky-200 rounded-lg px-2.5 py-1.5 focus:bg-white focus:outline-none focus:border-sky-500 font-medium cursor-pointer"
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
              <span className="text-slate-500 font-medium whitespace-nowrap">Site / Project:</span>
              <select
                value={selectedProjectId}
                onChange={e => setSelectedProjectId(e.target.value)}
                className="w-full bg-sky-50/50 text-sky-900 font-semibold text-xs border border-sky-200 rounded-lg px-2 py-1 focus:bg-white focus:outline-none"
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
            <div className="bg-sky-50/60 p-2 rounded-lg border border-sky-100 text-[11px] flex justify-between items-center">
              <div>
                <span className="text-slate-500 font-medium">Credit Limit: </span>
                <span className="font-bold text-slate-900">{formatKsh(selectedCustomer.creditLimit)}</span>
              </div>
              <div>
                <span className="text-slate-500 font-medium">Avail: </span>
                <span className={`font-bold ${selectedCustomer.creditLimit - selectedCustomer.currentBalance < 50000 ? 'text-rose-600' : 'text-emerald-700'}`}>
                  {formatKsh(Math.max(0, selectedCustomer.creditLimit - selectedCustomer.currentBalance))}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Cart Line Items List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-slate-50/40">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-2 select-none">
              <Barcode className="w-10 h-10 opacity-30 text-sky-600" />
              <p className="text-sm font-medium text-slate-500">Scan barcode or click items to add to cart</p>
              <span className="text-xs text-slate-400">Hardware counter checkout ready</span>
            </div>
          ) : (
            cart.map((item, index) => {
              const unitDef = item.product.availableUnits.find(u => u.unit === item.selectedUnit);
              const convFactor = unitDef?.conversionFactor || 1;
              const manualDiscountAmount = item.discountQuantity || 0;
              const totalPhysicalQty = item.quantity + manualDiscountAmount;
              const totalBaseDeduction = totalPhysicalQty * convFactor;
              const lineTotal = (item.quantity * item.unitPrice) - item.discount;

              return (
                <div
                  key={`${item.product.id}-${item.selectedUnit}-${index}`}
                  className="bg-white border border-sky-100 rounded-xl p-3 flex flex-col gap-2.5 shadow-2xs hover:border-sky-300 transition"
                >
                  {/* Top row: Name, SKU & Delete */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="font-semibold text-xs text-slate-900 leading-tight">
                        {item.product.name}
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono mt-0.5 flex items-center gap-2">
                        <span>{item.product.sku}</span>
                        <span className="text-sky-800 bg-sky-50 px-1.5 py-0.2 rounded text-[9px] border border-sky-200 font-semibold">
                          {convFactor !== 1 ? `1 ${item.selectedUnit} = ${convFactor} ${item.product.baseUnit}s` : `Base: ${item.product.baseUnit}`}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => removeFromCart(index)}
                      className="text-slate-400 hover:text-rose-600 p-1 transition cursor-pointer"
                      title="Remove line item"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Middle row: UoM Selector, Quantity Controls & Bonus Controls */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-center text-xs pt-1.5 border-t border-sky-100">
                    {/* 1. Unit of Measure Switcher */}
                    <div className="flex flex-col gap-1">
                      <span className="text-slate-500 text-[10px] uppercase font-bold">Unit (UoM)</span>
                      <select
                        value={item.selectedUnit}
                        onChange={e => switchItemUnit(index, e.target.value)}
                        className="bg-sky-50 text-sky-900 font-extrabold text-xs border border-sky-200 rounded-md px-2 py-1 focus:bg-white focus:outline-none focus:border-sky-500 cursor-pointer"
                      >
                        {item.product.availableUnits.map(u => (
                          <option key={u.unit} value={u.unit}>
                            {u.unit} (@ {formatKsh(u.sellingPrice)})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* 2. Billable Quantity Controls */}
                    <div className="flex flex-col gap-1">
                      <span className="text-slate-500 text-[10px] uppercase font-bold">Bill Qty</span>
                      <div className="flex items-center border border-sky-200 rounded-md bg-sky-50/50">
                        <button
                          onClick={() => updateQuantity(index, item.quantity - 1)}
                          className="px-2 py-1 text-slate-500 hover:text-slate-900 transition cursor-pointer"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <input
                          type="number"
                          min="1"
                          step="any"
                          value={item.quantity}
                          onChange={e => updateQuantity(index, parseFloat(e.target.value) || 1)}
                          className="w-12 text-center bg-transparent text-slate-900 font-bold text-xs focus:outline-none"
                        />
                        <button
                          onClick={() => updateQuantity(index, item.quantity + 1)}
                          className="px-2 py-1 text-slate-500 hover:text-slate-900 transition cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                      {/* 3. Discount Amount Input (Ksh) */}
                      <div className="flex flex-col gap-1">
                        <span className="text-sky-800 text-[10px] uppercase font-bold flex items-center gap-1">
                          <span>Discount (Ksh)</span>
                        </span>
                        <input
                          type="number"
                          min="0"
                          step="10"
                          placeholder="0"
                          value={item.discountKsh || ''}
                          onChange={e => updateDiscountKsh(index, parseFloat(e.target.value) || 0)}
                          className="w-full bg-white border border-sky-300 rounded-md px-2 py-1.5 text-sky-900 font-bold text-xs focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                        />
                      </div>
                    </div>

                    {/* Bottom Info Bar: Discount Badge, Stock Deduction & Line Subtotal */}
                    <div className="flex items-center justify-between text-xs pt-1.5 border-t border-sky-100">
                      <div className="flex items-center gap-2 flex-wrap">
                        {item.discountKsh > 0 && (
                          <span className="bg-sky-50 text-sky-800 border border-sky-300 px-2 py-0.5 rounded text-[10px] font-extrabold flex items-center gap-1 shadow-2xs">
                            <span>🏷️</span>
                            <span>Discount: {formatKsh(item.discountKsh)}</span>
                          </span>
                        )}
                      <span className="text-[10px] text-sky-800 font-mono font-medium">
                        Deducts: <strong>{totalBaseDeduction} {item.product.baseUnit}s</strong>
                      </span>
                    </div>

                    <div className="text-right">
                      <div className="font-black text-sky-700 text-xs font-mono">
                        {formatKsh(lineTotal)}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        @{formatKsh(item.unitPrice)} / {item.selectedUnit}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Cart Summary & Checkout Action */}
        <div className="shrink-0 p-3 bg-white border-t border-sky-100 space-y-2.5 shadow-xs">
          {/* Subtotal, VAT & Discount Breakdown */}
          <div className="space-y-1 text-xs">
            <div className="flex justify-between text-slate-600 font-medium">
              <span>Subtotal (Net):</span>
              <span className="font-mono">{formatKsh(cartSubtotal)}</span>
            </div>
            <div className="flex justify-between text-slate-600 font-medium">
              <span>Kenya VAT 16% (eTIMS):</span>
              <span className="font-mono">{formatKsh(cartTax)}</span>
            </div>
            {orderDiscount > 0 && (
              <div className="flex justify-between text-emerald-700 font-bold">
                <span>Discount:</span>
                <span className="font-mono">-{formatKsh(orderDiscount)}</span>
              </div>
            )}
            <div className="flex justify-between text-base font-black text-slate-900 pt-1.5 border-t border-sky-100">
              <span>Total Payable:</span>
              <span className="text-sky-700 font-mono">{formatKsh(totalAmount)}</span>
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
              className="text-slate-600 hover:text-slate-900 flex items-center gap-1 disabled:opacity-40 font-semibold cursor-pointer"
            >
              <PauseCircle className="w-3.5 h-3.5 text-sky-600" />
              <span>Hold Sale</span>
            </button>

            {featureFlags.deliveryManagement && (
              <label className="flex items-center gap-1.5 cursor-pointer text-slate-700 font-medium">
                <input
                  type="checkbox"
                  checked={deliveryRequired}
                  onChange={e => setDeliveryRequired(e.target.checked)}
                  className="rounded bg-sky-50 border-sky-300 text-sky-600 focus:ring-sky-500"
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
              className="w-full bg-sky-50/50 text-xs border border-sky-200 rounded-lg px-2.5 py-1.5 text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-sky-500"
            />
          )}

          {/* Main Checkout Button */}
          <button
            onClick={initiateCheckout}
            disabled={cart.length === 0}
            className="w-full py-3.5 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-xl transition flex items-center justify-center gap-2 shadow-lg shadow-sky-600/20 disabled:opacity-40 cursor-pointer text-sm"
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
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-sky-200 rounded-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-sky-100 pb-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <span>Checkout & Split Payment</span>
                  <span className="text-sky-700 font-mono">{formatKsh(totalAmount)}</span>
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  Customer: {selectedCustomer?.name} • Branch: {activeBranch.name}
                </p>
              </div>
              <button
                onClick={() => setShowPaymentModal(false)}
                className="text-slate-400 hover:text-slate-700 font-bold text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Quick 1-Click Payment Method Presets */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <button
                onClick={() => setPaymentQuickMode('cash')}
                className="p-2.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-900 font-bold border border-emerald-200 flex flex-col items-center gap-1 cursor-pointer transition shadow-2xs"
              >
                <DollarSign className="w-4 h-4 text-emerald-600" />
                <span>100% Cash</span>
              </button>
              <button
                onClick={() => setPaymentQuickMode('mpesa')}
                className="p-2.5 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-900 font-bold border border-sky-200 flex flex-col items-center gap-1 cursor-pointer transition shadow-2xs"
              >
                <Smartphone className="w-4 h-4 text-sky-600" />
                <span>100% M-Pesa</span>
              </button>
              <button
                onClick={() => setPaymentQuickMode('split')}
                className="p-2.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-900 font-bold border border-indigo-200 flex flex-col items-center gap-1 cursor-pointer transition shadow-2xs"
              >
                <Layers className="w-4 h-4 text-indigo-600" />
                <span>Cash + M-Pesa</span>
              </button>
              <button
                onClick={() => setPaymentQuickMode('credit')}
                disabled={!selectedCustomer?.creditAllowed}
                className="p-2.5 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-900 font-bold border border-purple-200 flex flex-col items-center gap-1 cursor-pointer transition shadow-2xs disabled:opacity-30"
              >
                <FileText className="w-4 h-4 text-purple-600" />
                <span>Contractor Credit</span>
              </button>
            </div>

            {/* Error Banner */}
            {paymentError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-start gap-2 font-medium">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{paymentError}</span>
              </div>
            )}

            {/* Split Breakdown Inputs */}
            <div className="space-y-3 bg-sky-50/60 p-3.5 rounded-xl border border-sky-100 text-xs">
              {/* 1. CASH */}
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 w-32 font-bold text-emerald-700">
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
                    className="w-full bg-white border border-slate-300 rounded-md px-2.5 py-1.5 text-slate-900 font-bold text-right focus:outline-none focus:border-sky-500"
                  />
                  {cashAmount > 0 && (
                    <input
                      type="number"
                      placeholder="Tendered"
                      value={cashTendered || ''}
                      onChange={e => setCashTendered(parseFloat(e.target.value) || 0)}
                      className="w-32 bg-white border border-slate-300 rounded-md px-2 py-1.5 text-sky-800 font-bold text-right text-xs focus:outline-none focus:border-sky-500"
                      title="Customer Tendered Cash (For Change calculation)"
                    />
                  )}
                </div>
              </div>
              {cashAmount > 0 && cashTendered > cashAmount && (
                <div className="text-right text-[11px] text-sky-800 font-bold pr-1">
                  Change Due: {formatKsh(cashTendered - cashAmount)}
                </div>
              )}

              {/* 2. M-PESA DARAJA 2.0 STK PUSH */}
              <div className="space-y-2 pt-2 border-t border-sky-100">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 w-32 font-bold text-sky-700">
                    <Smartphone className="w-4 h-4 text-sky-600 shrink-0" />
                    <span>M-Pesa STK:</span>
                  </div>
                  <div className="flex-1 flex gap-2">
                    <input
                      type="number"
                      min="0"
                      placeholder="Amount Ksh"
                      value={mpesaAmount || ''}
                      onChange={e => setMpesaAmount(parseFloat(e.target.value) || 0)}
                      className="w-full bg-white border border-slate-300 rounded-md px-2.5 py-1.5 text-slate-900 font-bold text-right focus:outline-none focus:border-sky-500"
                    />
                    <input
                      type="text"
                      placeholder="Ref / Receipt #"
                      value={mpesaReference}
                      onChange={e => setMpesaReference(e.target.value)}
                      className="w-36 bg-white border border-slate-300 rounded-md px-2 py-1.5 text-emerald-700 text-xs font-mono uppercase font-extrabold focus:outline-none focus:border-sky-500"
                    />
                  </div>
                </div>

                {mpesaAmount > 0 && (
                  <div className="bg-emerald-50/80 p-3 rounded-xl border border-emerald-200 space-y-2.5 mt-1 shadow-2xs">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-1">
                        <span className="text-slate-600 font-medium text-xs whitespace-nowrap">Mobile Phone:</span>
                        <input
                          type="text"
                          placeholder="e.g. 0712345678"
                          value={mpesaPhone}
                          onChange={e => setMpesaPhone(e.target.value)}
                          className="bg-white border border-slate-300 rounded-md px-2.5 py-1 text-slate-900 text-xs font-mono font-bold w-36 focus:outline-none focus:border-emerald-500"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={handleTriggerSTKPush}
                        disabled={mpesaStatus === 'pushing' || mpesaStatus === 'prompted'}
                        className={`px-3.5 py-1.5 rounded-md text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer ${
                          mpesaStatus === 'received'
                            ? 'bg-emerald-600 text-white'
                            : mpesaStatus === 'failed'
                            ? 'bg-sky-600 hover:bg-sky-500 text-white'
                            : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                        } disabled:opacity-50`}
                      >
                        {mpesaStatus === 'pushing' ? (
                          <span className="animate-pulse">Connecting...</span>
                        ) : mpesaStatus === 'prompted' ? (
                          <span className="animate-pulse flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                            Awaiting PIN...
                          </span>
                        ) : mpesaStatus === 'received' ? (
                          <span>✓ Confirmed</span>
                        ) : mpesaStatus === 'failed' ? (
                          <span>Retry STK Push</span>
                        ) : (
                          <span>Trigger STK Push</span>
                        )}
                      </button>
                    </div>

                    {/* M-Pesa Live Status Alert Container */}
                    {mpesaStatus !== 'idle' && (
                      <div className={`p-2.5 rounded-md border text-xs space-y-1 ${
                        mpesaStatus === 'received'
                          ? 'bg-emerald-100/80 border-emerald-300 text-emerald-900'
                          : mpesaStatus === 'failed'
                          ? 'bg-rose-50 border-rose-200 text-rose-800'
                          : 'bg-white border-emerald-300 text-emerald-800'
                      }`}>
                        <div className="flex items-center justify-between font-bold">
                          <span className="flex items-center gap-1.5">
                            {mpesaStatus === 'received' ? (
                              <Check className="w-4 h-4 text-emerald-600" />
                            ) : mpesaStatus === 'failed' ? (
                              <AlertTriangle className="w-4 h-4 text-rose-600" />
                            ) : (
                              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                            )}
                            <span>Safaricom Daraja 2.0 Gateway</span>
                          </span>
                          {mpesaReference && (
                            <span className="font-mono bg-white px-2 py-0.5 rounded border border-emerald-300 text-emerald-800 text-[11px]">
                              {mpesaReference}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] leading-relaxed font-medium">{mpesaStatusMsg}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* 3. CARD & BANK TRANSFER */}
              <div className="flex items-center justify-between gap-3 pt-2 border-t border-sky-100">
                <div className="flex items-center gap-2 w-32 font-bold text-sky-700">
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
                    className="w-1/2 bg-white border border-slate-300 rounded-md px-2.5 py-1.5 text-slate-900 text-right focus:outline-none focus:border-sky-500 font-bold"
                  />
                  <input
                    type="number"
                    min="0"
                    placeholder="Bank Transfer"
                    value={bankAmount || ''}
                    onChange={e => setBankAmount(parseFloat(e.target.value) || 0)}
                    className="w-1/2 bg-white border border-slate-300 rounded-md px-2.5 py-1.5 text-slate-900 text-right focus:outline-none focus:border-sky-500 font-bold"
                  />
                </div>
              </div>

              {/* 4. CONTRACTOR CREDIT (ON ACCOUNT) */}
              <div className="space-y-1 pt-2 border-t border-sky-100">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 w-32 font-bold text-purple-700">
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
                      className="w-full bg-white border border-slate-300 rounded-md px-2.5 py-1.5 text-purple-900 font-extrabold text-right disabled:opacity-40 focus:outline-none focus:border-purple-500"
                    />
                  </div>
                </div>
                {selectedCustomer?.creditAllowed && (
                  <div className="text-[11px] text-slate-500 flex justify-between px-1 font-medium">
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
                <div className={`p-3 rounded-xl border text-xs flex items-center justify-between font-bold ${
                  isBalanced
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-amber-50 border-amber-200 text-amber-800'
                }`}>
                  <div>
                    <span>Total Paid: {formatKsh(enteredTotal)}</span>
                    <span className="text-slate-500 font-medium ml-2">/ Due: {formatKsh(totalAmount)}</span>
                  </div>
                  <div>
                    {isBalanced ? (
                      <span className="flex items-center gap-1 text-emerald-700 font-black">
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
                className="w-1/3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-semibold transition cursor-pointer"
              >
                Back to Cart
              </button>
              <button
                type="button"
                onClick={handleFinalizeSale}
                disabled={isProcessingPayment}
                className="w-2/3 py-2.5 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-sm font-extrabold transition shadow-lg shadow-sky-600/20 flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
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
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 print:p-0 print:static print:bg-white">
          <div className="bg-white border border-sky-200 rounded-2xl w-full max-w-md p-5 space-y-4 shadow-2xl print:border-none print:shadow-none print:p-0 print:max-w-full">
            <div className="flex items-center justify-between border-b border-sky-100 pb-2 no-print">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                <Printer className="w-4 h-4 text-sky-600" />
                <span>Thermal Receipt & KRA eTIMS</span>
              </h3>
              <button
                onClick={() => setShowReceiptModal(false)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer font-bold"
              >
                ✕
              </button>
            </div>

            {/* Receipt Paper Simulation (80mm Thermal Printer) */}
            <div className="bg-slate-50 text-slate-900 p-4 rounded-xl font-mono text-[11px] shadow-inner space-y-2 border border-slate-200 select-text printable-receipt print:border-none print:bg-white print:p-0">
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
                  <div key={idx} className="flex flex-col text-[10px] border-b border-slate-200/60 pb-1">
                    <div className="flex justify-between">
                      <span className="truncate max-w-[150px] font-semibold">{it.name}</span>
                      <span>{it.soldQuantity} {it.unit}</span>
                      <span className="font-bold">{formatKsh(it.total)}</span>
                    </div>
                    {it.discountQuantity && it.discountQuantity > 0 ? (
                      <div className="text-emerald-700 text-[9px] font-bold flex items-center gap-1 pl-2 pt-0.5">
                        <span>🏷️ DISCOUNT: +{it.discountQuantity} {it.unit} FREE</span>
                      </div>
                    ) : null}
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
                <div className="text-[9px] font-mono bg-white p-1 rounded border border-slate-300">
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
            <div className="flex items-center gap-2 pt-2 no-print">
              <button
                onClick={() => window.print()}
                className="flex-1 py-2.5 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition shadow-md cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Print Thermal Receipt</span>
              </button>
              <button
                onClick={() => setShowEscPosViewer(!showEscPosViewer)}
                className="px-3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold border border-slate-200 cursor-pointer"
                title="View raw ESC/POS hex commands for hardware receipt printers"
              >
                Raw ESC/POS
              </button>
            </div>

            {showEscPosViewer && (
              <pre className="bg-slate-900 text-emerald-400 p-3 rounded-lg font-mono text-[10px] overflow-x-auto max-h-40 border border-slate-800 no-print">
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
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-sky-200 rounded-2xl w-full max-w-lg p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-sky-100 pb-2">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <PauseCircle className="w-4 h-4 text-indigo-600" />
                <span>Parked / Held Sales ({parkedSales.length})</span>
              </h3>
              <button onClick={() => setShowParkedModal(false)} className="text-slate-400 hover:text-slate-700 cursor-pointer font-bold">✕</button>
            </div>

            <div className="space-y-2 max-h-80 overflow-y-auto">
              {parkedSales.map(sale => (
                <div key={sale.id} className="p-3 bg-sky-50/50 rounded-xl border border-sky-100 flex items-center justify-between text-xs">
                  <div>
                    <div className="font-bold text-slate-900">{sale.customerName}</div>
                    <div className="text-slate-600 font-medium">{sale.items.length} items • {formatKsh(sale.totalAmount)}</div>
                    <div className="text-[10px] text-slate-400">{formatDate(sale.date)}</div>
                  </div>
                  <button
                    onClick={() => {
                      const restoredCart: CartItem[] = sale.items.map(it => {
                        const prod = products.find(p => p.id === it.productId) || {
                          id: it.productId,
                          sku: it.sku,
                          name: it.name,
                          baseUnit: it.unit,
                          retailPrice: it.unitPrice,
                          costPrice: it.costPriceAtSale || 0,
                          category: 'General',
                          brand: 'General',
                          active: true,
                          minStockAlert: 5,
                          stockByBranch: {},
                          availableUnits: [{ unit: it.unit, conversionFactor: 1, sellingPrice: it.unitPrice }]
                        } as any;
                        return {
                          product: prod,
                          selectedUnit: it.unit,
                          quantity: it.soldQuantity,
                          unitPrice: it.unitPrice,
                          discountKsh: it.discountKsh || it.manualDiscountAmount || it.discountAmount || 0,
                          lineDiscountAmount: it.lineDiscountAmount || 0,
                          taxRate: it.taxRate || 0.16
                        };
                      });
                      setCart(restoredCart);
                      onRestoreParkedSale(sale);
                      setShowParkedModal(false);
                    }}
                    className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold cursor-pointer transition shadow-2xs"
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
