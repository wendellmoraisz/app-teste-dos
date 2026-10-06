const { createApp } = require('./server');
const { randomBytes } = require('node:crypto');
const adminToken = process.env.ADMIN_TOKEN || randomBytes(18).toString('hex');
const port = Number(process.env.PORT || 8080);
createApp({ adminToken }).app.listen(port, '0.0.0.0', () => {
    console.log(`Alunos: http://localhost:${port}/`);
    console.log(`Professor: http://localhost:${port}/painel`);
    console.log(`Chave do professor: ${adminToken}`);
});
