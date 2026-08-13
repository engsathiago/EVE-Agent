# @eve/pixverse-provider

Official PixVerse video generation provider plugin for EVE.

This plugin registers PixVerse as a `video_generate` provider for text-to-video and image-to-video workflows.

## Install

```bash
eve plugins install @eve/pixverse-provider
```

Restart the Gateway after installing or updating the plugin.

## Configure

Store your PixVerse API key in EVE config or expose the supported environment variable to the Gateway. Then select PixVerse as a video generation provider.

Full setup and model/provider examples:

- https://docs.eve.ai/providers/pixverse

## Package

- Plugin id: `pixverse`
- Package: `@eve/pixverse-provider`
- Minimum EVE host: `2026.5.26`
