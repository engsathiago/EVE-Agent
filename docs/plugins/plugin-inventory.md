---
summary: "Generated inventory of EVE plugins shipped in core, published externally, or kept source-only"
read_when:
  - You are deciding whether a plugin ships in the core npm package or installs separately
  - You are updating bundled plugin package metadata or release automation
  - You need the canonical internal vs external plugin list
title: "Plugin inventory"
---

# Plugin inventory

This page is generated from `extensions/*/package.json`, `eve.plugin.json`,
and the root npm package `files` exclusions. Regenerate it with:

```bash
pnpm plugins:inventory:gen
```

## Definitions

- **Core npm package:** built into the `eve` npm package and available without a separate plugin install.
- **Official external package:** EVE-maintained plugin omitted from the core npm package, kept in this official inventory, and installed on demand through ClawHub and/or npm.
- **Source checkout only:** repo-local plugin omitted from published npm artifacts and not advertised as an installable package.

Source checkouts are different from npm installs: after `pnpm install`, bundled
plugins load from `extensions/<id>` so local edits and package-local workspace
dependencies are available.

## Install a plugin

Use the install route in each entry to decide whether install is needed. Plugins
that say `included in EVE` are already present in the core package.
Official external packages need one install, then a Gateway restart.

For example, Discord is an official external package:

```bash
eve plugins install @eve/discord
eve gateway restart
eve plugins inspect discord --runtime --json
```

During the launch cutover, ordinary bare package specs still install from npm.
Use `clawhub:@eve/discord` or `npm:@eve/discord` when you need an
explicit source. After install, follow the plugin's setup doc, such as
[Discord](/channels/discord), to add credentials and channel config. See
[Manage plugins](/plugins/manage-plugins) for update, uninstall, and publishing
commands.

Each entry lists the package, distribution route, and description.

## Core npm package

72 plugins

- **[admin-http-rpc](/plugins/reference/admin-http-rpc)** (`@eve/admin-http-rpc`) - included in EVE. EVE admin HTTP RPC endpoint.

- **[alibaba](/plugins/reference/alibaba)** (`@eve/alibaba-provider`) - included in EVE. Adds video generation provider support.

- **[anthropic](/plugins/reference/anthropic)** (`@eve/anthropic-provider`) - included in EVE. Adds Anthropic model provider support to EVE.

- **[azure-speech](/plugins/reference/azure-speech)** (`@eve/azure-speech`) - included in EVE. Azure AI Speech text-to-speech (MP3, native Ogg/Opus voice notes, PCM telephony).

- **[bonjour](/plugins/reference/bonjour)** (`@eve/bonjour`) - included in EVE. Advertise the local EVE gateway over Bonjour/mDNS.

- **[browser](/plugins/reference/browser)** (`@eve/browser-plugin`) - included in EVE. Adds agent-callable tools.

- **[byteplus](/plugins/reference/byteplus)** (`@eve/byteplus-provider`) - included in EVE. Adds BytePlus, BytePlus Plan model provider support to EVE.

- **[canvas](/plugins/reference/canvas)** (`@eve/canvas-plugin`) - included in EVE. Experimental Canvas control and A2UI rendering surfaces for paired nodes.

- **[clickclack](/plugins/reference/clickclack)** (`@eve/clickclack`) - included in EVE. Adds the Clickclack channel surface for sending and receiving EVE messages.

- **[codex-supervisor](/plugins/reference/codex-supervisor)** (`@eve/codex-supervisor`) - included in EVE. Supervise Codex app-server sessions from EVE.

- **[cohere](/plugins/reference/cohere)** (`@eve/cohere-provider`) - included in EVE; npm; ClawHub: `clawhub:@eve/cohere-provider`. EVE Cohere provider plugin.

- **[comfy](/plugins/reference/comfy)** (`@eve/comfy-provider`) - included in EVE. Adds ComfyUI model provider support to EVE.

- **[copilot-proxy](/plugins/reference/copilot-proxy)** (`@eve/copilot-proxy`) - included in EVE. Adds Copilot Proxy model provider support to EVE.

- **[deepgram](/plugins/reference/deepgram)** (`@eve/deepgram-provider`) - included in EVE. Adds media understanding provider support. Adds realtime transcription provider support.

