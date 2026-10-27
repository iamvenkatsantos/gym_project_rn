import { requireOptionalNativeModule } from 'expo';

/**
 * Whether this build has the camera's native module. Builds made before QR
 * check-in don't; there the phone's own camera app opens the QR's link instead.
 */
export const hasCameraModule = requireOptionalNativeModule('ExpoCamera') != null;
