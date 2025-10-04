export class GridRenderer {
  constructor(canvas, opts = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;

    this.gridW = opts.gridW ?? 1000;
    this.gridH = opts.gridH ?? 1000;

    this.baseCellSize = opts.cellSize ?? 20;
    this.zoom = 1;
    this.minZoom = 0.25;
    this.maxZoom = 8;
    this.pan = { x: 0, y: 0 };

    this.off = document.createElement('canvas');
    this.off.width = this.gridW;
    this.off.height = this.gridH;
    this.offCtx = this.off.getContext('2d', { willReadFrequently: true });
    this.offCtx.imageSmoothingEnabled = false;
    this.offCtx.fillStyle = '#ffffff';
    this.offCtx.fillRect(0, 0, this.gridW, this.gridH);

    this.meta = new Map();

    this.showGrid = true;
    this.gridMinPx = 6;
    this.gridColor = '#000';
    this.gridAlpha = 0.12;
    this.gridBoldEvery = 10;
    this.gridBoldAlpha = 0.22;

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.canvas.parentElement);
    this.resize();
    this.render();
  }

  setBaseCellSize(v) {
    this.baseCellSize = Math.max(2, Math.min(40, v | 0));
    this.render();
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = Math.max(1, Math.floor(rect.width * devicePixelRatio));
    this.canvas.height = Math.max(1, Math.floor(rect.height * devicePixelRatio));
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.imageSmoothingEnabled = false;
    this.render();
  }

  get scale() {
    return this.baseCellSize * this.zoom * devicePixelRatio;
  }

  toGrid(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    const px = (clientX - rect.left) * devicePixelRatio;
    const py = (clientY - rect.top) * devicePixelRatio;
    const x = Math.floor((px - this.pan.x) / this.scale);
    const y = Math.floor((py - this.pan.y) / this.scale);
    if (x < 0 || y < 0 || x >= this.gridW || y >= this.gridH) return null;
    return { x, y };
  }

  zoomAt(clientX, clientY, factor) {
    const rect = this.canvas.getBoundingClientRect();
    const px = (clientX - rect.left) * devicePixelRatio;
    const py = (clientY - rect.top) * devicePixelRatio;

    const worldX = (px - this.pan.x) / this.scale;
    const worldY = (py - this.pan.y) / this.scale;

    const newZoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.zoom * factor));
    this.zoom = newZoom;

    const newScale = this.scale;
    this.pan.x = px - worldX * newScale;
    this.pan.y = py - worldY * newScale;

    this.render();
  }

  panBy(dx, dy) {
    this.pan.x += dx * devicePixelRatio;
    this.pan.y += dy * devicePixelRatio;
    this.render();
  }

  setCell(x, y, color, meta = undefined) {
    if (x < 0 || y < 0 || x >= this.gridW || y >= this.gridH) return;
    this.offCtx.fillStyle = color;
    this.offCtx.fillRect(x, y, 1, 1);
    if (meta) {
      this.meta.set(y * this.gridW + x, meta);
    }
    this.render();
  }

  getCellMeta(x, y) {
    return this.meta.get(y * this.gridW + x) ?? null;
  }

  setRasterRGBA(rgba) {
    const arr = rgba instanceof Uint8Array ? rgba : new Uint8Array(rgba);
    if (arr.length !== this.gridW * this.gridH * 4) return;
    const imgData = new ImageData(new Uint8ClampedArray(arr), this.gridW, this.gridH);
    this.offCtx.putImageData(imgData, 0, 0);
    this.render();
  }

  render() {
    const ctx = this.ctx;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    const dw = this.off.width * this.scale;
    const dh = this.off.height * this.scale;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.off, 0, 0, this.off.width, this.off.height, this.pan.x, this.pan.y, dw, dh);

    this.drawGrid();

    ctx.restore();
  }

  drawGrid() {
    if (!this.showGrid) return;
    const scale = this.scale;
    if (scale < this.gridMinPx) return;

    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    const leftCell = Math.max(0, Math.floor((-this.pan.x) / scale));
    const topCell = Math.max(0, Math.floor((-this.pan.y) / scale));
    const rightCell = Math.min(this.gridW, Math.ceil((w - this.pan.x) / scale));
    const bottomCell = Math.min(this.gridH, Math.ceil((h - this.pan.y) / scale));

    ctx.lineWidth = 1;

    for (let x = leftCell; x <= rightCell; x++) {
      const sx = this.pan.x + x * scale;
      const px = Math.round(sx) + 0.5;
      ctx.beginPath();
      ctx.moveTo(px, Math.max(0, this.pan.y + topCell * scale));
      ctx.lineTo(px, Math.min(h, this.pan.y + bottomCell * scale));
      ctx.strokeStyle = this.gridColor;
      ctx.globalAlpha = (x % this.gridBoldEvery === 0) ? this.gridBoldAlpha : this.gridAlpha;
      ctx.stroke();
    }

    for (let y = topCell; y <= bottomCell; y++) {
      const sy = this.pan.y + y * scale;
      const py = Math.round(sy) + 0.5;
      ctx.beginPath();
      ctx.moveTo(Math.max(0, this.pan.x + leftCell * scale), py);
      ctx.lineTo(Math.min(w, this.pan.x + rightCell * scale), py);
      ctx.strokeStyle = this.gridColor;
      ctx.globalAlpha = (y % this.gridBoldEvery === 0) ? this.gridBoldAlpha : this.gridAlpha;
      ctx.stroke();
    }

    ctx.globalAlpha = 1;
  }
}