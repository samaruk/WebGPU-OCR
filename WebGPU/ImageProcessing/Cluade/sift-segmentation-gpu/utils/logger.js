/**
 * utils/logger.js – lightweight DOM logger with timestamps.
 */
export class Logger {
  #el; #maxLines;
  constructor(el, maxLines = 200) { this.#el = el; this.#maxLines = maxLines; }

  #log(msg, cls) {
    if (!this.#el) { console.log(`[${cls}]`, msg); return; }
    const entry = document.createElement('div');
    entry.className = 'log-entry';
    const now = new Date();
    const ts  = `${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}:${now.getSeconds().toString().padStart(2,'0')}.${now.getMilliseconds().toString().padStart(3,'0')}`;
    entry.innerHTML = `<span class="log-time">${ts}</span><span class="log-${cls}">${escHtml(msg)}</span>`;
    this.#el.appendChild(entry);
    while (this.#el.childElementCount > this.#maxLines) this.#el.firstChild.remove();
    this.#el.scrollTop = this.#el.scrollHeight;
  }

  info(msg)    { this.#log(msg, 'info');    console.log('[INFO]',    msg); }
  warn(msg)    { this.#log(msg, 'warn');    console.warn('[WARN]',   msg); }
  error(msg)   { this.#log(msg, 'error');   console.error('[ERROR]', msg); }
  success(msg) { this.#log(msg, 'success'); console.log('[OK]',      msg); }
}

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
