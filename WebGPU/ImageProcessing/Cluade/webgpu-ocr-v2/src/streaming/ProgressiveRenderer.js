// Updates UI incrementally as stages complete
export class ProgressiveRenderer {
  constructor(canvasPanel, progressBar, sidebarList, totalStages) {
    this.canvasPanel  = canvasPanel;
    this.progressBar  = progressBar;
    this.sidebarList  = sidebarList;
    this.totalStages  = totalStages;
    this.doneCount    = 0;
  }

  onStageDone(id, ms) {
    this.doneCount++;
    this.canvasPanel.setDone(id, ms);
    const pct = (this.doneCount / this.totalStages) * 100;
    this.progressBar.set(pct);
    this._updateSidebar(id, "done");
  }

  onStageStart(id) {
    this.canvasPanel.setRunning(id);
    this._updateSidebar(id, "running");
  }

  onStageError(id, err) {
    this.canvasPanel.setError(id, err.message ?? String(err));
    this._updateSidebar(id, "error");
  }

  _updateSidebar(id, state) {
    const el = document.getElementById(`si-${id}`);
    if (el) { el.className = `si ${state}`; el.dataset.state = state; }
  }
}