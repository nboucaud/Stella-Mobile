// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import DatabaseManager from '@database/manager';
import {prepareDeleteTeam, getMyTeamById, queryTeamSearchHistoryByTeamId, removeTeamFromTeamHistory, getTeamSearchHistoryById} from '@queries/servers/team';
import {logError} from '@utils/log';

export async function removeUserFromTeam(serverUrl: string, teamId: string) {
    try {
        const {database, operator} = DatabaseManager.getServerDatabaseAndOperator(serverUrl);
        const myTeam = await getMyTeamById(database, teamId);
        if (myTeam) {
            const team = await myTeam.team.fetch();
            if (!team) {
                throw new Error('Team not found');
            }
            const models = await prepareDeleteTeam(team);
            const system = await removeTeamFromTeamHistory(operator, team.id, true);
            if (system) {
                models.push(...system);
            }
            if (models.length) {
                await operator.batchRecords(models);
            }
        }

        return {error: undefined};
    } catch (error) {
        logError('Failed removeUserFromTeam', error);
        return {error};
    }
}

export async function addSearchToTeamSearchHistory(serverUrl: string, teamId: string, terms: string) {
    const MAX_TEAM_SEARCHES = 4;
    try {
        const {database, operator} = DatabaseManager.getServerDatabaseAndOperator(serverUrl);
        const newSearch: TeamSearchHistory = {
            created_at: 0,
            display_term: terms,
            term: terms,
            team_id: teamId,
        };
        await operator.handleTeamSearchHistory({teamSearchHistories: [newSearch], prepareRecordsOnly: false});

        const teamSearchHistory = await queryTeamSearchHistoryByTeamId(database, teamId).fetch();
        if (teamSearchHistory.length > MAX_TEAM_SEARCHES) {
            const lastSearch = teamSearchHistory.pop();
            await database.write(async () => {
                await lastSearch?.destroyPermanently();
            });
        }

        return {error: undefined};
    } catch (error) {
        logError('Failed addSearchToTeamSearchHistory', error);
        return {error};
    }
}

export async function removeSearchFromTeamSearchHistory(serverUrl: string, id: string) {
    try {
        const {database} = DatabaseManager.getServerDatabaseAndOperator(serverUrl);
        const teamSearch = await getTeamSearchHistoryById(database, id);
        await database.write(async () => {
            await teamSearch?.destroyPermanently();
        });
        return {teamSearch};
    } catch (error) {
        logError('Failed removeSearchFromTeamSearchHistory', error);
        return {error};
    }
}

