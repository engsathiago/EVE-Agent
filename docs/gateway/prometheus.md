---
summary: "Expose EVE diagnostics as Prometheus text metrics through the diagnostics-prometheus plugin"
title: "Prometheus metrics"
sidebarTitle: "Prometheus"
read_when:
  - You want Prometheus, Grafana, VictoriaMetrics, or another scraper to collect EVE Gateway metrics
  - You need the Prometheus metric names and label policy for dashboards or alerts
  - You want metrics without running an OpenTelemetry collector
---

EVE can expose diagnostics metrics through the official `diagnostics-prometheus` plugin. It listens to trusted diagnostics plus core-emitted gateway stability events, then renders a Prometheus text endpoint at:

```text
GET /api/diagnostics/prometheus
```

Content type is `text/plain; version=0.0.4; charset=utf-8`, the standard Prometheus exposition format.

<Warning>
The route uses Gateway authentication (operator scope). Do not expose it as a public unauthenticated `/metrics` endpoint. Scrape it through the same auth path you use for other operator APIs.
</Warning>

For traces, logs, OTLP push, and OpenTelemetry GenAI semantic attributes, see [OpenTelemetry export](/gateway/opentelemetry).

## Quick start

<Steps>
  <Step title="Install the plugin">
    ```bash
    eve plugins install clawhub:@eve/diagnostics-prometheus
    ```
  </Step>
  <Step title="Enable the plugin">
    <Tabs>
      <Tab title="Config">
        ```json5
        {
          plugins: {
            allow: ["diagnostics-prometheus"],
            entries: {
              "diagnostics-prometheus": { enabled: true },
            },
          },
          diagnostics: {
            enabled: true,
          },
        }
        ```
      </Tab>
      <Tab title="CLI">
        ```bash
        eve plugins enable diagnostics-prometheus
        ```
      </Tab>
    </Tabs>
  </Step>
  <Step title="Restart the Gateway">
    The HTTP route is registered at plugin startup, so reload after enabling.
  </Step>
  <Step title="Scrape the protected route">
    Send the same gateway auth your operator clients use:

    ```bash
    curl -H "Authorization: Bearer $EVE_GATEWAY_TOKEN" \
      http://127.0.0.1:18789/api/diagnostics/prometheus
    ```

  </Step>
  <Step title="Wire Prometheus">
    ```yaml
    # prometheus.yml
    scrape_configs:
      - job_name: eve
        scrape_interval: 30s
        metrics_path: /api/diagnostics/prometheus
        authorization:
          credentials_file: /etc/prometheus/eve-gateway-token
        static_configs:
          - targets: ["eve-gateway:18789"]
    ```
  </Step>
</Steps>

<Note>
`diagnostics.enabled: true` is required. Without it, the plugin still registers the HTTP route but no diagnostic events flow into the exporter, so the response is empty.
</Note>

## Metrics exported

