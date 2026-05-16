export class ResultStreamer {
  constructor(resultPanel) { this.panel = resultPanel; }
  stream(doc) { this.panel.render(doc); }
}