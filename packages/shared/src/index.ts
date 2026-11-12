/**
 * @file packages/shared/src/index.ts
 * @description Shared domain types, constants, and validators for the Vitrine platform.
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
 * Monetary representation.
 * STRICT INVARIANT: Money is stored as integer minor units with an explicit currency code.
 * Floating point representation for monetary values is strictly forbidden.
 */
export interface Money {
  /** Amount in integer minor units (e.g. 1500000 = 15,000.00 Kz) */
  amount: number;
  /** ISO 4217 currency code (default: AOA - Angolan Kwanza) */
  currency: string;
}

/**
 * Safely constructs a Money object ensuring integer minor units.
 * Throws an error if amount is not an integer.
 */
export function createMoney(minorUnits: number, currency = 'AOA'): Money {
  if (!Number.isInteger(minorUnits)) {
    throw new TypeError(
      `Monetary amount must be an integer minor unit. Received non-integer: ${minorUnits}`
    );
  }
  return {
    amount: minorUnits,
    currency,
  };
}

/**
 * Formats minor units for display (e.g. 1500000 AOA -> "15.000,00 Kz")
 */
export function formatMoney(money: Money): string {
  const major = (money.amount / 100).toLocaleString('pt-AO', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${major} ${money.currency === 'AOA' ? 'Kz' : money.currency}`;
}

/**
 * Health check response payload contract.
 */
export interface HealthStatusResponse {
  status: 'ok' | 'degraded' | 'error';
  service: string;
  version: string;
  timestamp: string;
  uptimeSeconds: number;
  environment: string;
  checks: {
    system: 'ok';
    database?: 'connected' | 'disconnected' | 'unconfigured';
  };
}
