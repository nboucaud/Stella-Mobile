// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {withDatabase} from '@nozbe/watermelondb/DatabaseProvider';
import withObservables from '@nozbe/with-observables';
import {combineLatest, of as of$, from as from$} from 'rxjs';
import {switchMap} from 'rxjs/operators';

import {General, Permissions} from '@constants';
import {MM_TABLES, SYSTEM_IDENTIFIERS} from '@constants/database';
import {MAX_MESSAGE_LENGTH_FALLBACK} from '@constants/post_draft';
import {hasPermissionForChannel} from '@utils/role';

import SendHandler from './send_handler';

import type {WithDatabaseArgs} from '@typings/database/database';
import type ChannelModel from '@typings/database/models/servers/channel';
import type SystemModel from '@typings/database/models/servers/system';
import type UserModel from '@typings/database/models/servers/user';

const {SERVER: {SYSTEM, USER, CHANNEL}} = MM_TABLES;

type OwnProps = {
    rootId: string;
    channelId: string;
    channelIsArchived?: boolean;
}

const enhanced = withObservables([], (ownProps: WithDatabaseArgs & OwnProps) => {
    const database = ownProps.database;
    const {rootId, channelId} = ownProps;
    let channel;
    if (rootId) {
        channel = database.get<ChannelModel>(CHANNEL).findAndObserve(channelId);
    } else {
        channel = database.get<SystemModel>(SYSTEM).findAndObserve(SYSTEM_IDENTIFIERS.CURRENT_CHANNEL_ID).pipe(
            switchMap((t) => database.get<ChannelModel>(CHANNEL).findAndObserve(t.value)),
        );
    }

    const currentUserId = database.get<SystemModel>(SYSTEM).findAndObserve(SYSTEM_IDENTIFIERS.CURRENT_USER_ID).pipe(
        switchMap(({value}) => of$(value)),
    );
    const currentUser = currentUserId.pipe(
        switchMap((id) => database.get<UserModel>(USER).findAndObserve(id)),
    );
    const userIsOutOfOffice = currentUser.pipe(
        switchMap((u) => of$(u.status === General.OUT_OF_OFFICE)),
    );

    const config = database.get<SystemModel>(SYSTEM).findAndObserve(SYSTEM_IDENTIFIERS.CONFIG).pipe(
        switchMap(({value}) => of$(value as ClientConfig)),
    );
    const enableConfirmNotificationsToChannel = config.pipe(
        switchMap((cfg) => of$(Boolean(cfg.EnableConfirmNotificationsToChannel === 'true'))),
    );
    const isTimezoneEnabled = config.pipe(
        switchMap((cfg) => of$(Boolean(cfg.ExperimentalTimezone === 'true'))),
    );
    const maxMessageLength = config.pipe(
        switchMap((cfg) => of$(parseInt(cfg.MaxPostSize || '0', 10) || MAX_MESSAGE_LENGTH_FALLBACK)),
    );

    const useChannelMentions = combineLatest([channel, currentUser]).pipe(
        switchMap(([c, u]) => {
            if (!c) {
                return of$(true);
            }

            // TODO: Check if this doesn't update in case of a role change
            return from$(hasPermissionForChannel(c, u, Permissions.USE_CHANNEL_MENTIONS, false));
        }),
    );

    const license = database.get<SystemModel>(SYSTEM).findAndObserve(SYSTEM_IDENTIFIERS.LICENSE).pipe(
        switchMap(({value}) => of$(value as ClientLicense)),
    );

    const useGroupMentions = combineLatest([channel, currentUser, license]).pipe(
        switchMap(([c, u, l]) => {
            if (!c || l?.IsLicensed !== 'true') {
                return of$(false);
            }

            // TODO: Check if this doesn't update in case of a role change
            return from$(hasPermissionForChannel(c, u, Permissions.USE_GROUP_MENTIONS, true));
        }),
    );

    // TODO
    const groupsWithAllowReference = combineLatest([useGroupMentions, channel]).pipe(
        switchMap(([gm, c]) => {
            if (!c || !gm) {
                return of$([]);
            }
            return of$([]);
        }),
    );

    const membersCount = channel.pipe(
        switchMap((c) => {
            if (!c) {
                return of$(0);
            }
            return from$(c.members.fetchCount());
        }),
    );

    return {
        currentUserId,
        enableConfirmNotificationsToChannel,
        isTimezoneEnabled,
        maxMessageLength,
        membersCount,
        userIsOutOfOffice,
        useChannelMentions,
        useGroupMentions,
        groupsWithAllowReference,
    };
});

export default withDatabase(enhanced(SendHandler));
