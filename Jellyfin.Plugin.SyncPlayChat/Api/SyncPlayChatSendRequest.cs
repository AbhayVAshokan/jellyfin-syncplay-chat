namespace Jellyfin.Plugin.SyncPlayChat.Api;

/// <summary>
/// Request payload for sending SyncPlay chat messages.
/// </summary>
public class SyncPlayChatSendRequest
{
    /// <summary>
    /// Gets or sets the preferred SyncPlay group identifier.
    /// </summary>
    public string? GroupId { get; set; }

    /// <summary>
    /// Gets or sets the sender session identifier from the web client.
    /// </summary>
    public string? SenderSessionId { get; set; }

    /// <summary>
    /// Gets or sets the toast header.
    /// </summary>
    public string? Header { get; set; }

    /// <summary>
    /// Gets or sets the message text.
    /// </summary>
    public string? Text { get; set; }

    /// <summary>
    /// Gets or sets the toast timeout in milliseconds.
    /// </summary>
    public int? TimeoutMs { get; set; }

    /// <summary>
    /// Gets or sets comma-separated participant hints from group payloads.
    /// </summary>
    public string? ParticipantsCsv { get; set; }
}
