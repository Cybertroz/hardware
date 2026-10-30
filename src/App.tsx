import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar.tsx';
import { POSScreen, CartItem } from './components/POSScreen.tsx';
import { InventoryScreen } from './components/InventoryScreen.tsx';
import { CustomersScreen } from './components/CustomersScreen.tsx';
import { ReportsScreen } from './components/ReportsScreen.tsx';
import { ScaleUpScreen } from './components/ScaleUpScreen.tsx';
import { ArchitectureDocs } from './components/ArchitectureDocs.tsx';
import { TestsRunnerScreen } from './components/TestsRunnerScreen.tsx';
import { TillModal } from './components/TillModal.tsx';
import { LoginScreen } from './components/LoginScreen.tsx';
import { FinanceScreen } from './components/FinanceScreen.tsx';
import {
  Product,
  Customer,
  Supplier,
  Sale,
  PurchaseOrder,
  GoodsReceivedNote,
  StockAdjustment,
  StockTransfer,
  Delivery,
  ApprovalRequest,
  TillSession,
  Branch,
  User,
  Role,
  FeatureFlags
} from './types/index.ts';
import { OfflineSyncService } from './services/offlineSync.ts';
import {
  branches as defaultBranches,
  products as defaultProducts,
  customers as defaultCustomers,
  suppliers as defaultSuppliers,
  sales as defaultSales,
  purchaseOrders as defaultPOs,
  goodsReceivedNotes as defaultGRNs,
  stockAdjustments as defaultAdjustments,
  stockTransfers as defaultTransfers,
  deliveries as defaultDeliveries,
  approvals as defaultApprovals,
  tillSessions as defaultTills,
  featureFlags as defaultFlags,
  users as defaultUsers
} from '../server/db.ts';

