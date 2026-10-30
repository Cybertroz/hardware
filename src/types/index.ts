/**
 * JengaPro Enterprise Domain Types
 * Hardware & Building Materials Management System
 * Context: Kenya (Ksh, 16% VAT, eTIMS, M-Pesa, Multi-Branch)
 */

export type Role = 'owner' | 'manager' | 'cashier' | 'storekeeper' | 'dispatcher';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  branchId: string;
  phone?: string;
  active: boolean;
}

export interface Branch {
  id: string;
  code: string;
  name: string;
  location: string;
  phone: string;
  isMainWarehouse: boolean;
  active: boolean;
}

export interface ProductUnit {
  unit: string; // e.g. 'bag', 'tonne', 'piece', 'metre', 'kg', 'box', 'roll'
  conversionFactor: number; // relative to baseUnit (e.g. 1 tonne = 20 bags, so multiplier = 20)
  priceMultiplier?: number; // specific markup/discount if sold in this unit
  sellingPrice: number; // computed or explicit selling price in this unit
  barcode?: string;
}

export interface Product {
  id: string;
  sku: string;
  barcode: string;
  name: string;
  category: string;
  brand: string;
  description: string;
  specifications?: string;
  imageUrl?: string;
  baseUnit: string; // e.g. 'bag', 'piece', 'kg', 'metre', 'litre'
  availableUnits: ProductUnit[];
  stockByBranch: Record<string, number>; // branchId -> quantity in baseUnit
  minStockAlert: number; // in baseUnit
  reorderQuantity: number;
  costPrice: number; // Weighted average cost per baseUnit
  retailPrice: number; // per baseUnit
  wholesalePrice: number; // per baseUnit
  contractorPrice: number; // per baseUnit
  taxRate: number; // 0.16 for Kenya VAT standard, or 0 for exempt
  taxInclusive: boolean;
  active: boolean;
}

export type AdjustmentReason = 
  | 'damage' 
  | 'breakage_in_transit' 
  | 'theft_shrinkage' 
  | 'count_correction' 
  | 'expired_cement_hardened' 
  | 'customer_return_restock';

export interface StockAdjustment {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  branchId: string;
  branchName: string;
  quantityChange: number; // negative for write-off, positive for found
  unit: string;
  reason: AdjustmentReason;
  notes: string;
  adjustedBy: string;
  adjustedByName: string;
  timestamp: string;
  requiresApproval?: boolean;
  approved?: boolean;
  approvedBy?: string;
}

export interface TransferItem {
  productId: string;
  sku: string;
  productName: string;
  unit: string;
  quantity: number;
}

export interface StockTransfer {
  id: string;
  transferNumber: string;
  sourceBranchId: string;
  sourceBranchName: string;
  destinationBranchId: string;
  destinationBranchName: string;
  items: TransferItem[];
  status: 'draft' | 'dispatched' | 'received' | 'cancelled';
  dispatchedBy: string;
  receivedBy?: string;
  dispatchedAt: string;
  receivedAt?: string;
  notes?: string;
}

export interface ProjectAccount {
  id: string;
  customerId: string;
  projectName: string;
  siteLocation: string;
  allocatedBudget: number;
  currentBalance: number; // outstanding owed
  status: 'active' | 'completed' | 'on_hold';
}

export interface Customer {
  id: string;
  code: string;
  name: string;
  type: 'retail' | 'contractor' | 'developer';
  phone: string;
  email?: string;
  kraPin?: string;
  idNumber?: string;
  address: string;
  creditAllowed: boolean;
  creditLimit: number;
  creditPeriodDays: number;
  currentBalance: number; // outstanding owed
  priceTier: 'retail' | 'wholesale' | 'contractor';
  projects?: ProjectAccount[];
  createdDate: string;
}

export interface Supplier {
  id: string;
  code: string;
  name: string;
  contactPerson: string;
  phone: string;
  email: string;
  kraPin: string;
  address: string;
  paymentTerms: string; // e.g. '30 Days Net', 'Cash On Delivery'
  currentPayable: number;
  rating?: number;
}

export interface POItem {
  productId: string;
  sku: string;
  productName: string;
  unit: string;
  quantityOrdered: number;
  quantityReceived: number;
  unitCost: number;
  lineTotal: number;
}

export interface PurchaseOrder {
  id: string;
  poNumber: string;
  supplierId: string;
  supplierName: string;
  branchId: string;
  branchName: string;
  orderDate: string;
  expectedDate: string;
  status: 'draft' | 'approved' | 'partially_received' | 'received' | 'cancelled';
  items: POItem[];
  totalAmount: number;
  taxAmount: number;
  notes?: string;
  approvedBy?: string;
}

export interface GRNItem {
  productId: string;
  sku: string;
  productName: string;
  unit: string;
  quantityReceived: number;
  unitCost: number;
  totalCost: number;
}

