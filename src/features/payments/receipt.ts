import type { Membership, PaymentMethod } from '@/features/memberships/types';
import { methodLabel } from '@/features/payments/history';
import { formatAmount, formatDate } from '@/lib/format';

/** A membership payment's receipt: the branch that took the money and what it was for. */
export type Receipt = {
  membershipId: string;
  /** Counted per branch from 1. */
  receiptNo: number;
  gymName: string;
  brandName: string;
  address: string;
  city: string;
  phone: string;
  email: string;
  memberName: string;
  memberPhone: string | null;
  planName: string;
  startsOn: string;
  endsOn: string;
  amountCents: number;
  currency: string;
  paymentMethod: PaymentMethod;
  paidAt: string;
  /** Razorpay's payment id, for in-app payments. */
  reference: string | null;
  /** Who took a front-desk payment. */
  receivedBy: string | null;
};

/** Money changed hands, so there's a receipt. Mirrors is_paid_membership() in SQL. */
export function hasReceipt(m: Pick<Membership, 'amountPaidCents' | 'paymentMethod'>) {
  return (m.amountPaidCents ?? 0) > 0 && m.paymentMethod !== 'complimentary';
}

/** "0042": four digits at least, so printed receipts line up. */
export function receiptNumber(n: number) {
  return String(n).padStart(4, '0');
}

/** The branch's address on one line, city last; empty when the owner hasn't added one. */
export function receiptAddress(r: Pick<Receipt, 'address' | 'city'>) {
  const address = r.address.trim();
  const city = r.city.trim();
  // Don't say the city twice when the address already ends with it.
  if (city && address.toLowerCase().endsWith(city.toLowerCase())) return address;
  return [address, city].filter(Boolean).join(', ');
}

/** How it was paid, as the receipt says it. */
export function receiptMethod(method: PaymentMethod) {
  return method === 'online' ? 'Online (Razorpay)' : methodLabel[method];
}

/** A file name WhatsApp shows, e.g. "Receipt 0042 Ravi Kumar.png". */
export function receiptFileName(r: Pick<Receipt, 'receiptNo' | 'memberName'>) {
  const name = r.memberName.replace(/[^\p{L}\p{N} _-]+/gu, '').trim();
  return `Receipt ${receiptNumber(r.receiptNo)}${name ? ` ${name}` : ''}.png`;
}

/** The receipt as plain text, for sharing where an image can't be made. */
export function receiptText(r: Receipt) {
  const header = [r.gymName, receiptAddress(r), r.phone].filter(Boolean);
  return [
    ...header,
    '',
    `Payment receipt No. ${receiptNumber(r.receiptNo)}`,
    `Date: ${formatDate(r.paidAt)}`,
    `Received from: ${r.memberName}`,
    `For: ${r.planName} membership, ${formatDate(r.startsOn)} – ${formatDate(r.endsOn)}`,
    `Paid by: ${receiptMethod(r.paymentMethod)}${r.reference ? ` (${r.reference})` : ''}`,
    `Amount paid: ${formatAmount(r.amountCents, r.currency)}`,
    '',
    'Thank you! Payment receipt, not a tax invoice.',
  ].join('\n');
}

export type ReceiptRow = {
  membership_id: string;
  receipt_no: number;
  gym_name: string;
  brand_name: string;
  address: string;
  city: string;
  phone: string;
  email: string;
  member_name: string;
  member_phone: string | null;
  plan_name: string;
  starts_on: string;
  ends_on: string;
  amount_cents: number;
  currency: string;
  payment_method: PaymentMethod;
  paid_at: string;
  reference: string | null;
  received_by: string | null;
};

/** membership_receipt()'s answer, as the app uses it. */
export function toReceipt(row: ReceiptRow): Receipt {
  return {
    membershipId: row.membership_id,
    receiptNo: row.receipt_no,
    gymName: row.gym_name,
    brandName: row.brand_name,
    address: row.address,
    city: row.city,
    phone: row.phone,
    email: row.email,
    memberName: row.member_name,
    memberPhone: row.member_phone,
    planName: row.plan_name,
    startsOn: row.starts_on,
    endsOn: row.ends_on,
    amountCents: row.amount_cents,
    currency: row.currency,
    paymentMethod: row.payment_method,
    paidAt: row.paid_at,
    reference: row.reference,
    receivedBy: row.received_by,
  };
}
