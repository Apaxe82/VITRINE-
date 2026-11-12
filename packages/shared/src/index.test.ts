import { describe, it, expect } from 'vitest';
import { createMoney, formatMoney, ProductStatus } from './index.ts';

describe('packages/shared: Money and Invariants', () => {
  it('creates money with valid integer minor units', () => {
    const money = createMoney(1500000, 'AOA');
    expect(money.amount).toBe(1500000);
    expect(money.currency).toBe('AOA');
  });

  it('rejects floating-point minor units with TypeError', () => {
    expect(() => createMoney(1500.5, 'AOA')).toThrow(TypeError);
    expect(() => createMoney(12.345, 'AOA')).toThrow(
      /Monetary amount must be an integer minor unit/
    );
  });

  it('formats AOA currency correctly', () => {
    const money = createMoney(250000, 'AOA'); // 2,500.00 Kz
    const formatted = formatMoney(money);
    expect(formatted).toContain('2');
    expect(formatted).toContain('500');
    expect(formatted).toContain('Kz');
  });

  it('verifies product status lifecycle constants', () => {
    expect(ProductStatus.DRAFT).toBe('DRAFT');
    expect(ProductStatus.PENDING_CONFIRMATION).toBe('PENDING_CONFIRMATION');
    expect(ProductStatus.PUBLISHED).toBe('PUBLISHED');
    expect(ProductStatus.ARCHIVED).toBe('ARCHIVED');
  });
});
