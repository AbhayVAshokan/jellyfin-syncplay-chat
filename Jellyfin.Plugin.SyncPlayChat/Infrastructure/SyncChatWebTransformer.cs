using System;
using System.Globalization;
using System.IO;

namespace Jellyfin.Plugin.SyncPlayChat.Infrastructure;

/// <summary>
/// Applies web content transformations for SyncPlay Chat.
/// </summary>
public static class SyncChatWebTransformer
{
    private const string SyncChatScriptMarker = "<!-- SyncPlayChat sync-chat.js -->";

    /// <summary>
    /// Injects SyncPlay Chat script into jellyfin-web index page.
    /// </summary>
    /// <param name="payload">The transformation payload.</param>
    /// <returns>The transformed index.html content.</returns>
    public static string TransformIndexHtml(WebContentTransformPayload payload)
    {
        if (payload.Contents.Contains(SyncChatScriptMarker, StringComparison.Ordinal))
        {
            return payload.Contents;
        }

        string scriptContent = GetSyncChatScript();
        if (string.IsNullOrEmpty(scriptContent))
        {
            return payload.Contents;
        }

        string injectedScript = string.Format(CultureInfo.InvariantCulture, "{0}<script>{1}</script>", SyncChatScriptMarker, scriptContent);

        return payload.Contents.Replace("</body>", string.Format(CultureInfo.InvariantCulture, "{0}</body>", injectedScript), StringComparison.Ordinal);
    }

    /// <summary>
    /// Returns embedded sync-chat.js content for plugin web path.
    /// </summary>
    /// <returns>Script content.</returns>
    public static string GetSyncChatScript()
    {
        const string resourcePath = "Jellyfin.Plugin.SyncPlayChat.Web.sync-chat.js";
        using Stream? stream = typeof(SyncChatWebTransformer).Assembly.GetManifestResourceStream(resourcePath);
        if (stream is null)
        {
            return string.Empty;
        }

        using StreamReader reader = new StreamReader(stream);
        return reader.ReadToEnd();
    }
}