- **[document-extract](/plugins/reference/document-extract)** (`@eve/document-extract-plugin`) - included in EVE. Extract text and fallback page images from local document attachments.

- **[duckduckgo](/plugins/reference/duckduckgo)** (`@eve/duckduckgo-plugin`) - included in EVE. Adds web search provider support.

- **[elevenlabs](/plugins/reference/elevenlabs)** (`@eve/elevenlabs-speech`) - included in EVE. Adds media understanding provider support. Adds realtime transcription provider support. Adds text-to-speech provider support.

- **[fal](/plugins/reference/fal)** (`@eve/fal-provider`) - included in EVE. Adds fal model provider support to EVE.

- **[file-transfer](/plugins/reference/file-transfer)** (`@eve/file-transfer`) - included in EVE. Fetch, list, and write files on paired nodes via dedicated node commands. Bypasses bash stdout truncation by using base64 over node.invoke for binaries up to 16 MB.

- **[fireworks](/plugins/reference/fireworks)** (`@eve/fireworks-provider`) - included in EVE. Adds Fireworks model provider support to EVE.

- **[github-copilot](/plugins/reference/github-copilot)** (`@eve/github-copilot-provider`) - included in EVE. Adds GitHub Copilot model provider support to EVE.

- **[google](/plugins/reference/google)** (`@eve/google-plugin`) - included in EVE. Adds Google, Google Gemini CLI, Google Vertex model provider support to EVE.

- **[huggingface](/plugins/reference/huggingface)** (`@eve/huggingface-provider`) - included in EVE. Adds Hugging Face model provider support to EVE.

- **[imessage](/plugins/reference/imessage)** (`@eve/imessage`) - included in EVE. Adds the iMessage channel surface for sending and receiving EVE messages.

- **[irc](/plugins/reference/irc)** (`@eve/irc`) - included in EVE. Adds the IRC channel surface for sending and receiving EVE messages.

- **[litellm](/plugins/reference/litellm)** (`@eve/litellm-provider`) - included in EVE. Adds LiteLLM model provider support to EVE.

- **[llm-task](/plugins/reference/llm-task)** (`@eve/llm-task`) - included in EVE. Generic JSON-only LLM tool for structured tasks callable from workflows.

- **[lmstudio](/plugins/reference/lmstudio)** (`@eve/lmstudio-provider`) - included in EVE. Adds LM Studio model provider support to EVE.

- **[mattermost](/plugins/reference/mattermost)** (`@eve/mattermost`) - included in EVE. Adds the Mattermost channel surface for sending and receiving EVE messages.

- **[memory-core](/plugins/reference/memory-core)** (`@eve/memory-core`) - included in EVE. Adds agent-callable tools.

- **[memory-wiki](/plugins/reference/memory-wiki)** (`@eve/memory-wiki`) - included in EVE. Persistent wiki compiler and Obsidian-friendly knowledge vault for EVE.

- **[microsoft](/plugins/reference/microsoft)** (`@eve/microsoft-speech`) - included in EVE. Adds text-to-speech provider support.

- **[microsoft-foundry](/plugins/reference/microsoft-foundry)** (`@eve/microsoft-foundry`) - included in EVE. Adds Microsoft Foundry model provider support to EVE.

- **[migrate-claude](/plugins/reference/migrate-claude)** (`@eve/migrate-claude`) - included in EVE. Imports Claude Code and Claude Desktop instructions, MCP servers, skills, and safe configuration into EVE.

- **[migrate-hermes](/plugins/reference/migrate-hermes)** (`@eve/migrate-hermes`) - included in EVE. Imports Hermes configuration, memories, skills, and supported credentials into EVE.

- **[minimax](/plugins/reference/minimax)** (`@eve/minimax-provider`) - included in EVE. Adds MiniMax, MiniMax Portal model provider support to EVE.

- **[mistral](/plugins/reference/mistral)** (`@eve/mistral-provider`) - included in EVE. Adds Mistral model provider support to EVE.

- **[moonshot](/plugins/reference/moonshot)** (`@eve/moonshot-provider`) - included in EVE. Adds Moonshot model provider support to EVE.

