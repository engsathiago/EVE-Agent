# @eve/diagnostics-otel

Official OpenTelemetry diagnostics exporter for EVE.

This plugin exports EVE Gateway traces, metrics, and logs to an OTLP collector for observability stacks such as Grafana, Datadog, Honeycomb, New Relic, Tempo, and compatible collectors. It can also write diagnostic log records as stdout JSONL for container log pipelines.

## Install

```bash
eve plugins install @eve/diagnostics-otel
```

Restart the Gateway after installing or updating the plugin.

## Configure

Enable the plugin and set the OTLP endpoint in `plugins.entries.diagnostics-otel.config`.

The full config surface, metric names, span names, and collector examples live in the docs:

- https://docs.eve.ai/gateway/opentelemetry

## Package

- Plugin id: `diagnostics-otel`
- Package: `@eve/diagnostics-otel`
- Minimum EVE host: `2026.4.25`
