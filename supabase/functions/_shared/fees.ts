// Razorpay's fees on an online payment, as pure functions so the edge functions
// and the app's tests share them. No Deno or network code here.
//
// Razorpay takes two fees from the platform account, each with 18% GST on top:
// - the gateway fee on what the member pays (2% on most Indian methods), taken
//   before the money reaches our balance;
// - the Route transfer fee (0.25%) on what we pass to the owner's linked account,
//   taken from our balance on top of the transfer. Razorpay refuses the transfer
//   if the balance can't cover both.
// Rates can be negotiated per account, so razorpay.ts reads them from env.

export type FeeRates = {
  /** Razorpay's gateway fee, in basis points of the payment (200 = 2%). */
  gatewayBps: number;
  /** Razorpay's Route transfer fee, in basis points of the transfer (25 = 0.25%). */
  transferBps: number;
  /** GST charged on each fee, in percent. */
  gstPercent: number;
};

export const DEFAULT_FEE_RATES: FeeRates = { gatewayBps: 200, transferBps: 25, gstPercent: 18 };

function ceilDiv(a: number, b: number) {
  return Math.ceil(a / b);
}

/**
 * A fee of `bps` on `amount` plus GST on it, in paise. Both parts round up, so
 * whichever way Razorpay rounds, we never count less than it takes.
 */
export function feeWithGst(amount: number, bps: number, gstPercent: number) {
  if (amount <= 0) return 0;
  const fee = ceilDiv(amount * bps, 10000);
  return fee + ceilDiv(fee * gstPercent, 100);
}

export function gatewayFee(amount: number, rates: FeeRates = DEFAULT_FEE_RATES) {
  return feeWithGst(amount, rates.gatewayBps, rates.gstPercent);
}

export function transferFee(amount: number, rates: FeeRates = DEFAULT_FEE_RATES) {
  return feeWithGst(amount, rates.transferBps, rates.gstPercent);
}

/**
 * The largest transfer our balance can make once Razorpay's transfer fee is
 * taken from it too: transfer + transferFee(transfer) <= available. Null when
 * nothing is left to send.
 */
export function routeTransfer(available: number, rates: FeeRates = DEFAULT_FEE_RATES) {
  if (available <= 0) return null;
  // available / (1 + rate × (1 + GST)), in whole numbers.
  let transfer = Math.floor(
    (available * 1000000) / (1000000 + rates.transferBps * (100 + rates.gstPercent)),
  );
  // Rounding the fee up can still overshoot by a paisa or two.
  while (transfer > 0 && transfer + transferFee(transfer, rates) > available) transfer -= 1;
  if (transfer <= 0) return null;
  return { transfer, transferFee: transferFee(transfer, rates) };
}

/** What a member pays for a plan when the online charges are passed on to them. */
export type MemberPrice = {
  /** The plan's price: what the gym receives. */
  baseCents: number;
  /** What the member pays: the price plus the charges. */
  amountCents: number;
  /** amountCents − baseCents, shown to the member as online payment charges. */
  chargesCents: number;
  /** Razorpay's expected gateway fee with GST, part of the charges. */
  gatewayFeeCents: number;
  /** Razorpay's expected Route transfer fee with GST, part of the charges. */
  transferFeeCents: number;
  /** CoreFit Gym's cut, part of the charges when the member pays the fees; else 0. */
  platformFeeCents: number;
};

/**
 * Grosses up a plan's price so that after Razorpay's gateway fee, CoreFit Gym's
 * cut and the transfer fee, the owner still receives the full `baseCents`.
 * With feesOnMember false the member pays the price and the owner bears the
 * fees and the cut.
 */
export function memberPrice(
  baseCents: number,
  cutCents: number,
  feesOnMember: boolean,
  rates: FeeRates = DEFAULT_FEE_RATES,
): MemberPrice {
  if (!feesOnMember) {
    return {
      baseCents,
      amountCents: baseCents,
      chargesCents: 0,
      gatewayFeeCents: gatewayFee(baseCents, rates),
      transferFeeCents: 0,
      platformFeeCents: 0,
    };
  }
  const toOwner = baseCents;
  const transfer = transferFee(toOwner, rates);
  // Our balance after the gateway fee must cover the transfer, its fee and the cut.
  const needed = toOwner + transfer + cutCents;
  let amount = Math.ceil(
    (needed * 1000000) / (1000000 - rates.gatewayBps * (100 + rates.gstPercent)),
  );
  while (amount - gatewayFee(amount, rates) < needed) amount += 1;
  while (amount - 1 - gatewayFee(amount - 1, rates) >= needed) amount -= 1;
  return {
    baseCents,
    amountCents: amount,
    chargesCents: amount - baseCents,
    // Whatever the gateway fee's rounding leaves over goes with it, so the
    // parts the member sees add up to the charges.
    gatewayFeeCents: amount - baseCents - transfer - cutCents,
    transferFeeCents: transfer,
    platformFeeCents: cutCents,
  };
}
