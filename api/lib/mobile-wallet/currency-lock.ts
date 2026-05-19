// ABOUTME: Currency constraint validation and auto-conversion for provider-specific currency restrictions.
// ABOUTME: M-PESA only supports KES; this module blocks invalid combinations and handles conversion with disclosures.

import { d, Decimal } from "../decimal";
import { CurrencyConverter } from "../currency-converter";

export interface CurrencyValidationResult {
  valid: boolean;
  error?: string;
  suggestedAction?: string;
}

export interface ConversionDisclosure {
  originalAmount: Decimal;
  originalCurrency: string;
  convertedAmount: Decimal;
  convertedCurrency: string;
  rate: Decimal;
  fee?: Decimal;
  disclosure: string;
}

export function validateProviderCurrency(
  provider: string,
  currency: string,
  supportedCurrencies: string[]
): CurrencyValidationResult {
  if (!supportedCurrencies.includes(currency)) {
    return {
      valid: false,
      error: `${provider} only supports ${supportedCurrencies.join(", ")}. ${currency} transactions cannot be processed through this provider.`,
      suggestedAction: `Convert ${currency} to ${supportedCurrencies[0]} before initiating payment through ${provider}.`,
    };
  }
  return { valid: true };
}

export async function ensureProviderCurrency(
  amount: Decimal,
  fromCurrency: string,
  toCurrency: string,
  converter: CurrencyConverter
): Promise<ConversionDisclosure> {
  if (fromCurrency === toCurrency) {
    return {
      originalAmount: amount,
      originalCurrency: fromCurrency,
      convertedAmount: amount,
      convertedCurrency: toCurrency,
      rate: d(1),
      disclosure: `No conversion needed — transaction is already in ${toCurrency}.`,
    };
  }

  const { converted, rate } = await converter.convert(amount, fromCurrency, toCurrency, {
    round: true,
    decimalPlaces: 2,
  });

  const feeAmount = amount.mul(d("0.01"));
  const displayFee = fromCurrency === "KES"
    ? undefined
    : feeAmount;

  const feeStr = displayFee ? ` A conversion fee of ${displayFee.toFixed(2)} ${fromCurrency} may apply.` : "";

  return {
    originalAmount: amount,
    originalCurrency: fromCurrency,
    convertedAmount: converted,
    convertedCurrency: toCurrency,
    rate,
    fee: displayFee,
    disclosure: `Your ${fromCurrency} ${amount.toFixed(2)} will be converted at ${rate.toFixed(6)} to ${converted.toFixed(2)} ${toCurrency}.${feeStr}`,
  };
}
