(function () {
    'use strict';

    const buttonId = 'syncPlayChatButton';
    const markerClass = 'syncPlayChatButton';
    const floatingHostId = 'syncPlayChatFloatingHost';
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
        button.style.padding = '0.48rem 0.92rem';
        button.style.borderRadius = '0.6rem';
        button.style.background = 'rgba(0, 0, 0, 0.7)';
        button.style.color = '#fff';
        button.style.border = '1px solid rgba(255, 255, 255, 0.25)';
        button.style.fontSize = '0.9rem';
        button.style.cursor = 'pointer';
        button.addEventListener('click', function () {
            onChatButtonClick(button);
        });
        return button;
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

            return normalizedActual === normalizedExpected
                || normalizedActual.indexOf(normalizedExpected) !== -1
                || normalizedExpected.indexOf(normalizedActual) !== -1;
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

        logDebug('Requesting API path', { path: normalizedPath, url: url });

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

    async function postJson(path, data) {
        if (!window.ApiClient) {
            return null;
        }

        const normalizedPath = typeof path === 'string' && path.charAt(0) === '/' ? path.slice(1) : path;
        const url = typeof window.ApiClient.getUrl === 'function'
            ? window.ApiClient.getUrl(normalizedPath)
            : normalizedPath;

        logDebug('Posting API path', { path: normalizedPath, url: url, data: data });

        if (typeof window.ApiClient.ajax === 'function') {
            return window.ApiClient.ajax({
                type: 'POST',
                url: url,
                contentType: 'application/json; charset=utf-8',
                data: JSON.stringify(data || {})
            });
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
                logDebug('Could not resolve group ID from SyncPlay/List payload', { group: group });
                continue;
            }

            try {
                const details = await fetchJson('SyncPlay/' + encodeURIComponent(groupId));
                if (details) {
                    detailGroups.push(details);
                    logDebug('Fetched SyncPlay group details', { groupId: groupId, details: details });
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

    async function sendMessageToSessions(sessionIds, text) {
        const distinctIds = [];
        sessionIds.forEach(function (id) {
            if (typeof id === 'string' && id.length > 0 && distinctIds.indexOf(id) === -1) {
                distinctIds.push(id);
            }
        });

        logDebug('Preparing SyncPlay chat send', {
            attemptedSessions: distinctIds.length,
            text: text,
            sessionIds: distinctIds
        });

        const payload = {
            Header: 'SyncPlay Chat',
            Text: text,
            TimeoutMs: 4000
        };

        const sendResults = await Promise.allSettled(distinctIds.map(function (sessionId) {
            return postJson('Sessions/' + encodeURIComponent(sessionId) + '/Message', payload);
        }));

        const failed = [];
        sendResults.forEach(function (result, index) {
            if (result.status === 'rejected') {
                failed.push({
                    sessionId: distinctIds[index],
                    reason: summarizeError(result.reason),
                    rawReason: result.reason
                });
            }
        });

        if (failed.length > 0) {
            logDebug('Session message failures', failed);
        }

        return {
            attempted: distinctIds.length,
            sent: distinctIds.length - failed.length,
            failed: failed.length
        };
    }

    async function onChatButtonClick(button) {
        if (sendInProgress) {
            logDebug('Ignoring click while previous send is in progress');
            return;
        }

        sendInProgress = true;
        if (button) {
            button.disabled = true;
            button.style.opacity = '0.75';
        }

        try {
            const sessions = await fetchSessions();
            const groupsResponse = await fetchJson('SyncPlay/List');
            const groups = normalizeGroupsResponse(groupsResponse);

            logDebug('Send click context', {
                sessionsCount: sessions.length,
                groupsCount: groups.length
            });

            const currentSession = getCurrentSession(sessions);
            const senderName = (currentSession && currentSession.UserName)
                || (currentSession && currentSession.User && currentSession.User.Name)
                || getCurrentUserName()
                || 'Someone';
            const messageText = senderName + ': Hello';

            const groupIds = getGroupIdsForCurrentUserSessions(sessions);
            const sessionIdsFromSessionGroup = findSessionIdsByGroupIds(sessions, groupIds);
            const sessionIdsFromGroupPayload = findSessionIdsInGroupPayload(groups, sessions);
            const relevantGroups = groups.filter(function (group) {
                return groupsContainCurrentUser([group], sessions);
            });
            const groupsForDetailLookup = relevantGroups.length > 0 ? relevantGroups : groups;

            if (relevantGroups.length === 0 && groups.length > 0) {
                logDebug('No directly matched group payload; falling back to all groups for detail lookup', {
                    totalGroups: groups.length
                });
            }

            const groupDetailPayloads = await fetchSyncPlayGroupDetails(groupsForDetailLookup);

            const sessionIdsFromGroupDetails = [];
            groupDetailPayloads.forEach(function (groupDetail) {
                extractLikelySessionIdsFromGroup(groupDetail).forEach(function (id) {
                    if (sessionIdsFromGroupDetails.indexOf(id) === -1) {
                        sessionIdsFromGroupDetails.push(id);
                    }
                });
            });
            const sessionIdsFromGroupDetailsKnown = filterSessionIdsToKnownSessions(sessionIdsFromGroupDetails, sessions);

            const localSessionIds = getCurrentSessionIds(sessions);

            const targetSessionIds = sessionIdsFromSessionGroup.slice();
            sessionIdsFromGroupPayload.forEach(function (id) {
                if (targetSessionIds.indexOf(id) === -1) {
                    targetSessionIds.push(id);
                }
            });
            sessionIdsFromGroupDetailsKnown.forEach(function (id) {
                if (targetSessionIds.indexOf(id) === -1) {
                    targetSessionIds.push(id);
                }
            });
            localSessionIds.forEach(function (id) {
                if (targetSessionIds.indexOf(id) === -1) {
                    targetSessionIds.push(id);
                }
            });

            const matchingUserSessions = sessions.filter(matchesCurrentUser);
            if (targetSessionIds.length <= localSessionIds.length) {
                const otherSessionIds = sessions
                    .filter(function (session) {
                        return !matchesCurrentUser(session);
                    })
                    .map(function (session) { return session && session.Id; })
                    .filter(function (id) { return typeof id === 'string' && id.length > 0; });

                otherSessionIds.forEach(function (id) {
                    if (targetSessionIds.indexOf(id) === -1) {
                        targetSessionIds.push(id);
                    }
                });

                if (otherSessionIds.length > 0) {
                    logDebug('Fallback added non-current-user sessions as potential SyncPlay targets', {
                        matchingUserSessions: matchingUserSessions.length,
                        addedSessionIds: otherSessionIds
                    });
                }
            }

            logDebug('Resolved SyncPlay chat targets', {
                senderName: senderName,
                groupIds: groupIds,
                fromSessionGroup: sessionIdsFromSessionGroup,
                fromGroupPayload: sessionIdsFromGroupPayload,
                fromGroupDetailsRaw: sessionIdsFromGroupDetails,
                fromGroupDetailsKnown: sessionIdsFromGroupDetailsKnown,
                localSessionIds: localSessionIds,
                groupDetailsFetched: groupDetailPayloads.length,
                targetSessionIds: targetSessionIds
            });

            if (!targetSessionIds.length) {
                logDebug('No target sessions resolved for sync chat send', {
                    sessions: sessions,
                    groups: groups,
                    groupIds: groupIds
                });
                showLocalToast('Could not resolve SyncPlay target sessions.');
                return;
            }

            const result = await sendMessageToSessions(targetSessionIds, messageText);
            logDebug('Sync chat send result', result);

            if (result.sent === 0) {
                showLocalToast('Failed to send SyncPlay chat message.');
            }
        } catch (err) {
            logDebug('Failed to send SyncPlay chat message', err);
            showLocalToast('Failed to send SyncPlay chat message.');
        } finally {
            sendInProgress = false;
            if (button) {
                button.disabled = false;
                button.style.opacity = '1';
            }
        }
    }

    function groupsContainCurrentUser(groups, sessions) {
        const currentUserIds = getCurrentUserIds().map(normalizeId).filter(Boolean);
        const sessionIds = getCurrentSessionIds(sessions).map(normalizeId).filter(Boolean);

        return groups.some(function (group) {
            const hasCurrentUser = currentUserIds.some(function (id) {
                return objectContainsString(group, id);
            });

            if (hasCurrentUser) {
                return true;
            }

            return sessionIds.some(function (sessionId) {
                return objectContainsString(group, sessionId);
            });
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
                logDebug('Sessions response', { path: path, count: sessions.length, sessions: sessions });

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

        logDebug('Merged sessions result', {
            pathsTried: paths,
            dedupedCount: dedupedSessions.length,
            noIdCount: sessionsWithoutId.length
        });

        return dedupedSessions;
    }

    async function isCurrentUserInSyncPlayGroup() {
        if (!window.ApiClient) {
            return false;
        }

        const sessions = await fetchSessions();
        if (sessions.length > 0) {
            const matchingUserSessions = sessions.filter(matchesCurrentUser);
            logDebug('Matching user sessions', matchingUserSessions);
            if (matchingUserSessions.length > 0 && matchingUserSessions.some(hasSyncPlayGroup)) {
                return true;
            }
        }

        try {
            const groupsResponse = await fetchJson('SyncPlay/List');
            const groups = normalizeGroupsResponse(groupsResponse);
            logDebug('SyncPlay groups response', { count: groups.length, groups: groups });
            if (groups.length > 0) {
                if (groupsContainCurrentUser(groups, sessions)) {
                    logDebug('SyncPlay membership matched by group payload', true);
                    return true;
                }

                const matchingUserSessions = sessions.filter(matchesCurrentUser);
                if (matchingUserSessions.length > 0) {
                    logDebug('SyncPlay membership inferred from non-empty group list', {
                        groupCount: groups.length,
                        matchingUserSessions: matchingUserSessions.length
                    });
                    return true;
                }
            }
        } catch (err) {
            logDebug('SyncPlay list request failed', err);
        }

        return false;
    }

    async function refreshSyncPlayState() {
        if (refreshInProgress) {
            return;
        }

        refreshInProgress = true;

        try {
            shouldShowButton = await isCurrentUserInSyncPlayGroup();
            logDebug('Button visibility state updated', shouldShowButton);
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

        if (floatingHost.querySelector('.' + markerClass)) {
            return;
        }

        floatingHost.appendChild(createButton());
    }

    function start() {
        if (!document.body) {
            return;
        }

        logDebug('sync-chat.js loaded');
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
