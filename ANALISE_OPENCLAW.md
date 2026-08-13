# Análise técnica completa do agente OpenClaw

## 1. Escopo e identificação da fonte

O diretório indicado inicialmente, /Users/fate/Desktop/EVE, estava vazio. A análise foi feita sobre o repositório OpenClaw encontrado em:

/Users/fate/Documents/Codex/2026-06-21/openclaw-openclaw-https-github-com-openclaw/work/openclaw

Identificação da versão analisada:

| Item | Valor |
|---|---|
| Repositório remoto | https://github.com/openclaw/openclaw.git |
| Branch | main |
| Commit | 66f84a9bf1082de26f92b2b3741cc2f34aba34fa |
| Data do commit | 2026-06-21 00:06:55 -0400 |
| Assunto do commit | fix(opencode-go): add current Go models |
| Versão do pacote | 2026.6.8 |
| Node.js mínimo | 22.19.0 |
| Gerenciador de pacotes | pnpm 11.2.2 |

O repositório usa sparse checkout. Parte dos diretórios estava materializada no disco e parte foi lida diretamente do objeto Git correspondente ao commit acima. Nenhum arquivo do código-fonte foi alterado.

Esta é uma análise completa por arquitetura, subsistema, contrato e fluxo de execução. Não é uma paráfrase linha a linha dos mais de quatro milhões de linhas TypeScript: esse formato esconderia as decisões importantes. Em vez disso, o relatório explica o papel do código, como os módulos se conectam, onde estão os limites de confiança e quais são os pontos de manutenção.

## 2. Resumo executivo

O OpenClaw é uma plataforma local-first de agentes, não apenas um chatbot. O núcleo combina:

- um gateway WebSocket/HTTP que centraliza sessões, autenticação, canais e controle;
- um runtime de agente embutido com streaming, compactação, recuperação e fallback;
- uma camada extensa de ferramentas com políticas sobrepostas;
- plugins em processo para provedores, canais, memória, mídia, voz, busca e runtimes;
- clientes CLI, TUI, web, Android, iOS e macOS;
- persistência híbrida em SQLite e transcrições JSONL;
- automação durável por cron, tarefas, subagentes, hooks e compromissos;
- uma SDK pública e pacotes de contrato reutilizáveis.

O desenho é modular nas bordas e deliberadamente centralizado no gateway. Isso melhora consistência de estado, idempotência e recuperação, mas torna alguns arquivos centrais muito grandes e aumenta o custo de mudança.

O modelo de segurança é explícito: uma instalação representa um operador confiável. Não há isolamento de multitenancy adversarial. Plugins rodam com os privilégios do processo, o sandbox vem desativado por padrão e um cliente autenticado no gateway possui grande poder operacional. Portanto, a segurança real depende da configuração de exposição, política de ferramentas, sandbox, aprovações e procedência dos plugins.

## 3. Dimensão do repositório

### 3.1 Inventário geral

| Métrica | Quantidade |
|---|---:|
| Arquivos rastreados | 20.381 |
| Arquivos TypeScript | 16.494 |
| Arquivos Markdown | 1.048 |
| Arquivos Swift | 691 |
| Arquivos JSON | 635 |
| Arquivos MJS | 377 |
| Arquivos shell | 189 |
| Arquivos Kotlin | 188 |
| Arquivos YAML/YML | 266 |
| Arquivos Go | 28 |
| Extensões de plugin | 138 |
| Manifestos de plugin | 134 |
| Pacotes internos | 21 |
| Skills incluídas | 57 |
| Scripts declarados no package.json | 468 |
| Exportações públicas declaradas | 324 |

Contagem aproximada das áreas principais:

| Área | Arquivos |
|---|---:|
| src | 8.975 |
| extensions | 6.656 |
| apps | 1.064 |
| scripts | 831 |
| docs | 765 |
| test | 603 |
| ui | 515 |
| packages | 434 |
| qa | 147 |
| .agents | 136 |
| .github | 112 |
| skills | 83 |

Nos diretórios TypeScript materializados, a contagem é de aproximadamente 4.526.841 linhas. Scripts JavaScript/MJS/shell somam cerca de 142.764 linhas, e a documentação Markdown cerca de 156.749 linhas.

### 3.2 Maiores concentrações dentro de src

| Subsistema | Arquivos |
|---|---:|
| agents | 1.817 |
| infra | 785 |
| gateway | 729 |
| commands | 694 |
| plugins | 628 |
| plugin-sdk | 588 |
| auto-reply | 558 |
| cli | 453 |
| config | 384 |
| channels | 380 |
| cron | 213 |
| secrets | 127 |
| shared | 119 |
| skills | 115 |
| acp | 98 |
| llm | 82 |
| security | 81 |
| logging | 72 |
| daemon | 71 |

### 3.3 Arquivos de maior complexidade aparente

| Arquivo | Linhas aproximadas | Papel |
|---|---:|---|
| src/agents/embedded-agent-runner/run/attempt.ts | 5.789 | Montagem e execução de uma tentativa de turno |
| extensions/policy/src/doctor/register.ts | 5.570 | Diagnóstico e reparos da extensão de política |
| src/gateway/server-methods/chat.ts | 5.104 | RPC e streaming de chat |
| src/agents/openai-transport-stream.ts | 4.427 | Adaptação do stream OpenAI |
| extensions/workboard/src/store.ts | 4.331 | Estado do workboard |
| extensions/qa-lab/web/src/ui-render.ts | 4.207 | Renderização da interface do laboratório |
| ui/src/ui/controllers/workboard.ts | 4.127 | Controlador web do workboard |
| src/infra/state-migrations.ts | 4.097 | Migrações de estado |
| ui/src/ui/app-render.ts | 4.074 | Composição principal da UI |
| src/agents/embedded-agent-runner/run.ts | 4.064 | Orquestração de tentativas, retry e fallback |
| src/cli/update-cli/update-command.ts | 4.001 | Atualização da instalação |
| extensions/diagnostics-otel/src/service.ts | 3.810 | Telemetria OpenTelemetry |
| extensions/active-memory/index.ts | 3.755 | Memória ativa |

Esses números não provam baixa qualidade, mas indicam os pontos de maior acoplamento e maior risco de regressão.

## 4. Arquitetura em camadas

Fluxo lógico principal:

    Usuário ou sistema externo
        ↓
    CLI / TUI / Control UI / app nativo / canal de mensagem
        ↓
    Gateway HTTP + WebSocket
        ↓
    autenticação, autorização, sessão, idempotência e roteamento
        ↓
    agentCommandFromIngress
        ↓
    seleção de agente, runtime, provedor, modelo e credenciais
        ↓
    runtime embutido, ACP externo ou harness de plugin
        ↓
    construção do prompt, contexto, memória, skills e ferramentas
        ↓
    loop do modelo com chamadas de ferramenta
        ↓
    persistência da transcrição e do estado
        ↓
    entrega durável no canal de origem e eventos aos clientes

As responsabilidades se dividem em quatro planos:

1. Plano de controle: gateway, configuração, plugins, modelos, dispositivos, aprovações e administração.
2. Plano de execução: runtime do agente, modelo, contexto, ferramentas, compactação e fallback.
3. Plano de comunicação: canais, outbound, streaming, UI, TUI e clientes nativos.
4. Plano de estado: sessões JSONL, SQLite global e por agente, arquivos de memória e filas duráveis.

Uma decisão importante é manter o núcleo agnóstico a plugins. Integrações devem entrar por contratos públicos em openclaw/plugin-sdk, sem importar arquivos internos do core.

## 5. Inicialização e CLI

### 5.1 Bootstrap do processo

