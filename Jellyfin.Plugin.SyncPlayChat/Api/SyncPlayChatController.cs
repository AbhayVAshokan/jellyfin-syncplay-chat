using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Security.Claims;
using System.Threading;
using System.Threading.Tasks;
using MediaBrowser.Common.Api;
using MediaBrowser.Controller.Library;
using MediaBrowser.Controller.Session;
using MediaBrowser.Controller.SyncPlay;
using MediaBrowser.Controller.SyncPlay.Requests;
using MediaBrowser.Model.Session;
using MediaBrowser.Model.SyncPlay;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace Jellyfin.Plugin.SyncPlayChat.Api;

/// <summary>
/// SyncPlay chat API endpoints.
/// </summary>
[ApiController]
[Route("SyncPlayChat")]
[Authorize]
public class SyncPlayChatController : ControllerBase
{
    private readonly ISessionManager _sessionManager;
    private readonly IUserManager _userManager;
    private readonly ISyncPlayManager _syncPlayManager;

    /// <summary>
    /// Initializes a new instance of the <see cref="SyncPlayChatController"/> class.
    /// </summary>
    /// <param name="sessionManager">The Jellyfin session manager.</param>
    /// <param name="userManager">The Jellyfin user manager.</param>
    /// <param name="syncPlayManager">The Jellyfin SyncPlay manager.</param>
    public SyncPlayChatController(ISessionManager sessionManager, IUserManager userManager, ISyncPlayManager syncPlayManager)
    {
        _sessionManager = sessionManager;
        _userManager = userManager;
        _syncPlayManager = syncPlayManager;
    }

    /// <summary>
    /// Sends a chat toast to sessions in the caller's SyncPlay group.
    /// </summary>
    /// <param name="request">The send request payload.</param>
    /// <returns>The send result.</returns>
    [HttpPost("Send")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<SyncPlayChatSendResponse>> Send([FromBody, Required] SyncPlayChatSendRequest request)
    {
        if (request is null)
        {
            return BadRequest("Request body is required.");
        }

        string text = (request.Text ?? string.Empty).Trim();
        if (string.IsNullOrEmpty(text))
        {
            return BadRequest("Text is required.");
        }

        string header = string.IsNullOrWhiteSpace(request.Header) ? "SyncPlay Chat" : request.Header.Trim();
        int timeoutMs = request.TimeoutMs is > 0 ? request.TimeoutMs.Value : 4000;

        Guid userId = ResolveCurrentUserId();
        if (userId == Guid.Empty)
        {
            return BadRequest("Could not resolve current user id.");
        }

        var allSessions = _sessionManager.Sessions.ToList();
        var controllingSession = ResolveControllingSession(allSessions, userId, request.SenderSessionId);
        if (controllingSession is null)
        {
            return BadRequest("Current session not found.");
        }

        string controllingSessionId = controllingSession.Id;

        var visibleGroups = _syncPlayManager.ListGroups(controllingSession, new ListGroupsRequest());

        var participantHints = ParseParticipantHints(request.ParticipantsCsv);
        var targetGroup = ResolveTargetGroup(visibleGroups, request.GroupId, participantHints);
        if (targetGroup is null)
        {
            return Ok(new SyncPlayChatSendResponse
            {
                Attempted = 0,
                Sent = 0,
                Failed = 0
            });
        }

        var allowedSessionIds = ResolveAllowedSessionIds(request, allSessions, controllingSessionId, targetGroup);
        if (allowedSessionIds.Count == 0)
        {
            return Ok(new SyncPlayChatSendResponse
            {
                Attempted = 0,
                Sent = 0,
                Failed = 0
            });
        }

        var command = new MessageCommand
        {
            Header = header,
            Text = text,
            TimeoutMs = timeoutMs
        };

        int sent = 0;
        int failed = 0;

        foreach (var sessionId in allowedSessionIds)
        {
            try
            {
                await _sessionManager.SendMessageCommand(
                    controllingSessionId,
                    sessionId,
                    command,
                    CancellationToken.None).ConfigureAwait(false);
                sent++;
            }
            catch
            {
                failed++;
            }
        }

        return Ok(new SyncPlayChatSendResponse
        {
            Attempted = allowedSessionIds.Count,
            Sent = sent,
            Failed = failed
        });
    }

    private static List<string> ResolveAllowedSessionIds(
        SyncPlayChatSendRequest request,
        List<SessionInfo> allSessions,
        string controllingSessionId,
        GroupInfoDto targetGroup)
    {
        var result = new List<string>();
        var sessionById = allSessions
            .Where(static s => !string.IsNullOrWhiteSpace(s.Id))
            .GroupBy(static s => s.Id, StringComparer.Ordinal)
            .ToDictionary(static g => g.Key, static g => g.First(), StringComparer.Ordinal);

        if (sessionById.TryGetValue(controllingSessionId, out var controllingSession)
            && controllingSession.UserId != Guid.Empty)
        {
            foreach (var session in allSessions)
            {
                if (string.IsNullOrWhiteSpace(session.Id))
                {
                    continue;
                }

                if (session.UserId == controllingSession.UserId)
                {
                    AddIfMissing(result, session.Id);
                }
            }
        }

        if (!string.IsNullOrWhiteSpace(request.SenderSessionId)
            && sessionById.TryGetValue(request.SenderSessionId, out var senderSession)
            && senderSession.UserId != Guid.Empty)
        {
            foreach (var session in allSessions)
            {
                if (string.IsNullOrWhiteSpace(session.Id))
                {
                    continue;
                }

                if (session.UserId == senderSession.UserId)
                {
                    AddIfMissing(result, session.Id);
                }
            }
        }

        var participantSet = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var participant in targetGroup.Participants)
        {
            if (!string.IsNullOrWhiteSpace(participant))
            {
                participantSet.Add(participant.Trim());
            }
        }

        foreach (var participant in ParseParticipantHints(request.ParticipantsCsv))
        {
            if (!string.IsNullOrWhiteSpace(participant))
            {
                participantSet.Add(participant.Trim());
            }
        }

        if (participantSet.Count > 0)
        {
            foreach (var session in allSessions)
            {
                if (string.IsNullOrWhiteSpace(session.Id))
                {
                    continue;
                }

                if (MatchesParticipant(session, participantSet))
                {
                    AddIfMissing(result, session.Id);
                }
            }
        }

        if (result.Count == 0)
        {
            AddIfMissing(result, controllingSessionId);
        }

        return result;
    }

