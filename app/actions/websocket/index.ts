// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {DeviceEventEmitter} from 'react-native';

import {fetchMyChannelsForTeam} from '@actions/remote/channel';
import {fetchPostsSince} from '@actions/remote/post';
import {fetchMyPreferences} from '@actions/remote/preference';
import {fetchRoles} from '@actions/remote/role';
import {fetchConfigAndLicense} from '@actions/remote/systems';
import {fetchAllTeams, fetchMyTeams} from '@actions/remote/team';
import {fetchMe, updateAllUsersSinceLastDisconnect} from '@actions/remote/user';
import {WebsocketEvents} from '@constants';
import {SYSTEM_IDENTIFIERS} from '@constants/database';
import DatabaseManager from '@database/manager';
import {queryCommonSystemValues, queryConfig, queryWebSocketLastDisconnected} from '@queries/servers/system';

import {handleChannelDeletedEvent, handleUserRemovedEvent} from './channel';
import {handleLeaveTeamEvent} from './teams';

export async function handleFirstConnect(serverUrl: string) {
    const database = DatabaseManager.serverDatabases[serverUrl]?.database;
    if (!database) {
        return;
    }
    const config = await queryConfig(database);
    const lastDisconnect = await queryWebSocketLastDisconnected(database);
    if (lastDisconnect && config.EnableReliableWebSockets !== 'true') {
        doReconnect(serverUrl);
        return;
    }

    doFirstConnect(serverUrl);
}

export async function handleReconnect(serverUrl: string) {
    doReconnect(serverUrl);
}

export async function handleClose(serverUrl: string, lastDisconnect: number) {
    const operator = DatabaseManager.serverDatabases[serverUrl]?.operator;
    if (!operator) {
        return;
    }
    await operator.handleSystem({
        systems: [
            {
                id: SYSTEM_IDENTIFIERS.WEBSOCKET,
                value: lastDisconnect.toString(10),
            },
        ],
        prepareRecordsOnly: false,
    });
}

async function doFirstConnect(serverUrl: string) {
    await updateAllUsersSinceLastDisconnect(serverUrl);
}

async function doReconnect(serverUrl: string) {
    const database = DatabaseManager.serverDatabases[serverUrl];
    if (!database) {
        return;
    }

    const {currentUserId, currentTeamId, currentChannelId} = await queryCommonSystemValues(database.database);
    const lastDisconnectedAt = await queryWebSocketLastDisconnected(database.database);

    fetchMe(serverUrl);
    fetchMyPreferences(serverUrl);
    const {config} = await fetchConfigAndLicense(serverUrl);
    const {memberships: teamMemberships} = await fetchMyTeams(serverUrl);
    fetchAllTeams(serverUrl);

    const currentTeamMembership = teamMemberships?.find((tm) => tm.team_id === currentTeamId && tm.delete_at === 0);

    let channelMemberships: ChannelMembership[] | undefined;
    if (currentTeamMembership) {
        const {memberships, channels, error} = await fetchMyChannelsForTeam(serverUrl, currentTeamMembership.team_id, false, lastDisconnectedAt);
        if (error) {
            DeviceEventEmitter.emit('team_load_error', serverUrl, error);
            return;
        }
        channelMemberships = memberships;

        if (currentChannelId) {
            const stillMemberOfCurrentChannel = memberships?.find((cm) => cm.channel_id === currentChannelId);
            const channelStillExist = channels?.find((c) => c.id === currentChannelId);
            const viewArchivedChannels = config?.ExperimentalViewArchivedChannels === 'true';

            if (!stillMemberOfCurrentChannel) {
                handleUserRemovedEvent(serverUrl, {data: {user_id: currentUserId, channel_id: currentChannelId}});
            } else if (!channelStillExist ||
                (!viewArchivedChannels && channelStillExist.delete_at !== 0)
            ) {
                handleChannelDeletedEvent(serverUrl, {data: {user_id: currentUserId, channel_id: currentChannelId}});
            } else {
                // TODO Differentiate between post and thread, to fetch the thread posts
                fetchPostsSince(serverUrl, currentChannelId, lastDisconnectedAt);
            }
        }

        // TODO Consider global thread screen to update global threads
    } else {
        handleLeaveTeamEvent(serverUrl, {data: {user_id: currentUserId, team_id: currentTeamId}});
    }

    fetchRoles(serverUrl, teamMemberships, channelMemberships);

    // TODO Fetch App bindings?

    await updateAllUsersSinceLastDisconnect(serverUrl);
}

