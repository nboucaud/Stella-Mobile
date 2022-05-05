// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {withDatabase} from '@nozbe/watermelondb/DatabaseProvider';
import withObservables from '@nozbe/with-observables';

import {queryAllMyChannel} from '@queries/servers/channel';
import {observeCurrentTeamId} from '@queries/servers/system';
import {queryMyTeams} from '@queries/servers/team';
import {observeIsCRTEnabled} from '@queries/servers/thread';

import ChannelsList from './channel_list';

import type {WithDatabaseArgs} from '@typings/database/database';

const enhanced = withObservables([], ({database}: WithDatabaseArgs) => ({
    currentTeamId: observeCurrentTeamId(database),
    isCRTEnabled: observeIsCRTEnabled(database),
    teamsCount: queryMyTeams(database).observeCount(false),
    channelsCount: queryAllMyChannel(database).observeCount(),
}));

export default withDatabase(enhanced(ChannelsList));