| Metric                                           | Type      | Labels                                                                                    |
| ------------------------------------------------ | --------- | ----------------------------------------------------------------------------------------- |
| `eve_run_completed_total`                   | counter   | `channel`, `model`, `outcome`, `provider`, `trigger`                                      |
| `eve_run_duration_seconds`                  | histogram | `channel`, `model`, `outcome`, `provider`, `trigger`                                      |
| `eve_model_call_total`                      | counter   | `api`, `error_category`, `model`, `outcome`, `provider`, `transport`                      |
| `eve_model_call_duration_seconds`           | histogram | `api`, `error_category`, `model`, `outcome`, `provider`, `transport`                      |
| `eve_model_failover_total`                  | counter   | `from_model`, `from_provider`, `lane`, `reason`, `suspended`, `to_model`, `to_provider`   |
| `eve_model_tokens_total`                    | counter   | `agent`, `channel`, `model`, `provider`, `token_type`                                     |
| `eve_gen_ai_client_token_usage`             | histogram | `model`, `provider`, `token_type`                                                         |
| `eve_model_cost_usd_total`                  | counter   | `agent`, `channel`, `model`, `provider`                                                   |
| `eve_skill_used_total`                      | counter   | `activation`, `agent`, `skill`, `source`                                                  |
| `eve_tool_execution_total`                  | counter   | `error_category`, `outcome`, `params_kind`, `tool`, `tool_owner`, `tool_source`           |
| `eve_tool_execution_duration_seconds`       | histogram | `error_category`, `outcome`, `params_kind`, `tool`, `tool_owner`, `tool_source`           |
| `eve_tool_execution_blocked_total`          | counter   | `denied_reason`, `params_kind`, `tool`, `tool_owner`, `tool_source`                       |
| `eve_harness_run_total`                     | counter   | `channel`, `error_category`, `harness`, `model`, `outcome`, `phase`, `plugin`, `provider` |
| `eve_harness_run_duration_seconds`          | histogram | `channel`, `error_category`, `harness`, `model`, `outcome`, `phase`, `plugin`, `provider` |
| `eve_webhook_received_total`                | counter   | `channel`, `webhook`                                                                      |
| `eve_webhook_error_total`                   | counter   | `channel`, `webhook`                                                                      |
| `eve_webhook_duration_seconds`              | histogram | `channel`, `webhook`                                                                      |
| `eve_message_received_total`                | counter   | `channel`, `source`                                                                       |
| `eve_message_dispatch_started_total`        | counter   | `channel`, `source`                                                                       |
| `eve_message_dispatch_completed_total`      | counter   | `channel`, `outcome`, `reason`, `source`                                                  |
| `eve_message_dispatch_duration_seconds`     | histogram | `channel`, `outcome`, `reason`, `source`                                                  |
| `eve_message_processed_total`               | counter   | `channel`, `outcome`, `reason`                                                            |
| `eve_message_processed_duration_seconds`    | histogram | `channel`, `outcome`, `reason`                                                            |
| `eve_message_delivery_started_total`        | counter   | `channel`, `delivery_kind`                                                                |
| `eve_message_delivery_total`                | counter   | `channel`, `delivery_kind`, `error_category`, `outcome`                                   |
| `eve_message_delivery_duration_seconds`     | histogram | `channel`, `delivery_kind`, `error_category`, `outcome`                                   |
| `eve_talk_event_total`                      | counter   | `brain`, `event_type`, `mode`, `provider`, `transport`                                    |
| `eve_talk_event_duration_seconds`           | histogram | `brain`, `event_type`, `mode`, `provider`, `transport`                                    |
| `eve_talk_audio_bytes`                      | histogram | `brain`, `event_type`, `mode`, `provider`, `transport`                                    |
| `eve_queue_lane_size`                       | gauge     | `lane`                                                                                    |
| `eve_queue_lane_wait_seconds`               | histogram | `lane`                                                                                    |
| `eve_session_state_total`                   | counter   | `reason`, `state`                                                                         |
| `eve_session_queue_depth`                   | gauge     | `state`                                                                                   |
| `eve_session_turn_created_total`            | counter   | `agent`, `channel`, `trigger`                                                             |
| `eve_session_stuck_total`                   | counter   | `reason`, `state`                                                                         |
| `eve_session_stuck_age_seconds`             | histogram | `reason`, `state`                                                                         |
| `eve_session_recovery_total`                | counter   | `action`, `active_work_kind`, `state`, `status`                                           |
| `eve_session_recovery_age_seconds`          | histogram | `action`, `active_work_kind`, `state`, `status`                                           |
| `eve_liveness_warning_total`                | counter   | `reason`                                                                                  |
| `eve_liveness_sessions`                     | gauge     | `state`                                                                                   |
| `eve_liveness_event_loop_delay_p99_seconds` | histogram | `reason`                                                                                  |
| `eve_liveness_event_loop_delay_max_seconds` | histogram | `reason`                                                                                  |
| `eve_liveness_event_loop_utilization_ratio` | histogram | `reason`                                                                                  |
| `eve_liveness_cpu_core_ratio`               | histogram | `reason`                                                                                  |
| `eve_payload_large_total`                   | counter   | `action`, `channel`, `plugin`, `reason`, `surface`                                        |
| `eve_payload_large_bytes`                   | histogram | `action`, `channel`, `plugin`, `reason`, `surface`                                        |
| `eve_memory_bytes`                          | gauge     | `kind`                                                                                    |
| `eve_memory_rss_bytes`                      | histogram | none                                                                                      |
| `eve_memory_pressure_total`                 | counter   | `level`, `reason`                                                                         |
| `eve_telemetry_exporter_total`              | counter   | `exporter`, `reason`, `signal`, `status`                                                  |
| `eve_prometheus_series_dropped_total`       | counter   | none                                                                                      |

## Label policy

