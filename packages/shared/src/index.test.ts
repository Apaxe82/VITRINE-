import { describe, it, expect } from 'vitest';
import {
  addMoney,
  createMoney,
  formatMoney,
  moneyToNumericString,
  parseNumericToMoney,
  ProductStatus,
} from './index.ts';

describe('packages/shared: Exact Money Conversion Boundary and Invariants', () => {
  it('creates money with valid integer minor units', () => {
    const money = createMoney(1500000, 'AOA');
    expect(money.amount).toBe(1500000);
    expect(money.currency).toBe('AOA');
  });

  it('rejects floating-point minor units with TypeError', () => {
    expect(() => createMoney(1500.5, 'AOA')).toThrow(TypeError);
    expect(() => createMoney(12.345, 'AOA')).toThrow(
      /Monetary amount must be a safe integer minor unit/
    );
  });

  it('round-trips DB NUMERIC string "12345678.90" exactly without floating point', () => {
    const parsed = parseNumericToMoney('12345678.90', 'AOA');
    expect(parsed.amount).toBe(1234567890);
    expect(parsed.currency).toBe('AOA');
    expect(moneyToNumericString(parsed)).toBe('12345678.90');
  });

  it('adds "0.10" and "0.20" to total exactly "0.30"', () => {
    const a = parseNumericToMoney('0.10', 'AOA');
    const b = parseNumericToMoney('0.20', 'AOA');
    const total = addMoney(a, b);
    expect(total.amount).toBe(30);
    expect(moneyToNumericString(total)).toBe('0.30');
  });

  it('parses integer, single-decimal, zero, and negative NUMERIC strings accurately', () => {
    expect(parseNumericToMoney('0', 'AOA').amount).toBe(0);
    expect(moneyToNumericString(parseNumericToMoney('0', 'AOA'))).toBe('0.00');
    expect(parseNumericToMoney('1500', 'AOA').amount).toBe(150000);
    expect(parseNumericToMoney('1500.5', 'AOA').amount).toBe(150050);
    expect(moneyToNumericString(parseNumericToMoney('-5.05', 'AOA'))).toBe('-5.05');
  });

  it('rejects >2 decimal places, scientific notation, empty, and non-numeric strings', () => {
    expect(() => parseNumericToMoney('12.345', 'AOA')).toThrow(TypeError);
    expect(() => parseNumericToMoney('1e5', 'AOA')).toThrow(TypeError);
    expect(() => parseNumericToMoney('', 'AOA')).toThrow(TypeError);
    expect(() => parseNumericToMoney('NaN', 'AOA')).toThrow(TypeError);
    expect(() => parseNumericToMoney('12.3.4', 'AOA')).toThrow(TypeError);
  });

  it('rejects currency mismatch in addMoney', () => {
    const aoa = parseNumericToMoney('10.00', 'AOA');
    const usd = parseNumericToMoney('10.00', 'USD');
    expect(() => addMoney(aoa, usd)).toThrow(TypeError);
  });

  it('formats AOA currency via exact string formatting', () => {
    const money = createMoney(250000, 'AOA');
    expect(formatMoney(money)).toBe('2.500,00 Kz');
  });

  it('verifies product status lifecycle constants', () => {
    expect(ProductStatus.DRAFT).toBe('DRAFT');
    expect(ProductStatus.PENDING_CONFIRMATION).toBe('PENDING_CONFIRMATION');
    expect(ProductStatus.PUBLISHED).toBe('PUBLISHED');
    expect(ProductStatus.ARCHIVED).toBe('ARCHIVED');
  });
});
