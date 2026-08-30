# EVE Agent

EVE é uma plataforma independente de agentes de IA, auto-hospedada e preparada
para operar em canais de mensagem, terminal, navegador, aplicativos e nós
remotos. O projeto reúne o núcleo completo de gateway multi-canal do OpenClaw
com uma camada operacional própria para trabalho persistente: projetos,
missões, fluxos, avaliações, rastreabilidade, recuperação e operação offline.

> **Status da distribuição:** o código-fonte e a versão `2026.6.8` estão
> publicados neste repositório. O pacote `eve-agent` **ainda não foi
> publicado no npm**; por enquanto, a instalação recomendada é a partir do
> código-fonte.

## Visão geral

O objetivo do EVE é ser uma base completa para um agente que realmente
executa trabalho: recebe uma solicitação em um canal, escolhe um provedor e
ferramentas compatíveis, mantém o contexto da sessão e devolve evidências do
resultado. A mesma instalação pode atender uma pessoa, uma equipe ou uma
infraestrutura de automação, sem depender de um serviço central do projeto.

O comando público é `eve`, o nome reservado do pacote é `eve-agent` e o estado
persistente fica em `~/.eve` por padrão. A configuração principal é
`~/.eve/eve.json`.

```text
Pessoa, canal ou aplicativo
            │
            ▼
  Gateway EVE ── sessões, autenticação e roteamento
            │
            ├── provedores e modelos de IA
            ├── ferramentas, MCP, skills e plugins
            ├── navegador, arquivos, shell e nós remotos
            └── projetos, missões, traces, resultados e backups
            │
            ▼
      Resposta, evidência e estado persistente
```

## O que o projeto entrega

| Área | Capacidades principais |
| --- | --- |
| Comunicação | Terminal, WebChat, Control UI, macOS, iOS, Android e nós headless; integrações para WhatsApp, Telegram, Slack, Discord, Signal, iMessage, Matrix, Google Chat, Microsoft Teams, IRC, LINE, Feishu e outros plugins de canal. |
| Inteligência | OpenAI, Anthropic, Google, Ollama, OpenRouter, Bedrock e provedores compatíveis; perfis, fallback, streaming, tool calling, roteamento adaptativo e laboratório de modelos. |
| Execução | Browser, shell, arquivos, mídia, MCP, plugins, skills, cron, hooks, sessões, subagentes, metas, memória e backends de sandbox. |
| Operação | Mission Control, Workboard, projetos, pausa/retomada/retry, reatribuição, evidências de conclusão, workers distribuídos e ambientes isolados. |
| Qualidade | Trace Studio, Result Hub, avaliações orientadas por trajetória, fluxos duráveis, experimentos canário e observabilidade operacional. |
| Continuidade | Backups transacionais, restauração verificada, pacotes de trabalho e bundles offline com manifesto SHA-256. |
| Produção de conteúdo | EVE Studio para documentos, apresentações, planilhas, sites, diagramas, notas, importação, download e publicação no Result Hub. |

## Arquitetura do repositório

O repositório é intencionalmente modular. O núcleo não fica amarrado a um canal
ou provedor específico; extensões usam contratos públicos de plugin e SDK.

```text
eve-agent/
├── src/             núcleo do gateway, agentes, CLI, ferramentas e configuração
├── extensions/      canais, provedores, plugins e integrações opcionais
├── packages/        contratos compartilhados e protocolo do gateway
├── apps/            aplicativos e superfícies de usuário
├── ui/              Control UI web
├── docs/            documentação técnica publicada
├── scripts/         build, validação, instalação e manutenção
├── test/             testes de integração e infraestrutura de testes
└── eve.mjs          ponto de entrada do comando `eve`
```

### Fluxo de uma solicitação

1. Um canal, a CLI ou a interface web entrega a mensagem ao Gateway.
2. O Gateway identifica o agente, a sessão, o destino e as capacidades
   disponíveis.
3. O runtime seleciona o modelo/provedor configurado, prepara o contexto e
   disponibiliza ferramentas autorizadas pela instalação.
4. O agente pode chamar ferramentas, skills, servidores MCP, navegador, shell
   ou nós remotos, conforme a configuração local.
5. A resposta é renderizada no canal de origem; sessões, resultados, traces e
   estado operacional são mantidos para auditoria e continuidade.

## Política de produto: fase inicial

Nesta primeira fase, o EVE não acrescenta uma política comportamental própria
ao prompt do agente: não há uma camada de recusas ou regras de conteúdo criada
pelo projeto. `SOUL.md` também começa vazio. A política de produto será
desenhada pelo proprietário em uma etapa posterior, como um módulo explícito e
auditável do EVE.

