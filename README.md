# Syncplay Chat

`Syncplay Chat` adds a chat button during SyncPlay sessions and sends chat messages as Jellyfin toasts to devices in the same SyncPlay group.

https://github.com/user-attachments/assets/69be29fa-b328-45c5-9967-f9582b0dd7d1

## Pre-requisites

- Jellyfin server compatible with `Jellyfin.Controller` / `Jellyfin.Model` `10.11.8`.
- .NET SDK 9.0 for building.
- Jellyfin [File Transformation](https://github.com/IAmParadox27/jellyfin-plugin-file-transformation) plugin installed and enabled.
    - Without File Transformation, `sync-chat.js` will not be injected into the web client.

## Installation

1. In Jellyfin, go to Dashboard > Plugins > Catalog > ⚙️
2. Click ➕ and give the repository a name (e.g., "Jellfin SyncPlay Chat").
3. Set the Repository URL to:
    ```
    https://raw.githubusercontent.com/AbhayVAshokan/jellyfin-syncplay-chat/master/manifest.json
    ```
4. Click Save.
5. Go to the Catalog tab, find `SyncPlay Chat` in the list, and click Install.
6. Restart your Jellyfin server to complete the installation.

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
mise exec dotnet@9.0 -- dotnet publish Jellyfin.Plugin.SyncPlayChat/Jellyfin.Plugin.SyncPlayChat.csproj -c Release
```

Output:

- `Jellyfin.Plugin.SyncPlayChat/bin/Release/net9.0/publish/`

Install manually by copying publish output into a plugin folder such as:

- macOS: `$HOME/Library/Application Support/jellyfin/plugins/SyncPlayChat`
- Linux: `$HOME/.local/share/jellyfin/plugins/SyncPlayChat`
- Windows: `%LOCALAPPDATA%\jellyfin\plugins\SyncPlayChat`

Then restart Jellyfin.

## Releasing a New Version

1. Publish release output:
    ```bash
    dotnet publish Jellyfin.Plugin.SyncPlayChat/Jellyfin.Plugin.SyncPlayChat.csproj -c Release
    ```
2. Zip the contents of `Jellyfin.Plugin.SyncPlayChat/bin/Release/net9.0/publish/` (not the folder itself):
    ```bash
    cd Jellyfin.Plugin.SyncPlayChat/bin/Release/net9.0/publish
    zip -r Jellyfin.Plugin.SyncPlayChat_<version>.zip .
    ```
3. Create a new GitHub release with tag `v<version>` (e.g., `v1.0.2.0`).
4. Attach the zip file (`Jellyfin.Plugin.SyncPlayChat_<version>.zip`) to the release.
5. Add release notes in the release body describing what changed.
6. Publish the release.

The `release.yaml` workflow will automatically:
- Compute the checksum of the attached zip.
- Prepend a new version entry to `manifest.json`.
- Update `Directory.Build.props` with the new version.
- Commit and push to `master`.

Plugin ID: `a69744cc-2281-48bf-adef-8e451a16ff71`

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
