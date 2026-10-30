/**
 * Offline-Tolerant Queue & Sync Service
 * For Kenyan Hardware Stores with intermittent connectivity.
 * Queues sales locally when network is offline, generates offline receipts,
 * and synchronizes automatically with backend when back online.
 */

const QUEUE_STORAGE_KEY = 'jengapro_offline_sales_queue';

export interface QueuedSalePayload {
  localQueueId: string;
  offlineReceiptNo: string;
  queuedAt: string;
  branchId: string;
  customerId?: string;
  customerName?: string;
  isContractor?: boolean;
  projectId?: string;
  projectName?: string;
  cashierId: string;
  cashierName: string;
  items: {
    productId: string;
    unit: string;
    quantity: number;
    unitPrice: number;
    discountAmount?: number;
  }[];
  payments: {
    method: 'cash' | 'mpesa' | 'card' | 'bank_transfer' | 'credit';
    amount: number;
    reference?: string;
    phone?: string;
  }[];
  totalAmount: number;
}

export class OfflineSyncService {
  /**
   * Get all queued sales
   */
  static getQueue(): QueuedSalePayload[] {
    try {
      const data = localStorage.getItem(QUEUE_STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  /**
   * Queue a sale for background sync
   */
  static enqueueSale(saleData: Omit<QueuedSalePayload, 'localQueueId' | 'offlineReceiptNo' | 'queuedAt'>): QueuedSalePayload {
    const queue = this.getQueue();
    const count = queue.length + 1;
    const queuedSale: QueuedSalePayload = {
      ...saleData,
      localQueueId: `offline-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      offlineReceiptNo: `OFFLINE-REC-${String(count).padStart(4, '0')}`,
      queuedAt: new Date().toISOString()
    };
    queue.push(queuedSale);
    localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue));
    return queuedSale;
  }

  /**
   * Remove items from queue
   */
  static removeFromQueue(localQueueId: string): void {
    const queue = this.getQueue().filter(q => q.localQueueId !== localQueueId);
    localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue));
  }

  /**
   * Clear entire queue
   */
  static clearQueue(): void {
    localStorage.removeItem(QUEUE_STORAGE_KEY);
  }

  /**
   * Synchronize all queued sales with backend API
   */
  static async syncWithServer(): Promise<{
    success: boolean;
    syncedCount: number;
    errors: string[];
  }> {
    const queue = this.getQueue();
    if (queue.length === 0) {
      return { success: true, syncedCount: 0, errors: [] };
    }

    try {
      const response = await fetch('/api/sync/offline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ offlineQueue: queue })
      });

      if (!response.ok) {
        throw new Error(`Sync failed with status: ${response.status}`);
      }

      const result = await response.json();
      if (result.success) {
        this.clearQueue();
        return {
          success: true,
          syncedCount: result.processedCount,
          errors: []
        };
      } else {
        return {
          success: false,
          syncedCount: result.processedCount || 0,
          errors: result.errors || ['Partial sync failure']
        };
      }
    } catch (err: any) {
      return {
        success: false,
        syncedCount: 0,
        errors: [err.message || 'Network error during sync']
      };
    }
  }
}
