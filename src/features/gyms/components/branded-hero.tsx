import { Image } from 'expo-image';
import { Image as NativeImage, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import type { GymBranding } from '@/features/gyms/branding-store';

/** The sign-in header for a gym the phone remembers: its logo, name and tagline. */
export function BrandedHero({ branding }: { branding: GymBranding }) {
  return (
    <View style={styles.hero} accessible accessibilityLabel={branding.name}>
      <Image
        source={{ uri: branding.logoUrl }}
        style={styles.logo}
        contentFit="cover"
        cachePolicy="disk"
        accessibilityIgnoresInvertColors
      />
      <ThemedText type="title" translate={false} style={styles.centre}>
        {branding.name}
      </ThemedText>
      {branding.tagline ? (
        <ThemedText themeColor="textSecondary" translate={false} style={styles.centre}>
          {branding.tagline}
        </ThemedText>
      ) : null}
    </View>
  );
}

/** "Powered by CoreFit" sign-off: a divider, then the CoreFit logo and name. */
export function PoweredByCoreFit() {
  return (
    <View style={styles.powered}>
      <View style={styles.line}>
        <View style={styles.rule} />
        <ThemedText type="label" themeColor="textSecondary">
          Powered by
        </ThemedText>
        <View style={styles.rule} />
      </View>
      <View style={styles.brand}>
        <NativeImage source={require('@/assets/images/logo.png')} style={styles.mark} />
        <ThemedText type="heading">CoreFit</ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: Spacing.two, paddingTop: Spacing.four },
  logo: { width: 92, height: 92, borderRadius: 22 },
  centre: { textAlign: 'center' },
  powered: { alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.three },
  line: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, alignSelf: 'stretch' },
  rule: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: '#8884' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  mark: { width: 36, height: 36 },
});
