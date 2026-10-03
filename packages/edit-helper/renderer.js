'use strict';
const api = window.reproEdit;
const nodes = Object.fromEntries(['connection','photoshop','message','pairing','pairCode','sessions','empty','defaultAuto'].map(id => [id, document.getElementById(id)]));
let busy = false, refreshing = false;
async function action(fn) {
  if (busy) return; busy = true;
  document.querySelectorAll('button,input').forEach(node => { node.disabled = true; });
  try { const result = await fn(); if (!result.ok) nodes.message.textContent = result.error; }
  finally { busy = false; await render(); }
}
function button(label, fn, primary = false) {
  const element = document.createElement('button'); element.textContent = label; if (primary) element.className = 'primary';
  element.disabled = busy; element.addEventListener('click', () => void action(fn)); return element;
}
function text(tag, value, className) { const element = document.createElement(tag); element.textContent = value; if (className) element.className = className; return element; }
async function render() {
  if (refreshing) return; refreshing = true;
  try {
    const result = await api.state(); if (!result.ok) { nodes.message.textContent = result.error; return; }
    const state = result.data;
    nodes.connection.textContent = state.connected ? 'Connected to RePro' : 'Connect from Settings → Desktop editing';
    nodes.photoshop.textContent = state.photoshop ? 'Photoshop: ' + state.photoshop : 'Photoshop not detected. Choose its installation or use manual editing.';
    nodes.message.textContent = state.message; nodes.defaultAuto.checked = state.autoUpload;
    nodes.pairing.hidden = !state.pairing; nodes.pairCode.textContent = state.pairing?.code || 'Waiting…';
    nodes.empty.hidden = state.sessions.length > 0; nodes.sessions.replaceChildren();
    for (const session of state.sessions) {
      const card = document.createElement('section'); card.className = 'session';
      card.append(text('div', session.filename, 'filename'), text('p', '#' + session.shootId + ' · Version ' + session.version + ' · ' + session.queued + ' saved uploads pending', 'meta'), text('div', session.status, 'status'), text('p', session.message));
      if (session.progress !== null && session.progress !== undefined) {
        const progress = document.createElement('progress'); progress.max = 100; progress.value = session.progress;
        progress.setAttribute('aria-label', 'Upload progress'); card.append(progress, text('p', session.progress === 100 ? 'Bytes transferred. Saving on the dashboard…' : session.progress + '% uploaded', 'meta'));
      }
      const actions = document.createElement('div'); actions.className = 'row';
      actions.append(button('Open in Photoshop', () => api.open(session.id)), button('Export file…', () => api.exportFile(session.id)),
        button('Upload saved edit', () => api.upload(session.id), true), button('Retry', () => api.retry(session.id)),
        button('Working folder', () => api.folder(session.id)), button('Versions in dashboard', () => api.dashboard(session.id)));
      const label = document.createElement('label'); const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.checked = session.autoUpload; checkbox.disabled = busy;
      checkbox.addEventListener('change', () => void action(() => api.auto(session.id, checkbox.checked)));
      label.append(checkbox, text('span', 'Auto-upload on save for this image')); actions.append(label); card.append(actions); nodes.sessions.append(card);
    }
    document.querySelectorAll('button,input').forEach(node => { node.disabled = busy; });
  } finally { refreshing = false; }
}
document.getElementById('dashboard').addEventListener('click', () => void action(() => api.dashboard(null)));
document.getElementById('choose').addEventListener('click', () => void action(() => api.choosePhotoshop()));
document.getElementById('quit').addEventListener('click', () => void api.quit());
nodes.defaultAuto.addEventListener('change', () => void action(() => api.auto(null, nodes.defaultAuto.checked)));
api.changed(() => void render()); void render();
