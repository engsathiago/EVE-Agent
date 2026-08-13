# @eve/diagnostics-prometheus

Official Prometheus diagnostics exporter for EVE.

This plugin exposes EVE Gateway runtime metrics in Prometheus text format for Prometheus, Grafana, VictoriaMetrics, and compatible scrapers.

## Install

```bash
eve plugins install @eve/diagnostics-prometheus
```

Restart the Gateway after installing or updating the plugin.

## Configure

Enable the plugin and set the scrape endpoint options in `plugins.entries.diagnostics-prometheus.config`.

The full config surface, metric names, and scrape examples live in the docs:

- https://docs.eve.ai/gateway/prometheus

## Package

- Plugin id: `diagnostics-prometheus`
- Package: `@eve/diagnostics-prometheus`
- Minimum EVE host: `2026.4.25`
