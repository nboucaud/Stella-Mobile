// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import DatabaseManager from '@database/manager';
import {WebSocketMessage} from '@typings/api/websocket';

export async function handlePreferenceChangedEvent(serverUrl: string, msg: WebSocketMessage): Promise<void> {
    const database = DatabaseManager.serverDatabases[serverUrl];
    if (!database) {
        return;
    }

    try {
        const preferences = JSON.parse(msg.data.preferences) as PreferenceType[];
        const operator = database?.operator;
        if (operator) {
            operator.handlePreferences({
                prepareRecordsOnly: false,
                preferences,
            });
        }
    } catch (error) {
        // Do nothing
    }
}

// example is flagging/saving a post
export async function handlePreferencesChangedEvent(serverUrl: string, msg: WebSocketMessage): Promise<void> {
    const database = DatabaseManager.serverDatabases[serverUrl];
    if (!database) {
        return;
    }

    try {
        const preferences = JSON.parse(msg.data.preferences) as PreferenceType[];
        const operator = database?.operator;
        if (operator) {
            operator.handlePreferences({
                prepareRecordsOnly: false,
                preferences,
            });
        }
    } catch (error) {
        // Do nothing
    }
}

// example is unflagging/unsaving a post
export async function handlePreferencesDeletedEvent(serverUrl: string, msg: WebSocketMessage): Promise<void> {
    const database = DatabaseManager.serverDatabases[serverUrl];
    if (!database) {
        return;
    }

    try {
        const preferences = JSON.parse(msg.data.preferences) as PreferenceType[];
        const operator = database?.operator;
        if (operator) {
            operator.handlePreferences({
                prepareRecordsOnly: false,
                preferences,
            });
        }
    } catch (error) {
        // Do nothing
    }
}
