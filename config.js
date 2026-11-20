/*
 * Public runtime configuration. NOT a place for secrets: everything here is visible to anyone.
 * apiUrl: the Apps Script Web App /exec URL of the v3 backend (deployment "VRM MIS v3.0.0").
 * This URL is public by design: the browser must call it. Access is controlled by each person's
 * sign-in on the server, not by keeping this address hidden.
 * Never point this at the legacy v2 backend: the protocols are incompatible.
 */
window.VRM_CONFIG = {
  apiUrl: 'https://script.google.com/macros/s/AKfycbyD2x6BgUPfgzy9vqjVMnH-2rC9jXJay489nuWOQCUkZoawrd5dIUE5HHNOc4-45EY58w/exec',
  environment: 'production'
};
