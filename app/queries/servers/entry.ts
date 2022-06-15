// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {MM_TABLES} from '@app/constants/database';
import {resetWebSocketLastDisconnected} from '@app/queries/servers/system';
import DatabaseManager from '@database/manager';
import ServerDataOperator from '@database/operator/server_data_operator';

import {prepareCategories, prepareCategoryChannels} from './categories';
import {prepareDeleteChannel, prepareMyChannelsForTeam} from './channel';
import {prepareMyPreferences} from './preference';
import {prepareDeleteTeam, prepareMyTeams} from './team';
import {prepareUsers} from './user';

import type {MyChannelsRequest} from '@actions/remote/channel';
import type {MyPreferencesRequest} from '@actions/remote/preference';
import type {MyTeamsRequest} from '@actions/remote/team';
import type {MyUserRequest} from '@actions/remote/user';
import type {Model} from '@nozbe/watermelondb';
import type ChannelModel from '@typings/database/models/servers/channel';
import type TeamModel from '@typings/database/models/servers/team';

type PrepareModelsArgs = {
    operator: ServerDataOperator;
    initialTeamId?: string;
    removeTeams?: TeamModel[];
    removeChannels?: ChannelModel[];
    teamData?: MyTeamsRequest;
    chData?: MyChannelsRequest;
    prefData?: MyPreferencesRequest;
    meData?: MyUserRequest;
    isCRTEnabled?: boolean;
}

const {
    POST,
    POSTS_IN_CHANNEL,
    POSTS_IN_THREAD,
    THREAD,
    THREADS_IN_TEAM,
    THREAD_PARTICIPANT,
    MY_CHANNEL,
} = MM_TABLES.SERVER;

export async function prepareModels({operator, initialTeamId, removeTeams, removeChannels, teamData, chData, prefData, meData, isCRTEnabled}: PrepareModelsArgs): Promise<Array<Promise<Model[]>>> {
    const modelPromises: Array<Promise<Model[]>> = [];

    if (removeTeams?.length) {
        removeTeams.forEach((team) => {
            modelPromises.push(prepareDeleteTeam(team));
        });
    }

    if (removeChannels?.length) {
        removeChannels.forEach((channel) => {
            modelPromises.push(prepareDeleteChannel(channel));
        });
    }

    if (teamData?.teams?.length && teamData.memberships?.length) {
        modelPromises.push(...prepareMyTeams(operator, teamData.teams, teamData.memberships));
    }

    if (chData?.categories?.length) {
        modelPromises.push(prepareCategories(operator, chData.categories));
        modelPromises.push(prepareCategoryChannels(operator, chData.categories));
    }

    if (initialTeamId && chData?.channels?.length && chData.memberships?.length) {
        modelPromises.push(...await prepareMyChannelsForTeam(operator, initialTeamId, chData.channels, chData.memberships, isCRTEnabled));
    }

    if (prefData?.preferences?.length) {
        modelPromises.push(prepareMyPreferences(operator, prefData.preferences, true));
    }

    if (meData?.user) {
        modelPromises.push(prepareUsers(operator, [meData.user]));
    }

    return modelPromises;
}

export async function truncateCrtRelatedTables(serverUrl: string): Promise<{error: any}> {
    const operator = DatabaseManager.serverDatabases?.[serverUrl].operator;

    if (!operator) {
        return {error: 'No App database found'};
    }
    const database = operator.database;

    try {
        await database.write(() => {
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            return database.adapter.unsafeExecute({
                sqls: [
                    [`DELETE FROM ${POST}`, []],
                    [`DELETE FROM ${POSTS_IN_CHANNEL}`, []],
                    [`DELETE FROM ${POSTS_IN_THREAD}`, []],
                    [`DELETE FROM ${THREAD}`, []],
                    [`DELETE FROM ${THREADS_IN_TEAM}`, []],
                    [`DELETE FROM ${THREAD_PARTICIPANT}`, []],
                    [`DELETE FROM ${MY_CHANNEL}`, []],
                ],
            });
        });
        await resetWebSocketLastDisconnected(operator);
    } catch (error) {
        if (__DEV__) {
            throw error;
        }
        return {error};
    }

    return {error: false};
}
