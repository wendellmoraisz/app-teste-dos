const el = id => document.getElementById(id);
let initialized = false, unavailable = false, connected = false, sending = false;
let paused = false, instanceId, lastLogId = 0, connectionError = false;
function buttonState() {
    el('send').disabled = unavailable || !connected || sending;
    el('send').textContent = unavailable ? 'Envio interrompido · HTTP 503' : sending ? 'Enviando…' : 'Enviar uma requisição ↗';
}
function appendLog(entry) {
    const row = document.createElement('div');
    row.className = `log-line ${entry.level.toLowerCase()}`;
    const timestamp = new Date(entry.time).toLocaleTimeString('pt-BR', { hour12: false });
    const time = document.createElement('span'); time.className = 'log-time'; time.textContent = timestamp;
    const level = document.createElement('span'); level.className = 'log-level'; level.textContent = entry.level;
    const message = document.createElement('span');
    message.textContent = entry.method ? `${entry.method} ${entry.route} → ${entry.status} ${entry.status === 503 ? 'Service Unavailable' : entry.status === 404 ? 'Not Found' : entry.status === 200 ? 'OK' : ''} · ${entry.durationMs} ms` : entry.message;
    row.append(time, level, message); el('logs').append(row);
    while (el('logs').children.length > 200) el('logs').firstChild.remove();
    el('logCount').textContent = `${el('logs').children.length} / 200 linhas`;
    if (!paused) el('logs').scrollTop = el('logs').scrollHeight;
}
function render(s) {
    connected = true; connectionError = false; unavailable = s.unavailable;
    document.body.classList.toggle('outage', unavailable);
    el('state').textContent = unavailable ? 'INDISPONÍVEL · 503' : 'DISPONÍVEL · 200';
    el('state').classList.toggle('down', unavailable);
    el('headline').textContent = unavailable ? 'Service Unavailable' : 'Serviço operacional';
    el('description').textContent = unavailable ? `Limite excedido. Envio interrompido. Recuperação em ${s.recoveryInSeconds} segundos.` : 'POST /api/request · Serviço disponível para a turma.';
    el('window').textContent = s.requestsInWindow; el('total').textContent = s.total;
    el('rejected').textContent = s.rejected; el('participants').textContent = s.activeParticipants;
    el('capacity').textContent = `${s.requestsInWindow} / ${s.limit}`;
    el('load').value = Math.min(100, s.requestsInWindow / s.limit * 100);
    el('rule').textContent = `Acima de ${s.limit} requisições em ${s.windowSeconds} s → indisponibilidade por ${s.recoverySeconds} s. Quedas: ${s.outages}.`;
    if (instanceId !== s.instanceId) { instanceId = s.instanceId; lastLogId = 0; }
    for (const entry of s.logs || []) if (entry.id > lastLogId) { appendLog(entry); lastLogId = entry.id; }
    if (!initialized) { el('limit').value = s.limit; el('seconds').value = s.windowSeconds; el('recovery').value = s.recoverySeconds; initialized = true; }
    buttonState();
}
function disconnected() {
    connected = false; buttonState();
    el('state').textContent = 'SEM CONEXÃO'; el('headline').textContent = 'Servidor inacessível.';
    el('description').textContent = 'Envio bloqueado até restabelecer a conexão.';
    if (!connectionError) appendLog({ time: Date.now(), level: 'ERROR', message: 'CLIENTE: falha de conexão com o servidor. Envios bloqueados; tentando reconectar.' });
    connectionError = true;
}
async function poll() {
    try { const r = await fetch('/api/status', { cache: 'no-store' }); if (!r.ok) throw new Error(); render(await r.json()); }
    catch { disconnected(); }
    finally { setTimeout(poll, 1000); }
}
el('send').addEventListener('click', async () => {
    if (unavailable || !connected || sending) return;
    sending = true; buttonState();
    try {
        const r = await fetch('/api/request', { method: 'POST' }); const data = await r.json();
        if (r.status !== 200 && r.status !== 503) throw new Error();
        render(data); el('feedback').textContent = `HTTP ${r.status} · ${data.message}`;
    } catch { el('feedback').textContent = 'Falha de conexão ao enviar.'; disconnected(); }
    finally { sending = false; buttonState(); }
});
el('pause').addEventListener('click', () => {
    paused = !paused; el('pause').textContent = paused ? 'Retomar rolagem' : 'Pausar rolagem';
    el('pause').setAttribute('aria-pressed', String(paused));
    if (!paused) el('logs').scrollTop = el('logs').scrollHeight;
});
el('clear').addEventListener('click', () => { el('logs').replaceChildren(); el('logCount').textContent = '0 / 200 linhas'; });
el('teacher').hidden = location.pathname !== '/painel';
async function admin(action, body) {
    try {
        const r = await fetch(`/api/admin/${action}`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${el('token').value}` }, body: JSON.stringify(body || {}) });
        const data = await r.json(); if (!r.ok) throw new Error(data.message);
        render(data); el('adminFeedback').textContent = action === 'reset' ? 'Demonstração reiniciada.' : 'Configuração aplicada; janela zerada.';
    } catch (e) { el('adminFeedback').textContent = e.message || 'Falha de conexão.'; }
}
el('settings').addEventListener('submit', e => { e.preventDefault(); admin('config', { limit: Number(el('limit').value), windowSeconds: Number(el('seconds').value), recoverySeconds: Number(el('recovery').value) }); });
el('reset').addEventListener('click', () => admin('reset'));
buttonState(); poll();

