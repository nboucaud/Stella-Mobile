// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import {
    Alert,
} from 'react-native';
import {toTitleCase} from 'app/utils/general';

export function confirmOutOfOfficeDisabled(intl, status, updateStatus) {
    const userStatusId = 'modal.manual_status.auto_responder.message_' + status;

    let translatedStatus;
    if (status === 'dnd') {
        translatedStatus = intl.formatMessage({
            id: 'mobile.set_status.dnd',
            defaultMessage: 'Do Not Disturb',
        });
    } else {
        translatedStatus = intl.formatMessage({
            id: `mobile.set_status.${status}`,
            defaultMessage: toTitleCase(status),
        });
    }

    Alert.alert(
        intl.formatMessage({
            id: 'mobile.reset_status.title_ooo',
            defaultMessage: 'Disable "Out Of Office"?',
        }),
        intl.formatMessage({
            id: userStatusId,
            defaultMessage: 'Would you like to switch your status to "{status}" and disable Automatic Replies?',
        }, {status: translatedStatus}),
        [{
            text: intl.formatMessage({id: 'mobile.reset_status.alert_cancel', defaultMessage: 'Cancel'}),
        }, {
            text: intl.formatMessage({id: 'mobile.reset_status.alert_ok', defaultMessage: 'OK'}),
            onPress: () => updateStatus(status),
        }],
    );
}
