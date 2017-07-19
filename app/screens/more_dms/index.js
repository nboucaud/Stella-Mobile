// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import {bindActionCreators} from 'redux';
import {connect} from 'react-redux';
import {createSelector} from 'reselect';

import {setChannelDisplayName} from 'app/actions/views/channel';
import {makeDirectChannel, makeGroupChannel} from 'app/actions/views/more_dms';
import {getTheme} from 'app/selectors/preferences';

import {getProfiles, getProfilesInTeam, searchProfiles} from 'mattermost-redux/actions/users';
import {General} from 'mattermost-redux/constants';
import {getConfig} from 'mattermost-redux/selectors/entities/general';
import {getTeammateNameDisplaySetting} from 'mattermost-redux/selectors/entities/preferences';
import {getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';
import {getCurrentUserId, getProfilesInCurrentTeam, getUsers} from 'mattermost-redux/selectors/entities/users';

import MoreDirectMessages from './more_dms';

function sortAndRemoveCurrentUser(profiles, currentUserId) {
    const users = {...profiles};
    Reflect.deleteProperty(users, currentUserId);
    return Object.values(users).sort((a, b) => {
        const nameA = a.username;
        const nameB = b.username;

        return nameA.localeCompare(nameB);
    });
}

const getUsersInCurrentTeamForMoreDirectMessages = createSelector(
    getProfilesInCurrentTeam,
    getCurrentUserId,
    sortAndRemoveCurrentUser
);

const getUsersForMoreDirectMessages = createSelector(
    getUsers,
    getCurrentUserId,
    sortAndRemoveCurrentUser
);

function mapStateToProps(state, ownProps) {
    const {searchProfiles: searchRequest} = state.requests.users;

    const config = getConfig(state);

    let getRequest;
    let profiles;
    if (config.RestrictDirectMessage === General.RESTRICT_DIRECT_MESSAGE_ANY) {
        getRequest = state.requests.users.getProfiles;
        profiles = getUsersForMoreDirectMessages(state);
    } else {
        getRequest = state.requests.users.getProfilesInTeam;
        profiles = getUsersInCurrentTeamForMoreDirectMessages(state);
    }

    return {
        ...ownProps,
        config,
        teammateNameDisplay: getTeammateNameDisplaySetting(state),
        profiles,
        theme: getTheme(state),
        currentDisplayName: state.views.channel.displayName,
        currentTeamId: getCurrentTeamId(state),
        currentUserId: getCurrentUserId(state),
        getRequest,
        searchRequest
    };
}

function mapDispatchToProps(dispatch) {
    return {
        actions: bindActionCreators({
            makeDirectChannel,
            makeGroupChannel,
            getProfiles,
            getProfilesInTeam,
            searchProfiles,
            setChannelDisplayName
        }, dispatch)
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(MoreDirectMessages);