    private static GroupInfoDto? ResolveTargetGroup(List<GroupInfoDto> groups, string? requestedGroupId, List<string> participants)
    {
        if (groups.Count == 0)
        {
            return null;
        }

        if (!string.IsNullOrWhiteSpace(requestedGroupId)
            && Guid.TryParse(requestedGroupId, out var parsedGroupId))
        {
            var direct = groups.FirstOrDefault(group => group.GroupId == parsedGroupId);
            if (direct is not null)
            {
                return direct;
            }
        }

        if (participants.Count > 0)
        {
            var participantSet = new HashSet<string>(participants.Where(static p => !string.IsNullOrWhiteSpace(p)), StringComparer.OrdinalIgnoreCase);
            var best = groups
                .OrderByDescending(group => group.Participants.Count(p => participantSet.Contains(p)))
                .FirstOrDefault();

            if (best is not null)
            {
                return best;
            }
        }

        return groups[0];
    }

    private static List<string> ParseParticipantHints(string? participantsCsv)
    {
        if (string.IsNullOrWhiteSpace(participantsCsv))
        {
            return [];
        }

        return participantsCsv
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Where(static part => !string.IsNullOrWhiteSpace(part))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();
    }

    private static bool MatchesParticipant(SessionInfo session, HashSet<string> participants)
    {
        if (participants.Count == 0)
        {
            return false;
        }

        if (!string.IsNullOrWhiteSpace(session.UserName) && participants.Contains(session.UserName))
        {
            return true;
        }

        if (!string.IsNullOrWhiteSpace(session.DeviceName) && participants.Contains(session.DeviceName))
        {
            return true;
        }

        if (!string.IsNullOrWhiteSpace(session.DeviceId) && participants.Contains(session.DeviceId))
        {
            return true;
        }

        if (!string.IsNullOrWhiteSpace(session.Client) && participants.Contains(session.Client))
        {
            return true;
        }

        return false;
    }

    private static void AddIfMissing(List<string> values, string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return;
        }

        if (!values.Contains(value, StringComparer.Ordinal))
        {
            values.Add(value);
        }
    }

    private Guid ResolveCurrentUserId()
    {
        var userIdClaim = User.Claims.FirstOrDefault(claim => string.Equals(claim.Type, "Jellyfin-UserId", StringComparison.OrdinalIgnoreCase))?.Value;
        if (string.IsNullOrWhiteSpace(userIdClaim))
        {
            return Guid.Empty;
        }

        if (Guid.TryParse(userIdClaim, out var userId))
        {
            return userId;
        }

        return Guid.Empty;
    }

    private static SessionInfo? ResolveControllingSession(List<SessionInfo> sessions, Guid userId, string? preferredSessionId)
    {
        if (!string.IsNullOrWhiteSpace(preferredSessionId))
        {
            var preferred = sessions.FirstOrDefault(session =>
                string.Equals(session.Id, preferredSessionId, StringComparison.Ordinal)
                && session.UserId == userId);
            if (preferred is not null)
            {
                return preferred;
            }
        }

        var fromUser = sessions
            .Where(session => session.UserId == userId)
            .OrderByDescending(session => session.LastActivityDate)
            .FirstOrDefault();
        if (fromUser is not null)
        {
            return fromUser;
        }

        return null;
    }
}
