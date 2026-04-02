export const DASHBOARD_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Agent 2 — Backend Event Processor</title>
<style>
  :root {
    --bg: #0a0a0f;
    --surface: #14141f;
    --border: #1e1e2e;
    --text: #e0e0e8;
    --text-dim: #6e6e82;
    --accent: #7c5cff;

    /* Work type colors */
    --color-bug-fix: #ff5c5c;
    --color-refactor: #5caaff;
    --color-feature: #5cff8a;
    --color-test: #ffd55c;
    --color-dependency: #ff8a5c;
    --color-config: #c084fc;
    --color-docs: #6ee7b7;
    --color-unknown: #6e6e82;

    /* Location colors */
    --loc-frontend: #f472b6;
    --loc-api: #60a5fa;
    --loc-service: #a78bfa;
    --loc-database: #fb923c;
    --loc-infrastructure: #94a3b8;
    --loc-tests: #fbbf24;
    --loc-config: #c084fc;
    --loc-unknown: #6e6e82;
  }

  * { margin: 0; padding: 0; box-sizing: border-box; }

  body {
    font-family: -apple-system, BlinkMacSystemFont, 'SF Pro', 'Inter', system-ui, sans-serif;
    background: var(--bg);
    color: var(--text);
    min-height: 100vh;
    overflow-x: hidden;
  }

  .header {
    padding: 24px 32px 16px;
    display: flex;
    align-items: center;
    gap: 12px;
    border-bottom: 1px solid var(--border);
  }

  .header .pulse {
    width: 10px; height: 10px;
    border-radius: 50%;
    background: #5cff8a;
    box-shadow: 0 0 8px #5cff8a88;
    animation: pulse 2s ease-in-out infinite;
  }

  .header h1 {
    font-size: 16px;
    font-weight: 600;
    letter-spacing: 0.5px;
  }

  .header .status {
    margin-left: auto;
    font-size: 12px;
    color: var(--text-dim);
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.5; transform: scale(0.8); }
  }

  .empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 60vh;
    color: var(--text-dim);
    gap: 16px;
  }

  .empty .icon { font-size: 48px; opacity: 0.3; }
  .empty p { font-size: 14px; }

  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(380px, 1fr));
    gap: 20px;
    padding: 24px 32px;
  }

  /* --- Agent Card --- */
  .card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 16px;
    padding: 24px;
    position: relative;
    overflow: hidden;
    transition: border-color 0.3s, box-shadow 0.3s;
  }

  .card:hover {
    border-color: var(--accent);
    box-shadow: 0 0 20px rgba(124, 92, 255, 0.1);
  }

  .card.active { border-left: 3px solid var(--work-color, var(--accent)); }
  .card.inactive { opacity: 0.6; }

  /* Glow bar at top */
  .card .glow {
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 3px;
    background: var(--work-color, var(--accent));
    opacity: 0.8;
  }

  .card.active .glow {
    animation: glow-pulse 1.5s ease-in-out infinite;
  }

  @keyframes glow-pulse {
    0%, 100% { opacity: 0.8; }
    50% { opacity: 0.3; }
  }

  /* Top row: work type badge + session */
  .card-top {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 16px;
  }

  .work-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 12px;
    border-radius: 20px;
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    background: color-mix(in srgb, var(--work-color) 15%, transparent);
    color: var(--work-color);
    border: 1px solid color-mix(in srgb, var(--work-color) 30%, transparent);
  }

  .work-badge .dot {
    width: 8px; height: 8px;
    border-radius: 50%;
    background: var(--work-color);
  }

  .session-id {
    margin-left: auto;
    font-size: 11px;
    color: var(--text-dim);
    font-family: 'SF Mono', 'Fira Code', monospace;
  }

  /* Intent */
  .intent {
    font-size: 15px;
    font-weight: 500;
    line-height: 1.4;
    margin-bottom: 20px;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  /* Location map */
  .location-map {
    display: flex;
    gap: 6px;
    margin-bottom: 16px;
    flex-wrap: wrap;
  }

  .loc-chip {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 3px 10px;
    border-radius: 6px;
    font-size: 11px;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    background: color-mix(in srgb, var(--loc-color) 12%, transparent);
    color: var(--loc-color);
    border: 1px solid color-mix(in srgb, var(--loc-color) 25%, transparent);
  }

  .loc-chip.primary {
    background: color-mix(in srgb, var(--loc-color) 20%, transparent);
    border-width: 2px;
  }

  /* Scope bar */
  .scope-section {
    margin-bottom: 16px;
  }

  .scope-label {
    font-size: 11px;
    color: var(--text-dim);
    text-transform: uppercase;
    letter-spacing: 0.8px;
    margin-bottom: 6px;
  }

  .scope-bar {
    display: flex;
    gap: 3px;
    align-items: flex-end;
    height: 24px;
  }

  .scope-block {
    flex: 1;
    max-width: 24px;
    border-radius: 3px;
    background: var(--work-color, var(--accent));
    opacity: 0.7;
    transition: height 0.3s ease;
  }

  .scope-stats {
    display: flex;
    gap: 16px;
    margin-top: 8px;
  }

  .scope-stat {
    font-size: 12px;
    color: var(--text-dim);
  }

  .scope-stat strong {
    color: var(--text);
    font-size: 16px;
    font-weight: 600;
  }

  /* Direction / strategy change */
  .direction {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border-radius: 8px;
    background: rgba(255, 92, 92, 0.08);
    border: 1px solid rgba(255, 92, 92, 0.2);
    font-size: 12px;
    color: #ff8a8a;
    animation: flash 0.5s ease;
  }

  .direction .arrow { font-size: 16px; }

  @keyframes flash {
    0% { background: rgba(255, 92, 92, 0.25); }
    100% { background: rgba(255, 92, 92, 0.08); }
  }

  /* Footer / timing */
  .card-footer {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 16px;
    padding-top: 12px;
    border-top: 1px solid var(--border);
    font-size: 11px;
    color: var(--text-dim);
  }

  .active-indicator {
    width: 6px; height: 6px;
    border-radius: 50%;
  }

  .active-indicator.on {
    background: #5cff8a;
    box-shadow: 0 0 6px #5cff8a88;
    animation: pulse 1.5s ease-in-out infinite;
  }

  .active-indicator.off {
    background: var(--text-dim);
  }
</style>
</head>
<body>

<div class="header">
  <div class="pulse"></div>
  <h1>Agent 2 — Backend Event Processor</h1>
  <div class="status" id="conn-status">Connecting...</div>
</div>

<div id="root">
  <div class="empty">
    <div class="icon">&#9678;</div>
    <p>Waiting for agent activity...</p>
  </div>
</div>

<script>
const WORK_COLORS = {
  'bug-fix': '#ff5c5c',
  'refactor': '#5caaff',
  'feature': '#5cff8a',
  'test': '#ffd55c',
  'dependency': '#ff8a5c',
  'config': '#c084fc',
  'docs': '#6ee7b7',
  'unknown': '#6e6e82',
};

const WORK_ICONS = {
  'bug-fix': '&#9888;',
  'refactor': '&#8634;',
  'feature': '&#9733;',
  'test': '&#9745;',
  'dependency': '&#9741;',
  'config': '&#9881;',
  'docs': '&#9998;',
  'unknown': '&#63;',
};

const LOC_COLORS = {
  'frontend': '#f472b6',
  'api': '#60a5fa',
  'service': '#a78bfa',
  'database': '#fb923c',
  'infrastructure': '#94a3b8',
  'tests': '#fbbf24',
  'config': '#c084fc',
  'unknown': '#6e6e82',
};

const states = new Map();
const root = document.getElementById('root');
const connStatus = document.getElementById('conn-status');

function relativeTime(ts) {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 5) return 'just now';
  if (diff < 60) return diff + 's ago';
  if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
  return Math.floor(diff / 3600) + 'h ago';
}

