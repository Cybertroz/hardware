/**
 * M-Pesa Daraja 2.0 STK Push & Query Service
 * Handles STK Push initiation, status polling, and transaction confirmation.
 */

export interface STKPushRequest {
  phone: string;
  amount: number;
  accountReference?: string;
  transactionDesc?: string;
}

export interface STKPushResponse {
  MerchantRequestID: string;
  CheckoutRequestID: string;
  ResponseCode: string;
  ResponseDescription: string;
  CustomerMessage: string;
}

export interface STKQueryResult {
  CheckoutRequestID: string;
  ResultCode: string;
  ResultDesc: string;
  MpesaReceiptNumber?: string | null;
  Amount: number;
  PhoneNumber: string;
  Status: 'PENDING' | 'SUCCESS' | 'FAILED' | 'CANCELLED';
}

export class MpesaService {
  /**
   * Format Kenyan Phone number to standard 2547XXXXXXXX format
   */
  static formatPhoneNumber(phone: string): string {
    let clean = phone.replace(/[^0-9]/g, '');
    if (clean.startsWith('0')) {
      clean = '254' + clean.substring(1);
    } else if (clean.startsWith('7') || clean.startsWith('1')) {
      clean = '254' + clean;
    } else if (!clean.startsWith('254')) {
      clean = '254' + clean;
    }
    return clean;
  }

  /**
   * Initiate M-Pesa STK Push
   */
  static async initiateSTKPush(payload: STKPushRequest): Promise<STKPushResponse> {
    const formattedPhone = this.formatPhoneNumber(payload.phone);
    const body = {
      phone: formattedPhone,
      amount: Math.round(payload.amount),
      accountReference: payload.accountReference || 'JengaPro POS',
      transactionDesc: payload.transactionDesc || 'Hardware Sale Checkout'
    };

    const response = await fetch('/api/mpesa/stkpush', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to trigger M-Pesa STK Push');
    }

    return await response.json();
  }

  /**
   * Poll STK Push transaction status from Daraja query API
   */
  static async pollTransactionStatus(
    checkoutRequestId: string,
    options: {
      onStatusUpdate?: (res: STKQueryResult) => void;
      onSuccess?: (res: STKQueryResult) => void;
      onFailure?: (errorMsg: string) => void;
      maxAttempts?: number;
      intervalMs?: number;
    }
  ): Promise<STKQueryResult> {
    const maxAttempts = options.maxAttempts || 20; // ~24 seconds total
    const intervalMs = options.intervalMs || 1200;

    let attempts = 0;

    return new Promise((resolve, reject) => {
      const timer = setInterval(async () => {
        attempts++;
        try {
          const response = await fetch(`/api/mpesa/query/${checkoutRequestId}`);
          if (!response.ok) {
            throw new Error('Failed to query M-Pesa Daraja status');
          }

          const result: STKQueryResult = await response.json();
          if (options.onStatusUpdate) {
            options.onStatusUpdate(result);
          }

          if (result.Status === 'SUCCESS') {
            clearInterval(timer);
            if (options.onSuccess) options.onSuccess(result);
            resolve(result);
          } else if (result.Status === 'FAILED' || result.Status === 'CANCELLED') {
            clearInterval(timer);
            const msg = result.ResultDesc || 'M-Pesa payment failed or was cancelled by user';
            if (options.onFailure) options.onFailure(msg);
            reject(new Error(msg));
          } else if (attempts >= maxAttempts) {
            clearInterval(timer);
            const timeoutMsg = 'M-Pesa STK push timed out after 24 seconds. Please check handset or retry.';
            if (options.onFailure) options.onFailure(timeoutMsg);
            reject(new Error(timeoutMsg));
          }
        } catch (err: any) {
          if (attempts >= maxAttempts) {
            clearInterval(timer);
            if (options.onFailure) options.onFailure(err.message || 'M-Pesa status query error');
            reject(err);
          }
        }
      }, intervalMs);
    });
  }
}
