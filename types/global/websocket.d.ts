// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

type WebsocketConnectedState = 'not_connected' | 'connected' | 'connecting';

type NotificationEntryInfo = {serverUrl: string; channelId: string; teamId: string} | null;