function renderCard(state) {
  const wc = WORK_COLORS[state.workType] || WORK_COLORS.unknown;
  const icon = WORK_ICONS[state.workType] || WORK_ICONS.unknown;
  const activeClass = state.active ? 'active' : 'inactive';
  const shortId = state.sessionID.replace(/^session-/, '').slice(0, 8);

  const locChips = (state.locations.length ? state.locations : [state.location])
    .map(loc => {
      const lc = LOC_COLORS[loc] || LOC_COLORS.unknown;
      const primary = loc === state.location ? 'primary' : '';
      return '<span class="loc-chip ' + primary + '" style="--loc-color:' + lc + '">' + loc + '</span>';
    }).join('');

  const scopeBlocks = Array.from({length: Math.min(state.scope.files, 20)}, (_, i) => {
    const h = Math.max(6, Math.min(24, 6 + (i * 2)));
    return '<div class="scope-block" style="height:' + h + 'px"></div>';
  }).join('');

  let directionHtml = '';
  const changes = state.strategyChanges || [];
  if (changes.length > 0) {
    const last = changes[changes.length - 1];
    const pc = WORK_COLORS[last.from] || WORK_COLORS.unknown;
    const cc = WORK_COLORS[last.to] || WORK_COLORS.unknown;
    directionHtml = '<div class="direction">' +
      '<span style="color:' + pc + '">' + last.from + '</span>' +
      '<span class="arrow">&#8594;</span>' +
      '<span style="color:' + cc + '">' + last.to + '</span>' +
      ' <span style="margin-left:auto">' + relativeTime(last.timestamp) + '</span>' +
      '</div>';
  }

  return '<div class="card ' + activeClass + '" style="--work-color:' + wc + '" data-session="' + state.sessionID + '">' +
    '<div class="glow"></div>' +
    '<div class="card-top">' +
      '<div class="work-badge"><span class="dot"></span> ' + icon + ' ' + state.workType + '</div>' +
      '<span class="session-id">' + shortId + '</span>' +
    '</div>' +
    '<div class="intent">' + escapeHtml(state.summary || 'Starting...') + '</div>' +
    '<div class="location-map">' + locChips + '</div>' +
    '<div class="scope-section">' +
      '<div class="scope-label">Scope</div>' +
      '<div class="scope-bar">' + scopeBlocks + '</div>' +
      '<div class="scope-stats">' +
        '<div class="scope-stat"><strong>' + state.scope.files + '</strong> files</div>' +
        '<div class="scope-stat"><strong>' + state.scope.modules + '</strong> modules</div>' +
      '</div>' +
    '</div>' +
    directionHtml +
    '<div class="card-footer">' +
      '<span class="active-indicator ' + (state.active ? 'on' : 'off') + '"></span>' +
      (state.active ? 'Working' : 'Idle') +
      '<span style="margin-left:auto">Updated ' + relativeTime(state.timestamp) + '</span>' +
    '</div>' +
  '</div>';
}

