export const PAY_CURRENCIES = ['INR', 'USD', 'EUR'] as const;
export type PayCurrency = (typeof PAY_CURRENCIES)[number];

export type PayrollTotal = {
  acceptedMinutes: number;
  hourlyRateMinor: number | null;
  currency: PayCurrency;
  amountMinor: number | null;
  detail: string;
};

export function payCurrency(value: string): PayCurrency {
  if (value === 'USD' || value === 'EUR') {
    return value;
  }
  return 'INR';
}

export function formatMinor(amountMinor: number, currency: string): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: payCurrency(currency),
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amountMinor / 100);
}

/**
 * Accepted minutes times the company hourly rate.
 * The rate is minor units per hour (paise, cents). Open, submitted, and
 * returned minutes are not included. Rounding is half up to the nearest minor unit.
 */
export function payrollTotal(
  acceptedMinutes: number,
  hourlyRateMinor: number | null,
  currency: string,
): PayrollTotal {
  const code = payCurrency(currency);
  if (hourlyRateMinor === null) {
    return {
      acceptedMinutes,
      hourlyRateMinor: null,
      currency: code,
      amountMinor: null,
      detail:
        'No hourly rate is set. An admin sets the company rate before a payroll total is calculated.',
    };
  }
  const amountMinor = Math.round((acceptedMinutes * hourlyRateMinor) / 60);
  return {
    acceptedMinutes,
    hourlyRateMinor,
    currency: code,
    amountMinor,
    detail:
      'The total is accepted minutes times the company hourly rate. Open, submitted, and returned minutes are not included.',
  };
}