Isso não desativa limitações externas. Regras de um modelo/provedor, termos de
serviços integrados e controles técnicos da instalação continuam existindo.
Autenticação, pareamento de remetentes, limites de sistema de arquivos,
validação de protocolo, limites de recursos e disponibilidade de ferramentas
são controles de execução, não uma política comportamental proprietária do
EVE. Consulte a documentação de
[política controlada pelo proprietário](https://docs.eve.ai/concepts/owner-policy).

## Instalação recomendada: código-fonte

Pré-requisitos:

- Node.js 22.19 ou superior; Node.js 24 é recomendado;
- `corepack` habilitado;
- `pnpm` gerenciado pelo Corepack;
- Git.

```bash
git clone https://github.com/engsathiago/eve-agent.git
cd eve-agent
corepack enable
pnpm install --frozen-lockfile
pnpm build
pnpm eve --version
```

Para usar a CLI dentro do checkout, prefira `pnpm eve <comando>`:

```bash
pnpm eve onboard --install-daemon
pnpm eve gateway status
pnpm eve doctor
```

### Instalação nativa em uma VPS Linux

O procedimento abaixo instala diretamente na máquina, sem Docker. Execute-o
como o usuário que vai operar o Gateway. O `pnpm build` é obrigatório: o
comando `eve` precisa do conteúdo gerado em `dist/`.

```bash
git clone https://github.com/engsathiago/eve-agent.git /opt/eve
cd /opt/eve
corepack enable
pnpm install --frozen-lockfile
pnpm build
sudo ln -sfn /opt/eve/eve.mjs /usr/local/bin/eve

eve --version
eve onboard --install-daemon
eve gateway status --probe
```

Se `eve` informar que falta `dist/entry.js` ou `dist/entry.mjs`, a instalação é
um checkout sem build. Entre no diretório do projeto, execute `pnpm build` e
repita `eve --version`. Não use um link simbólico apontando para uma pasta
temporária de teste.

Mantenha o Gateway em `loopback` ou em uma rede privada até configurar acesso
remoto autenticado. O guia completo está em
[Linux VPS](https://docs.eve.ai/vps).

## Primeiros comandos

```bash
# Assistente de configuração, credenciais e serviço
eve onboard --install-daemon

# Diagnóstico e estado do Gateway
eve doctor
eve status
eve gateway status --probe

# Interfaces locais
eve dashboard
eve tui

# Catálogos da instalação
eve channels list
eve plugins list
eve models list
```

Os comandos operacionais adicionais incluem:

```bash
eve mission status
eve projects list
eve intelligence status
eve traces status
eve results status
eve flows status
eve evals status
eve router status
eve experiments status
eve workers status
eve model-lab status
eve environments status
eve studio list
eve integrations list
eve packages list
```

## Backup, restauração e operação offline

```bash
# Cria e verifica um backup do estado EVE
eve backup create

# Primeiro valida a restauração; só depois aplica a troca de estado
eve backup restore ./eve-backup.tar.gz
eve backup restore ./eve-backup.tar.gz --apply

# Prepara operação sem rede com um modelo local
eve offline status
eve offline configure --model qwen3:8b
eve offline bundle --output /mnt/eve-offline
```

A restauração é uma simulação verificada por padrão. Quando aplicada, ela cria
um backup pré-restauração antes de substituir o estado. Bundles offline usam
manifesto SHA-256 e instalador sem necessidade de rede.

## Desenvolvimento e contribuição

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm build

# Teste unitário/integrado focalizado
node scripts/run-vitest.mjs <arquivo-ou-filtro>

# Verificação estrita de TypeScript por área
node scripts/run-tsgo.mjs -p tsconfig.core.json
node scripts/run-tsgo.mjs -p tsconfig.extensions.json
```

Antes de modificar o código, leia [CONTRIBUTING.md](CONTRIBUTING.md) e
[AGENTS.md](AGENTS.md). Eles explicam a divisão entre núcleo e plugins, a
forma correta de validar mudanças e as regras de contribuição.

## Estado da validação

O projeto foi verificado em instalação Linux nativa com build de produção,
checagem de tipos, testes focados de inteligência, smoke do Gateway e fluxo
end-to-end da Control UI. A publicação npm e a certificação completa de
release são etapas separadas e ainda não foram executadas; por isso esta
versão deve ser instalada a partir deste checkout até que os artefatos de
distribuição sejam oficialmente liberados.

## Documentação técnica

- [Começar agora](https://docs.eve.ai/start/getting-started)
- [Plataforma EVE](https://docs.eve.ai/concepts/eve-platform)
- [Política controlada pelo proprietário](https://docs.eve.ai/concepts/owner-policy)
- [CLI de inteligência operacional](https://docs.eve.ai/cli/intelligence)
- [Operação offline](https://docs.eve.ai/cli/offline)
- [Linux VPS](https://docs.eve.ai/vps)
- [Configuração do Gateway](https://docs.eve.ai/gateway/configuration)
- [Canais](https://docs.eve.ai/channels)
- [Plugins e skills](https://docs.eve.ai/tools)

## Licença e procedência

EVE é distribuído sob a licença MIT. O projeto preserva avisos de copyright e
obrigações de licenças de terceiros em [LICENSE](LICENSE),
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) e
[EVE_FORK_SOURCES.md](EVE_FORK_SOURCES.md). Esses arquivos registram a
procedência do código derivado e não definem a identidade, a estratégia ou a
política futura do EVE.
