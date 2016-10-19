// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React, {Component, PropTypes} from 'react';
import {TouchableHighlight, Text} from 'react-native';
import * as logoutActions from 'actions/logout';
import {bindActionCreators} from 'redux';
import {connect} from 'react-redux';
import {Actions as Routes} from 'react-native-router-flux';

const propTypes = {
    logout: PropTypes.object.isRequired,
    actions: PropTypes.object.isRequired
};

class Logout extends Component {
    static propTypes = propTypes;
    logout() {
        this.props.actions.logout();
    }

    componentWillReceiveProps(props) {
        if (this.props.logout.status === 'fetching' &&
          props.logout.status === 'fetched') {
            Routes.goToLogin();
            Routes.pop();
        }
    }

    render() {
        return (
            <TouchableHighlight
                onPress={(() => {
                    this.logout();
                })}
            >
                <Text>{'logout'}</Text>
            </TouchableHighlight>
        );
    }
}

function mapStateToProps(state) {
    return {
        logout: state.views.logout
    };
}

function mapDispatchToProps(dispatch) {
    return {
        actions: bindActionCreators(logoutActions, dispatch)
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(Logout);
