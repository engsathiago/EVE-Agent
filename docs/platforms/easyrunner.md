---
summary: "Run the EVE Gateway on EasyRunner with Podman and Caddy"
read_when:
  - Deploying EVE on EasyRunner
  - Running the Gateway behind EasyRunner's Caddy proxy
  - Choosing persistent volumes and auth for a hosted Gateway
title: "EasyRunner"
---

EasyRunner can host the EVE Gateway as a small containerized app behind its
Caddy proxy. This guide assumes an EasyRunner host that runs Podman-compatible
Compose apps and exposes HTTPS through Caddy.

## Before you begin

- An EasyRunner server with a domain routed to it.
- A built or published EVE container image.
- A persistent config volume for `/home/node/.eve`.
- A persistent workspace volume for `/workspace`.
- A strong Gateway token or password.

Keep device auth enabled when possible. If your reverse proxy deployment cannot
carry device identity correctly, fix trusted-proxy settings first; use
dangerous auth bypasses only for a fully private, operator-controlled network.

## Compose app

Create an EasyRunner app with a Compose file shaped like this:

```yaml
services:
  eve:
    image: ghcr.io/eve/eve:latest
    restart: unless-stopped
    environment:
      EVE_GATEWAY_TOKEN: ${EVE_GATEWAY_TOKEN}
      EVE_HOME: /home/node
      EVE_STATE_DIR: /home/node/.eve
      EVE_CONFIG_PATH: /home/node/.eve/eve.json
      EVE_WORKSPACE_DIR: /workspace
    volumes:
      - eve-config:/home/node/.eve
      - eve-workspace:/workspace
    labels:
      caddy: eve.example.com
      caddy.reverse_proxy: "{{upstreams 1455}}"
    command: ["eve", "gateway", "--bind", "lan", "--port", "1455"]

volumes:
  eve-config:
  eve-workspace:
```

Replace `eve.example.com` with your Gateway hostname. Store
`EVE_GATEWAY_TOKEN` in EasyRunner's secret/environment manager instead of
committing it to the app definition.

## Configure EVE

Inside the persistent config volume, keep the Gateway reachable only through
the proxy and require auth:

```json5
{
  gateway: {
    bind: "lan",
    port: 1455,
    auth: {
      token: "${EVE_GATEWAY_TOKEN}",
    },
  },
}
```

If Caddy terminates TLS for the Gateway, configure trusted proxy settings for
the exact proxy path rather than disabling auth checks globally. See
[Trusted proxy auth](/gateway/trusted-proxy-auth).

## Verify

From your workstation:

```bash
eve gateway probe --url https://eve.example.com --token <token>
eve gateway status --url https://eve.example.com --token <token>
```

From the EasyRunner host, check the app logs for a listening Gateway and no
startup SecretRef, plugin, or channel auth failures.

## Updates and backups

- Pull or build the new EVE image, then redeploy the EasyRunner app.
- Back up the `eve-config` volume before updates.
- Back up `eve-workspace` if agents write durable project data there.
- Run `eve doctor` after major updates to catch config migrations and
  service warnings.

## Troubleshooting

- `gateway probe` cannot connect: confirm the Caddy hostname points at the app
  and that the container listens on `0.0.0.0:1455`.
- Auth fails: rotate the token in EasyRunner secrets and the local client
  command together.
- Files are root-owned after restore: repair the mounted volumes so the
  container user can write `/home/node/.eve` and `/workspace`.
- Browser or channel plugins fail: check whether the required external
  binaries, network egress, and mounted credentials are available inside the
  container.
