// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Model} from '@nozbe/watermelondb';
import {DeviceEventEmitter} from 'react-native';

import {removeUserFromTeam} from '@actions/local/team';
import {fetchMyChannelsForTeam} from '@actions/remote/channel';
import {fetchRoles} from '@actions/remote/role';
import {fetchAllTeams, handleTeamChange, fetchMyTeam} from '@actions/remote/team';
import {updateUsersNoLongerVisible} from '@actions/remote/user';
import Events from '@constants/events';
import DatabaseManager from '@database/manager';
import {queryActiveServer} from '@queries/app/servers';
import {prepareCategories, prepareCategoryChannels} from '@queries/servers/categories';
import {prepareMyChannelsForTeam} from '@queries/servers/channel';
import {getCurrentTeam, getLastTeam, prepareMyTeams} from '@queries/servers/team';
import {getCurrentUser} from '@queries/servers/user';
import {dismissAllModals, popToRoot, resetToTeams} from '@screens/navigation';

export async function handleLeaveTeamEvent(serverUrl: string, msg: WebSocketMessage) {
    const database = DatabaseManager.serverDatabases[serverUrl];
    if (!database) {
        return;
    }

    const currentTeam = await getCurrentTeam(database.database);
    const user = await getCurrentUser(database.database);
    if (!user) {
        return;
    }

    const {user_id: userId, team_id: teamId} = msg.data;
    if (user.id === userId) {
        await removeUserFromTeam(serverUrl, teamId);
        fetchAllTeams(serverUrl);

        if (user.isGuest) {
            updateUsersNoLongerVisible(serverUrl);
        }

        if (currentTeam?.id === teamId) {
            const currentServer = await queryActiveServer(DatabaseManager.appDatabase!.database);

            if (currentServer?.url === serverUrl) {
                DeviceEventEmitter.emit(Events.LEAVE_TEAM, currentTeam?.displayName);
                await dismissAllModals();
                await popToRoot();
            }

            const teamToJumpTo = await getLastTeam(database.database);
            if (teamToJumpTo) {
                handleTeamChange(serverUrl, teamToJumpTo);
            } else if (currentServer?.url === serverUrl) {
                resetToTeams();
            }
        }
    }
}

export async function handleUpdateTeamEvent(serverUrl: string, msg: WebSocketMessage) {
    const database = DatabaseManager.serverDatabases[serverUrl];
    if (!database) {
        return;
    }

    try {
        const team = JSON.parse(msg.data.team) as Team;
        database.operator.handleTeam({
            teams: [team],
            prepareRecordsOnly: false,
        });
    } catch {
        // Do nothing
    }
}

// As of today, the server sends a duplicated event to add the user to the team.
// If we do not handle this, this ends up showing some errors in the database, apart
// of the extra computation time. We use this to track the events that are being handled
// and make sure we only handle one.
const addingTeam: {[id: string]: boolean} = {};

export async function handleUserAddedToTeamEvent(serverUrl: string, msg: WebSocketMessage) {
    const operator = DatabaseManager.serverDatabases[serverUrl]?.operator;
    if (!operator) {
        return;
    }
    const {team_id: teamId} = msg.data;

    // Ignore duplicated team join events sent by the server
    if (addingTeam[teamId]) {
        return;
    }
    addingTeam[teamId] = true;

    const {teams, memberships: teamMemberships} = await fetchMyTeam(serverUrl, teamId, true);

    const modelPromises: Array<Promise<Model[]>> = [];
    if (teams?.length && teamMemberships?.length) {
        const {channels, memberships, categories} = await fetchMyChannelsForTeam(serverUrl, teamId, false, 0, true);
        modelPromises.push(prepareCategories(operator, categories));
        modelPromises.push(prepareCategoryChannels(operator, categories));
        modelPromises.push(...await prepareMyChannelsForTeam(operator, teamId, channels || [], memberships || []));

        const {roles} = await fetchRoles(serverUrl, teamMemberships, memberships, undefined, true);
        modelPromises.push(operator.handleRole({roles, prepareRecordsOnly: true}));
    }

    if (teams && teamMemberships) {
        modelPromises.push(...prepareMyTeams(operator, teams, teamMemberships));
    }

    const models = await Promise.all(modelPromises);
    await operator.batchRecords(models.flat());

    delete addingTeam[teamId];
}
