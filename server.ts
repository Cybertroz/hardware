/**
 * Full-Stack Express Server for JengaPro Hardware & Building Materials ERP
 * Handles all REST API routes, transactional business logic,
 * Vite development middleware mounting on Port 3000.
 */

import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  branches,
  users,
  products,
  suppliers,
  customers,
  sales,
  parkedSales,
  saleReturns,
  quotations,
  purchaseOrders,
  goodsReceivedNotes,
  stockAdjustments,
  stockTransfers,
  deliveries,
  approvals,
  tillSessions,
  auditLogs,
  featureFlags,
  processSaleTransaction,
  processGoodsReceipt,
  processStockAdjustment,
  generatePostgreSQLSchemaScript
} from './server/db.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json());

// ---------------------------------------------------------------------
// REST API ROUTES
// ---------------------------------------------------------------------

// System Health & Info
app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    system: 'JengaPro Hardware ERP',
    currency: 'KES (Ksh)',
    vatRate: '16%',
    serverTime: new Date().toISOString(),
    features: featureFlags
  });
});

// Feature Flags
app.get('/api/features', (req: Request, res: Response) => {
  res.json(featureFlags);
});

app.post('/api/features', (req: Request, res: Response) => {
  Object.assign(featureFlags, req.body);
  res.json({ success: true, features: featureFlags });
});

// Branches
app.get('/api/branches', (req: Request, res: Response) => {
  res.json(branches);
});

app.post('/api/branches', (req: Request, res: Response) => {
  const newBranch = {
    id: `branch-${Date.now()}`,
    code: req.body.code,
    name: req.body.name,
    location: req.body.location,
    phone: req.body.phone,
    isMainWarehouse: !!req.body.isMainWarehouse,
    active: true
  };
  branches.push(newBranch);
  res.status(201).json(newBranch);
});

// Products & Inventory
app.get('/api/products', (req: Request, res: Response) => {
  res.json(products);
});

app.post('/api/products', (req: Request, res: Response) => {
  const newProduct = {
    id: `prod-${Date.now()}`,
    sku: req.body.sku,
    barcode: req.body.barcode,
    name: req.body.name,
    category: req.body.category,
    brand: req.body.brand,
    description: req.body.description || '',
    specifications: req.body.specifications || '',
    baseUnit: req.body.baseUnit,
    availableUnits: req.body.availableUnits || [{ unit: req.body.baseUnit, conversionFactor: 1, sellingPrice: req.body.retailPrice }],
    stockByBranch: req.body.stockByBranch || { [branches[0].id]: req.body.initialStock || 0 },
    minStockAlert: req.body.minStockAlert || 10,
    reorderQuantity: req.body.reorderQuantity || 50,
    costPrice: req.body.costPrice || 0,
    retailPrice: req.body.retailPrice || 0,
    wholesalePrice: req.body.wholesalePrice || req.body.retailPrice,
    contractorPrice: req.body.contractorPrice || req.body.retailPrice,
    taxRate: 0.16,
    taxInclusive: true,
    active: true
  };
  products.unshift(newProduct);
  res.status(201).json(newProduct);
});

app.put('/api/products/:id', (req: Request, res: Response) => {
  const product = products.find(p => p.id === req.params.id);
  if (!product) return res.status(404).json({ error: 'Product not found' });
  Object.assign(product, req.body);
  res.json(product);
});

// Stock Adjustments
app.get('/api/inventory/adjustments', (req: Request, res: Response) => {
  res.json(stockAdjustments);
});

app.post('/api/inventory/adjustments', (req: Request, res: Response) => {
  const result = processStockAdjustment(req.body);
  if (!result.success) {
    return res.status(400).json({ error: result.error });
  }
  res.json(result);
});

// Stock Transfers (Inter-Branch)
app.get('/api/inventory/transfers', (req: Request, res: Response) => {
  res.json(stockTransfers);
});

