import { Redirect, router } from 'expo-router';
import { useEffect } from 'react';

/**
 * Razorpay's page sends the browser to corefit://payment-return when the member
 * is done. The in-app browser picks that up and the pay flow opens the payment's
 * status itself, so this route only steps out of the way when Android also
 * delivers the link to the router.
 */
export default function PaymentReturn() {
  const canGoBack = router.canGoBack();
  useEffect(() => {
    if (canGoBack) router.back();
  }, [canGoBack]);
  return canGoBack ? null : <Redirect href="/" />;
}
