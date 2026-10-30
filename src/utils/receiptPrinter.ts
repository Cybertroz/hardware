/**
 * Thermal Receipt Printer Utility
 * Supports 80mm & 58mm POS receipt layout, KRA eTIMS QR & CU control codes,
 * ESC/POS binary pulse for cash drawer opening, and browser printing.
 */

import { Sale, Branch } from '../types/index.ts';
import { formatKsh, formatDate } from './formatters.ts';

export interface PrinterConfig {
  shopName: string;
  kraPin: string;
  etimsCuNumber: string;
  address: string;
  phone: string;
  footerNote: string;
}

export const defaultPrinterConfig: PrinterConfig = {
  shopName: 'JENGAPRO HARDWARE & BUILDING SUPPLIES LTD',
  kraPin: 'P051234567Z',
  etimsCuNumber: 'CU-NBO-019283-KE',
  address: 'Commercial Street, Industrial Area, Nairobi, Kenya',
  phone: '+254 722 100 200 / +254 733 200 300',
  footerNote: 'Goods once sold are non-refundable after 7 days. Asanteni kwa kujiunga nasi!'
};

/**
 * Generate simulated ESC/POS Hex / ASCII command sequence
 * Standard ESC/POS:
 * ESC @ (Init printer: 0x1B, 0x40)
 * ESC a 1 (Center align: 0x1B, 0x61, 0x01)
 * ESC p 0 25 250 (Kick Cash Drawer: 0x1B, 0x70, 0x00, 0x19, 0xFA)
 * GS V 66 0 (Cut paper: 0x1D, 0x56, 0x42, 0x00)
 */
export function generateEscPosHex(sale: Sale, branch: Branch): string {
  const lines: string[] = [
    '=== ESC/POS RAW COMMAND STREAM (80mm Thermal Printer) ===',
    '[INIT] 1B 40',
    '[ALIGN_CENTER] 1B 61 01',
    `[TEXT_BOLD] ${defaultPrinterConfig.shopName}`,
    `[TEXT] ${branch.name}`,
    `[TEXT] KRA PIN: ${defaultPrinterConfig.kraPin} | eTIMS CU: ${defaultPrinterConfig.etimsCuNumber}`,
    `[TEXT] TEL: ${branch.phone}`,
    '[LINE] ------------------------------------------',
    '[ALIGN_LEFT] 1B 61 00',
    `[TEXT] TAX INVOICE / RECEIPT: ${sale.invoiceNumber}`,
    `[TEXT] DATE: ${formatDate(sale.date)}`,
    `[TEXT] CASHIER: ${sale.cashierName}`,
    `[TEXT] CUSTOMER: ${sale.customerName} ${sale.isContractor ? '(CONTRACTOR)' : ''}`,
    sale.projectId ? `[TEXT] PROJECT: ${sale.projectName}` : '',
    '[LINE] ------------------------------------------',
    '[TEXT] ITEM                    QTY    PRICE    TOTAL',
    ...sale.items.map(it => {
      const name = it.name.length > 20 ? it.name.substring(0, 18) + '..' : it.name.padEnd(20);
      const qty = `${it.soldQuantity} ${it.unit}`.padStart(7);
      const price = `${it.unitPrice}`.padStart(7);
      const tot = `${it.total}`.padStart(8);
      return `[TEXT] ${name} ${qty} ${price} ${tot}`;
    }),
    '[LINE] ------------------------------------------',
    `[ALIGN_RIGHT] 1B 61 02`,
    `[TEXT] SUBTOTAL: ${formatKsh(sale.subtotal)}`,
    `[TEXT] VAT 16% (INCL): ${formatKsh(sale.taxTotal)}`,
    `[TEXT_DOUBLE_HEIGHT] TOTAL: ${formatKsh(sale.totalAmount)}`,
    '[LINE] ------------------------------------------',
    ...sale.payments.map(p => `[TEXT] PAID BY ${p.method.toUpperCase()}: ${formatKsh(p.amount)} ${p.reference ? `(${p.reference})` : ''}`),
    '[ALIGN_CENTER] 1B 61 01',
    `[TEXT] KRA CONTROL CODE: ${sale.kraControlCode}`,
    `[QR_CODE] ${sale.kraQrCodeUrl}`,
    '[TEXT] Thank you for building with us!',
    `[CASH_DRAWER_KICK] 1B 70 00 19 FA`,
    `[FEED_AND_CUT] 1D 56 42 00`
  ].filter(Boolean);

  return lines.join('\n');
}

/**
 * Triggers Browser Print for styled thermal receipt view
 */
export function triggerBrowserPrint(): void {
  window.print();
}
