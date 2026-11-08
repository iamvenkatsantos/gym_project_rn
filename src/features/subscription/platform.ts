import { Platform } from 'react-native';

/**
 * Owners pay CoreFit for their plan in the app on Android and the web dashboard only.
 * The plan is a digital service, so App Store guideline 3.1.1 would need Apple In-App Purchase
 * on iOS. There the app shows the plan's status with no pay button, link or hint of where to pay.
 */
export const canPayPlanInApp = Platform.OS !== 'ios';
