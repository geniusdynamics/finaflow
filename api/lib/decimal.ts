import Decimal from "decimal.js";
Decimal.set({ precision: 15, rounding: Decimal.ROUND_HALF_UP });
export const d = (value: number | string | Decimal) => new Decimal(value);
export { Decimal };