export async function handleEvent(serverUrl: string, msg: any) {
    switch (msg.event) {
        case WebsocketEvents.POSTED:
        case WebsocketEvents.EPHEMERAL_MESSAGE:
            break;

        //return dispatch(handleNewPostEvent(msg));
        case WebsocketEvents.POST_EDITED:
            break;

        //return dispatch(handlePostEdited(msg));
        case WebsocketEvents.POST_DELETED:
            break;

        // return dispatch(handlePostDeleted(msg));
        case WebsocketEvents.POST_UNREAD:
            break;

        // return dispatch(handlePostUnread(msg));
        case WebsocketEvents.LEAVE_TEAM:
            handleLeaveTeamEvent(serverUrl, msg);
            break;
        case WebsocketEvents.UPDATE_TEAM:
            break;

        // return dispatch(handleUpdateTeamEvent(msg));
        case WebsocketEvents.ADDED_TO_TEAM:
            break;

        // return dispatch(handleTeamAddedEvent(msg));
        case WebsocketEvents.USER_ADDED:
            break;

        // return dispatch(handleUserAddedEvent(msg));
        case WebsocketEvents.USER_REMOVED:
            handleUserRemovedEvent(serverUrl, msg);
            break;
        case WebsocketEvents.USER_UPDATED:
            break;

        // return dispatch(handleUserUpdatedEvent(msg));
        case WebsocketEvents.ROLE_ADDED:
            break;

        // return dispatch(handleRoleAddedEvent(msg));
        case WebsocketEvents.ROLE_REMOVED:
            break;

        // return dispatch(handleRoleRemovedEvent(msg));
        case WebsocketEvents.ROLE_UPDATED:
            break;

        // return dispatch(handleRoleUpdatedEvent(msg));
        case WebsocketEvents.USER_ROLE_UPDATED:
            break;

        // return dispatch(handleUserRoleUpdated(msg));
        case WebsocketEvents.MEMBERROLE_UPDATED:
            break;

        // return dispatch(handleUpdateMemberRoleEvent(msg));
        case WebsocketEvents.CHANNEL_CREATED:
            break;

        // return dispatch(handleChannelCreatedEvent(msg));
        case WebsocketEvents.CHANNEL_DELETED:
            handleChannelDeletedEvent(serverUrl, msg);
            break;
        case WebsocketEvents.CHANNEL_UNARCHIVED:
            break;

        // return dispatch(handleChannelUnarchiveEvent(msg));
        case WebsocketEvents.CHANNEL_UPDATED:
            break;

        // return dispatch(handleChannelUpdatedEvent(msg));
        case WebsocketEvents.CHANNEL_CONVERTED:
            break;

        // return dispatch(handleChannelConvertedEvent(msg));
        case WebsocketEvents.CHANNEL_VIEWED:
            break;

        // return dispatch(handleChannelViewedEvent(msg));
        case WebsocketEvents.CHANNEL_MEMBER_UPDATED:
            break;

        // return dispatch(handleChannelMemberUpdatedEvent(msg));
        case WebsocketEvents.CHANNEL_SCHEME_UPDATED:
            break;

        // return dispatch(handleChannelSchemeUpdatedEvent(msg));
        case WebsocketEvents.DIRECT_ADDED:
            break;

        // return dispatch(handleDirectAddedEvent(msg));
        case WebsocketEvents.PREFERENCE_CHANGED:
            break;

        // return dispatch(handlePreferenceChangedEvent(msg));
        case WebsocketEvents.PREFERENCES_CHANGED:
            break;

        // return dispatch(handlePreferencesChangedEvent(msg));
        case WebsocketEvents.PREFERENCES_DELETED:
            break;

        // return dispatch(handlePreferencesDeletedEvent(msg));
        case WebsocketEvents.STATUS_CHANGED:
            break;

        // return dispatch(handleStatusChangedEvent(msg));
        case WebsocketEvents.TYPING:
            break;

        // return dispatch(handleUserTypingEvent(msg));
        case WebsocketEvents.HELLO:
            break;

        // handleHelloEvent(msg);
        // break;
        case WebsocketEvents.REACTION_ADDED:
            break;

        // return dispatch(handleReactionAddedEvent(msg));
        case WebsocketEvents.REACTION_REMOVED:
            break;

        // return dispatch(handleReactionRemovedEvent(msg));
        case WebsocketEvents.EMOJI_ADDED:
            break;

        // return dispatch(handleAddEmoji(msg));
        case WebsocketEvents.LICENSE_CHANGED:
            break;

        // return dispatch(handleLicenseChangedEvent(msg));
        case WebsocketEvents.CONFIG_CHANGED:
            break;

        // return dispatch(handleConfigChangedEvent(msg));
        case WebsocketEvents.OPEN_DIALOG:
            break;

        // return dispatch(handleOpenDialogEvent(msg));
        case WebsocketEvents.RECEIVED_GROUP:
            break;

        // return dispatch(handleGroupUpdatedEvent(msg));
        case WebsocketEvents.THREAD_UPDATED:
            break;

        // return dispatch(handleThreadUpdated(msg));
        case WebsocketEvents.THREAD_READ_CHANGED:
            break;

        // return dispatch(handleThreadReadChanged(msg));
        case WebsocketEvents.THREAD_FOLLOW_CHANGED:
            break;

        // return dispatch(handleThreadFollowChanged(msg));
        case WebsocketEvents.APPS_FRAMEWORK_REFRESH_BINDINGS:
            break;

        // return dispatch(handleRefreshAppsBindings());
    }
}
