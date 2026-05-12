/**
 * history.js — Local history management & sparkline chart
 */

const History = (() => {

  function render(containerEl, emptyEl) {
    const entries = Storage.getHistory();
    if (!entries.length) {
      containerEl.hidden = true;
      if (emptyEl) emptyEl.hidden = false;
      return;
    }
    if (emptyEl) emptyEl.hidden = true;
    containerEl.hidden = false;
    containerEl.innerHTML = entries.map(e => _itemHTML(e)).join('');
    _drawChart(entries);
  }

  function _itemHTML(entry) {
    const cls = _colorClass(entry.score);
    const date = new Date(entry.id).toLocaleDateString('en-US', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
    return `
      <div class="history-item" title="${_escape(entry.summary || entry.trade)}">
        <div class="history-score ${cls}">${entry.score}</div>
        <div class="history-info">
          <div class="history-trade">${_escape(entry.summary || entry.trade)}</div>
          <div class="history-date">${date}</div>
        </div>
        <div class="rr-badge" style="flex-shrink:0">${entry.grade || ''}</div>
      </div>`;
  }

  function _drawChart(entries) {
    const canvas = document.getElementById('historyChart');
    if (!canvas) return;
    const data = [...entries].reverse().map(e => e.score);
    if (data.length < 2) { canvas.style.display = 'none'; return; }
    canvas.style.display = 'block';
    const ctx = canvas.getContext('2d');
    const W = canvas.offsetWidth || 700;
    const H = 120;
    canvas.width = W;
    canvas.height = H;
    ctx.clearRect(0, 0, W, H);

    const pad = 12;
    const xStep = (W - pad * 2) / (data.length - 1);
    const yMin = 0, yMax = 100;
    const toY = v => pad + (1 - (v - yMin) / (yMax - yMin)) * (H - pad * 2);
    const toX = i => pad + i * xStep;

    // Grid
    ctx.strokeStyle = '#1e2d3d';
    ctx.lineWidth = 1;
    [0, 25, 50, 75, 100].forEach(v => {
      ctx.beginPath();
      ctx.setLineDash([4, 4]);
      ctx.moveTo(pad, toY(v));
      ctx.lineTo(W - pad, toY(v));
      ctx.stroke();
    });
    ctx.setLineDash([]);

    // Fill
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, 'rgba(0,212,255,.25)');
    grad.addColorStop(1, 'rgba(0,212,255,0)');
    ctx.beginPath();
    ctx.moveTo(toX(0), toY(data[0]));
    data.forEach((v, i) => { if (i > 0) ctx.lineTo(toX(i), toY(v)); });
    ctx.lineTo(toX(data.length - 1), H);
    ctx.lineTo(toX(0), H);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // Line
    ctx.beginPath();
    ctx.moveTo(toX(0), toY(data[0]));
    data.forEach((v, i) => { if (i > 0) ctx.lineTo(toX(i), toY(v)); });
    ctx.strokeStyle = '#00d4ff';
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    ctx.stroke();

    // Dots
    data.forEach((v, i) => {
      ctx.beginPath();
      ctx.arc(toX(i), toY(v), 4, 0, Math.PI * 2);
      ctx.fillStyle = _dotColor(v);
      ctx.fill();
    });
  }

  function _colorClass(score) {
    if (score < 50) return 'red';
    if (score < 75) return 'yellow';
    return 'green';
  }

  function _dotColor(score) {
    if (score < 50) return '#ef4444';
    if (score < 75) return '#f59e0b';
    return '#22c55e';
  }

  function _escape(str) {
    return String(str || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  return { render };
})();
