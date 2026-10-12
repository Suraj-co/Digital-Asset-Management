import { IsIn, IsInt, Max, Min } from 'class-validator';
import { PAY_CURRENCIES, type PayCurrency } from '../payroll/payroll-total.js';

export class SetPayRateDto {
  @IsInt()
  @Min(0)
  @Max(100_000_000)
  hourlyRateMinor!: number;

  @IsIn(PAY_CURRENCIES)
  currency!: PayCurrency;
}