function renderAll() {
  if (states.size === 0) {
    root.innerHTML = '<div class="empty"><div class="icon">&#9678;</div><p>Waiting for agent activity...</p></div>';
    return;
  }
  root.className = 'grid';
  root.innerHTML = Array.from(states.values()).map(renderCard).join('');
}

function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

// SSE connection
function connect() {
  const es = new EventSource('/event');

  es.onopen = () => {
    connStatus.textContent = 'Connected';
    connStatus.style.color = '#5cff8a';
  };

  es.onmessage = (e) => {
    try {
      const evt = JSON.parse(e.data);
      if (evt.type === 'aiv.intent.updated') {
        states.set(evt.properties.sessionID, evt.properties.intent);
        renderAll();
      } else if (evt.type === 'aiv.cleared') {
        states.delete(evt.properties.sessionID);
        renderAll();
      }
    } catch {}
  };

  es.onerror = () => {
    connStatus.textContent = 'Reconnecting...';
    connStatus.style.color = '#ff5c5c';
    es.close();
    setTimeout(connect, 2000);
  };
}

// Fetch initial state
fetch('/aiv/intent').then(r => r.json()).then(map => {
  for (const [id, intent] of Object.entries(map)) {
    states.set(id, intent);
  }
  renderAll();
}).catch(() => {});

// Refresh relative timestamps every 10s
setInterval(() => { if (states.size > 0) renderAll(); }, 10000);

connect();
</script>
</body>
</html>`
