/**
 * @file packages/shared/src/index.ts
 * @description Shared domain types, constants, and exact money conversion helpers for Vitrine.
 */

/**
 * Product lifecycle states strictly enforced by the system.
 * Invariant: AI output can only set DRAFT or PENDING_CONFIRMATION.
 * Only merchant confirmation can transition to PUBLISHED.
 */
export const ProductStatus = {
  DRAFT: 'DRAFT',
  PENDING_CONFIRMATION: 'PENDING_CONFIRMATION',
  PUBLISHED: 'PUBLISHED',
  ARCHIVED: 'ARCHIVED',
} as const;

export type ProductStatusType = (typeof ProductStatus)[keyof typeof ProductStatus];

/**
 * Order lifecycle states for Phase 1.
 */
export const OrderStatus = {
  PENDING_PAYMENT: 'PENDING_PAYMENT',
  PAYMENT_SUBMITTED: 'PAYMENT_SUBMITTED',
  VERIFIED: 'VERIFIED',
  FULFILLED: 'FULFILLED',
  CANCELLED: 'CANCELLED',
} as const;

export type OrderStatusType = (typeof OrderStatus)[keyof typeof OrderStatus];

/**
 * Payment verification states.
 */
export const PaymentStatus = {
  PENDING: 'PENDING',
  VERIFIED: 'VERIFIED',
  REJECTED: 'REJECTED',
} as const;

export type PaymentStatusType = (typeof PaymentStatus)[keyof typeof PaymentStatus];

/**
 * Monetary representation in application memory.
 * Database columns store exact NUMERIC(20,2) (returned by `pg` as strings).
 * Application code converts DB NUMERIC strings to integer minor units strictly
 * by exact string parsing, never via Number() or parseFloat() on decimals.
 */
export interface Money {
  /** Amount in exact integer minor units (e.g. 1234567890 = 12345678.90 Kz) */
  amount: number;
  /** ISO 4217 currency code (default: AOA - Angolan Kwanza) */
  currency: string;
}

const NUMERIC_STRING_PATTERN = /^\s*([+-])?(\d+)(?:\.(\d+))?\s*$/;
const MIN_SAFE_BIGINT = BigInt(Number.MIN_SAFE_INTEGER);
const MAX_SAFE_BIGINT = BigInt(Number.MAX_SAFE_INTEGER);

/**
 * Safely constructs a Money object ensuring safe integer minor units.
 * Throws a TypeError if amount is not a safe integer.
 */
export function createMoney(minorUnits: number, currency = 'AOA'): Money {
  if (!Number.isSafeInteger(minorUnits)) {
    throw new TypeError(
      `Monetary amount must be a safe integer minor unit. Received: ${minorUnits}`
    );
  }
  return {
    amount: minorUnits,
    currency,
  };
}

/**
 * Converts a PostgreSQL NUMERIC string (e.g. "12345678.90") to integer-minor-unit Money
 * strictly via exact string parsing (never Number() or parseFloat()).
 */
export function parseNumericToMoney(numericString: string, currency = 'AOA'): Money {
  if (typeof numericString !== 'string') {
    throw new TypeError('DB NUMERIC value must be a string');
  }

  const match = NUMERIC_STRING_PATTERN.exec(numericString);
  if (!match) {
    throw new TypeError(`Invalid NUMERIC string for Money conversion: "${numericString}"`);
  }

  const sign = match[1] === '-' ? -1n : 1n;
  const intPart = match[2] ?? '';
  const fracPart = match[3] ?? '';

  if (fracPart.length > 2) {
    throw new TypeError(
      `NUMERIC string "${numericString}" exceeds 2 decimal places for minor units`
    );
  }

  const paddedFrac = fracPart.padEnd(2, '0');
  const minorBigInt = sign * BigInt(`${intPart}${paddedFrac}`);

  if (minorBigInt < MIN_SAFE_BIGINT || minorBigInt > MAX_SAFE_BIGINT) {
    throw new RangeError(
      `Monetary minor-unit value "${numericString}" exceeds safe integer bounds`
    );
  }

  return createMoney(Number(minorBigInt), currency);
}

/**
 * Converts an integer-minor-unit Money value to an exact DB NUMERIC(20,2) string
 * using integer/string arithmetic only (never floating point).
 */
export function moneyToNumericString(money: Money): string {
  if (!Number.isSafeInteger(money.amount)) {
    throw new TypeError(
      `Monetary amount must be a safe integer minor unit. Received: ${money.amount}`
    );
  }

  const value = BigInt(money.amount);
  const isNegative = value < 0n;
  const absDigits = (isNegative ? -value : value).toString().padStart(3, '0');
  const intPart = absDigits.slice(0, -2);
  const fracPart = absDigits.slice(-2);

  return `${isNegative ? '-' : ''}${intPart}.${fracPart}`;
}

/**
 * Adds two Money values with matching currency codes using exact integer arithmetic.
 */
export function addMoney(a: Money, b: Money): Money {
  if (a.currency !== b.currency) {
    throw new TypeError(
      `Currency mismatch in addMoney: "${a.currency}" vs "${b.currency}"`
    );
  }
  const sum = BigInt(a.amount) + BigInt(b.amount);
  if (sum < MIN_SAFE_BIGINT || sum > MAX_SAFE_BIGINT) {
    throw new RangeError('Monetary addition overflowed safe integer bounds');
  }
  return createMoney(Number(sum), a.currency);
}

/**
 * Formats Money for display using exact string manipulation (e.g. 250000 AOA -> "2.500,00 Kz").
 */
export function formatMoney(money: Money): string {
  const numeric = moneyToNumericString(money);
  const isNegative = numeric.startsWith('-');
  const unsigned = isNegative ? numeric.slice(1) : numeric;
  const [intPart = '0', fracPart = '00'] = unsigned.split('.');
  const groupedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const sign = isNegative ? '-' : '';
  return `${sign}${groupedInt},${fracPart} ${money.currency === 'AOA' ? 'Kz' : money.currency}`;
}

/**
 * Public liveness response payload contract (/health/live, /health, /api/health).
 * Contains no environment or uptime metadata.
 */
export interface HealthLiveResponse {
  status: 'ok';
  service: string;
  timestamp: string;
}

/**
 * Public readiness response payload contract (/health/ready).
 * Reports database: "connected" only when SELECT 1 succeeds within timeout.
 */
export interface HealthReadyResponse {
  status: 'ok' | 'error';
  service: string;
  timestamp: string;
  database: 'connected' | 'disconnected';
}
