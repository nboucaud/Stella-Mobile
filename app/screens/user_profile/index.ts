// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {withDatabase} from '@nozbe/watermelondb/DatabaseProvider';
import withObservables from '@nozbe/with-observables';
import {of as of$, combineLatest} from 'rxjs';
import {map, switchMap} from 'rxjs/operators';

import {General, Permissions, Preferences} from '@constants';
import {getPreferenceAsBool} from '@helpers/api/preference';
import {observeChannel} from '@queries/servers/channel';
import {queryPreferencesByCategoryAndName} from '@queries/servers/preference';
import {observeCanManageChannelMembers, observePermissionForChannel} from '@queries/servers/role';
import {observeConfigBooleanValue, observeCurrentTeamId, observeCurrentUserId} from '@queries/servers/system';
import {observeTeammateNameDisplay, observeUser, observeUserIsChannelAdmin, observeUserIsTeamAdmin} from '@queries/servers/user';
import {isSystemAdmin} from '@utils/user';

import UserProfile from './user_profile';

import type {WithDatabaseArgs} from '@typings/database/database';

type EnhancedProps = WithDatabaseArgs & {
    userId: string;
    channelId?: string;
}

const enhanced = withObservables([], ({channelId, database, userId}: EnhancedProps) => {
    const currentUserId = observeCurrentUserId(database);
    const channel = channelId ? observeChannel(database, channelId) : of$(undefined);
    const user = observeUser(database, userId);
    const teammateDisplayName = observeTeammateNameDisplay(database);
    const isChannelAdmin = channelId ? observeUserIsChannelAdmin(database, userId, channelId) : of$(false);
    const isDefaultChannel = channel ? channel.pipe(
        switchMap((c) => of$(c?.name === General.DEFAULT_CHANNEL)),
    ) : of$(false);
    const isDirectMessage = channelId ? channel.pipe(
        switchMap((c) => of$(c?.type === General.DM_CHANNEL)),
    ) : of$(false);
    const teamId = channel.pipe(switchMap((c) => (c?.teamId ? of$(c.teamId) : observeCurrentTeamId(database))));
    const isTeamAdmin = teamId.pipe(switchMap((id) => observeUserIsTeamAdmin(database, userId, id)));
    const systemAdmin = user.pipe(switchMap((u) => of$(u?.roles ? isSystemAdmin(u.roles) : false)));
    const enablePostIconOverride = observeConfigBooleanValue(database, 'EnablePostIconOverride');
    const enablePostUsernameOverride = observeConfigBooleanValue(database, 'EnablePostUsernameOverride');
    const preferences = queryPreferencesByCategoryAndName(database, Preferences.CATEGORY_DISPLAY_SETTINGS).
        observeWithColumns(['value']);
    const isMilitaryTime = preferences.pipe(map((prefs) => getPreferenceAsBool(prefs, Preferences.CATEGORY_DISPLAY_SETTINGS, 'use_military_time', false)));
    const isCustomStatusEnabled = observeConfigBooleanValue(database, 'EnableCustomUserStatuses');

    // can remove member
    const canManageAndRemoveMembers = combineLatest([channel, user]).pipe(
        switchMap(([c, u]) => (c && u ? observeCanManageChannelMembers(database, c.id, u) : of$(false))));

    const canChangeMemberRoles = combineLatest([channel, user, canManageAndRemoveMembers]).pipe(
        switchMap(([c, u, m]) => (of$(c?.id) && of$(u) && of$(m) && observePermissionForChannel(database, c, u, Permissions.MANAGE_CHANNEL_ROLES, true))));

    return {
        canManageAndRemoveMembers,
        currentUserId,
        enablePostIconOverride,
        enablePostUsernameOverride,
        isChannelAdmin,
        isCustomStatusEnabled,
        isDefaultChannel,
        isDirectMessage,
        isMilitaryTime,
        isSystemAdmin: systemAdmin,
        isTeamAdmin,
        teamId,
        teammateDisplayName,
        user,
        canChangeMemberRoles,
    };
});

export default withDatabase(enhanced(UserProfile));