export interface GoodsReceivedNote {
  id: string;
  grnNumber: string;
  poId: string;
  poNumber: string;
  supplierId: string;
  supplierName: string;
  branchId: string;
  branchName: string;
  receivedDate: string;
  supplierDeliveryNoteNo: string;
  items: GRNItem[];
  totalReceivedValue: number;
  receivedBy: string;
}

export interface SaleItem {
  productId: string;
  sku: string;
  name: string;
  unit: string;
  baseUnitQuantity: number; // e.g. 2 tonnes = 40 bags
  soldQuantity: number; // e.g. 2
  unitPrice: number; // price for this sold unit
  costPriceAtSale: number;
  discountAmount: number;
  taxRate: number;
  taxAmount: number;
  total: number;
}

export interface PaymentEntry {
  method: 'cash' | 'mpesa' | 'card' | 'bank_transfer' | 'credit';
  amount: number;
  reference?: string; // e.g. M-Pesa transaction code: 'QKF81JD91L'
  phone?: string; // For M-Pesa STK push
  bankName?: string;
  timestamp: string;
}

export interface Sale {
  id: string;
  invoiceNumber: string; // e.g. 'INV-2026-00381'
  receiptNumber: string; // e.g. 'REC-2026-00381'
  branchId: string;
  branchName: string;
  customerId?: string;
  customerName: string;
  isContractor: boolean;
  projectId?: string;
  projectName?: string;
  cashierId: string;
  cashierName: string;
  date: string;
  items: SaleItem[];
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  totalAmount: number;
  payments: PaymentEntry[];
  paymentStatus: 'paid' | 'partial' | 'credit_unpaid';
  kraControlCode: string; // simulated KRA eTIMS CU Inv No
  kraQrCodeUrl: string; // eTIMS verification url simulation
  status: 'completed' | 'parked' | 'refunded';
  notes?: string;
  isOfflineSync?: boolean;
  deliveryRequired?: boolean;
  deliveryId?: string;
}

export interface SaleReturn {
  id: string;
  returnNumber: string;
  originalSaleId: string;
  originalInvoiceNo: string;
  branchId: string;
  date: string;
  items: {
    productId: string;
    productName: string;
    unit: string;
    quantity: number;
    refundAmount: number;
  }[];
  totalRefund: number;
  refundMethod: 'cash' | 'mpesa' | 'credit_note';
  reason: string;
  restocked: boolean;
  processedBy: string;
}

export interface Quotation {
  id: string;
  quoteNumber: string;
  branchId: string;
  branchName: string;
  customerId?: string;
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  siteLocation?: string;
  date: string;
  validUntil: string;
  items: SaleItem[];
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  totalAmount: number;
  status: 'draft' | 'sent' | 'converted' | 'expired';
  notes?: string;
  convertedInvoiceId?: string;
}

export interface Delivery {
  id: string;
  deliveryNumber: string;
  saleId: string;
  invoiceNumber: string;
  branchId: string;
  customerName: string;
  customerPhone: string;
  destinationAddress: string;
  vehicleRegistration: string; // e.g. 'KDK 842X (Isuzu FRR 10-Tonne)'
  driverName: string;
  driverPhone: string;
  dispatchedAt?: string;
  status: 'pending' | 'dispatched' | 'delivered' | 'failed';
  offloadingInstructions?: string;
  recipientName?: string;
  signatureStamp?: string;
  deliveredAt?: string;
}

export interface ApprovalRequest {
  id: string;
  type: 'large_discount' | 'high_purchase_order' | 'stock_writeoff' | 'credit_override';
  branchId: string;
  branchName: string;
  title: string;
  description: string;
  requestedBy: string;
  requestedAt: string;
  amountOrValue?: number;
  status: 'pending' | 'approved' | 'rejected';
  resolvedBy?: string;
  resolvedAt?: string;
  rejectionReason?: string;
  payload: any;
}

export interface TillSession {
  id: string;
  branchId: string;
  branchName: string;
  cashierId: string;
  cashierName: string;
  openedAt: string;
  closedAt?: string;
  openingFloat: number;
  cashSales: number;
  mpesaSales: number;
  cardSales: number;
  bankSales: number;
  creditSales: number;
  expectedCash: number;
  countedCash?: number;
  cashVariance?: number;
  status: 'open' | 'closed';
  notes?: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  userRole: Role;
  branchId: string;
  action: string;
  module: 'pos' | 'inventory' | 'purchasing' | 'customers' | 'transfers' | 'approvals' | 'settings';
  details: string;
  ipAddress?: string;
}

export interface FeatureFlags {
  multiBranch: boolean;
  contractorCredit: boolean;
  approvalWorkflows: boolean;
  deliveryManagement: boolean;
  projectAccounts: boolean;
  batchTracking: boolean;
  kraEtimsStrict: boolean;
  allowNegativeStock: boolean;
}
