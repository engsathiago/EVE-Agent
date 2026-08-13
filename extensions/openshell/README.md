# @eve/openshell-sandbox

Official NVIDIA OpenShell sandbox backend for EVE.

This plugin lets EVE use OpenShell-managed sandboxes with mirrored local workspaces and SSH command execution.

## Install

```bash
eve plugins install @eve/openshell-sandbox
```

Restart the Gateway after installing or updating the plugin.

## Configure

Use the OpenShell docs for credentials, workspace mirroring, runtime selection, and troubleshooting:

- https://docs.eve.ai/gateway/openshell

## Package

- Plugin id: `openshell`
- Package: `@eve/openshell-sandbox`
- Minimum EVE host: `2026.5.12-beta.1`
