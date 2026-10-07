const express = require('express');
const path = require('node:path');
const { timingSafeEqual, randomUUID } = require('node:crypto');
function createApp({ adminToken, now = Date.now } = {}) {
    if (!adminToken) throw new Error('Defina a chave do professor.');
    const app = express();
    app.disable('x-powered-by');
    const instanceId = randomUUID();
    const logs = [];
    let logId = 0;
    function log(level, message, details = {}) {
        logs.push({ id: ++logId, time: now(), level, message, ...details });
        if (logs.length > 200) logs.shift();
    }
    app.use((req, res, next) => {
        const start = process.hrtime.bigint();
        res.once('finish', () => {
            if (req.path === '/api/request' || req.path.startsWith('/api/admin/') || res.statusCode >= 400) {
                log(res.statusCode >= 400 ? 'ERROR' : 'INFO', 'Resposta HTTP', {
                    method: req.method, route: req.path.slice(0, 160), status: res.statusCode,
                    durationMs: Number((Number(process.hrtime.bigint() - start) / 1e6).toFixed(2))
                });
            }
        });
        next();
    });
    app.use(express.json({ limit: '2kb' }));
    let config = { limit: 30, windowSeconds: 10, recoverySeconds: 15 };
    let hits = [], total = 0, rejected = 0, outages = 0, until = 0;
    const participants = new Map();
    function refresh() {
        const t = now();
        if (until && t >= until) {
            until = 0; hits = [];
            log('INFO', 'SIMULAÇÃO: serviço recuperado; envio liberado.');
        }
        hits = hits.filter(v => v > t - config.windowSeconds * 1000);
        for (const [ip, last] of participants) if (last <= t - 60000) participants.delete(ip);
        return t;
    }
    function status() {
        const t = refresh();
        return { ...config, instanceId, logs: logs.slice(), total, rejected, outages, requestsInWindow: hits.length,
            activeParticipants: participants.size, unavailable: until > t,
            recoveryInSeconds: Math.max(0, Math.ceil((until - t) / 1000)) };
    }
    app.get('/api/status', (req, res) => res.set('Cache-Control', 'no-store').json(status()));
    app.post('/api/request', (req, res) => {
        const t = refresh(); total++; participants.set(req.ip, t);
        if (!until) {
            hits.push(t);
            if (hits.length > config.limit) {
                until = t + config.recoverySeconds * 1000; outages++;
                log('ERROR', `SIMULAÇÃO: limite excedido (${hits.length}/${config.limit} em ${config.windowSeconds}s). Serviço indisponível; envio pela interface interrompido.`);
            }
        }
        if (until) {
            rejected++;
            return res.set('Retry-After', String(Math.ceil((until - t) / 1000))).status(503)
                .json({ message: 'Negação de serviço simulada: limite excedido.', ...status() });
        }
        res.json({ message: 'Requisição atendida!', ...status() });
    });
    app.use('/api/admin', (req, res, next) => {
        const a = Buffer.from(req.get('Authorization') || '');
        const b = Buffer.from(`Bearer ${adminToken}`);
        if (a.length !== b.length || !timingSafeEqual(a, b)) return res.status(401).json({ message: 'Chave inválida.' });
        next();
    });
    app.post('/api/admin/config', (req, res) => {
        const { limit, windowSeconds, recoverySeconds } = req.body || {};
        if (!Number.isInteger(limit) || limit < 1 || limit > 10000 ||
            !Number.isInteger(windowSeconds) || windowSeconds < 1 || windowSeconds > 300 ||
            !Number.isInteger(recoverySeconds) || recoverySeconds < 1 || recoverySeconds > 300)
            return res.status(400).json({ message: 'Limite: 1 a 10000. Tempos: 1 a 300 segundos.' });
        config = { limit, windowSeconds, recoverySeconds }; hits = []; until = 0;
        log('WARN', 'SIMULAÇÃO: configuração aplicada; janela zerada e serviço disponível.');
        res.json(status());
    });
    app.post('/api/admin/reset', (req, res) => {
        hits = []; total = rejected = outages = until = 0; participants.clear();
        log('WARN', 'SIMULAÇÃO: demonstração reiniciada pelo professor.'); res.json(status());
    });
    app.get('/painel', (req, res) => res.sendFile(path.join(__dirname, 'public/index.html')));
    app.use(express.static(path.join(__dirname, 'public')));
    app.use((req, res) => res.status(404).json({ message: 'Rota não encontrada.' }));
    app.use((err, req, res, next) => res.status(err.status === 413 ? 413 : 400).json({ message: 'Dados inválidos.' }));
    log('INFO', 'SIMULAÇÃO: monitor iniciado; aguardando requisições.');
    return { app };
}
module.exports = { createApp };
