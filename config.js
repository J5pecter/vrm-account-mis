/*
 * Public runtime configuration. NOT a place for secrets: everything here is visible to anyone.
 * apiUrl: the Apps Script Web App /exec URL of the v3 backend for this environment.
 * Leave empty until the approved v3 deployment exists (see docs/06_DEPLOYMENT_RUNBOOK.md).
 * Never point this at the legacy v2 backend: the protocols are incompatible.
 */
window.VRM_CONFIG = {
  apiUrl: '',
  environment: 'unconfigured'
};
