// Structured logger

const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };
let _level = 1;

export const Logger = {
  setLevel(l) { _level = LEVELS[l] ?? 1; },
  debug(...a) { if (_level <= 0) console.debug('[DBG]', ...a); },
  info(...a)  { if (_level <= 1) console.info ('[INF]', ...a); },
  warn(...a)  { if (_level <= 2) console.warn ('[WRN]', ...a); },
  error(...a) { if (_level <= 3) console.error('[ERR]', ...a); },
};
