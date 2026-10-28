import {
  DEFAULT_FEE_RATES,
  gatewayFee,
  memberPrice,
  routeTransfer,
  transferFee,
} from '../../../../supabase/functions/_shared/fees';

describe('routeTransfer', () => {
  it('leaves room for the transfer fee on a ₹1,000 payment with no cut', () => {
    // Captured 100000, gateway fee 2360, so 97640 is in our balance.
    const available = 100000 - 2360 - 0;
    expect(routeTransfer(available)).toEqual({ transfer: 97352, transferFee: 288 });
    expect(97352 + 288).toBeLessThanOrEqual(available);
  });

  it('keeps the cut out of the transfer and its fee', () => {
    const cut = 1000; // 1% of ₹1,000
    const available = 100000 - 2360 - cut;
    const result = routeTransfer(available)!;
    expect(result.transfer + result.transferFee).toBeLessThanOrEqual(available);
    expect(result).toEqual({ transfer: 96355, transferFee: 285 });
  });

  it('sends the most the balance allows, never overshooting', () => {
    for (let available = 1; available <= 300000; available += 37) {
      const result = routeTransfer(available);
      if (!result) continue;
      expect(result.transfer + transferFee(result.transfer)).toBeLessThanOrEqual(available);
      const next = result.transfer + 1;
      expect(next + transferFee(next)).toBeGreaterThan(available);
    }
  });

  it('sends nothing when nothing is left', () => {
    expect(routeTransfer(0)).toBeNull();
    expect(routeTransfer(-50)).toBeNull();
    expect(routeTransfer(1)).toBeNull();
    expect(routeTransfer(2)).toBeNull();
  });

  it('follows negotiated rates', () => {
    const rates = { ...DEFAULT_FEE_RATES, transferBps: 0 };
    expect(routeTransfer(97640, rates)).toEqual({ transfer: 97640, transferFee: 0 });
  });
});

describe('memberPrice', () => {
  it('adds the fees on top so the owner gets the full ₹1,000', () => {
    const price = memberPrice(100000, 0, true);
    expect(price).toEqual({
      baseCents: 100000,
      amountCents: 102720,
      chargesCents: 2720,
      gatewayFeeCents: 2425,
      transferFeeCents: 295,
    });
    const available = price.amountCents - gatewayFee(price.amountCents);
    expect(routeTransfer(available)?.transfer).toBe(100000);
  });

  it('pays the owner the price less the cut', () => {
    const price = memberPrice(100000, 1000, true);
    const available = price.amountCents - gatewayFee(price.amountCents) - 1000;
    expect(routeTransfer(available)?.transfer).toBe(99000);
  });

  it('is the smallest amount that covers every fee', () => {
    for (const base of [100, 4999, 50000, 150000, 1234567]) {
      const { amountCents } = memberPrice(base, 0, true);
      const covers = (a: number) => {
        const t = routeTransfer(a - gatewayFee(a));
        return !!t && t.transfer >= base;
      };
      expect(covers(amountCents)).toBe(true);
      expect(covers(amountCents - 1)).toBe(false);
    }
  });

  it('charges the price when the owner bears the fees', () => {
    const price = memberPrice(100000, 0, false);
    expect(price.amountCents).toBe(100000);
    expect(price.chargesCents).toBe(0);
  });
});
