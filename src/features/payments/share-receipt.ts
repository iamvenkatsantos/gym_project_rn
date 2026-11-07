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
import { imagePdf } from '@/lib/image-pdf';

export type ReceiptFormat = 'pdf' | 'image';

/** The receipt card as a file in the cache: an A5 PDF or a PNG. */
async function receiptFile(
  card: RefObject<ComponentRef<typeof View> | null>,
  receipt: Receipt,
  format: ReceiptFormat,
) {
  const node = findNodeHandle(card.current);
  if (node == null) throw new Error('The receipt isn’t on screen');
  // About 3x the card's size: sharp on a phone and when printed.
  const shot = await captureRef(node, {
    format: format === 'pdf' ? 'jpg' : 'png',
    quality: format === 'pdf' ? 0.92 : 1,
    result: 'tmpfile',
    width: 1080,
  });
  const file = new File(Paths.cache, receiptFileName(receipt, format === 'pdf' ? 'pdf' : 'png'));
  if (file.exists) file.delete();
  const image = new File(shot);
  if (format === 'pdf') {
    await file.write(imagePdf(await image.bytes(), `Receipt ${receiptNumber(receipt.receiptNo)}`));
    image.delete();
  } else {
    await image.move(file);
  }
  return file.uri;
}

/**
 * Saves the receipt card as a PDF (or an image) and opens the share sheet, so it
 * can go on WhatsApp or be printed. Where a file can't be made, shares it as text.
 */
export async function shareReceipt({
  card,
  receipt,
  format,
}: {
  card: RefObject<ComponentRef<typeof View> | null>;
  receipt: Receipt;
  format: ReceiptFormat;
}) {
  const title = `Receipt ${receiptNumber(receipt.receiptNo)}`;
  let uri: string | null = null;
  try {
    if (!(await Sharing.isAvailableAsync())) throw new Error('No file sharing');
    uri = await receiptFile(card, receipt, format);
  } catch {
    uri = null;
  }
  if (!uri) {
    await Share.share({ title, message: receiptText(receipt) });
  } else if (format === 'pdf') {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      UTI: 'com.adobe.pdf',
      dialogTitle: title,
    });
  } else {
    await Sharing.shareAsync(uri, { mimeType: 'image/png', UTI: 'public.png', dialogTitle: title });
  }
}
