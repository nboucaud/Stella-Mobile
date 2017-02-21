// Copyright (c) 2017 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';
import {StyleSheet, View} from 'react-native';

import FormattedDate from 'app/components/formatted_date';
import {makeStyleSheetFromTheme} from 'app/utils/theme';

const getStyleSheet = makeStyleSheetFromTheme((theme) => {
    return StyleSheet.create({
        container: {
            alignItems: 'center',
            flexDirection: 'row',
            height: 28
        },
        dateContainer: {
            marginLeft: 15,
            marginRight: 15
        },
        line: {
            backgroundColor: theme.centerChannelColor,
            flex: 1,
            height: StyleSheet.hairlineWidth,
            opacity: 0.2
        },
        date: {
            color: theme.centerChannelColor,
            fontSize: 14,
            fontWeight: '600'
        }
    });
});

export default class DateHeader extends React.Component {
    static propTypes = {
        date: React.PropTypes.object.isRequired,
        theme: React.PropTypes.object.isRequired,
        style: View.propTypes.style
    };

    render() {
        const style = getStyleSheet(this.props.theme);

        return (
            <View style={[style.container, this.props.style]}>
                <View style={style.line}/>
                <View style={style.dateContainer}>
                    <FormattedDate
                        style={style.date}
                        value={this.props.date}
                        weekday='short'
                        day='2-digit'
                        month='short'
                        year='numeric'
                    />
                </View>
                <View style={style.line}/>
            </View>
        );
    }
}
