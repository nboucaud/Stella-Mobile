// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export default {
    PAGE_SIZE_DEFAULT: 60,
    POST_CHUNK_SIZE: 60,
    POST_AROUND_CHUNK_SIZE: 10,
    CHANNELS_CHUNK_SIZE: 50,
    CRT_CHUNK_SIZE: 60,
    STATUS_INTERVAL: 60000,
    AUTOCOMPLETE_LIMIT_DEFAULT: 25,
    MENTION: 'mention',
    OUT_OF_OFFICE: 'ooo',
    OFFLINE: 'offline',
    AWAY: 'away',
    ONLINE: 'online',
    DND: 'dnd',
    STATUS_COMMANDS: ['offline', 'away', 'online', 'dnd'],
    DEFAULT_CHANNEL: 'town-square',
    DM_CHANNEL: 'D' as const,
    OPEN_CHANNEL: 'O' as const,
    PRIVATE_CHANNEL: 'P' as const,
    GM_CHANNEL: 'G' as const,
    TEAMMATE_NAME_DISPLAY: {
        SHOW_USERNAME: 'username',
        SHOW_NICKNAME_FULLNAME: 'nickname_full_name',
        SHOW_FULLNAME: 'full_name',
    },
    SPECIAL_MENTIONS: new Set(['all', 'channel', 'here']),
    MAX_USERS_IN_GM: 7,
    MIN_USERS_IN_GM: 3,
    MAX_GROUP_CHANNELS_FOR_PROFILES: 50,
    DEFAULT_AUTOLINKED_URL_SCHEMES: ['http', 'https', 'ftp', 'mailto', 'tel', 'mattermost'],
    PROFILE_CHUNK_SIZE: 100,
    SEARCH_TIMEOUT_MILLISECONDS: 500,
    AUTOCOMPLETE_SPLIT_CHARACTERS: ['.', '-', '_'],
    CHANNEL_USER_ROLE: 'channel_user',
    RESTRICT_DIRECT_MESSAGE_ANY: 'any',
    TIME_TO_FIRST_REVIEW: 14 * 24 * 60 * 60 * 1000, // 14 days
    TIME_TO_NEXT_REVIEW: 90 * 24 * 60 * 60 * 1000, // 90 days
};
