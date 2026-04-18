namespace Jellyfin.Plugin.SyncPlayChat.Api;

/// <summary>
/// Result payload for SyncPlay chat send attempts.
/// </summary>
public class SyncPlayChatSendResponse
{
    /// <summary>
    /// Gets or sets total attempted session sends.
    /// </summary>
    public int Attempted { get; set; }

    /// <summary>
    /// Gets or sets number of successful session sends.
    /// </summary>
    public int Sent { get; set; }

    /// <summary>
    /// Gets or sets number of failed session sends.
    /// </summary>
    public int Failed { get; set; }
}
