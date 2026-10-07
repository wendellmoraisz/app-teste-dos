# Laboratório de negação de serviço

Servidor Node.js/Express com interface para alunos e painel do professor. Cada clique envia uma requisição ao serviço de teste. Exceder o limite em uma janela móvel provoca respostas HTTP 503 durante um período configurável, com recuperação automática. O painel e as métricas permanecem disponíveis.

## Executar

Requer Node.js 18 ou superior e npm. Na pasta que contém package.json:

```powershell
npm install
npm start
```

Alunos: http://localhost:8080/ . Professor: http://localhost:8080/painel .
Copie a chave exibida no terminal para o campo do painel. A chave muda a cada inicialização. Para fixá-la, defina a variável de ambiente ADMIN_TOKEN; PORT permite mudar a porta.

## Usar na aula

1. Inicie o servidor na máquina do professor.
2. Execute `ipconfig` para identificar o IPv4 da interface do laboratório.
3. Os alunos abrem `http://IP-DO-PROFESSOR:8080/`. As máquinas devem alcançar o professor pela rede. Se necessário, libere TCP 8080 no firewall para a rede do laboratório.
4. No painel, informe a chave e configure, por exemplo, limite 10, janela 10 segundos, recuperação 15 segundos.
5. Peça que os alunos cliquem juntos. As primeiras 10 requisições dentro da janela recebem 200; a 11ª inicia a indisponibilidade e recebe 503.
6. Novos cliques durante a indisponibilidade recebem 503 e não prolongam a recuperação. Após 15 segundos, a janela é limpa e o atendimento volta. O professor também pode reiniciar pelo painel.

Somente POST /api/request conta para o limite. Carregar páginas e consultar métricas não aumenta a carga simulada. A interface consulta métricas a cada segundo. Origens ativas contam IPs que enviaram requisições nos últimos 60 segundos; NAT pode agrupar máquinas. IPs não são exibidos. Configurações e contadores ficam em memória e são perdidos ao encerrar. Aplicar configuração limpa a janela e recupera o serviço, preservando os totais.

A demonstração representa indisponibilidade lógica: não esgota recursos nem encerra o processo. Várias máquinas ilustram demanda distribuída, mas isso não mede a capacidade real do servidor nem reproduz um ataque DDoS real. A chave autoriza mudanças do professor; como o projeto usa HTTP, utilize-o na rede controlada do laboratório.

## Testar

```powershell
npm test
```

Verifica limite, respostas 503, recuperação automática, janela móvel, painel disponível, autenticação, validação e reinício.

## Preparar pull request

Em um clone Git do seu fork, copie os arquivos alterados e novos, execute os testes, crie uma branch e envie as alterações:

```powershell
git switch -c feat/laboratorio-dos
git add index.js server.js public test package.json package-lock.json README.md
git commit -m "Adiciona simulação didática de negação de serviço"
git push -u origin feat/laboratorio-dos
```

No GitHub, abra um pull request dessa branch do fork para o repositório original. Se esta pasta foi extraída de um ZIP, clone seu fork primeiro para obter o histórico Git. Não inclua node_modules no commit.

## Console técnico

O terminal mostra logs reais de POST /api/request, operações do professor e erros HTTP (inclusive rotas inexistentes), com horário, método, rota, status e tempo de processamento no servidor. Eventos didáticos são identificados como SIMULAÇÃO. Consultas de métricas e arquivos estáticos bem-sucedidos são omitidos para manter a leitura útil. Chaves e parâmetros de consulta não são registrados. Os logs são compartilhados com a turma e mantidos em memória, limitados a 200 entradas.

Durante a indisponibilidade, a página fica vermelha e bloqueia o botão de envio. Clientes externos à interface continuam recebendo 503. A tela detecta mudanças na próxima consulta de métricas, feita a cada segundo; requisições já em andamento podem terminar nesse intervalo. Ao recuperar, o envio é liberado automaticamente. Se perder a conexão, o botão também é bloqueado até reconectar.

Pausar rolagem mantém o acompanhamento de novos logs, mas suspende a rolagem automática. Limpar terminal remove somente as linhas desta tela, preservando métricas e logs do servidor. Reiniciar a demonstração preserva o histórico do terminal para discussão em aula.

## Desenvolvimento assistido por IA

Este projeto foi melhorado com a ajuda de inteligência artificial — Codex — sob supervisão, aprovação e testes humanos.

