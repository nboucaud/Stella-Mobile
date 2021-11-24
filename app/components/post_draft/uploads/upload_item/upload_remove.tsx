// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {View, Platform} from 'react-native';

import {useTheme} from '@app/context/theme';
import CompassIcon from '@components/compass_icon';
import TouchableWithFeedback from '@components/touchable_with_feedback';
import {makeStyleSheetFromTheme, changeOpacity} from '@utils/theme';

type Props = {
    onPress: () => void;
}

export default function UploadRemove({
    onPress,
}: Props) {
    const theme = useTheme();
    const style = getStyleSheet(theme);

    return (
        <TouchableWithFeedback
            style={style.tappableContainer}
            onPress={onPress}
            type={'opacity'}
        >
            <View style={style.removeButton}>
                <CompassIcon
                    name='close-circle'
                    color={changeOpacity(theme.centerChannelColor, 0.64)}
                    size={24}
                    style={style.removeIcon}
                />
            </View>
        </TouchableWithFeedback>
    );
}

const getStyleSheet = makeStyleSheetFromTheme((theme) => {
    return {
        tappableContainer: {
            position: 'absolute',
            elevation: 11,
            top: -7,
            right: -8,
            width: 24,
            height: 24,
        },
        removeButton: {
            borderRadius: 12,
            alignSelf: 'center',
            marginTop: Platform.select({
                ios: 5.4,
                android: 4.75,
            }),
            backgroundColor: theme.centerChannelBg,
            width: 24,
            height: 25,
        },
    };
});
