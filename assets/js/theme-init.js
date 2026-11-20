/* Apply the saved theme before first paint. Dark is the default (preserved from v2); key kept for continuity. */
(function () {
  var t = 'dark';
  try { t = localStorage.getItem('vrm_theme') === 'light' ? 'light' : 'dark'; } catch (e) { /* storage blocked */ }
  document.documentElement.setAttribute('data-theme', t);
})();
