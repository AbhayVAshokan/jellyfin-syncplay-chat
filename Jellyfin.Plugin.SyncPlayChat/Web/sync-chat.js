(function () {
    'use strict';

    const buttonId = 'syncPlayChatButton';
    const markerClass = 'syncPlayChatButton';
    const floatingHostId = 'syncPlayChatFloatingHost';
    const refreshIntervalMs = 5000;
    let shouldShowButton = false;
    let refreshInProgress = false;

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
        button.addEventListener('click', function () {});
        return button;
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
        const playState = session && session.PlayState;
        const groupId = (session && session.PlayState && session.PlayState.SyncPlayGroupId)
            || (session && session.PlayState && session.PlayState.SyncPlayGroup)
            || (session && session.SyncPlayGroupId)
            || (session && session.SyncPlayGroup)
            || (session && session.SyncPlayGroup && session.SyncPlayGroup.Id)
            || (playState && playState.SyncPlayGroup && playState.SyncPlayGroup.Id)
            || (playState && playState.SyncPlayInfo && playState.SyncPlayInfo.GroupId)
            || (session && session.AdditionalData && session.AdditionalData.SyncPlayGroupId);

        return typeof groupId === 'string' && groupId.length > 0;
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
        if (!userIds.length) {
            return ['Sessions'];
        }

        return userIds.map(function (id) {
            return 'Sessions?UserId=' + encodeURIComponent(id);
        });
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
        let fallbackSessions = [];

        for (let i = 0; i < paths.length; i += 1) {
            const response = await fetchJson(paths[i]);
            const sessions = normalizeSessionsResponse(response);
            logDebug('Sessions response', { path: paths[i], count: sessions.length, sessions: sessions });

            if (sessions.length > 0) {
                return sessions;
            }

            fallbackSessions = sessions;
        }

        return fallbackSessions;
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
