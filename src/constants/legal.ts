/**
 * Public pages served from web/public by the dashboard worker. Both stores
 * need the privacy policy; Play also asks for the delete-account page.
 */
const SITE = 'https://dashboard.vinven.net';

export const ABOUT_URL = `${SITE}/about`;
export const PRIVACY_POLICY_URL = `${SITE}/privacy`;
export const TERMS_URL = `${SITE}/terms`;
export const SUPPORT_URL = `${SITE}/support`;
export const DELETE_ACCOUNT_URL = `${SITE}/delete-account`;
export const SUPPORT_EMAIL = 'support@vinven.net';