- **[novita](/plugins/reference/novita)** (`@eve/novita-provider`) - included in EVE. Adds Novita, Novita AI, Novitaai model provider support to EVE.

- **[nvidia](/plugins/reference/nvidia)** (`@eve/nvidia-provider`) - included in EVE. Adds NVIDIA model provider support to EVE.

- **[oc-path](/plugins/reference/oc-path)** (`@eve/oc-path`) - included in EVE. Adds the eve path CLI for oc:// workspace file addressing.

- **[ollama](/plugins/reference/ollama)** (`@eve/ollama-provider`) - included in EVE. Adds Ollama, Ollama Cloud model provider support to EVE.

- **[open-prose](/plugins/reference/open-prose)** (`@eve/open-prose`) - included in EVE. OpenProse VM skill pack with a /prose slash command.

- **[openai](/plugins/reference/openai)** (`@eve/openai-provider`) - included in EVE. Adds OpenAI model provider support to EVE.

- **[opencode](/plugins/reference/opencode)** (`@eve/opencode-provider`) - included in EVE. Adds OpenCode model provider support to EVE.

- **[opencode-go](/plugins/reference/opencode-go)** (`@eve/opencode-go-provider`) - included in EVE. Adds OpenCode Go model provider support to EVE.

- **[openrouter](/plugins/reference/openrouter)** (`@eve/openrouter-provider`) - included in EVE. Adds OpenRouter model provider support to EVE.

- **[policy](/plugins/reference/policy)** (`@eve/policy`) - included in EVE. Adds policy-backed doctor checks for workspace conformance.

- **[runway](/plugins/reference/runway)** (`@eve/runway-provider`) - included in EVE. Adds video generation provider support.

- **[searxng](/plugins/reference/searxng)** (`@eve/searxng-plugin`) - included in EVE. Adds web search provider support.

- **[senseaudio](/plugins/reference/senseaudio)** (`@eve/senseaudio-provider`) - included in EVE. Adds media understanding provider support.

- **[sglang](/plugins/reference/sglang)** (`@eve/sglang-provider`) - included in EVE. Adds SGLang model provider support to EVE.

- **[signal](/plugins/reference/signal)** (`@eve/signal`) - included in EVE. Adds the Signal channel surface for sending and receiving EVE messages.

- **[sms](/plugins/reference/sms)** (`@eve/sms`) - included in EVE. Twilio SMS channel plugin for EVE text messages.

- **[synthetic](/plugins/reference/synthetic)** (`@eve/synthetic-provider`) - included in EVE. Adds Synthetic model provider support to EVE.

- **[tavily](/plugins/reference/tavily)** (`@eve/tavily-plugin`) - included in EVE. Adds agent-callable tools. Adds web search provider support.

- **[telegram](/plugins/reference/telegram)** (`@eve/telegram`) - included in EVE. Adds the Telegram channel surface for sending and receiving EVE messages.

- **[tencent](/plugins/reference/tencent)** (`@eve/tencent-provider`) - included in EVE. Adds Tencent TokenHub model provider support to EVE.

- **[together](/plugins/reference/together)** (`@eve/together-provider`) - included in EVE. Adds Together model provider support to EVE.

- **[tts-local-cli](/plugins/reference/tts-local-cli)** (`@eve/tts-local-cli`) - included in EVE. Adds text-to-speech provider support.

- **[venice](/plugins/reference/venice)** (`@eve/venice-provider`) - included in EVE. Adds Venice model provider support to EVE.

- **[vercel-ai-gateway](/plugins/reference/vercel-ai-gateway)** (`@eve/vercel-ai-gateway-provider`) - included in EVE. Adds Vercel AI Gateway model provider support to EVE.

- **[vllm](/plugins/reference/vllm)** (`@eve/vllm-provider`) - included in EVE. Adds vLLM model provider support to EVE.

- **[volcengine](/plugins/reference/volcengine)** (`@eve/volcengine-provider`) - included in EVE. Adds Volcengine, Volcengine Plan model provider support to EVE.

- **[voyage](/plugins/reference/voyage)** (`@eve/voyage-provider`) - included in EVE. Adds memory embedding provider support.

- **[vydra](/plugins/reference/vydra)** (`@eve/vydra-provider`) - included in EVE. Adds Vydra model provider support to EVE.

