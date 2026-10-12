import { formatMinor, payrollTotal } from './payroll-total.js';

describe('payrollTotal', () => {
  it('stays empty until an admin sets a rate', () => {
    const total = payrollTotal(90, null, 'INR');
    expect(total.amountMinor).toBeNull();
    expect(total.acceptedMinutes).toBe(90);
    expect(total.detail).toContain('No hourly rate');
  });

  it('multiplies accepted minutes by the hourly rate', () => {
    const total = payrollTotal(90, 50_000, 'INR');
    expect(total.amountMinor).toBe(75_000);
    expect(formatMinor(total.amountMinor ?? 0, 'INR')).toContain('750.00');
  });

  it('ignores a missing rate of zero minutes as a zero total once the rate exists', () => {
    expect(payrollTotal(0, 60_000, 'USD').amountMinor).toBe(0);
  });

  it('rounds half up to the nearest minor unit', () => {
    expect(payrollTotal(1, 100, 'EUR').amountMinor).toBe(2);
  });
});
