// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {withDatabase} from '@nozbe/watermelondb/DatabaseProvider';
import withObservables from '@nozbe/with-observables';
import React from 'react';
import {of as of$} from 'rxjs';
import {switchMap, distinctUntilChanged} from 'rxjs/operators';

import {General} from '@constants';
import {observeMyChannel} from '@queries/servers/channel';
import {queryDraft} from '@queries/servers/drafts';
import {observeCurrentChannelId, observeCurrentUserId} from '@queries/servers/system';
import ChannelModel from '@typings/database/models/servers/channel';
import MyChannelModel from '@typings/database/models/servers/my_channel';

import ChannelItem from './channel_item';

import type {WithDatabaseArgs} from '@typings/database/database';

type EnhanceProps = WithDatabaseArgs & {
    channel: ChannelModel;
    showTeamName?: boolean;
    isCategoryMuted?: boolean;
}

const observeIsMutedSetting = (mc: MyChannelModel) => mc.settings.observe().pipe(switchMap((s) => of$(s?.notifyProps?.mark_unread === 'mention')));

const enhance = withObservables(['showTeamName', 'isCategoryMuted'], ({channel, database, showTeamName, isCategoryMuted}: EnhanceProps) => {
    const currentUserId = observeCurrentUserId(database);
    const myChannel = observeMyChannel(database, channel.id);

    const hasDraft = queryDraft(database, channel.id).observeWithColumns(['message', 'files']).pipe(
        switchMap((draft) => of$(draft.length > 0)),
        distinctUntilChanged(),
    );

    const isActive = observeCurrentChannelId(database).pipe(
        switchMap((id) => of$(id ? id === channel.id : false)),
        distinctUntilChanged(),
    );

    const isMuted = myChannel.pipe(
        switchMap((mc) => {
            if (!mc) {
                return of$(false);
            }
            return observeIsMutedSetting(mc);
        }),
        switchMap((muted) => of$(isCategoryMuted || muted)),
    );

    let teamDisplayName = of$('');
    if (channel.teamId && showTeamName) {
        teamDisplayName = channel.team.observe().pipe(
            switchMap((team) => of$(team?.displayName || '')),
            distinctUntilChanged(),
        );
    }

    let membersCount = of$(0);
    if (channel.type === General.GM_CHANNEL) {
        membersCount = channel.members.observeCount();
    }

    const isUnread = myChannel.pipe(
        switchMap((mc) => of$(mc?.isUnread)),
        distinctUntilChanged(),
    );

    const mentionsCount = myChannel.pipe(
        switchMap((mc) => of$(mc?.mentionsCount)),
        distinctUntilChanged(),
    );

    return {
        currentUserId,
        hasDraft,
        isActive,
        isMuted,
        membersCount,
        isUnread,
        mentionsCount,
        teamDisplayName,
    };
});

export default React.memo(withDatabase(enhance(ChannelItem)));
