import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import type { ComponentRef, RefObject } from 'react';
import { findNodeHandle, type View } from 'react-native';
import { captureRef } from 'react-native-view-shot';

import { qrPng } from '@/features/check-in/qr-png';
import { checkInLink, qrFileName } from '@/features/check-in/rules';

/**
 * Saves the branch's QR card as an image and opens the share sheet, so the
 * admin can send it to the owner on WhatsApp, like a UPI QR, to print. Builds
 * without the screenshot module share the bare QR instead.
 */
export async function shareBranchQr({
  card,
  gymId,
  gymName,
  posterCode,
}: {
  card: RefObject<ComponentRef<typeof View> | null>;
  gymId: string;
  gymName: string;
  posterCode: string;
}) {
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Sharing files isn’t available on this device.');
  }
  const file = new File(Paths.cache, qrFileName(gymName));
  if (file.exists) file.delete();
  try {
    // About 4x the card's size, sharp enough to print on A4.
    const node = findNodeHandle(card.current);
    if (node == null) throw new Error('The QR card isn’t on screen');
    const uri = await captureRef(node, {
      format: 'png',
      quality: 1,
      result: 'tmpfile',
      width: 1056,
    });
    await new File(uri).move(file);
  } catch {
    await file.write(qrPng(checkInLink({ gymId, code: posterCode })));
  }
  await Sharing.shareAsync(file.uri, {
    mimeType: 'image/png',
    UTI: 'public.png',
    dialogTitle: `${gymName} check-in QR`,
  });
}
