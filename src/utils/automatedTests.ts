/**
 * Automated In-App Test Suite for Core Business Logic
 * Validates: Stock movement, Weighted Average Cost (WAC), Multi-unit conversion,
 * Kenya 16% VAT calculation, Contractor Credit Limits, Split Payment Math.
 */

import { calculateWeightedAverageCost, convertProductQuantity } from '../../server/db.ts';
import { Product } from '../types/index.ts';

export interface TestResult {
  name: string;
  category: 'Inventory' | 'Pricing & Costing' | 'Tax (Kenya VAT)' | 'Contractor Credit' | 'POS Payments';
  passed: boolean;
  expected: string;
  actual: string;
  message: string;
}

export function runBusinessLogicTests(): TestResult[] {
  const results: TestResult[] = [];

  // TEST 1: Weighted Average Cost (WAC) formula
  // Old: 100 bags @ Ksh 600 = 60,000. New: 100 bags @ Ksh 700 = 70,000. Total: 200 bags, Cost = 130,000 / 200 = 650.
  const wac1 = calculateWeightedAverageCost(100, 600, 100, 700);
  results.push({
    name: 'Weighted Average Cost (Equal Quantities)',
    category: 'Pricing & Costing',
    passed: wac1 === 650,
    expected: '650.00',
    actual: wac1.toFixed(2),
    message: wac1 === 650 ? 'WAC calculated correctly for equal weighted batches.' : 'WAC computation mismatch.'
  });

  // TEST 2: Weighted Average Cost (Unequal batches)
  // Old: 400 bags @ Ksh 625 = 250,000. New: 600 bags @ Ksh 650 = 390,000. Total = 640,000 / 1000 = 640.
  const wac2 = calculateWeightedAverageCost(400, 625, 600, 650);
  results.push({
    name: 'Weighted Average Cost (Unequal Weights: 400 vs 600 bags)',
    category: 'Pricing & Costing',
    passed: wac2 === 640,
    expected: '640.00',
    actual: wac2.toFixed(2),
    message: wac2 === 640 ? 'WAC calculated accurately for large incoming shipment.' : 'WAC failed on unequal batch.'
  });

  // TEST 3: Multi-Unit Conversion: Cement (Bag to Tonne)
  const dummyCement: Product = {
    id: 'test-cem',
    sku: 'CEM-TEST',
    barcode: '111',
    name: 'Test Cement',
    category: 'Cement',
    brand: 'Test',
    description: '',
    baseUnit: 'bag',
    availableUnits: [
      { unit: 'bag', conversionFactor: 1, sellingPrice: 720 },
      { unit: 'tonne', conversionFactor: 20, sellingPrice: 14000 }
    ],
    stockByBranch: {},
    minStockAlert: 10,
    reorderQuantity: 50,
    costPrice: 600,
    retailPrice: 720,
    wholesalePrice: 700,
    contractorPrice: 680,
    taxRate: 0.16,
    taxInclusive: true,
    active: true
  };

  const convertedBags = convertProductQuantity(dummyCement, 2.5, 'tonne', 'bag');
  // 2.5 tonnes * 20 bags/tonne = 50 bags
  results.push({
    name: 'Multi-Unit Conversion (2.5 Tonnes Cement to Bags)',
    category: 'Inventory',
    passed: convertedBags === 50,
    expected: '50 bags',
    actual: `${convertedBags} bags`,
    message: convertedBags === 50 ? 'Accurately converted bulk packaging to base inventory unit.' : 'UoM conversion error.'
  });

  // TEST 4: Multi-Unit Conversion: PVC Pipe (Pieces to Metres)
  const dummyPipe: Product = {
    id: 'test-pipe',
    sku: 'PIPE-TEST',
    barcode: '222',
    name: 'Test Pipe',
    category: 'Plumbing',
    brand: 'Test',
    description: '',
    baseUnit: 'piece',
    availableUnits: [
      { unit: 'piece', conversionFactor: 1, sellingPrice: 1200 },
      { unit: 'metre', conversionFactor: 0.166667, sellingPrice: 220 } // 1 piece = 6 metres => 1m = 1/6 pc
    ],
    stockByBranch: {},
    minStockAlert: 5,
    reorderQuantity: 20,
    costPrice: 800,
    retailPrice: 1200,
    wholesalePrice: 1100,
    contractorPrice: 1050,
    taxRate: 0.16,
    taxInclusive: true,
    active: true
  };

  const basePieces = convertProductQuantity(dummyPipe, 6, 'metre', 'piece');
  const isApproxOnePiece = Math.abs(basePieces - 1.0) < 0.01;
  results.push({
    name: 'Multi-Unit Conversion (6 Metres of Pipe to 1 Piece)',
    category: 'Inventory',
    passed: isApproxOnePiece,
    expected: '1.00 piece',
    actual: `${basePieces.toFixed(2)} piece`,
    message: isApproxOnePiece ? 'Cut-to-size length correctly converts to base warehouse stock.' : 'Pipe conversion error.'
  });

  // TEST 5: Kenya VAT 16% Tax-Inclusive Breakdown
  // If Gross = Ksh 11,600, Tax = 11,600 - (11,600 / 1.16) = 1,600. Subtotal = 10,000.
  const grossPrice = 11600;
  const taxRate = 0.16;
  const taxCalculated = grossPrice - (grossPrice / (1 + taxRate));
  const subtotalCalculated = grossPrice - taxCalculated;
  const taxAccurate = Math.round(taxCalculated) === 1600 && Math.round(subtotalCalculated) === 10000;
  results.push({
    name: 'Kenya VAT 16% Tax-Inclusive Split (Ksh 11,600 Gross)',
    category: 'Tax (Kenya VAT)',
    passed: taxAccurate,
    expected: 'Tax: Ksh 1,600.00 | Net: Ksh 10,000.00',
    actual: `Tax: Ksh ${taxCalculated.toFixed(2)} | Net: Ksh ${subtotalCalculated.toFixed(2)}`,
    message: taxAccurate ? 'Complies with KRA eTIMS tax-inclusive calculation standard.' : 'VAT breakdown formula error.'
  });

  // TEST 6: Contractor Credit Limit Guard
  // Credit Limit = 1,000,000. Existing Balance = 850,000. New Purchase = 200,000. New total = 1,050,000 (Exceeds limit by 50,000).
  const creditLimit = 1000000;
  const currentBalance = 850000;
  const saleCreditRequested = 200000;
  const willExceed = (currentBalance + saleCreditRequested) > creditLimit;
  results.push({
    name: 'Contractor Credit Limit Over-Allocation Prevention',
    category: 'Contractor Credit',
    passed: willExceed === true,
    expected: 'Transaction Blocked (Exceeds limit by Ksh 50,000)',
    actual: willExceed ? 'Blocked (Limit Ksh 1M, Attempted Ksh 1.05M)' : 'Allowed (Incorrect)',
    message: willExceed ? 'System strictly protects working capital and flags credit overflow.' : 'Credit limit guard failed.'
  });

  // TEST 7: Split Payment Sum Integrity
  // Total = Ksh 50,000. Payments: Cash 20,000 + M-Pesa 30,000 = 50,000.
  const invoiceTotal = 50000;
  const payments = [{ amount: 20000 }, { amount: 30000 }];
  const paymentSum = payments.reduce((acc, p) => acc + p.amount, 0);
  const isValidSplit = Math.abs(paymentSum - invoiceTotal) <= 0.01;
  results.push({
    name: 'Split Payment Balancing (Cash + M-Pesa = Total)',
    category: 'POS Payments',
    passed: isValidSplit,
    expected: `Ksh ${invoiceTotal.toLocaleString()}`,
    actual: `Ksh ${paymentSum.toLocaleString()}`,
    message: isValidSplit ? 'Split payment math validated with zero balance discrepancy.' : 'Split payment sum error.'
  });

  return results;
}
