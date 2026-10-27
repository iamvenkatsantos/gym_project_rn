import { create } from 'qrcode';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

/** Scanners need dark modules on light, whatever the app's theme. */
const QR_DARK = '#000000';
const QR_LIGHT = '#FFFFFF';
/** The blank border scanners look for, in modules. */
const QUIET_ZONE = 2;

/** Each row as runs of dark modules: [start column, length]. Fewer views than one per module. */
export function qrRows(text: string): { size: number; rows: [number, number][][] } {
  const { modules } = create(text, { errorCorrectionLevel: 'M' });
  const rows: [number, number][][] = [];
  for (let y = 0; y < modules.size; y++) {
    const runs: [number, number][] = [];
    for (let x = 0; x < modules.size; x++) {
      if (!modules.get(y, x)) continue;
      const last = runs.at(-1);
      if (last && last[0] + last[1] === x) last[1] += 1;
      else runs.push([x, 1]);
    }
    rows.push(runs);
  }
  return { size: modules.size, rows };
}

/** A QR code drawn with plain views, so it needs no native module. At most `size` wide. */
export function QrCode({
  value,
  size,
  label,
}: {
  value: string;
  size: number;
  /** Read by screen readers. */
  label: string;
}) {
  const qr = useMemo(() => qrRows(value), [value]);
  // Whole pixels, so rows meet without hairline gaps.
  const cell = Math.max(1, Math.floor(size / (qr.size + QUIET_ZONE * 2)));
  const side = cell * (qr.size + QUIET_ZONE * 2);

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={label}
      style={[styles.box, { width: side, height: side, padding: cell * QUIET_ZONE }]}>
      {qr.rows.map((runs, y) => (
        <View key={y} style={{ height: cell }}>
          {runs.map(([x, length]) => (
            <View
              key={x}
              style={[styles.run, { left: x * cell, width: length * cell, height: cell }]}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: QR_LIGHT,
  },
  run: {
    position: 'absolute',
    top: 0,
    backgroundColor: QR_DARK,
  },
});
