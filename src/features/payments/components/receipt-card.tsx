import { type ComponentRef, type ReactNode, type Ref, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  receiptAddress,
  receiptMethod,
  receiptNumber,
  type Receipt,
} from '@/features/payments/receipt';
import { formatAmount, formatDate } from '@/lib/format';

// The receipt is shared as an image and printed, so it keeps print colours and
// text size whatever the phone's theme or font setting (like the branch QR card).
const INK = '#101814';
const MUTED = '#5B6862';
const BRAND = '#15803D';
const PAPER = '#FFFFFF';
const EDGE = '#D9E2DC';
// imagePdf()'s A5 page and margin, in points.
const PAGE_WIDTH = 420;
const PAGE_HEIGHT = 595;
const PAGE_MARGIN = 24;

/** A membership payment receipt with the branch's name and address, like a printed one. */
export function ReceiptCard({
  receipt,
  ref,
}: {
  receipt: Receipt;
  ref?: Ref<ComponentRef<typeof View>>;
}) {
  const address = receiptAddress(receipt);
  const contact = [receipt.phone, receipt.email].filter(Boolean).join(' · ');
  // A one-branch brand is named after its gym; don't say it twice.
  const showBrand = receipt.brandName && receipt.brandName !== receipt.gymName;

  return (
    // The white backing keeps the rounded corners white in the PDF's JPEG, not black.
    <View ref={ref} collapsable={false} style={styles.backing}>
      <View style={styles.card}>
        <View style={styles.head}>
          {showBrand ? (
            <Text allowFontScaling={false} style={styles.brand}>
              {receipt.brandName.toUpperCase()}
            </Text>
          ) : null}
          <Text allowFontScaling={false} style={styles.gym}>
            {receipt.gymName}
          </Text>
          {address ? (
            <Text allowFontScaling={false} style={styles.muted}>
              {address}
            </Text>
          ) : null}
          {contact ? (
            <Text allowFontScaling={false} style={styles.muted}>
              {contact}
            </Text>
          ) : null}
        </View>

        <View style={styles.rule} />
        <View style={styles.titleRow}>
          <Text allowFontScaling={false} style={styles.title}>
            PAYMENT RECEIPT
          </Text>
          <Text allowFontScaling={false} style={styles.number}>
            No. {receiptNumber(receipt.receiptNo)}
          </Text>
        </View>
        <Line label="Date" value={formatDate(receipt.paidAt)} />
        <View style={styles.rule} />

        <Line label="Received from" value={receipt.memberName} />
        {receipt.memberPhone ? <Line label="Mobile" value={receipt.memberPhone} /> : null}
        <Line label="For" value={`${receipt.planName} membership`} />
        <Line
          label="Period"
          value={`${formatDate(receipt.startsOn)} – ${formatDate(receipt.endsOn)}`}
        />
        <Line label="Paid by" value={receiptMethod(receipt.paymentMethod)} />
        {receipt.reference ? <Line label="Reference" value={receipt.reference} /> : null}
        {receipt.receivedBy ? <Line label="Received by" value={receipt.receivedBy} /> : null}

        <View style={styles.total}>
          <Text allowFontScaling={false} style={styles.totalLabel}>
            Amount paid
          </Text>
          <Text allowFontScaling={false} style={styles.totalValue}>
            {formatAmount(receipt.amountCents, receipt.currency)}
          </Text>
        </View>

        <Text allowFontScaling={false} style={styles.thanks}>
          Thank you for training with us!
        </Text>
        <Text allowFontScaling={false} style={styles.footer}>
          Payment receipt, not a tax invoice · CoreFit
        </Text>
      </View>
    </View>
  );
}

/**
 * The A5 page the PDF puts the receipt on, so the screen previews the PDF as shared.
 * Same proportions and margins as imagePdf() (420 × 595 pt, 24 pt margins).
 */
export function ReceiptPage({ children }: { children: ReactNode }) {
  // The page is laid out at its real size in points, then scaled to fit the screen.
  const [scale, setScale] = useState(0);
  return (
    <View
      style={[styles.pageFrame, { height: PAGE_HEIGHT * scale }]}
      onLayout={(e) => setScale(Math.min(e.nativeEvent.layout.width / PAGE_WIDTH, 1))}>
      <View
        style={[
          styles.page,
          {
            opacity: scale ? 1 : 0,
            transform: [
              { translateX: (-PAGE_WIDTH * (1 - scale)) / 2 },
              { translateY: (-PAGE_HEIGHT * (1 - scale)) / 2 },
              { scale: scale || 1 },
            ],
          },
        ]}>
        {children}
      </View>
    </View>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.line}>
      <Text allowFontScaling={false} style={styles.label}>
        {label}
      </Text>
      <Text allowFontScaling={false} style={styles.value}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pageFrame: {
    width: '100%',
    maxWidth: PAGE_WIDTH,
    alignSelf: 'center',
    overflow: 'hidden',
  },
  page: {
    width: PAGE_WIDTH,
    height: PAGE_HEIGHT,
    backgroundColor: PAPER,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: EDGE,
    padding: PAGE_MARGIN,
  },
  backing: {
    width: '100%',
    maxWidth: PAGE_WIDTH - PAGE_MARGIN * 2,
    alignSelf: 'center',
    backgroundColor: PAPER,
  },
  card: {
    backgroundColor: PAPER,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: EDGE,
    padding: 18,
    gap: 6,
  },
  head: {
    alignItems: 'center',
    gap: 2,
  },
  brand: {
    color: BRAND,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    textAlign: 'center',
  },
  gym: {
    color: INK,
    fontSize: 19,
    fontWeight: '800',
    textAlign: 'center',
  },
  muted: {
    color: MUTED,
    fontSize: 12,
    textAlign: 'center',
  },
  rule: {
    height: 1,
    backgroundColor: EDGE,
    marginVertical: 6,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 8,
  },
  title: {
    color: BRAND,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1,
  },
  number: {
    color: INK,
    fontSize: 13,
    fontWeight: '700',
  },
  line: {
    flexDirection: 'row',
    gap: 12,
  },
  label: {
    color: MUTED,
    fontSize: 13,
    width: 100,
  },
  value: {
    color: INK,
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
  },
  total: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: EDGE,
    paddingVertical: 10,
    marginTop: 6,
  },
  totalLabel: {
    color: INK,
    fontSize: 15,
    fontWeight: '700',
  },
  totalValue: {
    color: INK,
    fontSize: 22,
    fontWeight: '800',
  },
  thanks: {
    color: INK,
    fontSize: 13,
    textAlign: 'center',
    marginTop: 6,
  },
  footer: {
    color: MUTED,
    fontSize: 10,
    textAlign: 'center',
  },
});
