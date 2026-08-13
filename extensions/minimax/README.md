# MiniMax (EVE plugin)

Bundled MiniMax plugin for both:

- API-key provider setup (`minimax`)
- Token Plan OAuth setup (`minimax-portal`)

## Enable

```bash
eve plugins enable minimax
```

Restart the Gateway after enabling.

```bash
eve gateway restart
```

## Authenticate

OAuth:

```bash
eve models auth login --provider minimax-portal --set-default
```

API key:

```bash
eve setup --wizard --auth-choice minimax-global-api
```

## Notes

- MiniMax OAuth uses a user-code login flow.
- OAuth currently targets the Token Plan path.