<AccordionGroup>
  <Accordion title="Bounded, low-cardinality labels">
    Prometheus labels stay bounded and low-cardinality. The exporter does not emit raw diagnostic identifiers such as `runId`, `sessionKey`, `sessionId`, `callId`, `toolCallId`, message IDs, chat IDs, or provider request IDs.

    Label values are redacted and must match EVE's low-cardinality character policy. Values that fail the policy are replaced with `unknown`, `other`, or `none`, depending on the metric. Labels that look like scoped agent session keys are also replaced with `unknown`.

  </Accordion>
  <Accordion title="Series cap and overflow accounting">
    The exporter caps retained time series in memory at **2048** series across counters, gauges, and histograms combined. New series beyond that cap are dropped, and `eve_prometheus_series_dropped_total` increments by one each time.

    Watch this counter as a hard signal that an attribute upstream is leaking high-cardinality values. The exporter never lifts the cap automatically; if it climbs, fix the source rather than disabling the cap.

  </Accordion>
  <Accordion title="What never appears in Prometheus output">
    - prompt text, response text, tool inputs, tool outputs, system prompts
    - Talk transcripts, audio payloads, call ids, room ids, handoff tokens, turn ids, and raw session ids
    - raw provider request IDs (only bounded hashes, where applicable, on spans — never on metrics)
    - session keys and session IDs
    - hostnames, file paths, secret values

  </Accordion>
</AccordionGroup>

## PromQL recipes

```promql
# Tokens per minute, split by provider
sum by (provider) (rate(eve_model_tokens_total[1m]))

# Spend (USD) over the last hour, by model
sum by (model) (increase(eve_model_cost_usd_total[1h]))

# 95th percentile model run duration
histogram_quantile(
  0.95,
  sum by (le, provider, model)
    (rate(eve_run_duration_seconds_bucket[5m]))
)

# Queue wait time SLO (95p under 2s)
histogram_quantile(
  0.95,
  sum by (le, lane) (rate(eve_queue_lane_wait_seconds_bucket[5m]))
) < 2

# Skill usage, split by bounded source
sum by (skill, source) (increase(eve_skill_used_total[24h]))

# Dropped Prometheus series (cardinality alarm)
increase(eve_prometheus_series_dropped_total[15m]) > 0
```

<Tip>
Prefer `gen_ai_client_token_usage` for cross-provider dashboards: it follows the OpenTelemetry GenAI semantic conventions and is consistent with metrics from non-EVE GenAI services.
</Tip>

## Choosing between Prometheus and OpenTelemetry export

EVE supports both surfaces independently. You can run either, both, or neither.

<Tabs>
  <Tab title="diagnostics-prometheus">
    - **Pull** model: Prometheus scrapes `/api/diagnostics/prometheus`.
    - No external collector required.
    - Authenticated through normal Gateway auth.
    - Surface is metrics only (no traces or logs).
    - Best for stacks already standardized on Prometheus + Grafana.

  </Tab>
  <Tab title="diagnostics-otel">
    - **Push** model: EVE sends OTLP/HTTP to a collector or OTLP-compatible backend.
    - Surface includes metrics, traces, and logs.
    - Bridges to Prometheus through an OpenTelemetry Collector (`prometheus` or `prometheusremotewrite` exporter) when you need both.
    - See [OpenTelemetry export](/gateway/opentelemetry) for the full catalog.

  </Tab>
</Tabs>

## Troubleshooting

<AccordionGroup>
  <Accordion title="Empty response body">
    - Check `diagnostics.enabled: true` in config.
    - Confirm the plugin is enabled and loaded with `eve plugins list --enabled`.
    - Generate some traffic; counters and histograms only emit lines after at least one event.

  </Accordion>
  <Accordion title="401 / unauthorized">
    The endpoint requires the Gateway operator scope (`auth: "gateway"` with `gatewayRuntimeScopeSurface: "trusted-operator"`). Use the same token or password Prometheus uses for any other Gateway operator route. There is no public unauthenticated mode.
  </Accordion>
  <Accordion title="`eve_prometheus_series_dropped_total` is climbing">
    A new attribute is exceeding the **2048**-series cap. Inspect recent metrics for an unexpectedly high-cardinality label and fix it at the source. The exporter intentionally drops new series instead of silently rewriting labels.
  </Accordion>
  <Accordion title="Prometheus shows stale series after a restart">
    The plugin keeps state in memory only. After a Gateway restart, counters reset to zero and gauges restart at their next reported value. Use PromQL `rate()` and `increase()` to handle resets cleanly.
  </Accordion>
</AccordionGroup>

## Related

- [Diagnostics export](/gateway/diagnostics) — local diagnostics zip for support bundles
- [Health and readiness](/gateway/health) — `/healthz` and `/readyz` probes
- [Logging](/logging) — file-based logging
- [OpenTelemetry export](/gateway/opentelemetry) — OTLP push for traces, metrics, and logs
