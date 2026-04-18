(function () {
    'use strict';

    const buttonId = 'syncPlayChatButton';
    const markerClass = 'syncPlayChatButton';
    const floatingHostId = 'syncPlayChatFloatingHost';
    const composerId = 'syncPlayChatComposer';
    const inputId = 'syncPlayChatInput';
    const sendButtonId = 'syncPlayChatSendButton';
    const refreshIntervalMs = 5000;
    let shouldShowButton = false;
    let refreshInProgress = false;
    let sendInProgress = false;

    function normalizeId(value) {
        if (value === null || value === undefined) {
            return '';
        }

        return String(value).toLowerCase().replace(/[^a-z0-9]/g, '');
    }

    function logDebug(message, details) {
        if (!window || !window.console || typeof window.console.log !== 'function') {
            return;
        }

        if (details === undefined) {
            window.console.log('[SyncPlayChat]', message);
            return;
        }

        window.console.log('[SyncPlayChat]', message, details);
    }

    function getControlHost() {
        return document.querySelector('.videoOsdBottom .buttons')
            || document.querySelector('.videoOsdBottom .videoOsdBottomButtons')
            || document.querySelector('.videoOsdBottom .osdControls')
            || document.querySelector('[class*="videoOsd"] [class*="buttons"]')
            || document.querySelector('[class*="videoOsd"] [class*="controls"]');
    }

    function getFloatingHost() {
        let host = document.getElementById(floatingHostId);
        if (host) {
            return host;
        }

        host = document.createElement('div');
        host.id = floatingHostId;
        host.style.position = 'fixed';
        host.style.right = '1rem';
        host.style.bottom = '1rem';
        host.style.zIndex = '99999';
        host.style.display = 'flex';
        host.style.alignItems = 'flex-end';
        host.style.gap = '0.5rem';
        document.body.appendChild(host);
        return host;
    }

    function createButton() {
        const button = document.createElement('button');
        button.id = buttonId;
        button.type = 'button';
        button.className = 'emby-button ' + markerClass;
        button.setAttribute('aria-label', 'SyncPlay chat');
        button.title = 'SyncPlay chat';
        button.innerHTML = '<svg viewBox="0 0 24 24" width="19" height="19" aria-hidden="true" focusable="false"><path fill="currentColor" d="M4 4h16v11H8l-4 4V4z"/></svg>';
        button.style.display = 'inline-flex';
        button.style.alignItems = 'center';
        button.style.justifyContent = 'center';
        button.style.flex = '0 0 auto';
        button.style.alignSelf = 'flex-end';
        button.style.padding = '0.48rem 0.92rem';
        button.style.borderRadius = '0.6rem';
        button.style.background = 'rgba(0, 0, 0, 0.7)';
        button.style.color = '#fff';
        button.style.border = '1px solid rgba(255, 255, 255, 0.25)';
        button.style.fontSize = '0.9rem';
        button.style.cursor = 'pointer';
        button.addEventListener('click', function () {
            toggleComposer(button);
        });
        return button;
    }

    function createComposer() {
        const composer = document.createElement('div');
        composer.id = composerId;
        composer.style.display = 'none';
        composer.style.alignItems = 'center';
        composer.style.gap = '0.45rem';
        composer.style.padding = '0.45rem';
        composer.style.borderRadius = '0.6rem';
        composer.style.background = 'rgba(0, 0, 0, 0.7)';
        composer.style.border = '1px solid rgba(255, 255, 255, 0.25)';

        const input = document.createElement('textarea');
        input.id = inputId;
        input.rows = 1;
        input.placeholder = 'Type a message';
        input.setAttribute('aria-label', 'SyncPlay chat message');
        input.wrap = 'soft';
        input.style.width = '15rem';
        input.style.maxWidth = '54vw';
        input.style.minHeight = '2rem';
        input.style.height = '2rem';
        input.style.maxHeight = '7rem';
        input.style.padding = '0.35rem 0.55rem';
        input.style.lineHeight = '1.2rem';
        input.style.boxSizing = 'border-box';
        input.style.borderRadius = '0.45rem';
        input.style.border = '1px solid rgba(255, 255, 255, 0.25)';
        input.style.background = 'rgba(20, 20, 20, 0.8)';
        input.style.color = '#fff';
        input.style.resize = 'none';
        input.style.overflowX = 'hidden';
        input.style.overflowY = 'auto';
        input.style.whiteSpace = 'pre-wrap';
        input.style.wordBreak = 'break-word';

        const sendButton = document.createElement('button');
        sendButton.id = sendButtonId;
        sendButton.type = 'button';
        sendButton.className = 'emby-button';
        sendButton.textContent = 'Send';
        sendButton.style.padding = '0.36rem 0.65rem';
        sendButton.style.borderRadius = '0.45rem';
        sendButton.style.background = 'rgba(255, 255, 255, 0.18)';
        sendButton.style.color = '#fff';
        sendButton.style.border = '1px solid rgba(255, 255, 255, 0.25)';
        sendButton.style.cursor = 'pointer';

        sendButton.addEventListener('click', function () {
            sendComposerMessage();
        });

        input.addEventListener('keydown', function (event) {
            event.stopPropagation();

            if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                sendComposerMessage();
                return;
            }

            if (event.key === 'Escape') {
                event.preventDefault();
                hideComposer();
            }
        });

        input.addEventListener('keyup', function (event) {
            event.stopPropagation();
        });

        input.addEventListener('input', function () {
            autoResizeComposerInput();
        });

        composer.appendChild(input);
        composer.appendChild(sendButton);
        return composer;
    }

    function getOrCreateComposer(host) {
        let composer = document.getElementById(composerId);
        if (composer) {
            return composer;
        }

        composer = createComposer();
        host.appendChild(composer);
        return composer;
    }

    function autoResizeComposerInput() {
        const input = document.getElementById(inputId);
        if (!input) {
            return;
        }

        input.style.height = 'auto';
        const minHeightPx = 32;
        const maxHeightPx = 112;
        const nextHeight = Math.max(minHeightPx, Math.min(maxHeightPx, input.scrollHeight));
        input.style.height = String(nextHeight) + 'px';
    }

    function setComposerBusy(isBusy) {
        const input = document.getElementById(inputId);
        const sendButton = document.getElementById(sendButtonId);

        if (input) {
            input.disabled = isBusy;
        }

        if (sendButton) {
            sendButton.disabled = isBusy;
            sendButton.style.opacity = isBusy ? '0.75' : '1';
        }
    }

    function hideComposer() {
        const composer = document.getElementById(composerId);
        if (composer) {
            composer.style.display = 'none';
        }
    }

    function toggleComposer(button) {
        if (!shouldShowButton) {
            return;
        }

        const host = getFloatingHost();
        const composer = getOrCreateComposer(host);

        const isVisible = composer.style.display !== 'none';
        composer.style.display = isVisible ? 'none' : 'flex';

        if (button) {
            button.style.opacity = isVisible ? '1' : '0.85';
        }

        if (!isVisible) {
            const input = document.getElementById(inputId);
            if (input) {
                window.setTimeout(function () {
                    autoResizeComposerInput();
                    input.focus();
                }, 0);
            }
        }
    }

    function getComposerMessageText() {
        const input = document.getElementById(inputId);
        if (!input) {
            return '';
        }

        return (input.value || '').trim();
    }

    function clearComposerInput() {
        const input = document.getElementById(inputId);
        if (input) {
            input.value = '';
            autoResizeComposerInput();
        }
    }

    function sendComposerMessage() {
        const text = getComposerMessageText();
        if (!text) {
            return;
        }

        onChatButtonClick(text);
    }

    function extractSyncPlayGroupId(session) {
        const playState = session && session.PlayState;
        const groupId = (session && session.PlayState && session.PlayState.SyncPlayGroupId)
            || (session && session.PlayState && session.PlayState.SyncPlayGroup)
            || (session && session.SyncPlayGroupId)
            || (session && session.SyncPlayGroup)
            || (session && session.SyncPlayGroup && session.SyncPlayGroup.Id)
            || (playState && playState.SyncPlayGroup && playState.SyncPlayGroup.Id)
            || (playState && playState.SyncPlayInfo && playState.SyncPlayInfo.GroupId)
            || (session && session.AdditionalData && session.AdditionalData.SyncPlayGroupId)
            || '';

        return typeof groupId === 'string' ? groupId : '';
    }

    function removeExtraButtons() {
        const existingButtons = document.querySelectorAll('.' + markerClass);
        if (existingButtons.length > 1) {
            for (let i = 1; i < existingButtons.length; i += 1) {
                existingButtons[i].remove();
            }
        }

        if (!shouldShowButton && existingButtons.length > 0) {
            existingButtons[0].remove();
        }
    }

    function getCurrentUserId() {
        if (!window.ApiClient) {
            return '';
        }

        if (typeof window.ApiClient.getCurrentUserId === 'function') {
            return window.ApiClient.getCurrentUserId() || '';
        }

        if (typeof window.ApiClient.userId === 'function') {
            return window.ApiClient.userId() || '';
        }

        if (typeof window.ApiClient._userId === 'string') {
            return window.ApiClient._userId;
        }

        if (window.ApiClient._serverInfo && typeof window.ApiClient._serverInfo.UserId === 'string') {
            return window.ApiClient._serverInfo.UserId;
        }

        return '';
    }

    function getCurrentUserIds() {
        const raw = getCurrentUserId();
        const ids = [];

        if (raw) {
            ids.push(raw);
        }

        const normalized = normalizeId(raw);
        if (normalized && ids.indexOf(normalized) === -1) {
            ids.push(normalized);
        }

        return ids;
    }

    function getCurrentUserName() {
        if (!window.ApiClient) {
            return '';
        }

        const serverInfo = window.ApiClient._serverInfo;
        if (serverInfo && typeof serverInfo.UserName === 'string' && serverInfo.UserName.length > 0) {
            return serverInfo.UserName;
        }

        if (window.Dashboard && window.Dashboard.getCurrentUser) {
            const currentUser = window.Dashboard.getCurrentUser();
            if (currentUser && typeof currentUser.Name === 'string' && currentUser.Name.length > 0) {
                return currentUser.Name;
            }
        }

        return '';
    }

    function getCurrentDeviceId() {
        if (!window.ApiClient) {
            return '';
        }

        if (typeof window.ApiClient.deviceId === 'function') {
            return window.ApiClient.deviceId() || '';
        }

        if (typeof window.ApiClient._deviceId === 'string') {
            return window.ApiClient._deviceId;
        }

        return '';
    }

    function hasSyncPlayGroup(session) {
        return extractSyncPlayGroupId(session).length > 0;
    }

    function collectStringValues(value, output) {
        if (value === null || value === undefined) {
            return;
        }

        if (typeof value === 'string') {
            output.push(value);
            return;
        }

        if (Array.isArray(value)) {
            value.forEach(function (item) {
                collectStringValues(item, output);
            });
            return;
        }

        if (typeof value === 'object') {
            Object.keys(value).forEach(function (key) {
                collectStringValues(value[key], output);
            });
        }
    }

    function normalizeSessionsResponse(response) {
        if (Array.isArray(response)) {
            return response;
        }

        if (response && Array.isArray(response.Items)) {
            return response.Items;
        }

        if (response && Array.isArray(response.Sessions)) {
            return response.Sessions;
        }

        return [];
    }

    function normalizeGroupsResponse(response) {
        if (Array.isArray(response)) {
            return response;
        }

        if (response && Array.isArray(response.Groups)) {
            return response.Groups;
        }

        if (response && Array.isArray(response.Items)) {
            return response.Items;
        }

        return [];
    }

    function objectContainsString(value, expectedLowerValue) {
        if (!value || !expectedLowerValue) {
            return false;
        }

        if (typeof value === 'string') {
            const normalizedActual = normalizeId(value);
            const normalizedExpected = normalizeId(expectedLowerValue);

            if (!normalizedActual || !normalizedExpected) {
                return false;
            }

            return normalizedActual === normalizedExpected;
        }

        if (Array.isArray(value)) {
            return value.some(function (item) {
                return objectContainsString(item, expectedLowerValue);
            });
        }

        if (typeof value === 'object') {
            return Object.keys(value).some(function (key) {
                return objectContainsString(value[key], expectedLowerValue);
            });
        }

        return false;
    }

    function buildSessionsPaths() {
        const userIds = getCurrentUserIds();
        const paths = ['Sessions'];

        userIds.forEach(function (id) {
            const path = 'Sessions?UserId=' + encodeURIComponent(id);
            if (paths.indexOf(path) === -1) {
                paths.push(path);
            }
        });

        return paths;
    }

    async function fetchJson(path) {
        if (!window.ApiClient) {
            return null;
        }

        const normalizedPath = typeof path === 'string' && path.charAt(0) === '/' ? path.slice(1) : path;
        const url = typeof window.ApiClient.getUrl === 'function'
            ? window.ApiClient.getUrl(normalizedPath)
            : normalizedPath;

        if (typeof window.ApiClient.ajax === 'function') {
            return window.ApiClient.ajax({
                type: 'GET',
                url: url,
                dataType: 'json'
            });
        }

        if (typeof window.ApiClient.getJSON === 'function') {
            return window.ApiClient.getJSON(url);
        }

        return null;
    }

    async function postJson(path, data, expectJsonResponse) {
        if (!window.ApiClient) {
            return null;
        }

        const normalizedPath = typeof path === 'string' && path.charAt(0) === '/' ? path.slice(1) : path;
        const url = typeof window.ApiClient.getUrl === 'function'
            ? window.ApiClient.getUrl(normalizedPath)
            : normalizedPath;

        if (typeof window.ApiClient.ajax === 'function') {
            const request = {
                type: 'POST',
                url: url,
                contentType: 'application/json; charset=utf-8',
                data: JSON.stringify(data || {})
            };

            if (expectJsonResponse) {
                request.dataType = 'json';
            }

            return window.ApiClient.ajax(request);
        }

        if (typeof window.fetch === 'function') {
            const response = await window.fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json; charset=utf-8'
                },
                body: JSON.stringify(data || {})
            });

            if (!response.ok) {
                throw new Error('HTTP ' + response.status);
            }

            if (expectJsonResponse) {
                return response.json();
            }

            return null;
        }

        return null;
    }

    function matchesCurrentUser(session) {
        const currentUserIds = getCurrentUserIds();
        if (!currentUserIds.length) {
            return true;
        }

        const sessionUserId = (session && session.UserId) || (session && session.User && session.User.Id) || '';
        const normalizedSessionUserId = normalizeId(sessionUserId);
        return currentUserIds.some(function (id) {
            return normalizeId(id) === normalizedSessionUserId;
        });
    }

    function getCurrentSessionIds(sessions) {
        return sessions
            .filter(matchesCurrentUser)
            .map(function (session) { return session && session.Id; })
            .filter(function (id) { return typeof id === 'string' && id.length > 0; });
    }

    function getCurrentSession(sessions) {
        const currentDeviceId = normalizeId(getCurrentDeviceId());
        const matchingUserSessions = sessions.filter(matchesCurrentUser);

        if (currentDeviceId) {
            const exactDeviceSession = matchingUserSessions.find(function (session) {
                return normalizeId(session && session.DeviceId) === currentDeviceId;
            });

            if (exactDeviceSession) {
                return exactDeviceSession;
            }
        }

        return matchingUserSessions.length > 0 ? matchingUserSessions[0] : null;
    }

    function mapKnownSessionIds(sessions) {
        const map = {};
        sessions.forEach(function (session) {
            const sessionId = session && session.Id;
            if (typeof sessionId === 'string' && sessionId.length > 0) {
                map[normalizeId(sessionId)] = sessionId;
            }
        });

        return map;
    }

    function filterSessionIdsToKnownSessions(sessionIds, sessions) {
        const knownSessionIds = mapKnownSessionIds(sessions);
        const filtered = [];

        sessionIds.forEach(function (id) {
            const knownId = knownSessionIds[normalizeId(id)];
            if (knownId && filtered.indexOf(knownId) === -1) {
                filtered.push(knownId);
            }
        });

        return filtered;
    }

    function summarizeError(error) {
        if (!error) {
            return 'Unknown error';
        }

        if (typeof error === 'string') {
            return error;
        }

        if (error.message) {
            return error.message;
        }

        if (error.status || error.statusText) {
            return 'HTTP ' + (error.status || 'unknown') + ' ' + (error.statusText || '').trim();
        }

        if (error.responseJSON) {
            try {
                return JSON.stringify(error.responseJSON);
            } catch (jsonErr) {
                return 'Response JSON serialization failed';
            }
        }

        if (error.responseText) {
            return String(error.responseText).slice(0, 500);
        }

        try {
            return JSON.stringify(error).slice(0, 500);
        } catch (jsonErr) {
            return 'Unserializable error object';
        }
    }

    function isLikelySessionId(value) {
        if (typeof value !== 'string') {
            return false;
        }

        const trimmed = value.trim();
        return /^[a-f0-9]{32}$/i.test(trimmed) || /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(trimmed);
    }

    function resolveSyncPlayGroupId(group) {
        const direct = (group && group.Id)
            || (group && group.GroupId)
            || (group && group.Group && group.Group.Id)
            || (group && group.GroupInfo && group.GroupInfo.Id)
            || '';

        if (typeof direct === 'string' && direct.length > 0) {
            return direct;
        }

        const values = [];
        collectStringValues(group, values);
        const possibleGroupId = values.find(function (value) {
            return isLikelySessionId(value);
        });

        return possibleGroupId || '';
    }

    function extractLikelySessionIdsFromGroup(group) {
        const fromSessionKeys = [];

        function walk(value) {
            if (value === null || value === undefined) {
                return;
            }

            if (Array.isArray(value)) {
                value.forEach(walk);
                return;
            }

            if (typeof value !== 'object') {
                return;
            }

            Object.keys(value).forEach(function (key) {
                const child = value[key];
                const normalizedKey = normalizeId(key);
                if ((normalizedKey === 'sessionid' || normalizedKey.indexOf('sessionid') !== -1) && typeof child === 'string' && child.length > 0) {
                    fromSessionKeys.push(child);
                }
                walk(child);
            });
        }

        walk(group);

        const values = [];
        collectStringValues(group, values);

        const unique = [];
        fromSessionKeys.forEach(function (value) {
            if (typeof value !== 'string' || value.length === 0) {
                return;
            }

            if (unique.indexOf(value) === -1) {
                unique.push(value);
            }
        });

        values.forEach(function (value) {
            if (!isLikelySessionId(value)) {
                return;
            }

            if (unique.indexOf(value) === -1) {
                unique.push(value);
            }
        });

        return unique;
    }

    async function fetchSyncPlayGroupDetails(groups) {
        const detailGroups = [];

        for (let i = 0; i < groups.length; i += 1) {
            const group = groups[i];
            const groupId = resolveSyncPlayGroupId(group);
            if (!groupId) {
                continue;
            }

            try {
                const details = await fetchJson('SyncPlay/' + encodeURIComponent(groupId));
                if (details) {
                    detailGroups.push(details);
                }
            } catch (err) {
                logDebug('Failed to fetch SyncPlay group details', { groupId: groupId, error: err });
            }
        }

        return detailGroups;
    }

    function getGroupIdsForCurrentUserSessions(sessions) {
        const groupIds = [];
        sessions
            .filter(matchesCurrentUser)
            .forEach(function (session) {
                const groupId = extractSyncPlayGroupId(session);
                if (groupId && groupIds.indexOf(groupId) === -1) {
                    groupIds.push(groupId);
                }
            });

        return groupIds;
    }

    function findSessionIdsByGroupIds(sessions, groupIds) {
        if (!groupIds.length) {
            return [];
        }

        const normalizedGroupIds = groupIds.map(normalizeId).filter(Boolean);
        return sessions
            .filter(function (session) {
                const sessionGroupId = normalizeId(extractSyncPlayGroupId(session));
                return normalizedGroupIds.indexOf(sessionGroupId) !== -1;
            })
            .map(function (session) { return session && session.Id; })
            .filter(function (id) { return typeof id === 'string' && id.length > 0; });
    }

    function findSessionIdsInGroupPayload(groups, sessions) {
        if (!groups.length || !sessions.length) {
            return [];
        }

        const normalizedSessionIds = {};
        sessions.forEach(function (session) {
            const sessionId = session && session.Id;
            if (typeof sessionId === 'string' && sessionId.length > 0) {
                normalizedSessionIds[normalizeId(sessionId)] = sessionId;
            }
        });

        const matchingIds = [];

        groups.forEach(function (group) {
            if (!groupsContainCurrentUser([group], sessions)) {
                return;
            }

            const values = [];
            collectStringValues(group, values);
            values.forEach(function (value) {
                const normalizedValue = normalizeId(value);
                const sessionId = normalizedSessionIds[normalizedValue];
                if (sessionId && matchingIds.indexOf(sessionId) === -1) {
                    matchingIds.push(sessionId);
                }
            });
        });

        return matchingIds;
    }

    function findGroupsByGroupIds(groups, groupIds) {
        if (!groups.length || !groupIds.length) {
            return [];
        }

        const normalizedGroupIds = groupIds.map(normalizeId).filter(Boolean);
        return groups.filter(function (group) {
            return normalizedGroupIds.indexOf(normalizeId(resolveSyncPlayGroupId(group))) !== -1;
        });
    }

    function mergeSessionsUnique(primary, secondary) {
        const map = {};

        (primary || []).forEach(function (session) {
            const id = session && session.Id;
            if (typeof id === 'string' && id.length > 0) {
                map[id] = session;
            }
        });

        (secondary || []).forEach(function (session) {
            const id = session && session.Id;
            if (typeof id === 'string' && id.length > 0 && !map[id]) {
                map[id] = session;
            }
        });

        return Object.keys(map).map(function (id) {
            return map[id];
        });
    }

    function extractParticipantTokens(groups) {
        const userIds = [];
        const userNames = [];

        groups.forEach(function (group) {
            if (!group || !Array.isArray(group.Participants)) {
                return;
            }

            group.Participants.forEach(function (participant) {
                if (typeof participant === 'string' && participant.length > 0) {
                    if (isLikelySessionId(participant)) {
                        if (userIds.indexOf(participant) === -1) {
                            userIds.push(participant);
                        }
                        return;
                    }

                    if (userNames.indexOf(participant) === -1) {
                        userNames.push(participant);
                    }
                    return;
                }

                if (!participant || typeof participant !== 'object') {
                    return;
                }

                const participantUserId = participant.UserId || (participant.User && participant.User.Id) || '';
                if (typeof participantUserId === 'string' && participantUserId.length > 0 && userIds.indexOf(participantUserId) === -1) {
                    userIds.push(participantUserId);
                }

                const participantUserName = participant.UserName || (participant.User && participant.User.Name) || '';
                if (typeof participantUserName === 'string' && participantUserName.length > 0 && userNames.indexOf(participantUserName) === -1) {
                    userNames.push(participantUserName);
                }
            });
        });

        return {
            userIds: userIds,
            userNames: userNames
        };
    }

    async function fetchSessionsForUserIds(userIds) {
        const sessionsById = {};

        for (let i = 0; i < userIds.length; i += 1) {
            const userId = userIds[i];
            if (!userId) {
                continue;
            }

            try {
                const response = await fetchJson('Sessions?UserId=' + encodeURIComponent(userId));
                const sessions = normalizeSessionsResponse(response);
                sessions.forEach(function (session) {
                    const sessionId = session && session.Id;
                    if (typeof sessionId === 'string' && sessionId.length > 0) {
                        sessionsById[sessionId] = session;
                    }
                });
            } catch (err) {
                logDebug('Failed to fetch participant sessions by user ID', { userId: userId, error: err });
            }
        }

        return Object.keys(sessionsById).map(function (id) {
            return sessionsById[id];
        });
    }

    function buildCurrentIdentityTokens(sessions) {
        const tokens = [];

        getCurrentUserIds().forEach(function (id) {
            if (id && tokens.indexOf(id) === -1) {
                tokens.push(id);
            }
        });

        const currentUserName = getCurrentUserName();
        if (currentUserName && tokens.indexOf(currentUserName) === -1) {
            tokens.push(currentUserName);
        }

        getCurrentSessionIds(sessions).forEach(function (sessionId) {
            if (sessionId && tokens.indexOf(sessionId) === -1) {
                tokens.push(sessionId);
            }
        });

        sessions
            .filter(matchesCurrentUser)
            .forEach(function (session) {
                const userName = (session && session.UserName)
                    || (session && session.User && session.User.Name)
                    || '';
                if (userName && tokens.indexOf(userName) === -1) {
                    tokens.push(userName);
                }
            });

        return tokens;
    }

    function payloadContainsAnyIdentity(payload, identityTokens) {
        if (!payload || !identityTokens.length) {
            return false;
        }

        return identityTokens.some(function (token) {
            return objectContainsString(payload, token);
        });
    }

    function hasIntersection(left, right) {
        if (!left.length || !right.length) {
            return false;
        }

        const rightLookup = {};
        right.forEach(function (value) {
            rightLookup[normalizeId(value)] = true;
        });

        return left.some(function (value) {
            return !!rightLookup[normalizeId(value)];
        });
    }

    async function isCurrentUserInGroupsViaDetails(groups, sessions) {
        const localSessionIds = getCurrentSessionIds(sessions);
        const identityTokens = buildCurrentIdentityTokens(sessions);
        if (!localSessionIds.length || !groups.length) {
            return false;
        }

        const groupIds = getGroupIdsForCurrentUserSessions(sessions);
        const scopedGroups = findGroupsByGroupIds(groups, groupIds);
        const groupsForLookup = scopedGroups.length > 0 ? scopedGroups : groups;
        const groupDetailPayloads = await fetchSyncPlayGroupDetails(groupsForLookup);

        const sessionIdsFromGroupDetails = [];
        let matchedIdentityInDetails = false;
        groupDetailPayloads.forEach(function (groupDetail) {
            if (!matchedIdentityInDetails && payloadContainsAnyIdentity(groupDetail, identityTokens)) {
                matchedIdentityInDetails = true;
            }

            extractLikelySessionIdsFromGroup(groupDetail).forEach(function (id) {
                if (sessionIdsFromGroupDetails.indexOf(id) === -1) {
                    sessionIdsFromGroupDetails.push(id);
                }
            });
        });

        const knownSessionIds = filterSessionIdsToKnownSessions(sessionIdsFromGroupDetails, sessions);
        if (hasIntersection(localSessionIds, knownSessionIds)) {
            return true;
        }

        return matchedIdentityInDetails;
    }

    function showLocalToast(text, title) {
        if (window.toastr && typeof window.toastr.info === 'function') {
            window.toastr.info(text, title || 'SyncPlay Chat');
            return;
        }

        if (window.Dashboard && typeof window.Dashboard.alert === 'function') {
            window.Dashboard.alert({
                title: title || 'SyncPlay Chat',
                message: text
            });
            return;
        }

        logDebug('Toast fallback', { title: title || 'SyncPlay Chat', text: text });
    }

    function extractParticipantsFromGroups(groups) {
        const participants = [];

        groups.forEach(function (group) {
            const groupParticipants = group && group.Participants;
            if (!Array.isArray(groupParticipants)) {
                return;
            }

            groupParticipants.forEach(function (participant) {
                if (typeof participant === 'string' && participant.length > 0 && participants.indexOf(participant) === -1) {
                    participants.push(participant);
                    return;
                }

                if (participant && typeof participant === 'object') {
                    const userName = participant.UserName || (participant.User && participant.User.Name) || '';
                    const deviceName = participant.DeviceName || participant.Device || '';

                    if (typeof userName === 'string' && userName.length > 0 && participants.indexOf(userName) === -1) {
                        participants.push(userName);
                    }

                    if (typeof deviceName === 'string' && deviceName.length > 0 && participants.indexOf(deviceName) === -1) {
                        participants.push(deviceName);
                    }
                }
            });
        });

        return participants;
    }

    async function sendMessageViaServer(text, senderSessionId, groupId, participants) {
        const response = await postJson('SyncPlayChat/Send', {
            GroupId: groupId || '',
            SenderSessionId: senderSessionId || '',
            Header: 'SyncPlay Chat',
            Text: text,
            TimeoutMs: 4000,
            ParticipantsCsv: (participants || []).join(',')
        }, true);

        let normalized = response;
        if (typeof normalized === 'string') {
            try {
                normalized = JSON.parse(normalized);
            } catch (parseError) {
                logDebug('Failed to parse server chat send response JSON', {
                    response: response,
                    error: parseError
                });
                normalized = null;
            }
        }

        if (normalized && typeof normalized === 'object' && normalized.responseJSON && typeof normalized.responseJSON === 'object') {
            normalized = normalized.responseJSON;
        }

        if (!normalized || typeof normalized !== 'object') {
            logDebug('Unexpected server chat send response shape', { response: response, normalized: normalized });
            return {
                attempted: 0,
                sent: 0,
                failed: 0
            };
        }

        return {
            attempted: Number(normalized.Attempted) || 0,
            sent: Number(normalized.Sent) || 0,
            failed: Number(normalized.Failed) || 0
        };
    }

    async function onChatButtonClick(chatText) {
        if (sendInProgress) {
            return;
        }

        const trimmedText = typeof chatText === 'string' ? chatText.trim() : '';
        if (!trimmedText) {
            return;
        }

        sendInProgress = true;
        setComposerBusy(true);

        try {
            const sessions = await fetchSessions();
            const groupsResponse = await fetchJson('SyncPlay/List');
            const groups = normalizeGroupsResponse(groupsResponse);

            const currentSession = getCurrentSession(sessions);
            const senderName = (currentSession && currentSession.UserName)
                || (currentSession && currentSession.User && currentSession.User.Name)
                || getCurrentUserName()
                || 'Someone';
            const messageText = senderName + ': ' + trimmedText;

            const groupIds = getGroupIdsForCurrentUserSessions(sessions);
            const sessionIdsFromSessionGroup = findSessionIdsByGroupIds(sessions, groupIds);
            const sessionIdsFromGroupPayload = findSessionIdsInGroupPayload(groups, sessions);
            const groupsBySessionGroupIds = findGroupsByGroupIds(groups, groupIds);
            const relevantGroups = groups.filter(function (group) {
                return groupsContainCurrentUser([group], sessions);
            });
            let groupsForDetailLookup = [];

            if (groupsBySessionGroupIds.length > 0) {
                groupsForDetailLookup = groupsBySessionGroupIds;
            } else if (relevantGroups.length > 0) {
                groupsForDetailLookup = relevantGroups;
            } else if (groups.length === 1) {
                groupsForDetailLookup = [groups[0]];
            }

            const participantsForSend = extractParticipantsFromGroups(groupsForDetailLookup.length > 0 ? groupsForDetailLookup : groups);
            let result;
            const preferredGroupId = groupIds.length > 0 ? groupIds[0] : resolveSyncPlayGroupId(groupsForDetailLookup[0] || groups[0]);
            result = await sendMessageViaServer(
                messageText,
                currentSession && currentSession.Id,
                preferredGroupId,
                participantsForSend);

            logDebug('Sync chat send result', result);

            if (result && result.sent > 0) {
                clearComposerInput();
                hideComposer();
            } else {
                showLocalToast('Failed to send SyncPlay chat message.');
            }
        } catch (err) {
            logDebug('Failed to send SyncPlay chat message', err);
            showLocalToast('Failed to send SyncPlay chat message.');
        } finally {
            sendInProgress = false;
            setComposerBusy(false);
        }
    }

    function groupsContainCurrentUser(groups, sessions) {
        const identityTokens = buildCurrentIdentityTokens(sessions);
        if (identityTokens.length === 0) {
            return false;
        }

        return groups.some(function (group) {
            return payloadContainsAnyIdentity(group, identityTokens);
        });
    }

    async function fetchSessions() {
        const paths = buildSessionsPaths();
        const sessionsById = {};
        const sessionsWithoutId = [];

        for (let i = 0; i < paths.length; i += 1) {
            const path = paths[i];
            try {
                const response = await fetchJson(path);
                const sessions = normalizeSessionsResponse(response);
                sessions.forEach(function (session) {
                    const sessionId = session && session.Id;
                    if (typeof sessionId === 'string' && sessionId.length > 0) {
                        sessionsById[sessionId] = session;
                        return;
                    }

                    sessionsWithoutId.push(session);
                });
            } catch (err) {
                logDebug('Failed to fetch sessions path', { path: path, error: err });
            }
        }

        const dedupedSessions = Object.keys(sessionsById).map(function (id) {
            return sessionsById[id];
        });

        if (dedupedSessions.length === 0 && sessionsWithoutId.length > 0) {
            return sessionsWithoutId;
        }

        return dedupedSessions;
    }

    async function isCurrentUserInSyncPlayGroup() {
        if (!window.ApiClient) {
            return false;
        }

        const sessions = await fetchSessions();
        const matchingUserSessions = sessions.filter(matchesCurrentUser);
        if (matchingUserSessions.length === 0) {
            return false;
        }

        if (matchingUserSessions.some(hasSyncPlayGroup)) {
            return true;
        }

        try {
            const groupsResponse = await fetchJson('SyncPlay/List');
            const groups = normalizeGroupsResponse(groupsResponse);
            if (groups.length > 0) {
                if (groupsContainCurrentUser(groups, sessions)) {
                    return true;
                }

                if (await isCurrentUserInGroupsViaDetails(groups, sessions)) {
                    return true;
                }
            }
        } catch (err) {
            logDebug('SyncPlay list request failed', err);
        }

        logDebug('Current user not in any SyncPlay group', {
            matchingUserSessions: matchingUserSessions.length
        });
        return false;
    }

    async function refreshSyncPlayState() {
        if (refreshInProgress) {
            return;
        }

        refreshInProgress = true;

        try {
            shouldShowButton = await isCurrentUserInSyncPlayGroup();
        } catch (err) {
            logDebug('Failed to refresh SyncPlay state', err);
            return;
        } finally {
            refreshInProgress = false;
            addButton();
        }
    }

    function addButton() {
        const controlHost = getControlHost();
        const floatingHost = getFloatingHost();
        removeExtraButtons();

        if (!controlHost && !floatingHost) {
            return;
        }

        if (!shouldShowButton) {
            hideComposer();

            if (controlHost) {
                const controlButton = controlHost.querySelector('.' + markerClass);
                if (controlButton) {
                    controlButton.remove();
                }
            }

            const floatingButton = floatingHost.querySelector('.' + markerClass);
            if (floatingButton) {
                floatingButton.remove();
            }

            return;
        }

        getOrCreateComposer(floatingHost);

        if (floatingHost.querySelector('.' + markerClass)) {
            return;
        }

        floatingHost.appendChild(createButton());
    }

    function start() {
        if (!document.body) {
            return;
        }

        window.__syncPlayChatLoaded = true;

        const observer = new MutationObserver(addButton);
        observer.observe(document.body, { childList: true, subtree: true });

        refreshSyncPlayState();
        window.setInterval(refreshSyncPlayState, refreshIntervalMs);
        window.addEventListener('focus', refreshSyncPlayState);
        document.addEventListener('visibilitychange', function () {
            if (!document.hidden) {
                refreshSyncPlayState();
            }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start, { once: true });
    } else {
        start();
    }
})();
