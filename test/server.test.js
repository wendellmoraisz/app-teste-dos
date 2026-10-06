const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../server');

test('limite, recuperação, janela móvel e administração', async t => {
    let time = 100000;
    const { app } = createApp({ adminToken: 'test-key', now: () => time });
    const server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
    const base = `http://127.0.0.1:${server.address().port}`;
    const get = async route => { const r = await fetch(base + route); return { code: r.status, body: await r.json() }; };
    const post = async (route, body = {}, auth = true) => {
        const r = await fetch(base + route, { method: 'POST', headers: {
            'Content-Type': 'application/json', ...(auth ? { Authorization: 'Bearer test-key' } : {})
        }, body: JSON.stringify(body) });
        return { code: r.status, retry: r.headers.get('Retry-After'), body: await r.json() };
    };
    assert.equal((await post('/api/admin/reset', {}, false)).code, 401);
    assert.equal((await post('/api/admin/config', { limit: 0 })).code, 400);
    assert.equal((await post('/api/admin/config', { limit: 2, windowSeconds: 10, recoverySeconds: 15 })).code, 200);
    assert.equal((await post('/api/request')).code, 200);
    assert.equal((await post('/api/request')).code, 200);
    const trigger = await post('/api/request');
    assert.equal(trigger.code, 503); assert.equal(trigger.retry, '15');
    assert.equal(trigger.body.outages, 1);
    assert.equal((await get('/api/status')).body.total, 3);
    const failedLogs = (await get('/api/status')).body.logs;
    assert.ok(failedLogs.some(v => v.status === 503 && v.route === '/api/request' && v.durationMs >= 0));
    assert.ok(failedLogs.some(v => v.level === 'ERROR' && v.message.includes('limite excedido')));
    assert.equal((await fetch(base + '/painel')).status, 200);
    time += 14000;
    assert.equal((await post('/api/request')).code, 503);
    time += 1000;
    const recovered = await post('/api/request');
    assert.equal(recovered.code, 200); assert.equal(recovered.body.requestsInWindow, 1);
    assert.equal(recovered.body.rejected, 2);
    assert.ok(recovered.body.logs.some(v => v.message.includes('serviço recuperado')));
    time += 10000;
    assert.equal((await get('/api/status')).body.requestsInWindow, 0);
    assert.equal((await post('/api/request')).code, 200);
    await post('/api/admin/reset');
    const reset = (await get('/api/status')).body;
    assert.equal(reset.total, 0); assert.equal(reset.outages, 0); assert.equal(reset.activeParticipants, 0);
    const before = reset.logs.length;
    await get('/api/status');
    assert.equal((await get('/api/status')).body.logs.length, before);
    assert.equal((await get('/rota-inexistente?token=segredo')).code, 404);
    const routeLogs = (await get('/api/status')).body.logs;
    assert.ok(routeLogs.some(v => v.status === 404 && v.route === '/rota-inexistente'));
    assert.ok(!JSON.stringify(routeLogs).includes('segredo'));
    for (let i = 0; i < 205; i++) await get('/rota-inexistente');
    const bounded = (await get('/api/status')).body.logs;
    assert.equal(bounded.length, 200);
    assert.ok(bounded.every((v, i) => i === 0 || v.id > bounded[i - 1].id));
});