O executável começa em [openclaw.mjs](https://github.com/openclaw/openclaw/blob/66f84a9bf1082de26f92b2b3741cc2f34aba34fa/openclaw.mjs). Ele:

1. rejeita versões de Node abaixo de 22.19;
2. trata version e help por um caminho rápido;
3. identifica uma execução a partir do código-fonte;
4. habilita cache de compilação quando suportado;
5. aplica uma contenção específica para deadlock do Node 24 no Windows;
6. pode relançar o processo, preservando sinais;
7. calcula um cache de instalação baseado na versão e metadados do pacote;
8. carrega dist/entry.js ou dist/entry.mjs;
9. emite uma mensagem clara quando o build não existe.

O segundo estágio está em [src/entry.ts](https://github.com/openclaw/openclaw/blob/66f84a9bf1082de26f92b2b3741cc2f34aba34fa/src/entry.ts). Ele normaliza ambiente, cores, argumentos Windows, perfil, modo container e título do processo. Também instala caminhos especiais para auditoria de secrets e então importa o comando principal dinamicamente.

Essa separação reduz o custo de inicialização e permite que help/version funcionem mesmo quando partes pesadas do runtime não estão prontas.

### 5.2 Registro de comandos

O CLI usa Commander, com construção em:

- [src/cli/program/build-program.ts](https://github.com/openclaw/openclaw/blob/66f84a9bf1082de26f92b2b3741cc2f34aba34fa/src/cli/program/build-program.ts)
- [src/cli/program/command-registry-core.ts](https://github.com/openclaw/openclaw/blob/66f84a9bf1082de26f92b2b3741cc2f34aba34fa/src/cli/program/command-registry-core.ts)

Comandos centrais:

- setup, onboard, configure e config;
- backup, migrate, doctor, reset e uninstall;
- message, agent, agents e sessions;
- status, health e dashboard;
- transcripts, commitments e tasks;
- mcp e crestodian.

Famílias registradas sob demanda:

- acp;
- gateway e daemon;
- logs e system;
- models, infer e capability;
- approvals e exec-policy;
- nodes, node e devices;
- sandbox;
- tui, terminal e chat;
- cron;
- dns, docs e proxy;
- hooks e webhooks;
- plugins, channels e directory;
- security, secrets e skills;
- update e completion.

O registro preguiçoso é uma otimização consciente: o CLI inspeciona os argumentos antes de importar árvores grandes.

## 6. Gateway: o centro operacional

O wrapper público [src/gateway/server.ts](https://github.com/openclaw/openclaw/blob/66f84a9bf1082de26f92b2b3741cc2f34aba34fa/src/gateway/server.ts) importa de forma preguiçosa a implementação em [src/gateway/server.impl.ts](https://github.com/openclaw/openclaw/blob/66f84a9bf1082de26f92b2b3741cc2f34aba34fa/src/gateway/server.impl.ts).

### 6.1 Inicialização do servidor

startGatewayServer executa, em alto nível:

1. normalização de ambiente, interface, porta e modo de rede;
2. coordenação de handoff quando existe reinício;
3. leitura de configuração e snapshot de secrets;
4. preparação de autenticação, TLS e origens da Control UI;
5. descoberta de metadados dos plugins sem necessariamente executá-los;
6. bind dos servidores HTTP e WebSocket;
7. inicialização de canais e serviços;
8. criação do estado de clientes, broadcasts, sequências e deduplicação;
9. ligação dos handlers RPC;
10. configuração de reload e diagnóstico.

O padrão é escutar em 127.0.0.1:18789. As superfícies Canvas e A2UI são expostas em caminhos reservados abaixo de /__openclaw__.

### 6.2 Protocolo

O protocolo usa mensagens JSON request/response/event. O primeiro frame WebSocket é uma conexão autenticada. Os tipos são descritos com TypeBox, convertidos em JSON Schema e também usados para gerar modelos Swift.

Não existe replay geral de eventos do gateway. Cada stream carrega sequência; se o cliente detecta lacuna, precisa atualizar o snapshot. É um desenho mais simples no servidor, com custo de complexidade nos clientes.

### 6.3 Autenticação e autorização

Os modos incluem token, senha, proxy confiável, identidade Tailscale e um modo sem credencial limitado a ingressos privados. A identidade de dispositivo usa pareamento e assinatura de nonce. A versão atual do protocolo fixa plataforma e família do dispositivo na assinatura.

Papéis principais:

- node: dispositivo executor;
- operator: cliente administrativo.

Escopos do operador:

- admin;
- write;
- read;
- approvals;
- pairing.

Há verificações específicas por método, autorização separada para node e operator e limites de taxa para mutações do plano de controle.

### 6.4 Métodos RPC

[src/gateway/server-methods.ts](https://github.com/openclaw/openclaw/blob/66f84a9bf1082de26f92b2b3741cc2f34aba34fa/src/gateway/server-methods.ts) reúne famílias carregadas sob demanda:

- connect, logs, health e status;
- chat, send, commands e voice wake;
- agent, agents e agent.wait;
- sessions, tasks e artifacts;
- channels;
- cron;
- devices, nodes e push;
- approvals;
- config, doctor e wizard;
- plugins, skills, tools e models;
- environments;
- diagnostics;
- native hooks e web;
- talk e TTS;
- usage, update, system e restart.

### 6.5 RPC de agente

O método agent:

1. valida o identificador de idempotência;
2. verifica autorização para troca de modelo/provedor e controles internos de sessão;
3. consulta a tabela de deduplicação;
4. responde imediatamente com accepted quando a execução começa;
5. registra lifecycle e controlador de cancelamento;
6. chama agentCommandFromIngress;
7. publica eventos de stream;
8. persiste rastreamento de tarefa quando aplicável;
9. encerra com o resultado final e limpa recursos.

Entradas repetidas podem encontrar estados accepted, inflight ou final. agent.wait observa o lifecycle até um estado terminal.

Há uma separação de segurança importante:

- agentCommand é voltado a chamadas locais e confiáveis; presume dono e permite override de modelo;
- agentCommandFromIngress presume caller não proprietário e exige permissão explícita para override.

## 7. Fluxo completo de uma execução do agente

O comando central está em [src/agents/agent-command.ts](https://github.com/openclaw/openclaw/blob/66f84a9bf1082de26f92b2b3741cc2f34aba34fa/src/agents/agent-command.ts).

### 7.1 Preparação

A etapa inicial:

1. valida mensagem e seleção da sessão;
2. lê configuração;
3. resolve secrets somente quando necessários para entrega;
4. normaliza níveis de verbose e thinking;
5. determina timeout;
6. resolve agente, workspace, diretório privado e cwd;
7. descobre metadados de plugin;
8. monta catálogo de modelos;
9. garante bootstrap do workspace;
10. associa runId e, quando necessário, sessão ACP.

Subagentes não recebem timeout por omissão, a menos que isso seja configurado explicitamente.

### 7.2 Escolha do caminho de execução

Há dois caminhos principais.

Primeiro, se uma sessão ACP externa está pronta:

- acpManager.runTurn recebe o turno;
- o stream é traduzido para eventos OpenClaw;
- a transcrição é persistida;
- lifecycle e entrega são finalizados.

Caso contrário:

- o snapshot de skills é carregado;
- visibilidade e overrides de modelo são aplicados;
- credenciais são selecionadas;
- runWithModelFallback executa uma ou mais tentativas;
- live model switching pode trocar de backend;
- compactação pode ser disparada;
- a resposta final entra na entrega durável.

### 7.3 Garantia de entrega

Antes de enviar a resposta ao canal, o sistema grava uma finalização pendente durável. Depois da confirmação do outbound, essa pendência é limpa. Esse protocolo reduz perda de resposta em reinício ou crash entre geração e envio.

Há também correção de lacunas de transcrição, recuperação de runs interrompidos e rotação do ciclo de sessão.

## 8. Runtime embutido

Os arquivos centrais são:

- [src/agents/embedded-agent-runner/run.ts](https://github.com/openclaw/openclaw/blob/66f84a9bf1082de26f92b2b3741cc2f34aba34fa/src/agents/embedded-agent-runner/run.ts)
- [src/agents/embedded-agent-runner/run/attempt.ts](https://github.com/openclaw/openclaw/blob/66f84a9bf1082de26f92b2b3741cc2f34aba34fa/src/agents/embedded-agent-runner/run/attempt.ts)

### 8.1 Orquestrador de tentativas

runEmbeddedAgent:

- captura snapshot de configuração e geração de lifecycle;
- entra primeiro em uma fila por sessão e depois em uma fila global;
- executa manutenção diferida;
- resolve workspace, plugins, modelo, provedor e hooks;
- oferece o runtime OpenClaw e harnesses de plugins como Codex e Copilot;
- seleciona e rotaciona perfis de autenticação;
- limita compactações automáticas a duas por execução;
- limita recuperações de overflow a três;
- detecta loops após compactação;
- possui disjuntor de idle timeout;
- preserva lifecycle de trabalho foreground enfileirado durante reinício.

O loop classifica falhas de timeout, autenticação, rate limit, overflow, replay e resposta vazia. Conforme o caso, rotaciona credencial, troca modelo, compacta ou termina.

### 8.2 Uma tentativa

runEmbeddedAttempt executa o trabalho de granularidade fina:

1. resolve workspace e sandbox;
2. rejeita override de cwd quando o sandbox está ativo;
3. monta ferramentas e políticas;
4. carrega e trunca arquivos de bootstrap;
5. projeta schemas para o provedor;
6. constrói o system prompt;
7. adquire ownership retido da sessão e lock de escrita;
8. repara JSONL quando necessário;
9. abre SessionManager;
10. cria o context engine;
11. cria AgentSession;
12. normaliza timestamps;
13. instala subscriptions de stream;
14. configura cancelamento e timeout;
15. chama o hook before_agent_run em modo fail-closed;
16. persiste entrada bloqueada de forma redigida quando o hook recusa;
17. chama activeSession.prompt com texto e imagens;
18. aguarda ferramentas e compactação;
19. executa afterTurn e hooks finais;
20. libera MCP, LSP, catálogos, session owner, lock e diagnósticos.

O tratamento de erros tenta preservar o erro original mesmo se a limpeza posterior também falhar.

### 8.3 Concorrência e stream

O lock de transcrição usa timeout padrão de 60 segundos. O runtime padrão admite uma execução muito longa, com timeout de até 48 horas, enquanto agent.wait tem janela inicial curta e pode continuar observando.

Eventos publicados cobrem lifecycle, texto do assistente e chamadas de ferramenta. A resposta especial NO_REPLY é filtrada e existem barreiras contra duplicação de mensagem.

## 9. Prompt, contexto e bootstrap

O construtor puro está em [src/agents/system-prompt.ts](https://github.com/openclaw/openclaw/blob/66f84a9bf1082de26f92b2b3741cc2f34aba34fa/src/agents/system-prompt.ts).

O prompt é composto por seções:

- identidade e papel do agente;
- ferramentas disponíveis;
- viés de execução e regras operacionais;
- segurança;
- skills;
- controle do OpenClaw;
- workspace;
- documentação;
- arquivos de bootstrap;
- sandbox;
- data, hora e locale;
- comportamento de mensageria;
- heartbeat;
- runtime e raciocínio.

Há três modos:

- full: prompt completo;
- minimal: subconjunto operacional;
- none: somente identidade essencial.

O código separa um prefixo estável de uma cauda volátil para aproveitar cache de prompt. A seção de segurança declara que o agente não tem objetivos independentes, não deve contornar proteções, deve inspecionar configuração e agendadores antes de alterar comportamento persistente e não deve se copiar.

### 9.1 Arquivos de bootstrap

Os nomes reconhecidos incluem:

- AGENTS.md;
- SOUL.md;
- TOOLS.md;
- IDENTITY.md;
- USER.md;
- HEARTBEAT.md;
- BOOTSTRAP.md;
- MEMORY.md.

Subagentes recebem apenas AGENTS.md e TOOLS.md. Por padrão, cada arquivo é limitado a cerca de 20 mil caracteres e o conjunto a 60 mil, evitando consumo ilimitado de contexto.

### 9.2 Context engine

O context engine seleciona histórico, resumo, memória e eventos relevantes para cada turno. Plugins podem fornecer uma implementação própria. A compactação reduz histórico quando o contexto estoura, mas mantém árvores de transcrição e metadados para auditoria.

## 10. Ferramentas e política

O ponto principal é [src/agents/agent-tools.ts](https://github.com/openclaw/openclaw/blob/66f84a9bf1082de26f92b2b3741cc2f34aba34fa/src/agents/agent-tools.ts), complementado por [src/agents/openclaw-tools.ts](https://github.com/openclaw/openclaw/blob/66f84a9bf1082de26f92b2b3741cc2f34aba34fa/src/agents/openclaw-tools.ts).

### 10.1 Ferramentas de codificação

createOpenClawCodingTools pode expor:

- leitura, escrita e edição de arquivos;
- grep, find e listagem;
- exec e controle de processo;
- apply_patch;
- bridges para workspace em sandbox.

apply_patch pode ser restrito ao workspace. Essa opção é recomendada quando o modelo recebe conteúdo não confiável.

### 10.2 Ferramentas OpenClaw

O conjunto potencial inclui:

- agents_list;
- cron;
- gateway;
- goal create, get e update;
- image e image_generation;
- message;
- music;
- nodes;
- pdf;
- session_status;
- sessions_history, list, send, spawn e yield;
- skill_workshop;
- subagents;
- transcripts;
- TTS;
- update_plan;
- video;
- web_fetch e web_search;
- browser, canvas e ferramentas fornecidas por plugins.

Disponibilidade real depende de configuração, secrets, autenticação, canal, modelo, sandbox e plugins.

### 10.3 Política em camadas

A permissão efetiva resulta da combinação de:

1. perfil de ferramentas;
2. política do provedor;
3. política global;
4. política do agente;
5. política do grupo;
6. política do remetente;
7. política do sandbox;
8. política de subagente;
9. política herdada;
10. allowlist de runtime.

Hooks before_tool_call podem negar ou alterar a chamada. Wrappers também propagam cancelamento e normalizam schemas conforme o provedor.

A proteção real é a combinação de allowlists, sandbox, approvals e wrappers. Instruções no prompt são apenas uma camada comportamental e não constituem uma barreira de segurança.

## 11. Modelos, provedores e runtimes

O sistema separa quatro conceitos:

- provedor: empresa ou endpoint que oferece inferência;
- modelo: identificador lógico selecionado;
- runtime: mecanismo que conduz o loop do agente;
- canal: superfície de entrada e saída.

### 11.1 Seleção e fallback

A configuração define modelo primário e cadeia de fallbacks. Dentro do mesmo provedor, perfis de autenticação podem ser rotacionados antes de trocar de modelo.

Uma escolha explícita do usuário na sessão é estrita: ela não deve cair silenciosamente para outro modelo. Uma escolha automática pode usar fallback e registrar a mudança, além de reavaliar o modelo preferido futuramente. Jobs cron também podem ter sua própria cadeia.

### 11.2 Runtimes

Há quatro famílias:

- runtime OpenClaw embutido;
- harness de agente fornecido por plugin, como Codex ou Copilot;
- backend CLI, como ferramentas externas;
- sessão ACP via acpx.

A escolha considera política exata por modelo, política por provedor e claims de plugins. Uma seleção explícita de runtime falha fechada se o runtime não estiver disponível.

Referências OpenAI de agente GPT podem usar o runtime Codex app-server sem mudar o nome lógico openai/modelo. A autenticação OAuth do Codex é tratada separadamente.

### 11.3 Transporte LLM

src/llm e os pacotes llm-core e llm-runtime implementam:

- registro de APIs e provedores;
- transporte OpenAI, Anthropic, Google e Mistral;
- adaptação de mensagens e schemas;
- OAuth;
- proxy;
- wrappers de stream;
- reparo e normalização de tool calls.

Plugins de provedor são responsáveis por catálogo, autenticação e capacidades adicionais.

## 12. Sessões e roteamento multiagente

### 12.1 Chaves e escopo de DM

O escopo padrão de mensagem direta é main, que compartilha uma sessão entre DMs. Para ambientes com múltiplas pessoas, o modo recomendado é per-channel-peer.

Outros escopos:

- per-peer;
- per-account-channel-peer.

Grupos e salas são isolados. Threads adicionam sufixos específicos à chave.

### 12.2 Seleção de agente

Bindings determinísticos são avaliados do mais específico ao mais genérico:

1. peer exato;
2. parent;
3. guild com roles;
4. guild;
5. team;
6. account;
7. wildcard de canal;
8. agente padrão.

Cada agente possui workspace, agentDir, registro de modelos, perfis de autenticação e armazenamento de sessão próprios. Reutilizar o mesmo agentDir para agentes diferentes é incorreto.

### 12.3 Reset e continuidade

O reset diário padrão ocorre às 4h, medido por sessionStartedAt. É possível configurar reset por inatividade. Eventos internos de sistema não estendem a atividade da conversa. Comandos como new e reset iniciam novo ciclo.

## 13. Persistência

O OpenClaw usa três formas complementares.

### 13.1 Sessões em JSON e JSONL

Local padrão:

    ~/.openclaw/agents/<agentId>/sessions/sessions.json
    ~/.openclaw/agents/<agentId>/sessions/<sessionId>.jsonl

sessions.json mantém o índice. O JSONL é append-only e representa uma árvore por parentId, não somente uma lista plana. SessionManager suporta:

- mensagens;
- mudança de modelo e thinking;
- compactação;
- branch e branch summary;
- reparo de corrupção;
- merge de entradas laterais liberadas pelo prompt;
- locks de arquivo.

O gateway é o proprietário do estado de sessão. A manutenção padrão remove sessões antigas após 30 dias e limita a 500, preservando referências externas de conversa.

### 13.2 SQLite global

O schema global contém mais de 60 tabelas. Famílias principais:

- metadados e migrações de schema;
- perfis e estado de autenticação;
- diagnósticos e bundles;
- leases e approvals de execução;
- dispositivos, nodes, tokens e identidades;
- configuração de node;
- catálogo e cache de modelos;
- imagens gerenciadas e blobs de mídia;
- pareamento de canais;
- push web, VAPID e APNs;
- voice wake;
- saúde de configuração e atualização;
- índice de plugins instalados;
- estado e blobs de plugins;
- sentinelas de reinício e handoff;
- ACP e replay;
- registro dos bancos por agente;
- ingress de canais;
- uploads de skills;
- captura;
- sandbox registry;
- commitments;
- jobs e execuções cron;
- command log;
- fila de entrega;
- tarefas, subagentes e flows;
- conversation bindings;
- aprovações de plugins;
- última sessão da TUI;
- backups e migrações.

### 13.3 SQLite por agente

O banco de cada agente contém cache e autenticação, além do índice de memória:

- sources;
- chunks;
- embedding cache;
- revisões e triggers de invalidação.

### 13.4 Características do banco

O código usa SQLite nativo do Node com uma fachada Kysely síncrona. Configura:

- foreign_keys ativado;
- busy_timeout de 30 segundos;
- WAL;
- synchronous NORMAL;
- autocheckpoint em 1.000 páginas;
- checkpoint periódico limitado.

Diretórios usam permissão 0700 e arquivos 0600. WAL é rejeitado em caminhos de rede que não garantem semântica segura. Migrações de runtime devem ser aditivas; reparos destrutivos ficam para doctor.

## 14. Memória

A memória canônica é legível por humanos:

- MEMORY.md: conhecimento de longo prazo, normalmente injetado na sessão principal;
- memory/YYYY-MM-DD.md: notas diárias indexadas;
- DREAMS: material opcional de dreaming.

memory-core oferece memory_search e memory_get. A busca pode combinar palavras-chave e vetores. Backends incluem:

- SQLite embutido;
- QMD;
- Honcho;
- LanceDB.

Antes de uma compactação, o agente pode receber um turno silencioso para persistir memória útil. A escrita automática deve ser tratada com cuidado porque memória passa a ser estado confiável do operador.

## 15. Canais e entrega

### 15.1 Separação de responsabilidades

O core implementa:

- roteamento genérico;
- política de acesso;
- menções em grupo;
- debounce;
- typing;
- replies e receipts;
- fila durável;
- ferramenta message.

Cada plugin de canal implementa:

- sintaxe e resolução de destino;
- adapter inbound e outbound;
- ações específicas;
- diretório;
- configuração e capacidades.

O retorno é determinístico ao canal de origem. O modelo não escolhe implicitamente um canal diferente.

### 15.2 Política de entrada

Mensagens diretas podem usar:

- pairing, padrão;
- allowlist;
- open, que exige wildcard explícito;
- disabled.

Em grupos, a exigência de menção é o padrão. O código distingue acesso autorizado de visibilidade de contexto: poder enviar uma mensagem não implica receber todo o histórico.

### 15.3 Entrega durável

O pipeline outbound:

1. executa hooks;
2. planeja batch, chunking e mídia;
3. chama o adapter do canal;
4. registra lifecycle do envio;
5. confirma a entrega;
6. emite diagnóstico;
7. espelha a resposta na transcrição.

Quando o canal não pode provar se um envio incerto foi recebido, o adapter declara a capacidade de reconciliação. Isso evita assumir confirmação onde ela não existe.

O pipeline inbound admite checkpoints como receive_record, agent_dispatch, durable_send e manual. Broadcast groups podem disparar vários agentes depois do gate normal de reply.

### 15.4 Canais implementados

Há 24 canais declarados em manifestos:

1. ClickClack
2. Discord
3. Feishu
4. Google Chat
5. iMessage
6. IRC
7. LINE
8. Matrix
9. Mattermost
10. Microsoft Teams
11. Nextcloud Talk
12. Nostr
13. QA Channel
14. QQBot
15. Signal
16. Slack
17. SMS
18. Synology Chat
19. Telegram
20. Tlon
21. Twitch
22. WhatsApp
23. Zalo
24. Zalo User

## 16. Sistema de plugins

### 16.1 Ciclo de vida

Plugins passam por quatro estágios:

1. manifest e discovery;
2. enablement, validação e resolução de slots;
3. carregamento do runtime;
4. consumo dos registros pelos subsistemas.

A descoberta considera caminhos configurados, workspace, instalação global, pacotes e plugins bundled. O manifest é lido antes de executar código. Isso permite validar configuração e construir um snapshot de capacidades com custo e risco menores.

Código TypeScript de terceiros pode ser carregado por Jiti em ambiente de desenvolvimento; pacotes distribuídos preferem JavaScript compilado e require nativo.

### 16.2 Contrato público

O contrato está concentrado em [src/plugins/types.ts](https://github.com/openclaw/openclaw/blob/66f84a9bf1082de26f92b2b3741cc2f34aba34fa/src/plugins/types.ts) e nos subcaminhos exportados por [src/plugin-sdk](https://github.com/openclaw/openclaw/tree/66f84a9bf1082de26f92b2b3741cc2f34aba34fa/src/plugin-sdk).

Um plugin pode registrar:

- ferramentas;
- hooks;
- rotas HTTP;
- mídia hospedada;
- canais;
- métodos de gateway;
- comandos CLI;
- callbacks de reload;
- políticas de node host e invoke;
- coletores de auditoria;
- serviços e discovery;
- provedores;
- catálogos de modelo;
- embeddings;
- speech e transcrição;
- mídia, imagem, música e vídeo;
- busca e fetch web;
- context engine;
- compactação;
- harness de agente;
- middleware de ferramentas;
- controles de sessão e estado;
- workflows, tasks e memória;
- bridge MCP.

Os formatos observados são:

- capability pura;
- híbrido com capability e hooks;
- somente hooks;
- serviço sem capability pública.

before_agent_start existe por compatibilidade. Novas integrações devem preferir before_model_resolve e before_prompt_build.

### 16.3 Limites arquiteturais

Plugins não devem importar módulos internos do core. O acesso suportado é pelos 324 exports públicos. A unidade de ownership é empresa ou feature; uma capability é o contrato reutilizável.

Um plugin de workspace pode, intencionalmente, sombrear um plugin bundled com o mesmo ID quando autorizado. plugins.allow confia no ID, não comprova por si só a origem. A procedência real vem do snapshot de discovery. Essa flexibilidade exige disciplina de supply chain.

Plugins são código confiável dentro do processo. Eles têm os mesmos privilégios do OpenClaw e não são um sandbox.

### 16.4 Catálogo completo das extensões

As 138 pastas em extensions são:

| Categoria | Extensões |
|---|---|
| Runtimes e agentes | acpx, codex, codex-supervisor, copilot, copilot-proxy, github-copilot, kilocode, opencode, open-prose |
| Provedores e gateways LLM | alibaba, amazon-bedrock, amazon-bedrock-mantle, anthropic, anthropic-vertex, arcee, byteplus, cerebras, chutes, cloudflare-ai-gateway, cohere, deepinfra, deepseek, fireworks, gmi, google, groq, huggingface, kimi-coding, litellm, llama-cpp, lmstudio, microsoft, microsoft-foundry, minimax, mistral, moonshot, novita, nvidia, ollama, openai, opencode-go, openrouter, qianfan, qwen, sglang, stepfun, synthetic, tencent, together, venice, vercel-ai-gateway, vllm, volcengine, xai, xiaomi, zai |
| Canais | clickclack, discord, feishu, googlechat, imessage, irc, line, matrix, mattermost, msteams, nextcloud-talk, nostr, qa-channel, qqbot, signal, slack, sms, synology-chat, telegram, tlon, twitch, whatsapp, zalo, zalouser |
| Busca e conteúdo web | brave, duckduckgo, exa, firecrawl, parallel, perplexity, searxng, tavily, web-readability |
| Navegação e superfícies | browser, canvas, device-pair, phone-control |
| Áudio, voz e fala | azure-speech, deepgram, elevenlabs, gradium, inworld, senseaudio, sherpa-related core through plugins, talk-voice, tts-local-cli, voice-call |
| Imagem, vídeo e mídia | comfy, document-extract, fal, image-generation-core, media-understanding-core, pixverse, runway, video-generation-core |
| Memória | active-memory, memory-core, memory-lancedb, memory-wiki, tokenjuice |
| Observabilidade e operação | admin-http-rpc, bonjour, diagnostics-otel, diagnostics-prometheus, oc-path, policy, webhooks |
| Produtividade e workflow | diffs, diffs-language-pack, google-meet, llm-task, lobster, migrate-claude, migrate-hermes, workboard |
| QA e suporte | qa-lab, qa-matrix, test-support |
| Segurança e ownership | openshell, thread-ownership |
| Outros provedores de mídia/voz | image-generation-core, media-understanding-core, video-generation-core |

Lista alfabética exata:

1. acpx
2. active-memory
3. admin-http-rpc
4. alibaba
5. amazon-bedrock
6. amazon-bedrock-mantle
7. anthropic
8. anthropic-vertex
9. arcee
10. azure-speech
11. bonjour
12. brave
13. browser
14. byteplus
15. canvas
16. cerebras
17. chutes
18. clickclack
19. cloudflare-ai-gateway
20. codex
21. codex-supervisor
22. cohere
23. comfy
24. copilot
25. copilot-proxy
26. deepgram
27. deepinfra
28. deepseek
29. device-pair
30. diagnostics-otel
31. diagnostics-prometheus
32. diffs
33. diffs-language-pack
34. discord
35. document-extract
36. duckduckgo
37. elevenlabs
38. exa
39. fal
40. feishu
41. file-transfer
42. firecrawl
43. fireworks
44. github-copilot
45. gmi
46. google
47. google-meet
48. googlechat
49. gradium
50. groq
51. huggingface
52. image-generation-core
53. imessage
54. inworld
55. irc
56. kilocode
57. kimi-coding
58. line
59. litellm
60. llama-cpp
61. llm-task
62. lmstudio
63. lobster
64. matrix
65. mattermost
66. media-understanding-core
67. memory-core
68. memory-lancedb
69. memory-wiki
70. microsoft
71. microsoft-foundry
72. migrate-claude
73. migrate-hermes
74. minimax
75. mistral
76. moonshot
77. msteams
78. nextcloud-talk
79. nostr
80. novita
81. nvidia
82. oc-path
83. ollama
84. open-prose
85. openai
86. opencode
87. opencode-go
88. openrouter
89. openshell
90. parallel
91. perplexity
92. phone-control
93. pixverse
94. policy
95. qa-channel
96. qa-lab
97. qa-matrix
98. qianfan
99. qqbot
100. qwen
101. runway
102. searxng
103. senseaudio
104. sglang
105. signal
106. slack
107. sms
108. stepfun
109. synology-chat
110. synthetic
111. talk-voice
112. tavily
113. telegram
114. tencent
115. test-support
116. thread-ownership
117. tlon
118. together
119. tokenjuice
120. tts-local-cli
121. twitch
122. venice
123. vercel-ai-gateway
124. video-generation-core
125. vllm
126. voice-call
127. volcengine
128. voyage
129. vydra
130. web-readability
131. webhooks
132. whatsapp
133. workboard
134. xai
135. xiaomi
136. zai
137. zalo
138. zalouser

Quatro pastas não possuem openclaw.plugin.json próprio: image-generation-core, media-understanding-core, test-support e video-generation-core. Elas funcionam como infraestrutura compartilhada ou suporte, e não como plugin instalável independente.

## 17. Automação, tarefas e hooks

### 17.1 Cron

O scheduler vive no gateway e persiste jobs. Tipos de agenda:

- data e hora única;
- intervalo recorrente;
- expressão cron;
- timezone explícito;
- staggering para distribuir carga.

O job pode:

- inserir evento na sessão principal;
- abrir sessão isolada de agente;
- executar comando;
- anunciar a resposta;
- chamar webhook;
- não entregar saída.

Cada job pode sobrescrever modelo e thinking. Execuções e logs são gravados em SQLite. Existem retry, backoff e alertas de falha.

Webhooks aceitam Bearer ou x-openclaw-token. Token em query string é rejeitado, reduzindo vazamento por logs e histórico.

### 17.2 Tarefas

Tarefas duráveis registram:

- tipo, como CLI, cron, subagente ou ACP;
- owner e requester;
- sessão;
- destino de entrega;
- retenção;
- lifecycle e resultado.

Isso permite acompanhar execuções além da duração de uma conexão WebSocket.

### 17.3 Commitments

Commitments são follow-ups inferidos, opcionais e curtos, entregues pelo heartbeat. Lembretes explícitos devem ser cron jobs. Essa separação evita transformar toda promessa conversacional em automação permanente.

### 17.4 Hooks internos

Hooks de arquivo são compostos por HOOK.md e handler. Eventos incluem:

- command new, reset e stop;
- compactação de sessão;
- bootstrap de agente;
- lifecycle do gateway;
- mensagem recebida, transcrita, pré-processada e enviada.

Hooks bundled:

- session-memory;
- bootstrap-extra-files;
- command-logger;
- compaction-notifier;
- boot-md.

### 17.5 Hooks de plugin

Os pontos principais são:

- before_model_resolve;
- before_prompt_build;
- before_agent_start, legado;
- before_agent_reply;
- before_agent_run;
- before_agent_finalize;
- agent_end;
- compactação;
- before_tool_call;
- after_tool_call;
- before install;
- tool result persist;
- messaging;
- lifecycle de sessão e gateway.

Hooks que fazem política devem falhar de maneira explícita. O runtime trata before_agent_run como fail-closed.

## 18. Interfaces de usuário e clientes

### 18.1 Control UI

O diretório ui usa Vite 8 e Lit 3. Bibliotecas de sanitização e Markdown incluem DOMPurify, markdown-it e marked. O service worker é ativado apenas em produção.

Controladores cobrem:

- agentes;
- canais;
- chat;
- configuração;
- cron;
- devices e nodes;
- approvals;
- logs e health;
- modelos;
- sessões;
- skills e workshop;
- usage;
- workboard;
- dreaming.

O chat renderiza tool cards, streaming, anexos e talk em tempo real. A interface possui internacionalização, incluindo pt-BR. Autenticação e identidade de dispositivo são negociadas com o gateway.

### 18.2 TUI

src/tui usa pi-tui. Opera conectado ao gateway ou em modo local embutido. Possui:

- chat log;
- cards de ferramentas;
- status e footer;
- seletores de modelo, agente e sessão;
- streaming;
- histórico;
- reconexão e tratamento de gaps.

O comando local iniciado por ! pede confirmação uma vez por sessão. Entrega via gateway fica desativada por padrão nesse modo para evitar mensagens duplicadas.

### 18.3 Android

O app Android usa Kotlin e Jetpack Compose. Seu estado no próprio repositório é descrito como extremamente alpha e em reconstrução.

NodeApp cria um NodeRuntime singleton e ativa StrictMode em debug. NodeRuntime concentra:

- duas sessões de gateway, operator e node;
- confiança por fingerprint TLS;
- identidade de dispositivo;
- preferências criptografadas;
- conexão e discovery;
- chat;
- câmera e localização;
- SMS e call log;
- fotos;
- contatos e calendário;
- movimento;
- notificações;
- informações do sistema;
- talk;
- Canvas e A2UI.

Capacidades são filtradas por flavor. A versão Play remove permissões restritas de SMS, call log e fotos; a versão thirdParty pode incluí-las. Há reforço com biometria e proteção de tokens.

### 18.4 iOS

O app iOS é SwiftUI, foreground-first e classificado como super-alpha. Pode assumir os papéis node e operator.

Inclui:

- discovery e configuração manual do gateway;
- pin de TLS;
- Keychain;
- pareamento;
- chat e talk;
- Canvas;
- câmera e tela;
- localização;
- contatos, calendário e lembretes;
- fotos e movimento;
- notificações;
- share extension;
- Apple Watch;
- APNs.

Push pode ser direto/local ou passar pelo relay hospedado oficial. O relay combina App Attest, JWS do StoreKit, identidade do gateway e grant delegado de envio. Limitações de execução em background são documentadas.

### 18.5 macOS

O app macOS usa Swift 6.2 e funciona como menu bar e companion desktop. Contém:

- processo e autostart do gateway;
- discovery e túnel remoto;
- WebChat e dashboard;
- canais, configuração, cron, sessões, skills e usage;
- node mode;
- browser, localização e captura de tela;
- approvals e avaliador de allowlist para exec;
- gestão de permissões;
- Canvas;
- talk e voice wake;
- atualização Sparkle.

O runtime Node não roda como root. Dependências incluem MenuBarExtraAccess, Swift Subprocess, Swift Logging, Sparkle, Peekaboo, OpenClawKit e swabble.

### 18.6 Pacotes Swift auxiliares

OpenClawKit é compartilhado por iOS e macOS e contém:

- OpenClawProtocol;
- OpenClawKit;
- OpenClawChatUI;
- conexão de gateway;
- autenticação de dispositivo;
- confiança TLS;
- modelos de comando;
- Canvas e A2UI;
- mídia e chat.

macos-mlx-tts fornece TTS local. swabble usa APIs de fala on-device para voice wake em macOS.

## 19. Pacotes internos

O workspace pnpm inclui 21 pacotes:

| Pacote | Responsabilidade |
|---|---|
| acp-core | Contratos e utilitários ACP |
| agent-core | Tipos e lógica comum de agente |
| gateway-client | Cliente, readiness, auth e timeout do gateway |
| gateway-protocol | Schemas, validadores, erros e versão do protocolo |
| llm-core | Tipos neutros de modelo e inferência |
| llm-runtime | Execução e transporte LLM |
| markdown-core | Processamento Markdown reutilizável |
| media-core | Tipos e operações comuns de mídia |
| media-generation-core | Contratos de geração de mídia |
| media-understanding-common | Contratos de compreensão de mídia |
| memory-host-sdk | Interface host para memória |
| model-catalog-core | Catálogo e referências de modelo |
| net-policy | Política comum de rede |
| normalization-core | Normalização compartilhada |
| plugin-package-contract | Contrato de empacotamento de plugin |
| plugin-sdk | SDK de plugins |
| sdk | SDK pública de alto nível |
| speech-core | Tipos de speech e áudio |
| terminal-core | Abstrações de terminal |
| tool-call-repair | Reparo de chamadas de ferramenta |
| web-content-core | Conteúdo e fetch web comuns |

A maioria tem versão 0.0.0-private e existe para impor limites de dependência. gateway-protocol é o contrato wire. gateway-client implementa conexão, device auth, readiness e timeout. A SDK pública organiza namespaces para Agent, Agents, Approvals, Artifacts, Environments, Models, Sessions, Tasks, Tools, Run, transport e event hub.

## 20. Skills incluídas

### 20.1 Descoberta

Precedência, da maior para a menor:

1. workspace;
2. .agents do workspace;
3. ~/.agents;
4. ~/.openclaw;
5. skills bundled;
6. diretórios extras e plugins.

Skills são filtradas por sistema operacional, binários, variáveis, configuração e allowlist por agente. O runtime usa snapshots para evitar mudança inesperada no meio de um turno.

Skills de terceiros devem ser tratadas como instruções não confiáveis. O loader verifica contenção de caminho e políticas de instalação, mas o conteúdo ainda influencia o agente.

### 20.2 Catálogo completo

As 57 skills bundled são:

1. 1password
2. apple-notes
3. apple-reminders
4. bear-notes
5. blogwatcher
6. blucli
7. camsnap
8. canvas
9. clawhub
10. coding-agent
11. diagram-maker
12. discord
13. eightctl
14. gemini
15. gh-issues
16. gifgrep
17. github
18. gog
19. goplaces
20. healthcheck
21. himalaya
22. imsg
23. mcporter
24. meme-maker
25. model-usage
26. nano-pdf
27. node-connect
28. node-inspect-debugger
29. notion
30. obsidian
31. openai-whisper-api
32. openai-whisper
33. openhue
34. oracle
35. ordercli
36. peekaboo
37. python-debugpy
38. sag
39. session-logs
40. sherpa-onnx-tts
41. skill-creator
42. slack
43. songsee
44. sonoscli
45. spike
46. spotify-player
47. summarize
48. taskflow-inbox-triage
49. taskflow
50. things-mac
51. tmux
52. trello
53. video-frames
54. voice-call
55. wacli
56. weather
57. xurl

## 21. Configuração e secrets

### 21.1 Configuração

O arquivo opcional padrão é ~/.openclaw/openclaw.json, em JSON5. O schema é estrito: chaves desconhecidas são rejeitadas, exceto $schema na raiz. Schemas de plugins e canais são mesclados a partir dos manifests.

O reload mantém o último runtime aceito quando a nova configuração é inválida. Em inicialização fria, configuração inválida impede o serviço e doctor fornece diagnóstico ou reparo. O código evita promover automaticamente snapshots redigidos como se fossem configuração completa.

Edições de mapas de modelos são aditivas e há proteção contra clobber concorrente.

### 21.2 Ambiente

Precedência geral:

1. variáveis já presentes no processo;
2. .env local;
3. ~/.openclaw/.env;
4. bloco env da configuração.

Algumas credenciais diretas têm resolução específica para evitar que um mecanismo genérico mude seu significado.

### 21.3 Secret refs

Secrets podem vir de:

- variável de ambiente;
- arquivo;
- comando exec autorizado;
- referências resolvidas por plugin ou provider.

O runtime trabalha com snapshots redigidos e só resolve o valor quando necessário. Auditorias removem secrets de argv e mensagens. Há guarda de concorrência para atualizações atômicas.

Credenciais geradas temporariamente para o owner podem permanecer somente em memória. Includes de configuração são confinados ao diretório do arquivo, salvo raízes explicitamente permitidas por OPENCLAW_INCLUDE_ROOTS. Escrita através de symlink não é suportada como caminho normal.

## 22. Modelo de segurança

### 22.1 Limite de confiança declarado

O OpenClaw é local-first e assume um operador confiável por host/gateway. Ele não promete isolamento entre usuários hostis.

Consequências:

- token compartilhado ou cliente autenticado equivale a um operador poderoso;
- sessionId é identificador de roteamento, não fronteira de autorização;
- node pareado é uma extensão remota do operador;
- approvals são guardrails, não isolamento de tenant;
- plugins executam com privilégio do processo;
- arquivos de memória são estado confiável do operador.

### 22.2 Sandbox e execução

O sandbox vem desativado por padrão. tools.exec usa host auto por desenho. Para entrada não confiável, é necessário ativar sandbox em non-main ou all, restringir ferramentas e habilitar approvals.

Approvals vinculam comando, cwd, ambiente e, em alguns caminhos, snapshot do script. Essa verificação é best effort e não deve ser tratada como isolamento criptográfico.

### 22.3 Rede

O gateway e a Control UI devem permanecer locais. O bind padrão em loopback é adequado. Exposição à internet pública não é um cenário endurecido. Acesso remoto recomendado usa túnel SSH, Tailscale e autenticação.

O modelo LLM é considerado não confiável. Prompt injection, isoladamente, não é uma fronteira. As fronteiras efetivas são autenticação, política de ferramentas, sandbox, approvals, contenção de filesystem e adapters.

### 22.4 Controles positivos

O repositório demonstra:

- verificações fail-closed em caminhos sensíveis;
- separação entre chamada confiável local e ingress remoto;
- nonce assinado e identidade de dispositivo;
- secrets redigidos;
- permissões de filesystem 0700 e 0600;
- imagens Docker fixadas por digest;
- processo Docker não root;
- dependências e actions pinadas;
- limites de SSRF e política de rede;
- revisão especial para mudanças security-sensitive;
- CodeQL segmentado;
- OpenGrep em diffs;
- detecção de secrets;
- testes de boundary entre core e plugins.

## 23. Build, qualidade e testes

### 23.1 Build

O pacote é ESM. O build principal chama scripts/build-all.mjs, que coordena tsdown, assets de plugins e declarações da SDK. O workspace cobre raiz, ui, packages e extensions.

pnpm aplica:

- minimumReleaseAge de 2.880 minutos;
- blockExoticSubdeps;
- overrides fixos;
- patch de dependência ACP;
- allowBuilds explícito.

TypeScript usa NodeNext, ES2023 e strict. A versão de compilador observada é TypeScript 6.0.3/tsgo.

### 23.2 Matriz de testes

Vitest 4.1.8 é dividido em muitos shards:

- unitários;
- fast;
- security;
- gateway;
- channels;
- extensions;
- contratos;
- E2E;
- live;
- UI;
- PTY.

Há wrappers para:

- timeout;
- retry;
- encerramento de grupos de processos;
- paralelismo;
- coleta de timing.

Outras matrizes:

- Playwright para UI;
- Swift build, test e lint;
- Android Gradle para flavors Play e thirdParty;
- testes Windows e macOS;
- Docker E2E e live.

test:all combina lint, build, unit, E2E, live e Docker.

### 23.3 Guardrails estruturais

Testes e scripts verificam:

- ciclos de arquitetura;
- limites de importação;
- exports da SDK;
- TypeBox e protocolo;
- uso correto de Kysely;
- caminhos temporários;
- autenticação antes da leitura do body de webhook;
- política de plugins;
- compatibilidade de canais;
- configuração e secrets;
- migrações;
- entrega e idempotência.

O repositório possui mais de 50 workflows de CI, incluindo CodeQL por categoria, checks de dependência e gates para código sensível.

### 23.4 Validação realizada nesta análise

Não foram executados build ou testes porque:

- a solicitação é de análise, sem mudança de código;
- o repositório encontrado está fora da raiz gravável deste trabalho;
- pnpm docs:list tentou criar um diretório temporário dentro do checkout somente leitura e falhou com EPERM.

A documentação foi indexada manualmente e os arquivos ausentes do sparse checkout foram lidos pelo Git. Portanto, as conclusões são de revisão estática da versão identificada, não de validação dinâmica do binário.

## 24. Avaliação de engenharia

### 24.1 Pontos fortes

1. Limite de segurança honesto. A documentação não vende multitenancy que o produto não oferece.
2. Entrega resiliente. Idempotência, fila durável, pending-final e recuperação de restart cobrem falhas comuns.
3. Arquitetura extensível. Canais e providers vivem nas bordas, com manifest-first e SDK pública.
4. Runtime robusto. Retry, rotação de auth, fallback, compactação e recuperação são tratados como estados explícitos.
5. Estado auditável. JSONL append-only preserva a história; SQLite organiza o estado operacional.
6. Políticas sobrepostas. A permissão efetiva pode ser afinada por provedor, agente, grupo, usuário, sandbox e runtime.
7. Compatibilidade entre clientes. Protocolos schema-first alimentam TypeScript, web e Swift.
8. Qualidade de supply chain. Actions e imagens pinadas, dependências controladas e scanners específicos.
9. Cobertura de integração. A matriz inclui canais, plugins, apps nativos, UI e Docker.
10. Startup pensado. Imports preguiçosos e fast paths evitam carregar todo o monólito no uso simples.

### 24.2 Riscos e dívidas técnicas

1. Blast radius padrão alto. Sandbox off e exec no host são úteis para um assistente local, mas perigosos quando um canal recebe conteúdo não confiável.
2. Escopo main de DM. Em um gateway usado por várias pessoas, a configuração padrão pode compartilhar contexto entre conversas.
3. Supply chain de plugins e skills. Plugins são privilegiados e um ID pode ser sombreado por fonte de workspace.
4. Arquivos centrais gigantes. attempt.ts, agent-command.ts, server.impl.ts e chat.ts acumulam decisões de muitas camadas.
5. Persistência híbrida. JSONL e SQLite são adequados a responsabilidades diferentes, mas aumentam complexidade de transação, recuperação e migração.
6. Ausência de replay global de eventos. Clientes precisam detectar gaps e refazer snapshots corretamente.
7. Superfície enorme. Centenas de integrações e múltiplos apps ampliam a matriz de regressão.
8. Apps móveis imaturos. Android e iOS são explicitamente alpha.
9. Contrato público muito largo. 324 exports melhoram extensibilidade, mas tornam evolução e compatibilidade custosas.
10. Centro de controle único. O gateway concentra estado e autoridade; sua indisponibilidade afeta praticamente todas as superfícies.

### 24.3 Riscos não classificados como vulnerabilidade

Os itens acima são propriedades do modelo operacional e da arquitetura. Não encontrei, nesta revisão estática, evidência suficiente para declarar uma vulnerabilidade explorável específica. Fazer isso exigiria um threat model definido, ambiente reproduzível, testes dinâmicos e confirmação de impacto.

## 25. Recomendações de implantação

Para uso pessoal em uma única máquina:

- manter o gateway em loopback;
- usar token forte e pareamento;
- revisar plugins e skills instalados;
- habilitar approvals para exec;
- restringir escrita ao workspace;
- manter backups de ~/.openclaw.

Para mensagens vindas de terceiros:

- mudar DM scope para per-channel-peer;
- usar allowlists ou pairing;
- exigir menção em grupos;
- ativar sandbox para sessões não principais;
- negar exec, write e browser quando não necessários;
- separar agentes por finalidade e agentDir;
- limitar canais e ações de message;
- auditar outbound e webhooks.

Para ambiente de equipe:

- não tratar uma instância como serviço multitenant;
- usar uma instância ou identidade operacional separada por fronteira de confiança;
- fixar a procedência de plugins;
- controlar alterações de openclaw.json;
- exportar diagnósticos para OTEL ou Prometheus;
- testar restauração de SQLite, JSONL e arquivos de memória.

Para manutenção do código:

- decompor os maiores orquestradores por máquina de estados ou serviços estreitos;
- manter o core sem imports de extensões;
- preservar manifests como fonte de validação sem execução;
- adicionar testes de recuperação sempre que tocar em entrega, restart ou sessão;
- tratar mudanças no protocolo como aditivas;
- evitar migração destrutiva automática;
- medir startup e carregamento de plugins em cada alteração de registro.

## 26. Mapa dos diretórios

### 26.1 Raiz

| Caminho | Papel |
|---|---|
| openclaw.mjs | Bootstrap do executável |
| package.json | Scripts, dependências, binário e exports |
| pnpm-workspace.yaml | Monorepo e política de dependências |
| tsconfig.json | Compilação TypeScript |
| src | Núcleo da aplicação |
| extensions | Plugins e integrações |
| packages | Bibliotecas e contratos internos |
| ui | Control UI web |
| apps | Android, iOS, macOS e auxiliares |
| skills | Skills bundled |
| docs | Documentação |
| scripts | Build, release, QA e manutenção |
| test | Harnesses e suites transversais |
| qa | Cenários de qualidade |
| security | Política e assets de segurança |
| deploy | Empacotamento e implantação |
| config | Configuração de ferramentas do repositório |
| patches | Patches de dependências |
| .github | CI, templates e automações |
| .agents | Instruções e recursos de agentes de desenvolvimento |

### 26.2 src por responsabilidade

| Grupo | Diretórios |
|---|---|
| Execução de agente | agents, auto-reply, context-engine, llm, models |
| Controle | gateway, commands, cli, daemon, config |
| Extensibilidade | plugins, plugin-sdk, hooks, skills |
| Comunicação | channels, infra/outbound, media, media-understanding, speech |
| Estado | sessions, state, memory, secrets, tasks, cron |
| Segurança | security, approvals, sandbox |
| Integrações de protocolo | acp, mcp, nodes |
| Interfaces | tui, terminal |
| Operação | logging, diagnostics, infra, shared |
| Outros domínios | browser, canvas, web, usage, update, backup, pairing |

## 27. Índice de arquivos-chave

### Entrada, CLI e servidor

- [openclaw.mjs](https://github.com/openclaw/openclaw/blob/66f84a9bf1082de26f92b2b3741cc2f34aba34fa/openclaw.mjs)
- [src/entry.ts](https://github.com/openclaw/openclaw/blob/66f84a9bf1082de26f92b2b3741cc2f34aba34fa/src/entry.ts)
- [src/cli/program/build-program.ts](https://github.com/openclaw/openclaw/blob/66f84a9bf1082de26f92b2b3741cc2f34aba34fa/src/cli/program/build-program.ts)
- [src/gateway/server.impl.ts](https://github.com/openclaw/openclaw/blob/66f84a9bf1082de26f92b2b3741cc2f34aba34fa/src/gateway/server.impl.ts)
- [src/gateway/server-methods.ts](https://github.com/openclaw/openclaw/blob/66f84a9bf1082de26f92b2b3741cc2f34aba34fa/src/gateway/server-methods.ts)
- [src/gateway/server-methods/agent.ts](https://github.com/openclaw/openclaw/blob/66f84a9bf1082de26f92b2b3741cc2f34aba34fa/src/gateway/server-methods/agent.ts)

### Runtime do agente

- [src/agents/agent-command.ts](https://github.com/openclaw/openclaw/blob/66f84a9bf1082de26f92b2b3741cc2f34aba34fa/src/agents/agent-command.ts)
- [src/agents/embedded-agent-runner/run.ts](https://github.com/openclaw/openclaw/blob/66f84a9bf1082de26f92b2b3741cc2f34aba34fa/src/agents/embedded-agent-runner/run.ts)
- [src/agents/embedded-agent-runner/run/attempt.ts](https://github.com/openclaw/openclaw/blob/66f84a9bf1082de26f92b2b3741cc2f34aba34fa/src/agents/embedded-agent-runner/run/attempt.ts)
- [src/agents/system-prompt.ts](https://github.com/openclaw/openclaw/blob/66f84a9bf1082de26f92b2b3741cc2f34aba34fa/src/agents/system-prompt.ts)
- [src/agents/agent-tools.ts](https://github.com/openclaw/openclaw/blob/66f84a9bf1082de26f92b2b3741cc2f34aba34fa/src/agents/agent-tools.ts)
- [src/agents/openclaw-tools.ts](https://github.com/openclaw/openclaw/blob/66f84a9bf1082de26f92b2b3741cc2f34aba34fa/src/agents/openclaw-tools.ts)

### Plugins, configuração e estado

- [src/plugins/types.ts](https://github.com/openclaw/openclaw/blob/66f84a9bf1082de26f92b2b3741cc2f34aba34fa/src/plugins/types.ts)
- [src/plugin-sdk](https://github.com/openclaw/openclaw/tree/66f84a9bf1082de26f92b2b3741cc2f34aba34fa/src/plugin-sdk)
- [src/config](https://github.com/openclaw/openclaw/tree/66f84a9bf1082de26f92b2b3741cc2f34aba34fa/src/config)
- [src/secrets](https://github.com/openclaw/openclaw/tree/66f84a9bf1082de26f92b2b3741cc2f34aba34fa/src/secrets)
- [src/state/openclaw-state-schema.sql](https://github.com/openclaw/openclaw/blob/66f84a9bf1082de26f92b2b3741cc2f34aba34fa/src/state/openclaw-state-schema.sql)
- [src/infra/state-migrations.ts](https://github.com/openclaw/openclaw/blob/66f84a9bf1082de26f92b2b3741cc2f34aba34fa/src/infra/state-migrations.ts)

### Comunicação, automação e interfaces

- [src/channels](https://github.com/openclaw/openclaw/tree/66f84a9bf1082de26f92b2b3741cc2f34aba34fa/src/channels)
- [src/infra/outbound](https://github.com/openclaw/openclaw/tree/66f84a9bf1082de26f92b2b3741cc2f34aba34fa/src/infra/outbound)
- [src/cron](https://github.com/openclaw/openclaw/tree/66f84a9bf1082de26f92b2b3741cc2f34aba34fa/src/cron)
- [src/tasks](https://github.com/openclaw/openclaw/tree/66f84a9bf1082de26f92b2b3741cc2f34aba34fa/src/tasks)
- [src/tui](https://github.com/openclaw/openclaw/tree/66f84a9bf1082de26f92b2b3741cc2f34aba34fa/src/tui)
- [ui](https://github.com/openclaw/openclaw/tree/66f84a9bf1082de26f92b2b3741cc2f34aba34fa/ui)
- [apps](https://github.com/openclaw/openclaw/tree/66f84a9bf1082de26f92b2b3741cc2f34aba34fa/apps)

## 28. Conclusão

O OpenClaw é um sistema de agentes maduro no núcleo operacional e amplo nas integrações. Seu principal valor técnico não está em uma única chamada a modelo, mas na coordenação confiável de sessão, ferramentas, canais, estado, fallback e entrega.

A arquitetura funciona melhor quando implantada conforme sua premissa original: operador único ou fronteira de confiança estreita, gateway local, plugins auditados e políticas explícitas para qualquer entrada externa. Fora dessa premissa, principalmente em uso compartilhado ou exposto à internet, os defaults precisam ser endurecidos.

As áreas que merecem maior atenção em futuras mudanças são o runtime de tentativa, agent-command, chat/gateway, migrações e plugins privilegiados. São também as áreas em que os testes de contrato, recuperação e segurança oferecem mais retorno.
