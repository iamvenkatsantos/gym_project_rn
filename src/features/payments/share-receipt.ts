import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import type { ComponentRef, RefObject } from 'react';
import { findNodeHandle, Share, type View } from 'react-native';
import { captureRef } from 'react-native-view-shot';

import {
  receiptFileName,
  receiptNumber,
  receiptText,
  type Receipt,
} from '@/features/payments/receipt';

/**
 * Saves the receipt card as an image and opens the share sheet, so it can go on
 * WhatsApp or be printed. Where an image can't be made, shares the receipt as text.
 */
export async function shareReceipt({
  card,
  receipt,
}: {
  card: RefObject<ComponentRef<typeof View> | null>;
  receipt: Receipt;
}) {
  const title = `Receipt ${receiptNumber(receipt.receiptNo)}`;
  let uri: string | null = null;
  try {
    if (!(await Sharing.isAvailableAsync())) throw new Error('No file sharing');
    const node = findNodeHandle(card.current);
    if (node == null) throw new Error('The receipt isn’t on screen');
    const shot = await captureRef(node, {
      format: 'png',
      quality: 1,
      result: 'tmpfile',
      width: 1080,
    });
    const file = new File(Paths.cache, receiptFileName(receipt));
    if (file.exists) file.delete();
    await new File(shot).move(file);
    uri = file.uri;
  } catch {
    uri = null;
  }
  if (uri) {
    await Sharing.shareAsync(uri, { mimeType: 'image/png', UTI: 'public.png', dialogTitle: title });
  } else {
    await Share.share({ title, message: receiptText(receipt) });
  }
}
