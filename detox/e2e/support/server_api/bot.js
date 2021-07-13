// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {capitalize, getRandomId} from '@support/utils';

import client from './client';
import {getResponseFromError} from './common';

// ****************************************************************
// Bots
// See https://api.mattermost.com/#tag/bots
//
// Exported API function should have the following:
// - documented using JSDoc
// - meaningful description
// - match the referenced API endpoints
// - parameter/s defined by `@param`
// - return value defined by `@return`
// ****************************************************************

/**
 * Create a bot.
 * See https://api.mattermost.com/#operation/CreateBot
 * @param {string} option.prefix - prefix to username and display name
 * @param {Object} option.user - user object to be created
 * @return {Object} returns {user} on success or {error, status} on error
 */
export const apiCreateBot = async ({prefix = 'bot', bot = null} = {}) => {
    try {
        const newBot = bot || generateRandomBot({prefix});

        const response = await client.post(
            '/api/v4/bots',
            newBot,
        );

        return {bot: response.data};
    } catch (err) {
        return getResponseFromError(err);
    }
};

export const generateRandomBot = ({prefix = 'bot', randomIdLength = 6} = {}) => {
    const randomId = getRandomId(randomIdLength);

    return {
        username: `${prefix}-${randomId}`,
        display_name: `${capitalize(prefix)} ${randomId}`,
        description: `Test bot description ${randomId}`,
    };
};

export const Bot = {
    apiCreateBot,
    generateRandomBot,
};

export default Bot;
