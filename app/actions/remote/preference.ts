// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Preferences} from '@constants';
import DatabaseManager from '@database/manager';
import NetworkManager from '@managers/network_manager';
import {queryPreferencesByCategoryAndName} from '@queries/servers/preference';
import {getCurrentUserId} from '@queries/servers/system';

import {forceLogoutIfNecessary} from './session';

const {CATEGORY_FAVORITE_CHANNEL, CATEGORY_SAVED_POST} = Preferences;

export type MyPreferencesRequest = {
    preferences?: PreferenceType[];
    error?: unknown;
};

export const fetchMyPreferences = async (serverUrl: string, fetchOnly = false): Promise<MyPreferencesRequest> => {
    let client;
    try {
        client = NetworkManager.getClient(serverUrl);
    } catch (error) {
        return {error};
    }

    try {
        const preferences = await client.getMyPreferences();

        if (!fetchOnly) {
            const operator = DatabaseManager.serverDatabases[serverUrl]?.operator;
            if (operator) {
                await operator.handlePreferences({
                    prepareRecordsOnly: false,
                    preferences,
                    sync: true,
                });
            }
        }

        return {preferences};
    } catch (error) {
        forceLogoutIfNecessary(serverUrl, error as ClientErrorProps);
        return {error};
    }
};

export const saveFavoriteChannel = async (serverUrl: string, channelId: string, isFavorite: boolean) => {
    const operator = DatabaseManager.serverDatabases[serverUrl]?.operator;
    if (!operator) {
        return {error: `${serverUrl} database not found`};
    }

    try {
        // Todo: @shaz I think you'll need to add the category handler here so that the channel is added/removed from the favorites category
        const userId = await getCurrentUserId(operator.database);
        const favPref: PreferenceType = {
            category: CATEGORY_FAVORITE_CHANNEL,
            name: channelId,
            user_id: userId,
            value: String(isFavorite),
        };
        return savePreference(serverUrl, [favPref]);
    } catch (error) {
        return {error};
    }
};

export const savePostPreference = async (serverUrl: string, postId: string) => {
    const operator = DatabaseManager.serverDatabases[serverUrl]?.operator;
    if (!operator) {
        return {error: `${serverUrl} database not found`};
    }

    try {
        const userId = await getCurrentUserId(operator.database);
        const pref: PreferenceType = {
            user_id: userId,
            category: CATEGORY_SAVED_POST,
            name: postId,
            value: 'true',
        };
        return savePreference(serverUrl, [pref]);
    } catch (error) {
        return {error};
    }
};

export const savePreference = async (serverUrl: string, preferences: PreferenceType[]) => {
    const operator = DatabaseManager.serverDatabases[serverUrl]?.operator;
    if (!operator) {
        return {error: `${serverUrl} database not found`};
    }

    let client;
    try {
        client = NetworkManager.getClient(serverUrl);
    } catch (error) {
        return {error};
    }

    try {
        const userId = await getCurrentUserId(operator.database);
        client.savePreferences(userId, preferences);
        await operator.handlePreferences({
            preferences,
            prepareRecordsOnly: false,
        });

        return {preferences};
    } catch (error) {
        forceLogoutIfNecessary(serverUrl, error as ClientErrorProps);
        return {error};
    }
};

export const deleteSavedPost = async (serverUrl: string, postId: string) => {
    const operator = DatabaseManager.serverDatabases[serverUrl]?.operator;
    if (!operator) {
        return {error: `${serverUrl} database not found`};
    }
    let client;
    try {
        client = NetworkManager.getClient(serverUrl);
    } catch (error) {
        return {error};
    }
    try {
        const userId = await getCurrentUserId(operator.database);
        const records = await queryPreferencesByCategoryAndName(operator.database, CATEGORY_SAVED_POST, postId).fetch();
        const postPreferenceRecord = records.find((r) => postId === r.name);
        const pref = {
            user_id: userId,
            category: CATEGORY_SAVED_POST,
            name: postId,
            value: 'true',
        };

        if (postPreferenceRecord) {
            client.deletePreferences(userId, [pref]);
            await postPreferenceRecord.destroyPermanently();
        }

        return {
            preference: pref,
        };
    } catch (error) {
        forceLogoutIfNecessary(serverUrl, error as ClientErrorProps);
        return {error};
    }
};
