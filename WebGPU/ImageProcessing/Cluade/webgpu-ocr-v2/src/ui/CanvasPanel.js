// src/ui/CanvasPanel.js – builds stage canvas cards and returns canvasMap
export class CanvasPanel {
  constructor(container, stages) {
    this.container = container;
    this.stages    = stages;
    this.canvasMap = {};
    this._build();
  }

  _build() {
    this.container.innerHTML = '';
    for (const s of this.stages) {
      const card = document.createElement('div');
      card.className = 'cv-card';
      card.id = `card-${s.id}`;
      card.innerHTML = `
        <div class="cv-hdr">
          <span class="cv-tag">${String(s.idx).padStart(2,'0')}</span>
          <span class="cv-name">${s.label}</span>
          <span class="cv-ms" id="ms-${s.id}">—</span>
        </div>
        <div class="cv-body">
          <canvas id="cv-${s.id}" width="320" height="120"></canvas>
        </div>
        <div class="cv-foot">
          <span><span class="dot" id="dot-${s.id}"></span>${s.id}</span>
          <span id="info-${s.id}">waiting</span>
        </div>
      `;
      this.container.appendChild(card);
      this.canvasMap[s.id] = card.querySelector(`#cv-${s.id}`);
    }
  }

  setRunning(id) {
    document.getElementById(`card-${id}`)?.classList.add('running');
    document.getElementById(`dot-${id}`)?.classList.remove('ok');
    document.getElementById(`info-${id}`).textContent = 'running…';
  }

  setDone(id, ms) {
    const card = document.getElementById(`card-${id}`);
    card?.classList.remove('running');
    card?.classList.add('done');
    const dot = document.getElementById(`dot-${id}`);
    if (dot) dot.classList.add('ok');
    const msEl = document.getElementById(`ms-${id}`);
    if (msEl) msEl.textContent = `${ms.toFixed(0)}ms`;
    const info = document.getElementById(`info-${id}`);
    if (info) info.textContent = 'done';
  }

  setError(id, msg) {
    document.getElementById(`card-${id}`)?.classList.remove('running');
    const info = document.getElementById(`info-${id}`);
    if (info) { info.textContent = 'error: ' + msg.slice(0,40); info.style.color='#ff3d57'; }
  }
}