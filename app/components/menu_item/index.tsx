// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {ReactNode} from 'react';
import {Platform, StyleProp, View, ViewStyle} from 'react-native';

import CompassIcon from '@components/compass_icon';
import FormattedText from '@components/formatted_text';
import TouchableWithFeedback from '@components/touchable_with_feedback';
import {changeOpacity, makeStyleSheetFromTheme} from '@utils/theme';

export const ITEM_HEIGHT = 50;

type MenuItemProps = {
    centered?: boolean;
    defaultMessage?: string;
    i18nId?: string;
    iconContainerStyle?: StyleProp<ViewStyle>;
    iconName?: string;
    innerContainerStyle?: StyleProp<ViewStyle>;
    isDestructor?: boolean;
    labelComponent?: ReactNode;
    leftComponent?: ReactNode;
    messageValues?: Record<string, any>;
    onPress: () => void;
    separator?: boolean;
    showArrow?: boolean;
    testID: string;
    theme: Theme;
};

const getStyleSheet = makeStyleSheetFromTheme((theme) => {
    return {
        container: {
            flexDirection: 'row',
            minHeight: ITEM_HEIGHT,
        },
        iconContainer: {
            width: 45,
            height: ITEM_HEIGHT,
            alignItems: 'center',
            justifyContent: 'center',
            marginLeft: 5,
        },
        icon: {
            color: changeOpacity(theme.centerChannelColor, 0.64),
            fontSize: 24,
        },
        labelContainer: {
            flex: 1,
            justifyContent: 'center',
            paddingVertical: 14,
        },
        centerLabel: {
            textAlign: 'center',
            textAlignVertical: 'center',
        },
        label: {
            color: changeOpacity(theme.centerChannelColor, 0.5),
            fontSize: 17,
            textAlignVertical: 'center',
            includeFontPadding: false,
        },
        divider: {
            backgroundColor: changeOpacity(theme.centerChannelColor, 0.2),
            height: 1,
        },
        chevron: {
            alignSelf: 'center',
            color: changeOpacity(theme.centerChannelColor, 0.64),
            fontSize: 24,
        },
    };
});

const MenuItem = (props: MenuItemProps) => {
    const {
        centered,
        defaultMessage = '',
        i18nId,
        iconContainerStyle,
        iconName,
        isDestructor = false,
        labelComponent,
        leftComponent,
        onPress,
        separator = true,
        testID,
        theme,
        showArrow = false,
        innerContainerStyle,
        messageValues,
    } = props;

    const style = getStyleSheet(theme);

    const destructor: any = {};
    if (isDestructor) {
        destructor.color = theme.errorTextColor;
    }

    let icon;
    if (leftComponent) {
        icon = leftComponent;
    } else if (iconName) {
        icon = (
            <CompassIcon
                name={iconName}
                style={[style.icon, destructor]}
            />
        );
    }

    let label;
    if (labelComponent) {
        label = labelComponent;
    } else if (i18nId) {
        label = (
            <FormattedText
                id={i18nId}
                defaultMessage={defaultMessage}
                style={[
                    style.label,
                    destructor,
                    centered ? style.centerLabel : {},
                ]}
                values={messageValues}
            />
        );
    }

    return (
        <TouchableWithFeedback
            testID={testID}
            onPress={onPress}
            underlayColor={changeOpacity(theme.centerChannelColor, Platform.select({android: 0.1, ios: 0.3}) || 0.3)}
        >
            <View style={{flexDirection: 'column'}}>
                <View style={[style.container, innerContainerStyle]}>
                    {icon && (
                        <View style={[style.iconContainer, iconContainerStyle]}>
                            {icon}
                        </View>
                    )}
                    <View style={style.labelContainer}>
                        {label}
                    </View>
                    {Boolean(showArrow) && (
                        <CompassIcon
                            name='chevron-right'
                            style={style.chevron}
                        />
                    )}
                </View>
                {Boolean(separator) && (<View style={style.divider}/>)}
            </View>
        </TouchableWithFeedback>
    );
};

export default MenuItem;
