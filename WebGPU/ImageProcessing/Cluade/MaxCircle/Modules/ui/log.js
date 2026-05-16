/**
 * ui/log.js
 * Simple log panel helper.
 * Appends coloured <span> lines to #logArea.
 *
 * CSS classes (defined in styles.css):
 *   ''      → dim grey (default)
 *   'ok'    → teal  green
 *   'warn'  → amber
 *   'err'   → red
 *   'info'  → dark blue-grey
 */

const logEl = () => document.getElementById('logArea');

/**
 * Append a message line to the log panel.
 * @param {string} msg
 * @param {string} [cls]  — CSS class: '' | 'ok' | 'warn' | 'err' | 'info'
 */
export function log(msg, cls = '') {
  const el = logEl();
  if (!el) return;
  const sp = document.createElement('span');
  sp.className   = cls;
  sp.textContent = msg + '\n';
  el.appendChild(sp);
  el.scrollTop = el.scrollHeight;
}

/** Clear all log entries. */
export function clearLog() {
  const el = logEl();
  if (el) el.textContent = '';
}
