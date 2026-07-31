

# Syncplay Chat

`Syncplay Chat` agrega un botón de chat durante las sesiones de SyncPlay y envía los mensajes del chat como notificaciones toast de Jellyfin a los dispositivos en el mismo grupo de SyncPlay.

https://github.com/user-attachments/assets/69be29fa-b328-45c5-9967-f9582b0dd7d1

## Prerrequisitos

- Servidor Jellyfin compatible con `Jellyfin.Controller` / `Jellyfin.Model` `10.11.8`.
- .NET SDK 9.0 para la compilación.
- Complemento [File Transformation](https://github.com/IAmParadox27/jellyfin-plugin-file-transformation) de Jellyfin instalado y habilitado.
    - Sin File Transformation, `sync-chat.js` no se inyectará en el cliente web.

## Instalación

1. En Jellyfin, ve a Panel de control > Complementos > Catálogo > ⚙️
2. Haz clic en ➕ y dale un nombre al repositorio (por ejemplo, "Jellfin SyncPlay Chat").
3. Establece la URL del repositorio en:
    ```
    https://raw.githubusercontent.com/AbhayVAshokan/jellyfin-syncplay-chat/master/manifest.json
    ```
4. Haz clic en Guardar.
5. Ve a la pestaña Catálogo, encuentra `SyncPlay Chat` en la lista y haz clic en Instalar.
6. Reinicia tu servidor Jellyfin para completar la instalación.

## Implementación para Desarrollo Local

Desde la raíz del repositorio:

```bash
./scripts/deploy-dev.sh
```

Qué hace:

- Publica la solución en modo Debug.
- Copia el resultado de la publicación al directorio de complementos de Jellyfin.

Sobrescrituras de entorno:

```bash
JELLYFIN_DATA_DIR="$HOME/Library/Application Support/jellyfin" \
PLUGIN_DIR="$HOME/Library/Application Support/jellyfin/plugins/SyncPlayChat" \
./scripts/deploy-dev.sh
```

Notas:

- `PLUGIN_DIR` tiene precedencia sobre `JELLYFIN_DATA_DIR`.
- El valor predeterminado de `JELLYFIN_DATA_DIR` es `$HOME/Library/Application Support/jellyfin`.
- Reinicia Jellyfin después de la implementación.

## Compilación e Instalación Manual

Compilación:

```bash
mise exec dotnet@9.0 -- dotnet publish Jellyfin.Plugin.SyncPlayChat/Jellyfin.Plugin.SyncPlayChat.csproj -c Release
```

Resultado:

- `Jellyfin.Plugin.SyncPlayChat/bin/Release/net9.0/publish/`

Instala manualmente copiando el resultado de la publicación en una carpeta de complementos como:

- macOS: `$HOME/Library/Application Support/jellyfin/plugins/SyncPlayChat`
- Linux: `$HOME/.local/share/jellyfin/plugins/SyncPlayChat`
- Windows: `%LOCALAPPDATA%\jellyfin\plugins\SyncPlayChat`

Luego, reinicia Jellyfin.

## Publicación de una Nueva Versión

1. Publica el resultado de la versión:
    ```bash
    dotnet publish Jellyfin.Plugin.SyncPlayChat/Jellyfin.Plugin.SyncPlayChat.csproj -c Release
    ```
2. Comprime en ZIP el contenido de `Jellyfin.Plugin.SyncPlayChat/bin/Release/net9.0/publish/` (no la carpeta en sí):
    ```bash
    cd Jellyfin.Plugin.SyncPlayChat/bin/Release/net9.0/publish
    zip -r Jellyfin.Plugin.SyncPlayChat_<version>.zip .
    ```
3. Crea un nuevo lanzamiento en GitHub con la etiqueta `v<version>` (por ejemplo, `v1.0.2.0`).
4. Adjunta el archivo zip (`Jellyfin.Plugin.SyncPlayChat_<version>.zip`) al lanzamiento.
5. Agrega notas de lanzamiento en el cuerpo del lanzamiento describiendo los cambios.
6. Publica el lanzamiento.

El flujo de trabajo `release.yaml` hará automáticamente lo siguiente:
- Calcular la suma de verificación (checksum) del zip adjunto.
- Agregar una nueva entrada de versión al principio de `manifest.json`.
- Actualizar `Directory.Build.props` con la nueva versión.
- Confirmar y enviar cambios a `master`.

ID del complemento: `a69744cc-2281-48bf-adef-8e451a16ff71`

## Solución de Problemas

- El botón de chat no aparece:
    - Verifica que el usuario esté en un grupo de SyncPlay activo.
    - Verifica que el complemento File Transformation esté instalado y habilitado.
    - Reinicia Jellyfin después de implementar/actualizar el complemento.
- Los mensajes solo aparecen en un dispositivo:
    - Revisa la consola del navegador en busca de registros de error de envío de `[SyncPlayChat]`.
    - Confirma que los dispositivos destino son sesiones activas visibles para Jellyfin.

## Licencia

Consultar `LICENSE`.