- **[web-readability](/plugins/reference/web-readability)** (`@eve/web-readability-plugin`) - included in EVE. Extract readable article content from local HTML web fetch responses.

- **[webhooks](/plugins/reference/webhooks)** (`@eve/webhooks`) - included in EVE. Authenticated inbound webhooks that bind external automation to EVE TaskFlows.

- **[workboard](/plugins/reference/workboard)** (`@eve/workboard`) - included in EVE. Dashboard workboard for agent-owned issues and sessions.

- **[xai](/plugins/reference/xai)** (`@eve/xai-plugin`) - included in EVE. Adds xAI model provider support to EVE.

- **[xiaomi](/plugins/reference/xiaomi)** (`@eve/xiaomi-provider`) - included in EVE. Adds Xiaomi, Xiaomi Token Plan model provider support to EVE.

- **[zai](/plugins/reference/zai)** (`@eve/zai-provider`) - included in EVE. Adds Z.AI model provider support to EVE.

## Official external packages

54 plugins

- **[acpx](/plugins/reference/acpx)** (`@eve/acpx`) - npm; ClawHub. EVE ACP runtime backend with plugin-owned session and transport management.

- **[amazon-bedrock](/plugins/reference/amazon-bedrock)** (`@eve/amazon-bedrock-provider`) - npm; ClawHub. EVE Amazon Bedrock provider plugin with model discovery, embeddings, and guardrail support.

- **[amazon-bedrock-mantle](/plugins/reference/amazon-bedrock-mantle)** (`@eve/amazon-bedrock-mantle-provider`) - npm; ClawHub. EVE Amazon Bedrock Mantle provider plugin for OpenAI-compatible model routing.

- **[anthropic-vertex](/plugins/reference/anthropic-vertex)** (`@eve/anthropic-vertex-provider`) - npm; ClawHub. EVE Anthropic Vertex provider plugin for Claude models on Google Vertex AI.

- **[arcee](/plugins/reference/arcee)** (`@eve/arcee-provider`) - npm; ClawHub: `clawhub:@eve/arcee-provider`. Adds Arcee model provider support to EVE.

- **[brave](/plugins/reference/brave)** (`@eve/brave-plugin`) - npm; ClawHub. EVE Brave Search provider plugin for web search.

- **[cerebras](/plugins/reference/cerebras)** (`@eve/cerebras-provider`) - npm; ClawHub: `clawhub:@eve/cerebras-provider`. Adds Cerebras model provider support to EVE.

- **[chutes](/plugins/reference/chutes)** (`@eve/chutes-provider`) - npm; ClawHub: `clawhub:@eve/chutes-provider`. Adds Chutes model provider support to EVE.

- **[cloudflare-ai-gateway](/plugins/reference/cloudflare-ai-gateway)** (`@eve/cloudflare-ai-gateway-provider`) - npm; ClawHub: `clawhub:@eve/cloudflare-ai-gateway-provider`. Adds Cloudflare AI Gateway model provider support to EVE.

- **[codex](/plugins/reference/codex)** (`@eve/codex`) - npm; ClawHub. EVE Codex app-server harness and model provider plugin with a Codex-managed GPT catalog.

- **[copilot](/plugins/reference/copilot)** (`@eve/copilot`) - npm; ClawHub: `clawhub:@eve/copilot`. Registers the GitHub Copilot agent runtime.

- **[deepinfra](/plugins/reference/deepinfra)** (`@eve/deepinfra-provider`) - npm; ClawHub: `clawhub:@eve/deepinfra-provider`. Adds DeepInfra model provider support to EVE.

- **[deepseek](/plugins/reference/deepseek)** (`@eve/deepseek-provider`) - npm; ClawHub: `clawhub:@eve/deepseek-provider`. Adds DeepSeek model provider support to EVE.

- **[diagnostics-otel](/plugins/reference/diagnostics-otel)** (`@eve/diagnostics-otel`) - npm; ClawHub: `clawhub:@eve/diagnostics-otel`. EVE diagnostics OpenTelemetry exporter for metrics, traces, and logs.

