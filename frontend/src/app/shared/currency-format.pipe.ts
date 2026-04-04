import { Pipe, PipeTransform } from '@angular/core';
import { CURRENCY_LOCALE, CURRENCY_CODE } from './constants';

@Pipe({
  name: 'appCurrency',
  standalone: true
})
export class CurrencyFormatPipe implements PipeTransform {
  private formatter = new Intl.NumberFormat(CURRENCY_LOCALE, { style: 'currency', currency: CURRENCY_CODE });

  transform(value: number, signed = false): string {
    if (signed) {
      const prefix = value >= 0 ? '+' : '';
      return prefix + this.formatter.format(value);
    }
    return this.formatter.format(value);
  }
}
