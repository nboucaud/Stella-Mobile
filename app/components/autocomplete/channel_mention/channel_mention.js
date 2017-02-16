// Copyright (c) 2017 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React, {Component, PropTypes} from 'react';
import {
    ListView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';

import FormattedText from 'app/components/formatted_text';
import {makeStyleSheetFromTheme, changeOpacity} from 'app/utils/theme';

import {RequestStatus} from 'service/constants';

const CHANNEL_MENTION_REGEX = /\B(~([^~\r\n]*))$/i;

const getStyleFromTheme = makeStyleSheetFromTheme((theme) => {
    return StyleSheet.create({
        section: {
            justifyContent: 'center',
            paddingLeft: 8,
            backgroundColor: changeOpacity(theme.centerChannelColor, 0.1),
            borderTopWidth: 1,
            borderTopColor: changeOpacity(theme.centerChannelColor, 0.2)
        },
        sectionText: {
            fontSize: 12,
            color: changeOpacity(theme.centerChannelColor, 0.7),
            paddingVertical: 7
        },
        sectionWrapper: {
            backgroundColor: theme.centerChannelBg
        },
        listView: {
            flex: 1,
            backgroundColor: theme.centerChannelBg,
            borderWidth: 1,
            borderColor: changeOpacity(theme.centerChannelColor, 0.2),
            borderTopWidth: 0,
            borderBottomWidth: 0
        },
        loading: {
            alignItems: 'center',
            justifyContent: 'center',
            paddingVertical: 20,
            backgroundColor: theme.centerChannelBg,
            borderWidth: 1,
            borderColor: changeOpacity(theme.centerChannelColor, 0.2),
            borderBottomWidth: 0
        },
        row: {
            padding: 8,
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: theme.centerChannelBg,
            borderTopWidth: 1,
            borderTopColor: changeOpacity(theme.centerChannelColor, 0.2)
        },
        rowDisplayName: {
            fontSize: 13,
            color: theme.centerChannelColor
        },
        rowName: {
            color: theme.centerChannelColor,
            opacity: 0.6
        }
    });
});

export default class AtMention extends Component {
    static propTypes = {
        currentChannelId: PropTypes.string.isRequired,
        currentTeamId: PropTypes.string.isRequired,
        cursorPosition: PropTypes.number.isRequired,
        autocompleteChannels: PropTypes.object.isRequired,
        postDraft: PropTypes.string,
        requestStatus: PropTypes.string.isRequired,
        theme: PropTypes.object.isRequired,
        actions: PropTypes.shape({
            changePostDraft: PropTypes.func.isRequired,
            autocompleteChannels: PropTypes.func.isRequired
        })
    }

    static defaultProps = {
        postDraft: ''
    }

    constructor(props) {
        super(props);

        const ds = new ListView.DataSource({
            sectionHeaderHasChanged: (s1, s2) => s1 !== s2,
            rowHasChanged: (r1, r2) => r1 !== r2
        });

        this.state = {
            active: false,
            dataSource: ds.cloneWithRowsAndSections(props.autocompleteChannels)
        };
    }

    componentWillReceiveProps(nextProps) {
        const match = nextProps.postDraft.substring(0, nextProps.cursorPosition).match(CHANNEL_MENTION_REGEX);

        // If not match or if user clicked on a mention
        if (!match || this.state.mentionComplete) {
            const nextState = {
                active: false,
                mentionComplete: false
            };

            // Handle the case where the user typed a ~ first and then backspaced
            if (!nextProps.postDraft.length) {
                nextState.matchTerm = null;
            }

            this.setState(nextState);
            return;
        }

        const matchTerm = match[2];
        const myChannels = nextProps.autocompleteChannels.myChannels;
        const otherChannels = nextProps.autocompleteChannels.otherChannels;

        // Show loading indicator on first pull for channels
        if (nextProps.requestStatus === RequestStatus.STARTED && ((myChannels.length === 0 && otherChannels.length === 0) || matchTerm === '')) {
            this.setState({
                active: true,
                loading: true
            });
            return;
        }

        // Still matching the same term that didn't return any results
        if (match[0].startsWith(`~${this.state.matchTerm}`) && (myChannels.length === 0 && otherChannels.length === 0)) {
            this.setState({
                active: false
            });
            return;
        }

        if (matchTerm !== this.state.matchTerm) {
            this.setState({
                matchTerm
            });

            const {currentTeamId} = this.props;
            this.props.actions.autocompleteChannels(currentTeamId, matchTerm);
            return;
        }

        if (nextProps.requestStatus !== RequestStatus.STARTED && this.props.autocompleteChannels !== nextProps.autocompleteChannels) {
            let data = {};
            if (myChannels.length > 0) {
                data = Object.assign({}, data, {myChannels});
            }
            if (otherChannels.length > 0) {
                data = Object.assign({}, data, {otherChannels});
            }

            this.setState({
                active: true,
                loading: false,
                dataSource: this.state.dataSource.cloneWithRowsAndSections(data)
            });
        }
    }

    completeMention = (mention) => {
        const mentionPart = this.props.postDraft.substring(0, this.props.cursorPosition);

        let completedDraft = mentionPart.replace(CHANNEL_MENTION_REGEX, `~${mention} `);
        if (this.props.postDraft.length > this.props.cursorPosition) {
            completedDraft += this.props.postDraft.substring(this.props.cursorPosition);
        }

        this.props.actions.changePostDraft(this.props.currentChannelId, completedDraft);
        this.setState({
            active: false,
            mentionComplete: true,
            matchTerm: `${mention} `
        });
    }

    renderSectionHeader = (sectionData, sectionId) => {
        const style = getStyleFromTheme(this.props.theme);

        const localization = {
            myChannels: {
                id: 'suggestion.mention.channels',
                defaultMessage: 'My Channels'
            },
            otherChannels: {
                id: 'suggestion.mention.morechannels',
                defaultMessage: 'Other Channels'
            }
        };

        return (
            <View style={style.sectionWrapper}>
                <View style={style.section}>
                    <FormattedText
                        id={localization[sectionId].id}
                        defaultMessage={localization[sectionId].defaultMessage}
                        style={style.sectionText}
                    />
                </View>
            </View>
        );
    }

    renderRow = (data) => {
        const style = getStyleFromTheme(this.props.theme);

        return (
            <TouchableOpacity
                onPress={() => this.completeMention(data.name)}
                style={style.row}
            >
                <Text style={style.rowDisplayName}>{data.display_name}</Text>
                <Text style={style.rowName}>{` (~${data.name})`}</Text>
            </TouchableOpacity>
        );
    }

    render() {
        if (!this.state.active) {
            // If we are not in an active state return null so nothing is rendered
            // other components are not blocked.
            return null;
        }

        const {requestStatus, theme} = this.props;

        const style = getStyleFromTheme(theme);

        if (this.state.loading && requestStatus === RequestStatus.STARTED) {
            return (
                <View style={style.loading}>
                    <FormattedText
                        id='analytics.chart.loading": "Loading...'
                        defaultMessage='Loading...'
                        style={style.sectionText}
                    />
                </View>
            );
        }

        return (
            <ListView
                keyboardShouldPersistTaps='always'
                style={style.listView}
                enableEmptySections={true}
                dataSource={this.state.dataSource}
                renderSectionHeader={this.renderSectionHeader}
                renderRow={this.renderRow}
                pageSize={10}
                initialListSize={10}
            />
        );
    }
}
