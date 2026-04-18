#!/usr/bin/env bash

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
JELLYFIN_DATA_DIR="${JELLYFIN_DATA_DIR:-$HOME/Library/Application Support/jellyfin}"
PLUGIN_DIR="${PLUGIN_DIR:-$JELLYFIN_DATA_DIR/plugins/SyncPlayChat}"

mise exec dotnet@9.0 -- dotnet publish "$REPO_ROOT/Jellyfin.Plugin.SyncPlayChat.sln" -c Debug

mkdir -p "$PLUGIN_DIR"
rsync -a --delete "$REPO_ROOT/Jellyfin.Plugin.SyncPlayChat/bin/Debug/net9.0/publish/" "$PLUGIN_DIR/"

echo "Deployed to: $PLUGIN_DIR"
echo "Please restart Jellyfin to apply the plugin"
