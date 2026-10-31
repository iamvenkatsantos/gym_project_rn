import { addDays, spellDate, toIsoDate } from '@/features/memberships/rules';
import type {
  LoyaltyOffer,
  Membership,
  MembershipPlan,
  PlanOffer,
} from '@/features/memberships/types';
import { formatAmount } from '@/lib/format';

/**
 * Price rules for plan offers and the loyalty offer. The database mirrors them
 * in plan_offer_cents() and member_plan_price() (20261031010000_membership_offers),
 * which is what online payments charge.
 */

export const MAX_OFFER_PERCENT = 90;
export const MAX_LOYALTY_PERCENT = 50;
export const MAX_LOYALTY_MONTHS = 24;
/** What a new loyalty offer starts at in the app. */
export const DEFAULT_LOYALTY: LoyaltyOffer = { months: 2, percent: 10 };
/** A break of up to this many days between memberships still counts as paying without a break. */
export const LOYALTY_GAP_DAYS = 7;
export const LOYALTY_LABEL = 'Loyalty offer';

/** What a member pays for a plan, and the offer that brought it down, if any. */
export type OfferPrice = {
  priceCents: number;
  /** The plan's own price. */
  originalCents: number;
  /** "Diwali offer", "Loyalty offer" or null when no offer applies. */
  offer: string | null;
  /** "10% off" or "₹200 off". */
  savings: string | null;
};

/** Percent off a price, rounded to whole rupees so prices stay tidy. */
function percentOff(priceCents: number, percent: number) {
  return Math.min(Math.round((priceCents * percent) / 10000) * 100, priceCents);
}

export function offerLabel(offer: Pick<PlanOffer, 'label'>) {
  return offer.label.trim() || 'Offer';
}

/** Whether the plan's offer applies on this day. */
export function offerActive(plan: Pick<MembershipPlan, 'offer'>, today: Date = new Date()) {
  const offer = plan.offer;
  if (!offer) return false;
  const day = toIsoDate(today);
  return day <= offer.endsOn && (!offer.startsOn || day >= offer.startsOn);
}

/** How much the plan's offer takes off today, in paise. */
export function planOfferCents(plan: MembershipPlan, today: Date = new Date()) {
  const offer = plan.offer;
  if (!offer || !offerActive(plan, today)) return 0;
  return offer.type === 'flat'
    ? Math.min(offer.value, plan.priceCents)
    : percentOff(plan.priceCents, offer.value);
}

/**
 * Days the member paid without a break up to startsOn, counting back from their
 * latest membership. Complimentary memberships don't count.
 */
export function loyaltyStreakDays(memberships: Membership[], memberId: string, startsOn: string) {
  const mine = memberships
    .filter(
      (m) =>
        m.memberId === memberId && m.startsOn < startsOn && m.paymentMethod !== 'complimentary',
    )
    .sort((a, b) => b.endsOn.localeCompare(a.endsOn));
  let from = startsOn;
  for (const m of mine) {
    if (m.endsOn < addDays(from, -(LOYALTY_GAP_DAYS + 1))) break;
    if (m.startsOn < from) from = m.startsOn;
  }
  const [y1, m1, d1] = from.split('-').map(Number);
  const [y2, m2, d2] = startsOn.split('-').map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000);
}

/** Whether a membership starting on startsOn earns the loyalty offer. */
export function earnsLoyalty(
  loyalty: LoyaltyOffer | null | undefined,
  memberships: Membership[],
  memberId: string,
  startsOn: string,
) {
  return !!loyalty && loyaltyStreakDays(memberships, memberId, startsOn) >= loyalty.months * 30;
}

/**
 * A member's price for a plan: the plan's price less whichever takes more off,
 * its offer or the loyalty offer. They never stack.
 */
export function priceFor(
  plan: MembershipPlan,
  {
    loyalty,
    memberships = [],
    memberId,
    startsOn,
    today = new Date(),
  }: {
    loyalty?: LoyaltyOffer | null;
    memberships?: Membership[];
    memberId?: string;
    /** When the new membership would start; defaults to today. */
    startsOn?: string;
    today?: Date;
  } = {},
): OfferPrice {
  const planOff = planOfferCents(plan, today);
  const loyal =
    memberId && earnsLoyalty(loyalty, memberships, memberId, startsOn ?? toIsoDate(today));
  const loyaltyOff = loyal && loyalty ? percentOff(plan.priceCents, loyalty.percent) : 0;
  const base = { originalCents: plan.priceCents };
  if (loyaltyOff > planOff && loyalty) {
    return {
      ...base,
      priceCents: plan.priceCents - loyaltyOff,
      offer: LOYALTY_LABEL,
      savings: `${loyalty.percent}% off`,
    };
  }
  if (planOff > 0 && plan.offer) {
    return {
      ...base,
      priceCents: plan.priceCents - planOff,
      offer: offerLabel(plan.offer),
      savings: savingsText(plan.offer, plan.currency),
    };
  }
  return { ...base, priceCents: plan.priceCents, offer: null, savings: null };
}

export function savingsText(offer: Pick<PlanOffer, 'type' | 'value'>, currency: string) {
  return offer.type === 'percent'
    ? `${offer.value}% off`
    : `${formatAmount(offer.value, currency)} off`;
}

/** "Diwali offer · 10% off till 15 Nov 2026" */
export function offerSummary(plan: MembershipPlan) {
  if (!plan.offer) return null;
  return `${offerLabel(plan.offer)} · ${savingsText(plan.offer, plan.currency)} till ${spellDate(plan.offer.endsOn)}`;
}

/** Why an offer can't be saved, or null. */
export function offerProblem(offer: PlanOffer, priceCents: number | null, today = new Date()) {
  if (!Number.isFinite(offer.value) || offer.value <= 0) return 'Enter the discount.';
  if (
    offer.type === 'percent' &&
    (offer.value > MAX_OFFER_PERCENT || !Number.isInteger(offer.value))
  )
    return `Pick a whole 1–${MAX_OFFER_PERCENT}% off.`;
  if (offer.type === 'flat' && priceCents !== null && offer.value >= priceCents)
    return 'Take off less than the price.';
  if (offer.endsOn < toIsoDate(today)) return 'The end date has passed.';
  if (offer.label.trim().length > 30) return 'Keep the label under 30 characters.';
  return null;
}

/** The announcement an owner posts about a plan offer. */
export function offerAnnouncement(plan: MembershipPlan, gymName: string) {
  const price = priceFor(plan);
  const label = plan.offer ? offerLabel(plan.offer) : 'Offer';
  return {
    title: `${label}: ${plan.name} at ${formatAmount(price.priceCents, plan.currency)}`.slice(
      0,
      80,
    ),
    body: plan.offer
      ? `${plan.name} membership at ${gymName}: ${formatAmount(price.priceCents, plan.currency)} instead of ${formatAmount(plan.priceCents, plan.currency)}, till ${spellDate(plan.offer.endsOn)}. Renew in the app or at the front desk.`
      : '',
  };
}