export default function App() {
  // Navigation
  const [activeTab, setActiveTab] = useState<string>('pos');

  // Multi-Branch & Role
  const [branches, setBranches] = useState<Branch[]>(defaultBranches);
  const [activeBranchId, setActiveBranchId] = useState<string>(defaultBranches[0]?.id || 'branch-nbo-hq');
  const [currentUser, setCurrentUser] = useState<User>(defaultUsers[0]);
  const [currentRole, setCurrentRole] = useState<Role>('owner');

  // Core Datasets
  const [products, setProducts] = useState<Product[]>(defaultProducts);
  const [customers, setCustomers] = useState<Customer[]>(defaultCustomers);
  const [suppliers, setSuppliers] = useState<Supplier[]>(defaultSuppliers);
  const [sales, setSales] = useState<Sale[]>(defaultSales);
  const [parkedSales, setParkedSales] = useState<Sale[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>(defaultPOs);
  const [goodsReceivedNotes, setGoodsReceivedNotes] = useState<GoodsReceivedNote[]>(defaultGRNs);
  const [stockAdjustments, setStockAdjustments] = useState<StockAdjustment[]>(defaultAdjustments);
  const [stockTransfers, setStockTransfers] = useState<StockTransfer[]>(defaultTransfers);
  const [deliveries, setDeliveries] = useState<Delivery[]>(defaultDeliveries);
  const [approvals, setApprovals] = useState<ApprovalRequest[]>(defaultApprovals);
  const [activeTill, setActiveTill] = useState<TillSession | undefined>(defaultTills[0]);
  const [featureFlags, setFeatureFlags] = useState<FeatureFlags>(defaultFlags);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(true);

  // Connectivity & Offline Queue
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [offlineQueueCount, setOfflineQueueCount] = useState<number>(OfflineSyncService.getQueue().length);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [showTillModal, setShowTillModal] = useState<boolean>(false);

  // Refresh data from server
  const fetchAllData = async () => {
    if (!navigator.onLine) return;
    try {
      const [prodRes, custRes, supRes, saleRes, poRes, grnRes, adjRes, trfRes, delRes, appRes, flagRes, branchRes, tillRes] = await Promise.all([
        fetch('/api/products').catch(() => null),
        fetch('/api/customers').catch(() => null),
        fetch('/api/suppliers').catch(() => null),
        fetch('/api/sales').catch(() => null),
        fetch('/api/purchase-orders').catch(() => null),
        fetch('/api/goods-receipts').catch(() => null),
        fetch('/api/inventory/adjustments').catch(() => null),
        fetch('/api/inventory/transfers').catch(() => null),
        fetch('/api/deliveries').catch(() => null),
        fetch('/api/approvals').catch(() => null),
        fetch('/api/features').catch(() => null),
        fetch('/api/branches').catch(() => null),
        fetch(`/api/till/session?branchId=${activeBranchId}`).catch(() => null)
      ]);

      if (prodRes?.ok) setProducts(await prodRes.json());
      if (custRes?.ok) setCustomers(await custRes.json());
      if (supRes?.ok) setSuppliers(await supRes.json());
      if (saleRes?.ok) setSales(await saleRes.json());
      if (poRes?.ok) setPurchaseOrders(await poRes.json());
      if (grnRes?.ok) setGoodsReceivedNotes(await grnRes.json());
      if (adjRes?.ok) setStockAdjustments(await adjRes.json());
      if (trfRes?.ok) setStockTransfers(await trfRes.json());
      if (delRes?.ok) setDeliveries(await delRes.json());
      if (appRes?.ok) setApprovals(await appRes.json());
      if (flagRes?.ok) setFeatureFlags(await flagRes.json());
      if (branchRes?.ok) setBranches(await branchRes.json());
      if (tillRes?.ok) setActiveTill(await tillRes.json());
    } catch (e) {
      console.log('Running in local fallback mode:', e);
    }
  };

  useEffect(() => {
    fetchAllData();

    const handleOnline = () => {
      setIsOnline(true);
      handleSyncOffline();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Update current user when role changes
  useEffect(() => {
    const matchedUser = defaultUsers.find(u => u.role === currentRole) || {
      id: `user-${currentRole}`,
      name: `${currentRole.toUpperCase()} User`,
      email: `${currentRole}@jengapro.co.ke`,
      role: currentRole,
      branchId: activeBranchId,
      active: true
    };
    setCurrentUser(matchedUser);
  }, [currentRole, activeBranchId]);

  // Sync Offline Queue
  const handleSyncOffline = async () => {
    setIsSyncing(true);
    const result = await OfflineSyncService.syncWithServer();
    setOfflineQueueCount(OfflineSyncService.getQueue().length);
    setIsSyncing(false);
    if (result.success && result.syncedCount > 0) {
      fetchAllData();
    }
  };

  // Feature flags update
  const handleUpdateFeatureFlags = async (updated: Partial<FeatureFlags>) => {
    const newFlags = { ...featureFlags, ...updated };
    setFeatureFlags(newFlags);
    try {
      await fetch('/api/features', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newFlags)
      });
    } catch (e) {
      console.error(e);
    }
  };

  // Park a sale
  const handleParkSale = (cartItems: CartItem[], customer?: Customer, notes?: string) => {
    const nextSeq = parkedSales.length + 1;
    const parked: Sale = {
      id: `held-${Date.now()}`,
      invoiceNumber: `HELD-${nextSeq}`,
      receiptNumber: `HELD-${nextSeq}`,
      branchId: activeBranchId,
      branchName: activeBranch.name,
      customerId: customer?.id,
      customerName: customer?.name || 'Walk-in Retail Customer',
      isContractor: !!customer?.creditAllowed,
      cashierId: currentUser.id,
      cashierName: currentUser.name,
      date: new Date().toISOString(),
      items: cartItems.map(it => {
        const unitDef = it.product.availableUnits.find(u => u.unit === it.selectedUnit);
        const factor = unitDef?.conversionFactor || 1;
        const discountQty = it.discountQuantity || 0;
        const totalPhysicalQty = it.quantity + discountQty;
        const baseQty = totalPhysicalQty * factor;
        const lineTotal = (it.quantity * it.unitPrice) - it.discount;
        return {
          productId: it.product.id,
          sku: it.product.sku,
          name: it.product.name,
          unit: it.selectedUnit,
          soldQuantity: it.quantity,
          discountQuantity: discountQty,
          baseUnitQuantity: baseQty,
          unitPrice: it.unitPrice,
          costPriceAtSale: it.product.costPrice,
          discountAmount: it.discount,
          taxRate: it.taxRate,
          taxAmount: (lineTotal * 0.16 / 1.16),
          total: lineTotal
        };
      }),
      subtotal: cartItems.reduce((acc, it) => acc + (it.quantity * it.unitPrice / 1.16), 0),
      discountTotal: cartItems.reduce((acc, it) => acc + it.discount, 0),
      taxTotal: cartItems.reduce((acc, it) => acc + ((it.quantity * it.unitPrice) * 0.16 / 1.16), 0),
      totalAmount: cartItems.reduce((acc, it) => acc + (it.quantity * it.unitPrice) - it.discount, 0),
      payments: [],
      paymentStatus: 'credit_unpaid',
      kraControlCode: '',
      kraQrCodeUrl: '',
      status: 'parked',
      notes
    };
    setParkedSales(prev => [parked, ...prev]);
  };

  const handleRestoreParkedSale = (sale: Sale) => {
    setParkedSales(prev => prev.filter(s => s.id !== sale.id));
  };

  const activeBranch = branches.find(b => b.id === activeBranchId) || branches[0];
  const pendingApprovalsCount = approvals.filter(a => a.status === 'pending').length;

  if (!isLoggedIn) {
    return (
      <LoginScreen
        onLogin={user => {
          setCurrentUser(user);
          setCurrentRole(user.role);
          setIsLoggedIn(true);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans selection:bg-sky-500 selection:text-white">
      {/* Persistent Global Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        branches={branches}
        activeBranchId={activeBranchId}
        setActiveBranchId={setActiveBranchId}
        currentRole={currentRole}
        setCurrentRole={setCurrentRole}
        isOnline={isOnline}
        setIsOnline={setIsOnline}
        offlineQueueCount={offlineQueueCount}
        onSyncOffline={handleSyncOffline}
        isSyncing={isSyncing}
        featureFlags={featureFlags}
        activeTill={activeTill}
        onOpenTillModal={() => setShowTillModal(true)}
        pendingApprovalsCount={pendingApprovalsCount}
        onLogout={() => setIsLoggedIn(false)}
      />

      {/* Main View Area */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {activeTab === 'pos' && (
          <POSScreen
            products={products}
            customers={customers}
            sales={sales}
            activeBranch={activeBranch}
            currentUser={currentUser}
            activeTill={activeTill}
            featureFlags={featureFlags}
            isOnline={isOnline}
            onSaleCompleted={sale => {
              setSales(prev => [sale, ...prev]);
              setOfflineQueueCount(OfflineSyncService.getQueue().length);
              fetchAllData();
            }}
            onRefreshData={fetchAllData}
            parkedSales={parkedSales}
            onParkSale={handleParkSale}
            onRestoreParkedSale={handleRestoreParkedSale}
          />
        )}

        {activeTab === 'inventory' && (
          <InventoryScreen
            products={products}
            branches={branches}
            activeBranch={activeBranch}
            currentUser={currentUser}
            featureFlags={featureFlags}
            adjustments={stockAdjustments}
            onRefreshData={fetchAllData}
          />
        )}



        {activeTab === 'finance' && (
          <FinanceScreen
            sales={sales}
            customers={customers}
            suppliers={suppliers}
            goodsReceivedNotes={goodsReceivedNotes}
            activeBranch={activeBranch}
            currentUser={currentUser}
            onRefreshData={fetchAllData}
          />
        )}

        {activeTab === 'customers' && (
          <CustomersScreen
            customers={customers}
            sales={sales}
            activeBranch={activeBranch}
            currentUser={currentUser}
            onRefreshData={fetchAllData}
          />
        )}

        {activeTab === 'reports' && (
          <ReportsScreen
            sales={sales}
            products={products}
            suppliers={suppliers}
            customers={customers}
            goodsReceivedNotes={goodsReceivedNotes}
            activeBranch={activeBranch}
          />
        )}

        {activeTab === 'scaleup' && (
          <ScaleUpScreen
            featureFlags={featureFlags}
            onUpdateFeatureFlags={handleUpdateFeatureFlags}
            branches={branches}
            transfers={stockTransfers}
            approvals={approvals}
            deliveries={deliveries}
            products={products}
            currentUser={currentUser}
            onRefreshData={fetchAllData}
          />
        )}

        {activeTab === 'architecture' && <ArchitectureDocs />}

        {activeTab === 'tests' && <TestsRunnerScreen />}
      </main>

      {/* Till Cash-Up & Z-Report Modal */}
      {showTillModal && (
        <TillModal
          activeTill={activeTill}
          activeBranch={activeBranch}
          currentUser={currentUser}
          onClose={() => setShowTillModal(false)}
          onRefreshData={fetchAllData}
        />
      )}
    </div>
  );
}
