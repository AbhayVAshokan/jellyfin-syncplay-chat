# Syncplay Chat

`Syncplay Chat` adds an in-player chat button during SyncPlay sessions and sends chat messages as Jellyfin toasts to devices in the same SyncPlay group.

## Pre-requisites

- Jellyfin server compatible with `Jellyfin.Controller` / `Jellyfin.Model` `10.11.8`.
- .NET SDK 9.0 for building.
- Jellyfin [File Transformation](https://github.com/IAmParadox27/jellyfin-plugin-file-transformation) plugin installed and enabled.
    - Without File Transformation, `sync-chat.js` will not be injected into the web client.

## Local Development Deploy

From repository root:

```bash
./scripts/deploy-dev.sh
```

What it does:

- Publishes the solution in Debug.
- Copies publish output to Jellyfin plugin directory.

Environment overrides:

```bash
JELLYFIN_DATA_DIR="$HOME/Library/Application Support/jellyfin" \
PLUGIN_DIR="$HOME/Library/Application Support/jellyfin/plugins/SyncPlayChat" \
./scripts/deploy-dev.sh
```

Notes:

- `PLUGIN_DIR` takes precedence over `JELLYFIN_DATA_DIR`.
- Default `JELLYFIN_DATA_DIR` is `$HOME/Library/Application Support/jellyfin`.
- Restart Jellyfin after deploy.

## Manual Build and Install

Build:

```bash
dotnet publish Jellyfin.Plugin.SyncPlayChat/Jellyfin.Plugin.SyncPlayChat.csproj -c Release
```

Output:

- `Jellyfin.Plugin.SyncPlayChat/bin/Release/net9.0/publish/`

Install manually by copying publish output into a plugin folder such as:

- macOS: `$HOME/Library/Application Support/jellyfin/plugins/SyncPlayChat`
- Linux: `$HOME/.local/share/jellyfin/plugins/SyncPlayChat`
- Windows: `%LOCALAPPDATA%\jellyfin\plugins\SyncPlayChat`

Then restart Jellyfin.

## Packaging for Repository Distribution

1. Publish release output.
2. Zip the files from `bin/Release/net9.0/publish/`.
3. Upload zip to a GitHub release.
4. Reference that asset in your Jellyfin plugin repository manifest.

Plugin ID (must match manifest):

- `a69744cc-2281-48bf-adef-8e451a16ff71`

## Troubleshooting

- Chat button does not appear:
  - Verify user is in an active SyncPlay group.
  - Verify File Transformation plugin is installed and enabled.
  - Restart Jellyfin after plugin deploy/update.
- Messages only appear on one device:
  - Check browser console for `[SyncPlayChat]` send failure logs.
  - Confirm target devices are active sessions visible to Jellyfin.

## License

See `LICENSE`.
