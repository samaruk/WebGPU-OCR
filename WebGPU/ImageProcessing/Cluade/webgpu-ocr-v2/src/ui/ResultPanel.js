// src/ui/ResultPanel.js – renders final OCR result
export class ResultPanel {
  constructor(container) {
    this.container = container;
  }

  render(doc) {
    if (!doc) return;
    this.container.innerHTML = '';
    const el = document.createElement('div');
    el.style.cssText = 'padding:16px;font:11px "IBM Plex Mono",monospace;color:#e8e8f4;';
    el.innerHTML = `
      <div style="color:#00e676;font-weight:700;font-size:10px;letter-spacing:.12em;margin-bottom:10px;">
        EXTRACTED TEXT — ${doc.stats.charCount} chars
      </div>
      <pre style="white-space:pre-wrap;color:#c8c8d8;font-size:10px;line-height:1.7;">${escapeHtml(doc.fullText || '(no text recognized)')}</pre>
      <div style="margin-top:14px;color:#6a6f8a;font-size:9px;">
        ${doc.stats.blockCount} blocks · ${doc.stats.tableCount} tables · ${doc.stats.regionCount} regions
      </div>
    `;
    this.container.appendChild(el);
  }
}

function escapeHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}