app.post('/api/inventory/transfers', (req: Request, res: Response) => {
  const { sourceBranchId, destinationBranchId, items, notes, dispatchedBy } = req.body;
  const sourceBranch = branches.find(b => b.id === sourceBranchId);
  const destBranch = branches.find(b => b.id === destinationBranchId);

  if (!sourceBranch || !destBranch) {
    return res.status(400).json({ error: 'Invalid source or destination branch' });
  }

  // Deduct stock from source branch
  for (const item of items) {
    const product = products.find(p => p.id === item.productId);
    if (product) {
      const current = product.stockByBranch[sourceBranchId] || 0;
      if (current < item.quantity && !featureFlags.allowNegativeStock) {
        return res.status(400).json({ error: `Insufficient stock of ${product.name} at ${sourceBranch.name}` });
      }
      product.stockByBranch[sourceBranchId] = Math.max(0, current - item.quantity);
    }
  }

  const nextSeq = stockTransfers.length + 22;
  const newTransfer = {
    id: `trf-${Date.now()}`,
    transferNumber: `TRF-2026-${String(nextSeq).padStart(5, '0')}`,
    sourceBranchId,
    sourceBranchName: sourceBranch.name,
    destinationBranchId,
    destinationBranchName: destBranch.name,
    items,
    status: 'dispatched' as const,
    dispatchedBy: dispatchedBy || 'Storekeeper',
    dispatchedAt: new Date().toISOString(),
    notes
  };

  stockTransfers.unshift(newTransfer);

  auditLogs.unshift({
    id: `aud-${Date.now()}`,
    timestamp: new Date().toISOString(),
    userId: 'user-4',
    userName: dispatchedBy || 'Storekeeper',
    userRole: 'owner',
    branchId: sourceBranchId,
    action: 'DISPATCH_TRANSFER',
    module: 'transfers',
    details: `Dispatched ${newTransfer.transferNumber} to ${destBranch.name}`
  });

  res.status(201).json(newTransfer);
});

app.put('/api/inventory/transfers/:id/receive', (req: Request, res: Response) => {
  const transfer = stockTransfers.find(t => t.id === req.params.id);
  if (!transfer) return res.status(404).json({ error: 'Transfer not found' });
  if (transfer.status === 'received') return res.status(400).json({ error: 'Transfer already received' });

  // Add stock to destination branch
  for (const item of transfer.items) {
    const product = products.find(p => p.id === item.productId);
    if (product) {
      const current = product.stockByBranch[transfer.destinationBranchId] || 0;
      product.stockByBranch[transfer.destinationBranchId] = current + item.quantity;
    }
  }

  transfer.status = 'received';
  transfer.receivedBy = req.body.receivedBy || 'Storekeeper';
  transfer.receivedAt = new Date().toISOString();

  res.json(transfer);
});

// ---------------------------------------------------------------------
// M-PESA DARAJA 2.0 STK PUSH SIMULATOR
// ---------------------------------------------------------------------
interface STKSession {
  checkoutRequestId: string;
  merchantRequestId: string;
  phone: string;
  amount: number;
  accountReference: string;
  status: 'PENDING' | 'SUCCESS' | 'FAILED' | 'CANCELLED';
  resultDesc: string;
  mpesaReceiptNumber?: string;
  createdAt: number;
}

const activeMpesaSessions = new Map<string, STKSession>();

