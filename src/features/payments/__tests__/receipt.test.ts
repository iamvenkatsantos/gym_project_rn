import {
  hasReceipt,
  receiptAddress,
  receiptFileName,
  receiptMethod,
  receiptNumber,
  receiptText,
  toReceipt,
  type Receipt,
} from '@/features/payments/receipt';

const receipt: Receipt = {
  membershipId: 'm1',
  receiptNo: 42,
  gymName: 'Pulse Fitness Anna Nagar',
  brandName: 'Pulse Fitness',
  address: '12, 2nd Avenue, Anna Nagar',
  city: 'Chennai',
  phone: '9840012345',
  email: '',
  memberName: 'Ravi Kumar',
  memberPhone: '9876543210',
  planName: 'Monthly',
  startsOn: '2026-11-01',
  endsOn: '2026-11-30',
  amountCents: 150000,
  currency: 'INR',
  paymentMethod: 'upi',
  paidAt: '2026-11-01T10:30:00Z',
  reference: null,
  receivedBy: 'Olga',
};

describe('hasReceipt', () => {
  it('needs money paid, and not complimentary', () => {
    expect(hasReceipt({ amountPaidCents: 150000, paymentMethod: 'cash' })).toBe(true);
    expect(hasReceipt({ amountPaidCents: 150000, paymentMethod: 'online' })).toBe(true);
    expect(hasReceipt({ amountPaidCents: 0, paymentMethod: 'cash' })).toBe(false);
    expect(hasReceipt({ amountPaidCents: null, paymentMethod: null })).toBe(false);
    expect(hasReceipt({ amountPaidCents: 5000, paymentMethod: 'complimentary' })).toBe(false);
  });
});

describe('receipt formatting', () => {
  it('pads the number to four digits', () => {
    expect(receiptNumber(7)).toBe('0007');
    expect(receiptNumber(12345)).toBe('12345');
  });

  it('puts the city after the address once', () => {
    expect(receiptAddress(receipt)).toBe('12, 2nd Avenue, Anna Nagar, Chennai');
    expect(receiptAddress({ address: 'Anna Nagar, Chennai', city: 'chennai' })).toBe(
      'Anna Nagar, Chennai',
    );
    expect(receiptAddress({ address: ' ', city: 'Chennai' })).toBe('Chennai');
    expect(receiptAddress({ address: '', city: '' })).toBe('');
  });

  it('names in-app payments after Razorpay', () => {
    expect(receiptMethod('online')).toBe('Online (Razorpay)');
    expect(receiptMethod('upi')).toBe('UPI');
  });

  it('makes a safe file name', () => {
    expect(receiptFileName({ receiptNo: 42, memberName: 'Ravi/Kumar' }, 'pdf')).toBe(
      'Receipt 0042 RaviKumar.pdf',
    );
    expect(receiptFileName({ receiptNo: 3, memberName: '' }, 'png')).toBe('Receipt 0003.png');
  });

  it('shares as text with the gym, number and amount, and says it is not a tax invoice', () => {
    const text = receiptText(receipt);
    expect(text.split('\n')[0]).toBe('Pulse Fitness Anna Nagar');
    expect(text).toContain('12, 2nd Avenue, Anna Nagar, Chennai');
    expect(text).toContain('Payment receipt No. 0042');
    expect(text).toContain('Received from: Ravi Kumar');
    expect(text).toContain('Paid by: UPI');
    expect(text).toMatch(/Amount paid: .*1,500/);
    expect(text).toContain('not a tax invoice');
  });

  it('reads the server row', () => {
    const r = toReceipt({
      membership_id: 'm1',
      receipt_no: 1,
      gym_name: 'G',
      brand_name: 'B',
      address: 'A',
      city: 'C',
      phone: '',
      email: '',
      member_name: 'M',
      member_phone: null,
      plan_name: 'P',
      starts_on: '2026-11-01',
      ends_on: '2026-11-30',
      amount_cents: 100,
      currency: 'INR',
      payment_method: 'online',
      paid_at: '2026-11-01T00:00:00Z',
      reference: 'pay_1',
      received_by: null,
    });
    expect(r).toMatchObject({ receiptNo: 1, gymName: 'G', reference: 'pay_1', memberPhone: null });
  });
});
