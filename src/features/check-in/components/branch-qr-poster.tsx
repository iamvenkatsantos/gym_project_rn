import { type ComponentRef, type Ref } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { QrCode } from '@/features/check-in/components/qr-code';
import { checkInLink } from '@/features/check-in/rules';

// The card is shared as an image and printed, so it keeps the same print
// colours and text size whatever the admin's theme or font setting.
const INK = '#101814';
const MUTED = '#5B6862';
const BRAND = '#15803D';
const PAPER = '#FFFFFF';
const EDGE = '#D9E2DC';

export type PosterBranch = {
  gymId: string;
  gymName: string;
  brandName: string;
  address: string;
  city: string;
  phone: string;
};

/** The branch's check-in QR with its details, like a UPI QR card. Shared as an image. */
export function BranchQrPoster({
  branch,
  posterCode,
  ref,
}: {
  branch: PosterBranch;
  posterCode: string;
  ref?: Ref<ComponentRef<typeof View>>;
}) {
  const { width } = useWindowDimensions();
  // Fits inside a card on the screen; the shared image is scaled up from it.
  const qrSize = Math.min(width - 112, 232);
  const address = [branch.address, branch.city].filter(Boolean).join(', ');
  // A one-branch brand is named after its gym; don't say it twice.
  const showBrand = branch.brandName && branch.brandName !== branch.gymName;

  return (
    <View ref={ref} collapsable={false} style={styles.card}>
      {showBrand ? (
        <Text allowFontScaling={false} style={styles.brand}>
          {branch.brandName.toUpperCase()}
        </Text>
      ) : null}
      <Text allowFontScaling={false} style={styles.name}>
        {branch.gymName}
      </Text>
      {address ? (
        <Text allowFontScaling={false} style={styles.detail}>
          {address}
        </Text>
      ) : null}
      {branch.phone ? (
        <Text allowFontScaling={false} style={styles.detail}>
          {branch.phone}
        </Text>
      ) : null}
      <View style={styles.qr}>
        <QrCode
          value={checkInLink({ gymId: branch.gymId, code: posterCode })}
          size={qrSize}
          label={`Check-in QR for ${branch.gymName}`}
        />
      </View>
      <Text allowFontScaling={false} style={styles.cta}>
        Scan to check in
      </Text>
      <Text allowFontScaling={false} style={styles.detail}>
        Scan again when you leave
      </Text>
      <Text allowFontScaling={false} style={styles.footer}>
        Use the CoreFit Gym app or your phone&apos;s camera
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    maxWidth: 300,
    alignSelf: 'center',
    alignItems: 'center',
    backgroundColor: PAPER,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: EDGE,
    paddingVertical: 20,
    paddingHorizontal: 12,
    gap: 4,
  },
  brand: {
    color: BRAND,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    textAlign: 'center',
  },
  name: {
    color: INK,
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
  },
  detail: {
    color: MUTED,
    fontSize: 12,
    textAlign: 'center',
  },
  qr: {
    marginVertical: 8,
  },
  cta: {
    color: INK,
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
  },
  footer: {
    color: MUTED,
    fontSize: 10,
    textAlign: 'center',
    marginTop: 6,
  },
});