app.post('/api/mpesa/stkpush', (req: Request, res: Response) => {
  const { phone, amount, accountReference } = req.body;
  if (!phone || !amount || amount <= 0) {
    return res.status(400).json({ error: 'Valid phone number and positive amount are required' });
  }

  const cleanPhone = phone.startsWith('0') ? '254' + phone.substring(1) : phone;
  const checkoutRequestId = `ws_CO_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const merchantRequestId = `29381-92831-${Math.floor(1000 + Math.random() * 9000)}`;

  const session: STKSession = {
    checkoutRequestId,
    merchantRequestId,
    phone: cleanPhone,
    amount: Number(amount),
    accountReference: accountReference || 'JengaPro POS',
    status: 'PENDING',
    resultDesc: 'Customer prompted on handset. Awaiting M-Pesa PIN input...',
    createdAt: Date.now()
  };

  activeMpesaSessions.set(checkoutRequestId, session);

  // Auto-simulate M-Pesa handset prompt PIN entry after 3 seconds
  setTimeout(() => {
    const current = activeMpesaSessions.get(checkoutRequestId);
    if (current && current.status === 'PENDING') {
      const alpha = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      const randomCode = 'QKD' + Math.floor(100000 + Math.random() * 900000) + alpha.charAt(Math.floor(Math.random() * 26));
      current.status = 'SUCCESS';
      current.mpesaReceiptNumber = randomCode;
      current.resultDesc = `The service request is processed successfully. Receipt: ${randomCode}`;
    }
  }, 3000);

  res.status(200).json({
    MerchantRequestID: merchantRequestId,
    CheckoutRequestID: checkoutRequestId,
    ResponseCode: "0",
    ResponseDescription: "Success. Request accepted for processing",
    CustomerMessage: `Success. STK Push prompt sent to ${cleanPhone}`
  });
});

app.get('/api/mpesa/query/:checkoutRequestId', (req: Request, res: Response) => {
  const session = activeMpesaSessions.get(req.params.checkoutRequestId);
  if (!session) {
    return res.status(404).json({ error: 'Transaction checkout session not found or expired' });
  }

  res.json({
    CheckoutRequestID: session.checkoutRequestId,
    ResultCode: session.status === 'SUCCESS' ? "0" : session.status === 'PENDING' ? "PENDING" : "1",
    ResultDesc: session.resultDesc,
    MpesaReceiptNumber: session.mpesaReceiptNumber || null,
    Amount: session.amount,
    PhoneNumber: session.phone,
    Status: session.status
  });
});

// Sales & POS Counter
app.get('/api/sales', (req: Request, res: Response) => {
  res.json(sales);
});

app.post('/api/sales', (req: Request, res: Response) => {
  const result = processSaleTransaction(req.body);
  if (!result.success) {
    return res.status(400).json({ error: result.error });
  }
  res.status(201).json(result.sale);
});

// Parked / Held Sales
app.get('/api/sales/held', (req: Request, res: Response) => {
  res.json(parkedSales);
});

app.post('/api/sales/park', (req: Request, res: Response) => {
  const heldSale = {
    ...req.body,
    id: `held-${Date.now()}`,
    status: 'parked',
    date: new Date().toISOString()
  };
  parkedSales.unshift(heldSale);
  res.status(201).json(heldSale);
});

app.delete('/api/sales/held/:id', (req: Request, res: Response) => {
  const index = parkedSales.findIndex(s => s.id === req.params.id);
  if (index !== -1) {
    parkedSales.splice(index, 1);
  }
  res.json({ success: true });
});

// Sale Returns & Refunds
app.get('/api/sales/returns', (req: Request, res: Response) => {
  res.json(saleReturns);
});

app.post('/api/sales/returns', (req: Request, res: Response) => {
  const { originalSaleId, items, refundMethod, reason, restock } = req.body;
  const originalSale = sales.find(s => s.id === originalSaleId);
  if (!originalSale) return res.status(404).json({ error: 'Original sale invoice not found' });

  let totalRefund = 0;
  for (const item of items) {
    totalRefund += item.refundAmount;
    if (restock) {
      const product = products.find(p => p.id === item.productId);
      if (product) {
        const curStock = product.stockByBranch[originalSale.branchId] || 0;
        product.stockByBranch[originalSale.branchId] = curStock + item.quantity;
      }
    }
  }

  const returnRecord = {
    id: `ret-${Date.now()}`,
    returnNumber: `RET-2026-${String(saleReturns.length + 12).padStart(5, '0')}`,
    originalSaleId,
    originalInvoiceNo: originalSale.invoiceNumber,
    branchId: originalSale.branchId,
    date: new Date().toISOString(),
    items,
    totalRefund,
    refundMethod: refundMethod || 'cash',
    reason: reason || 'Customer returned surplus materials',
    restocked: !!restock,
    processedBy: req.body.processedBy || 'Cashier'
  };

  saleReturns.unshift(returnRecord);
  originalSale.status = 'refunded';

  res.status(201).json(returnRecord);
});

// Quotations
app.get('/api/quotations', (req: Request, res: Response) => {
  res.json(quotations);
});

app.post('/api/quotations', (req: Request, res: Response) => {
  const nextSeq = quotations.length + 105;
  const newQuote = {
    ...req.body,
    id: `quote-${Date.now()}`,
    quoteNumber: `QTE-2026-${String(nextSeq).padStart(5, '0')}`,
    date: new Date().toISOString(),
    validUntil: req.body.validUntil || new Date(Date.now() + 14 * 86400000).toISOString(),
    status: 'sent'
  };
  quotations.unshift(newQuote);
  res.status(201).json(newQuote);
});

app.post('/api/quotations/:id/convert', (req: Request, res: Response) => {
  const quote = quotations.find(q => q.id === req.params.id);
  if (!quote) return res.status(404).json({ error: 'Quotation not found' });

  const saleResult = processSaleTransaction({
    branchId: quote.branchId,
    customerId: quote.customerId,
    customerName: quote.customerName,
    isContractor: !!quote.customerId,
    cashierId: req.body.cashierId || 'user-3',
    cashierName: req.body.cashierName || 'Peter Omondi',
    items: quote.items.map(item => ({
      productId: item.productId,
      unit: item.unit,
      quantity: item.soldQuantity,
      unitPrice: item.unitPrice,
      discountAmount: item.discountAmount
    })),
    payments: req.body.payments,
    notes: `Converted from Quotation ${quote.quoteNumber}`
  });

  if (!saleResult.success) {
    return res.status(400).json({ error: saleResult.error });
  }

  quote.status = 'converted';
  quote.convertedInvoiceId = saleResult.sale?.id;

  res.json({ success: true, sale: saleResult.sale });
});

// Customers & Contractor Accounts
app.get('/api/customers', (req: Request, res: Response) => {
  res.json(customers);
});

app.post('/api/customers', (req: Request, res: Response) => {
  const nextSeq = customers.length + 1;
  const newCustomer = {
    id: `cust-${Date.now()}`,
    code: `CUST-${String(nextSeq).padStart(3, '0')}`,
    name: req.body.name,
    type: req.body.type || 'contractor',
    phone: req.body.phone,
    email: req.body.email,
    kraPin: req.body.kraPin,
    address: req.body.address || '',
    creditAllowed: !!req.body.creditAllowed,
    creditLimit: req.body.creditLimit || 0,
    creditPeriodDays: req.body.creditPeriodDays || 30,
    currentBalance: 0,
    priceTier: req.body.priceTier || 'contractor',
    projects: req.body.projects || [],
    createdDate: new Date().toISOString()
  };
  customers.push(newCustomer);
  res.status(201).json(newCustomer);
});

app.post('/api/customers/:id/payments', (req: Request, res: Response) => {
  const customer = customers.find(c => c.id === req.params.id);
  if (!customer) return res.status(404).json({ error: 'Customer not found' });

  const amount = Number(req.body.amount);
  if (amount <= 0) return res.status(400).json({ error: 'Payment amount must be greater than 0' });

  customer.currentBalance = Math.max(0, customer.currentBalance - amount);

  // If allocated to a project
  if (req.body.projectId && customer.projects) {
    const proj = customer.projects.find(p => p.id === req.body.projectId);
    if (proj) {
      proj.currentBalance = Math.max(0, proj.currentBalance - amount);
    }
  }

  auditLogs.unshift({
    id: `aud-${Date.now()}`,
    timestamp: new Date().toISOString(),
    userId: req.body.cashierId || 'user-3',
    userName: req.body.cashierName || 'Cashier',
    userRole: 'cashier',
    branchId: branches[0].id,
    action: 'CUSTOMER_PAYMENT',
    module: 'customers',
    details: `Received Ksh ${amount.toLocaleString()} from ${customer.name} via ${req.body.method} (Ref: ${req.body.reference || 'N/A'})`
  });

  res.json({ success: true, currentBalance: customer.currentBalance });
});

// Suppliers
app.get('/api/suppliers', (req: Request, res: Response) => {
  res.json(suppliers);
});

app.post('/api/suppliers', (req: Request, res: Response) => {
  const nextSeq = suppliers.length + 1;
  const newSupplier = {
    id: `sup-${Date.now()}`,
    code: `SUP-${String(nextSeq).padStart(3, '0')}`,
    name: req.body.name,
    contactPerson: req.body.contactPerson,
    phone: req.body.phone,
    email: req.body.email,
    kraPin: req.body.kraPin,
    address: req.body.address,
    paymentTerms: req.body.paymentTerms || '30 Days Net',
    currentPayable: 0,
    rating: 5.0
  };
  suppliers.push(newSupplier);
  res.status(201).json(newSupplier);
});

// Purchase Orders & GRN
app.get('/api/purchase-orders', (req: Request, res: Response) => {
  res.json(purchaseOrders);
});

app.post('/api/purchase-orders', (req: Request, res: Response) => {
  const nextSeq = purchaseOrders.length + 89;
  const supplier = suppliers.find(s => s.id === req.body.supplierId);
  const branch = branches.find(b => b.id === req.body.branchId) || branches[0];

  const newPO = {
    id: `po-${Date.now()}`,
    poNumber: `PO-2026-${String(nextSeq).padStart(5, '0')}`,
    supplierId: req.body.supplierId,
    supplierName: supplier?.name || 'Supplier',
    branchId: branch.id,
    branchName: branch.name,
    orderDate: new Date().toISOString(),
    expectedDate: req.body.expectedDate || new Date(Date.now() + 7 * 86400000).toISOString(),
    status: (featureFlags.approvalWorkflows && req.body.totalAmount > 500000) ? 'draft' as const : 'approved' as const,
    items: req.body.items.map((item: any) => ({
      ...item,
      quantityReceived: 0,
      lineTotal: item.quantityOrdered * item.unitCost
    })),
    totalAmount: req.body.totalAmount,
    taxAmount: Math.round(req.body.totalAmount * 0.16 * 100) / 100,
    notes: req.body.notes
  };

  if (newPO.status === 'draft') {
    approvals.unshift({
      id: `app-${Date.now()}`,
      type: 'high_purchase_order',
      branchId: branch.id,
      branchName: branch.name,
      title: `High Value PO: ${newPO.poNumber} (${supplier?.name})`,
      description: `Purchase Order of Ksh ${newPO.totalAmount.toLocaleString()} requires Owner sign-off before dispatch to supplier.`,
      requestedBy: req.body.requestedBy || 'Procurement',
      requestedAt: new Date().toISOString(),
      amountOrValue: newPO.totalAmount,
      status: 'pending',
      payload: newPO
    });
  }

  purchaseOrders.unshift(newPO);
  res.status(201).json(newPO);
});

app.get('/api/goods-receipts', (req: Request, res: Response) => {
  res.json(goodsReceivedNotes);
});

app.post('/api/goods-receipts', (req: Request, res: Response) => {
  const result = processGoodsReceipt(req.body);
  if (!result.success) {
    return res.status(400).json({ error: result.error });
  }
  res.status(201).json(result.grn);
});

// Deliveries
app.get('/api/deliveries', (req: Request, res: Response) => {
  res.json(deliveries);
});

app.put('/api/deliveries/:id/status', (req: Request, res: Response) => {
  const delivery = deliveries.find(d => d.id === req.params.id);
  if (!delivery) return res.status(404).json({ error: 'Delivery record not found' });

  delivery.status = req.body.status;
  if (req.body.status === 'delivered') {
    delivery.recipientName = req.body.recipientName;
    delivery.signatureStamp = req.body.signatureStamp || `SIGN_POD_${Date.now()}`;
    delivery.deliveredAt = new Date().toISOString();
  }
  res.json(delivery);
});

// Approvals
app.get('/api/approvals', (req: Request, res: Response) => {
  res.json(approvals);
});

app.post('/api/approvals/:id/resolve', (req: Request, res: Response) => {
  const approval = approvals.find(a => a.id === req.params.id);
  if (!approval) return res.status(404).json({ error: 'Approval request not found' });

  approval.status = req.body.status; // 'approved' | 'rejected'
  approval.resolvedBy = req.body.resolvedBy || 'James Kamau (Owner)';
  approval.resolvedAt = new Date().toISOString();
  approval.rejectionReason = req.body.rejectionReason;

  if (approval.status === 'approved') {
    if (approval.type === 'stock_writeoff' && approval.payload) {
      const { productId, branchId, quantityChange } = approval.payload;
      const product = products.find(p => p.id === productId);
      if (product) {
        const cur = product.stockByBranch[branchId] || 0;
        product.stockByBranch[branchId] = Math.max(0, cur + quantityChange);
      }
    } else if (approval.type === 'high_purchase_order') {
      const po = purchaseOrders.find(p => p.id === approval.payload.id);
      if (po) po.status = 'approved';
    }
  }

  res.json(approval);
});

// Till Sessions & Reconciliation
app.get('/api/till/session', (req: Request, res: Response) => {
  const branchId = (req.query.branchId as string) || branches[0].id;
  const current = tillSessions.find(t => t.branchId === branchId && t.status === 'open') || tillSessions[0];
  res.json(current);
});

app.post('/api/till/close', (req: Request, res: Response) => {
  const { sessionId, countedCash, notes } = req.body;
  const session = tillSessions.find(t => t.id === sessionId);
  if (!session) return res.status(404).json({ error: 'Session not found' });

  session.status = 'closed';
  session.closedAt = new Date().toISOString();
  session.countedCash = countedCash;
  session.cashVariance = countedCash - session.expectedCash;
  session.notes = notes;

  auditLogs.unshift({
    id: `aud-${Date.now()}`,
    timestamp: new Date().toISOString(),
    userId: session.cashierId,
    userName: session.cashierName,
    userRole: 'cashier',
    branchId: session.branchId,
    action: 'CLOSE_TILL',
    module: 'pos',
    details: `Closed Till. Expected Cash: Ksh ${session.expectedCash}, Counted: Ksh ${countedCash}, Variance: Ksh ${session.cashVariance}`
  });

  res.json(session);
});

// Audit Logs
app.get('/api/audit-logs', (req: Request, res: Response) => {
  res.json(auditLogs);
});

// Offline Sales Sync Gateway
app.post('/api/sync/offline', (req: Request, res: Response) => {
  const { offlineQueue } = req.body;
  if (!Array.isArray(offlineQueue) || offlineQueue.length === 0) {
    return res.json({ success: true, processedCount: 0, syncedSales: [] });
  }

  const syncedSales: any[] = [];
  const errors: string[] = [];

  for (const queuedSale of offlineQueue) {
    const result = processSaleTransaction({
      ...queuedSale,
      isOfflineSync: true
    });
    if (result.success && result.sale) {
      syncedSales.push(result.sale);
    } else {
      errors.push(result.error || 'Failed to sync sale');
    }
  }

  res.json({
    success: errors.length === 0,
    processedCount: syncedSales.length,
    syncedSales,
    errors
  });
});

// PostgreSQL Schema & Migration Script (Deliverable 1 & 2)
app.get('/api/schema/postgres', (req: Request, res: Response) => {
  const sqlScript = generatePostgreSQLSchemaScript();
  res.setHeader('Content-Type', 'text/plain');
  res.send(sqlScript);
});

// System Backup & Snapshot
app.get('/api/backup', (req: Request, res: Response) => {
  const snapshot = {
    exportedAt: new Date().toISOString(),
    version: '1.0.0',
    featureFlags,
    branches,
    users,
    products,
    suppliers,
    customers,
    sales,
    quotations,
    purchaseOrders,
    goodsReceivedNotes,
    stockAdjustments,
    stockTransfers,
    deliveries,
    approvals,
    auditLogs
  };
  res.json(snapshot);
});

// ---------------------------------------------------------------------
// Vite Dev Server Middleware or Static Production Serving
// ---------------------------------------------------------------------
async function startServer() {
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 JengaPro Hardware ERP running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