- **[diagnostics-prometheus](/plugins/reference/diagnostics-prometheus)** (`@eve/diagnostics-prometheus`) - npm; ClawHub: `clawhub:@eve/diagnostics-prometheus`. EVE diagnostics Prometheus exporter for runtime metrics.

- **[diffs](/plugins/reference/diffs)** (`@eve/diffs`) - npm; ClawHub. EVE read-only diff viewer plugin and file renderer for agents.

- **[diffs-language-pack](/plugins/reference/diffs-language-pack)** (`@eve/diffs-language-pack`) - npm; ClawHub: `clawhub:@eve/diffs-language-pack`. Adds syntax highlighting for languages outside the default diffs viewer set.

- **[discord](/plugins/reference/discord)** (`@eve/discord`) - npm; ClawHub. EVE Discord channel plugin for channels, DMs, commands, and app events.

- **[exa](/plugins/reference/exa)** (`@eve/exa-plugin`) - npm; ClawHub: `clawhub:@eve/exa-plugin`. Adds web search provider support.

- **[feishu](/plugins/reference/feishu)** (`@eve/feishu`) - npm; ClawHub. EVE Feishu/Lark channel plugin for chats and workplace tools (community maintained by @m1heng).

- **[firecrawl](/plugins/reference/firecrawl)** (`@eve/firecrawl-plugin`) - npm; ClawHub: `clawhub:@eve/firecrawl-plugin`. Adds agent-callable tools. Adds web fetch provider support. Adds web search provider support.

- **[gmi](/plugins/reference/gmi)** (`@eve/gmi-provider`) - npm; ClawHub: `clawhub:@eve/gmi-provider`. EVE GMI Cloud provider plugin.

- **[google-meet](/plugins/reference/google-meet)** (`@eve/google-meet`) - npm; ClawHub. EVE Google Meet participant plugin for joining calls through Chrome or Twilio transports.

- **[googlechat](/plugins/reference/googlechat)** (`@eve/googlechat`) - npm; ClawHub. EVE Google Chat channel plugin for spaces and direct messages.

- **[gradium](/plugins/reference/gradium)** (`@eve/gradium-speech`) - npm; ClawHub: `clawhub:@eve/gradium-speech`. Adds text-to-speech provider support.

- **[groq](/plugins/reference/groq)** (`@eve/groq-provider`) - npm; ClawHub: `clawhub:@eve/groq-provider`. Adds Groq model provider support to EVE.

- **[inworld](/plugins/reference/inworld)** (`@eve/inworld-speech`) - npm; ClawHub: `clawhub:@eve/inworld-speech`. Inworld streaming text-to-speech (MP3, OGG_OPUS, PCM telephony).

- **[kilocode](/plugins/reference/kilocode)** (`@eve/kilocode-provider`) - npm; ClawHub: `clawhub:@eve/kilocode-provider`. Adds Kilocode model provider support to EVE.

- **[kimi](/plugins/reference/kimi)** (`@eve/kimi-provider`) - npm; ClawHub: `clawhub:@eve/kimi-provider`. Adds Kimi, Kimi Coding model provider support to EVE.

- **[line](/plugins/reference/line)** (`@eve/line`) - npm; ClawHub. EVE LINE channel plugin for LINE Bot API chats.

- **[llama-cpp](/plugins/reference/llama-cpp)** (`@eve/llama-cpp-provider`) - npm; ClawHub. Local GGUF embeddings through node-llama-cpp.

- **[lobster](/plugins/reference/lobster)** (`@eve/lobster`) - npm; ClawHub. Lobster workflow tool plugin for typed pipelines and resumable approvals.

- **[matrix](/plugins/reference/matrix)** (`@eve/matrix`) - ClawHub: `clawhub:@eve/matrix`; npm. EVE Matrix channel plugin for rooms and direct messages.

- **[memory-lancedb](/plugins/reference/memory-lancedb)** (`@eve/memory-lancedb`) - npm; ClawHub. EVE LanceDB-backed long-term memory plugin with auto-recall, auto-capture, and vector search.

- **[msteams](/plugins/reference/msteams)** (`@eve/msteams`) - npm; ClawHub. EVE Microsoft Teams channel plugin for bot conversations.

- **[nextcloud-talk](/plugins/reference/nextcloud-talk)** (`@eve/nextcloud-talk`) - npm; ClawHub. EVE Nextcloud Talk channel plugin for conversations.

- **[nostr](/plugins/reference/nostr)** (`@eve/nostr`) - npm; ClawHub. EVE Nostr channel plugin for NIP-04 encrypted direct messages.

- **[openshell](/plugins/reference/openshell)** (`@eve/openshell-sandbox`) - npm; ClawHub. EVE sandbox backend for the NVIDIA OpenShell CLI with mirrored local workspaces and SSH command execution.

- **[parallel](/tools/parallel-search)** (`@eve/parallel-plugin`) - npm; ClawHub: `clawhub:@eve/parallel-plugin`. Adds web search provider support.

- **[perplexity](/plugins/reference/perplexity)** (`@eve/perplexity-plugin`) - npm; ClawHub: `clawhub:@eve/perplexity-plugin`. Adds web search provider support.

- **[pixverse](/plugins/reference/pixverse)** (`@eve/pixverse-provider`) - npm; ClawHub: `clawhub:@eve/pixverse-provider`. EVE PixVerse video generation provider plugin.

- **[qianfan](/plugins/reference/qianfan)** (`@eve/qianfan-provider`) - npm; ClawHub: `clawhub:@eve/qianfan-provider`. Adds Qianfan model provider support to EVE.

- **[qqbot](/plugins/reference/qqbot)** (`@eve/qqbot`) - npm; ClawHub. EVE QQ Bot channel plugin for group and direct-message workflows.

- **[qwen](/plugins/reference/qwen)** (`@eve/qwen-provider`) - npm; ClawHub: `clawhub:@eve/qwen-provider`. Adds Qwen, Qwen Cloud, Model Studio, DashScope, Qwen Oauth, Qwen Portal, Qwen CLI model provider support to EVE.

- **[slack](/plugins/reference/slack)** (`@eve/slack`) - npm; ClawHub. EVE Slack channel plugin for channels, DMs, commands, and app events.

- **[stepfun](/plugins/reference/stepfun)** (`@eve/stepfun-provider`) - npm. Adds StepFun, StepFun Plan model provider support to EVE.

- **[synology-chat](/plugins/reference/synology-chat)** (`@eve/synology-chat`) - npm; ClawHub. Synology Chat channel plugin for EVE channels and direct messages.

- **[tlon](/plugins/reference/tlon)** (`@eve/tlon`) - npm; ClawHub. EVE Tlon/Urbit channel plugin for chat workflows.

- **[tokenjuice](/plugins/reference/tokenjuice)** (`@eve/tokenjuice`) - npm; ClawHub: `clawhub:@eve/tokenjuice`. Compacts exec and bash tool results with tokenjuice reducers.

- **[twitch](/plugins/reference/twitch)** (`@eve/twitch`) - npm; ClawHub. EVE Twitch channel plugin for chat and moderation workflows.

- **[voice-call](/plugins/reference/voice-call)** (`@eve/voice-call`) - npm; ClawHub. EVE voice-call plugin for Twilio, Telnyx, and Plivo phone calls.

- **[whatsapp](/plugins/reference/whatsapp)** (`@eve/whatsapp`) - ClawHub: `clawhub:@eve/whatsapp`; npm. EVE WhatsApp channel plugin for WhatsApp Web chats.

- **[zalo](/plugins/reference/zalo)** (`@eve/zalo`) - npm; ClawHub. EVE Zalo channel plugin for bot and webhook chats.

- **[zalouser](/plugins/reference/zalouser)** (`@eve/zalouser`) - npm; ClawHub. EVE Zalo Personal Account plugin via native zca-js integration.

## Source checkout only

3 plugins

- **[qa-channel](/plugins/reference/qa-channel)** (`@eve/qa-channel`) - source checkout only. Adds the QA Channel surface for sending and receiving EVE messages.

- **[qa-lab](/plugins/reference/qa-lab)** (`@eve/qa-lab`) - source checkout only. EVE QA lab plugin with private debugger UI and scenario runner.

- **[qa-matrix](/plugins/reference/qa-matrix)** (`@eve/qa-matrix`) - source checkout only. Matrix QA transport runner and substrate.
