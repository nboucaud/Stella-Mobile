// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import deepEqual from 'deep-equal';
import React, {Component} from 'react';
import PropTypes from 'prop-types';
import {
    FlatList,
    Platform,
    StyleSheet,
    Text,
    TouchableHighlight,
    View
} from 'react-native';
import {injectIntl, intlShape} from 'react-intl';
import AwesomeIcon from 'react-native-vector-icons/FontAwesome';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';

import FormattedText from 'app/components/formatted_text';
import {preventDoubleTap} from 'app/utils/tap';
import {changeOpacity, makeStyleSheetFromTheme} from 'app/utils/theme';

import {General} from 'mattermost-redux/constants';

import ChannelDrawerItem from './channel_drawer_item';
import UnreadIndicator from './unread_indicator';

class ChannelDrawerList extends Component {
    static propTypes = {
        canCreatePrivateChannels: PropTypes.bool.isRequired,
        channels: PropTypes.object.isRequired,
        channelMembers: PropTypes.object,
        currentTeam: PropTypes.object.isRequired,
        currentChannel: PropTypes.object,
        intl: intlShape.isRequired,
        navigator: PropTypes.object,
        onSelectChannel: PropTypes.func.isRequired,
        theme: PropTypes.object.isRequired
    };

    static defaultProps = {
        currentTeam: {},
        currentChannel: {}
    };

    constructor(props) {
        super(props);
        this.firstUnreadChannel = null;
        this.lastUnreadChannel = null;
        this.state = {
            showAbove: false,
            showBelow: false,
            dataSource: this.buildData(props)
        };
        MaterialIcon.getImageSource('close', 20, this.props.theme.sidebarHeaderTextColor).
        then((source) => {
            this.closeButton = source;
        });
    }

    shouldComponentUpdate(nextProps, nextState) {
        return !deepEqual(this.props, nextProps, {strict: true}) || !deepEqual(this.state, nextState, {strict: true});
    }

    componentWillReceiveProps(nextProps) {
        this.setState({
            dataSource: this.buildData(nextProps)
        }, () => {
            if (this.refs.list) {
                this.refs.list.recordInteraction();
                this.updateUnreadIndicators({
                    viewableItems: Array.from(this.refs.list._listRef._viewabilityHelper._viewableItems.values()) //eslint-disable-line
                });
            }
        });
    }

    updateUnreadIndicators = ({viewableItems}) => {
        let showAbove = false;
        let showBelow = false;
        const visibleIndexes = viewableItems.map((v) => v.index);

        if (visibleIndexes.length) {
            const {dataSource} = this.state;
            const firstVisible = parseInt(visibleIndexes[0], 10);
            const lastVisible = parseInt(visibleIndexes[visibleIndexes.length - 1], 10);

            if (this.firstUnreadChannel) {
                const index = dataSource.findIndex((item) => {
                    return item.display_name === this.firstUnreadChannel;
                });
                showAbove = index < firstVisible;
            }

            if (this.lastUnreadChannel) {
                const index = dataSource.findIndex((item) => {
                    return item.display_name === this.lastUnreadChannel;
                });
                showBelow = index > lastVisible;
            }

            this.setState({
                showAbove,
                showBelow
            });
        }
    };

    onSelectChannel = (channel) => {
        this.props.onSelectChannel(channel.id);
    };

    onLayout = (event) => {
        const {width} = event.nativeEvent.layout;
        this.width = width;
    };

    getUnreadMessages = (channel) => {
        const member = this.props.channelMembers[channel.id];
        let mentions = 0;
        let unreadCount = 0;
        if (member && channel) {
            mentions = member.mention_count;
            unreadCount = channel.total_msg_count - member.msg_count;

            if (member.notify_props && member.notify_props.mark_unread === General.MENTION) {
                unreadCount = 0;
            }
        }

        return {
            mentions,
            unreadCount
        };
    };

    findUnreadChannels = (data) => {
        data.forEach((c) => {
            if (c.id) {
                const {mentions, unreadCount} = this.getUnreadMessages(c);
                const unread = (mentions + unreadCount) > 0;

                if (unread && c.id !== this.props.currentChannel.id) {
                    if (!this.firstUnreadChannel) {
                        this.firstUnreadChannel = c.display_name;
                    }
                    this.lastUnreadChannel = c.display_name;
                }
            }
        });
    };

    createChannelElement = (channel) => {
        const {mentions, unreadCount} = this.getUnreadMessages(channel);
        const msgCount = mentions + unreadCount;
        const unread = msgCount > 0;

        return (
            <ChannelDrawerItem
                ref={channel.id}
                channel={channel}
                hasUnread={unread}
                mentions={mentions}
                onSelectChannel={this.onSelectChannel}
                isActive={channel.isCurrent}
                theme={this.props.theme}
            />
        );
    };

    createPrivateChannel = () => {
        const {intl, navigator, theme} = this.props;

        navigator.showModal({
            screen: 'CreateChannel',
            animationType: 'slide-up',
            title: intl.formatMessage({id: 'mobile.create_channel.private', defaultMessage: 'New Private Channel'}),
            backButtonTitle: '',
            animated: true,
            navigatorStyle: {
                navBarTextColor: theme.sidebarHeaderTextColor,
                navBarBackgroundColor: theme.sidebarHeaderBg,
                navBarButtonColor: theme.sidebarHeaderTextColor,
                screenBackgroundColor: theme.centerChannelBg
            },
            passProps: {
                channelType: General.PRIVATE_CHANNEL,
                closeButton: this.closeButton
            }
        });
    };

    buildData = (props) => {
        const data = [];

        if (!props.currentChannel) {
            return data;
        }

        const {canCreatePrivateChannels, theme} = this.props;
        const styles = getStyleSheet(theme);

        const {
            unreadChannels,
            favoriteChannels,
            publicChannels,
            privateChannels,
            directAndGroupChannels
        } = props.channels;

        if (unreadChannels.length) {
            data.push(
                this.renderTitle(styles, 'mobile.channel_list.unreads', 'UNREADS', null, unreadChannels.length > 0),
                ...unreadChannels
            );
        }

        if (favoriteChannels.length) {
            data.push(
                this.renderTitle(styles, 'sidebar.favorite', 'FAVORITES', null, favoriteChannels.length > 0),
                ...favoriteChannels
            );
        }

        data.push(
            this.renderTitle(styles, 'sidebar.channels', 'CHANNELS', this.showMoreChannelsModal, publicChannels.length > 0),
            ...publicChannels
        );

        let createPrivateChannel;
        if (canCreatePrivateChannels) {
            createPrivateChannel = this.createPrivateChannel;
        }
        data.push(
            this.renderTitle(styles, 'sidebar.pg', 'PRIVATE CHANNELS', createPrivateChannel, privateChannels.length > 0),
            ...privateChannels
        );

        data.push(
            this.renderTitle(styles, 'sidebar.direct', 'DIRECT MESSAGES', this.showDirectMessagesModal, directAndGroupChannels.length > 0),
            ...directAndGroupChannels
        );

        this.firstUnreadChannel = null;
        this.lastUnreadChannel = null;
        this.findUnreadChannels(data);

        return data;
    };

    openSettingsModal = () => {
        const {intl, navigator, theme} = this.props;

        navigator.showModal({
            screen: 'Settings',
            title: intl.formatMessage({id: 'mobile.routes.settings', defaultMessage: 'Settings'}),
            animationType: 'slide-up',
            animated: true,
            backButtonTitle: '',
            navigatorStyle: {
                navBarTextColor: theme.sidebarHeaderTextColor,
                navBarBackgroundColor: theme.sidebarHeaderBg,
                navBarButtonColor: theme.sidebarHeaderTextColor,
                screenBackgroundColor: theme.centerChannelBg
            },
            navigatorButtons: {
                leftButtons: [{
                    id: 'close-settings',
                    icon: this.closeButton
                }]
            }
        });
    };

    showDirectMessagesModal = () => {
        const {intl, navigator, theme} = this.props;

        navigator.showModal({
            screen: 'MoreDirectMessages',
            title: intl.formatMessage({id: 'more_direct_channels.title', defaultMessage: 'Direct Messages'}),
            animationType: 'slide-up',
            animated: true,
            backButtonTitle: '',
            navigatorStyle: {
                navBarTextColor: theme.sidebarHeaderTextColor,
                navBarBackgroundColor: theme.sidebarHeaderBg,
                navBarButtonColor: theme.sidebarHeaderTextColor,
                screenBackgroundColor: theme.centerChannelBg
            },
            navigatorButtons: {
                leftButtons: [{
                    id: 'close-dms',
                    icon: this.closeButton
                }]
            }
        });
    };

    showMoreChannelsModal = () => {
        const {intl, navigator, theme} = this.props;

        navigator.showModal({
            screen: 'MoreChannels',
            animationType: 'slide-up',
            title: intl.formatMessage({id: 'more_channels.title', defaultMessage: 'More Channels'}),
            backButtonTitle: '',
            animated: true,
            navigatorStyle: {
                navBarTextColor: theme.sidebarHeaderTextColor,
                navBarBackgroundColor: theme.sidebarHeaderBg,
                navBarButtonColor: theme.sidebarHeaderTextColor,
                screenBackgroundColor: theme.centerChannelBg
            },
            passProps: {
                channelType: General.PRIVATE_CHANNEL,
                closeButton: this.closeButton
            }
        });
    };

    renderSectionAction = (styles, action) => {
        const {theme} = this.props;
        return (
            <TouchableHighlight
                style={styles.actionContainer}
                onPress={() => preventDoubleTap(action, this)}
                underlayColor={changeOpacity(theme.sidebarTextHoverBg, 0.5)}
            >
                <MaterialIcon
                    name='add'
                    style={styles.action}
                />
            </TouchableHighlight>
        );
    };

    renderDivider = (styles, marginLeft) => {
        return (
            <View
                style={[styles.divider, {marginLeft}]}
            />
        );
    };

    renderItem = ({item}) => {
        if (!item.isTitle) {
            return this.createChannelElement(item);
        }
        return item.title;
    };

    renderTitle = (styles, id, defaultMessage, action, bottomDivider) => {
        const {formatMessage} = this.props.intl;
        return {
            id,
            isTitle: true,
            title: (
                <View>
                    {this.renderDivider(styles, 0)}
                    <View style={styles.titleContainer}>
                        <Text style={styles.title}>
                            {formatMessage({id, defaultMessage}).toUpperCase()}
                        </Text>
                        {action && this.renderSectionAction(styles, action)}
                    </View>
                    {bottomDivider && this.renderDivider(styles, 16)}
                </View>
            )
        };
    };

    render() {
        if (!this.props.currentChannel) {
            return <Text>{'Loading'}</Text>;
        }

        const {theme} = this.props;
        const styles = getStyleSheet(theme);

        const settings = (
            <TouchableHighlight
                style={styles.settingsContainer}
                onPress={() => preventDoubleTap(this.openSettingsModal)}
                underlayColor={changeOpacity(theme.sidebarHeaderBg, 0.5)}
            >
                <AwesomeIcon
                    name='cog'
                    style={styles.settings}
                />
            </TouchableHighlight>
        );

        let above;
        let below;
        if (this.state.showAbove) {
            above = (
                <UnreadIndicator
                    style={[styles.above, {width: (this.width - 40)}]}
                    text={(
                        <FormattedText
                            style={styles.indicatorText}
                            id='sidebar.unreadAbove'
                            defaultMessage='Unread post(s) above'
                        />
                    )}
                />
            );
        }

        if (this.state.showBelow) {
            below = (
                <UnreadIndicator
                    style={[styles.below, {width: (this.width - 40)}]}
                    text={(
                        <FormattedText
                            style={styles.indicatorText}
                            id='sidebar.unreadBelow'
                            defaultMessage='Unread post(s) below'
                        />
                    )}
                />
            );
        }

        return (
            <View
                style={styles.container}
                onLayout={this.onLayout}
            >
                <View style={styles.statusBar}>
                    <View style={styles.headerContainer}>
                        <Text
                            ellipsizeMode='tail'
                            numberOfLines={1}
                            style={styles.header}
                        >
                            {this.props.currentTeam.display_name}
                        </Text>
                        {settings}
                    </View>
                </View>
                <FlatList
                    ref='list'
                    data={this.state.dataSource}
                    renderItem={this.renderItem}
                    keyExtractor={(item) => item.id}
                    onViewableItemsChanged={this.updateUnreadIndicators}
                    maxToRenderPerBatch={10}
                    viewabilityConfig={{
                        viewAreaCoveragePercentThreshold: 3,
                        waitForInteraction: false
                    }}
                />
                {above}
                {below}
            </View>
        );
    }
}

const getStyleSheet = makeStyleSheetFromTheme((theme) => {
    return StyleSheet.create({
        container: {
            backgroundColor: theme.sidebarBg,
            flex: 1
        },
        statusBar: {
            backgroundColor: theme.sidebarHeaderBg,
            ...Platform.select({
                ios: {
                    paddingTop: 20
                }
            })
        },
        scrollContainer: {
            flex: 1
        },
        headerContainer: {
            alignItems: 'center',
            backgroundColor: theme.sidebarHeaderBg,
            flexDirection: 'row',
            height: 44,
            paddingLeft: 16
        },
        header: {
            color: theme.sidebarHeaderTextColor,
            flex: 1,
            fontSize: 14,
            fontWeight: 'normal',
            lineHeight: 16
        },
        settingsContainer: {
            alignItems: 'center',
            height: 44,
            justifyContent: 'center',
            width: 50
        },
        settings: {
            color: theme.sidebarHeaderTextColor,
            fontSize: 18,
            fontWeight: '300'
        },
        titleContainer: {
            alignItems: 'center',
            flex: 1,
            flexDirection: 'row',
            height: 48,
            marginLeft: 16
        },
        title: {
            flex: 1,
            color: theme.sidebarText,
            opacity: 1,
            fontSize: 15,
            fontWeight: '400',
            letterSpacing: 0.8,
            lineHeight: 18
        },
        divider: {
            backgroundColor: changeOpacity(theme.sidebarText, 0.1),
            height: 1
        },
        actionContainer: {
            alignItems: 'center',
            height: 48,
            justifyContent: 'center',
            width: 50
        },
        action: {
            color: theme.sidebarText,
            fontSize: 20,
            fontWeight: '500',
            lineHeight: 18
        },
        above: {
            backgroundColor: theme.mentionBj,
            top: 79
        },
        below: {
            backgroundColor: theme.mentionBj,
            bottom: 15
        },
        indicatorText: {
            backgroundColor: 'transparent',
            color: theme.mentionColor,
            fontSize: 14,
            paddingVertical: 2,
            paddingHorizontal: 4,
            textAlign: 'center',
            textAlignVertical: 'center'
        }
    });
});

export default injectIntl(ChannelDrawerList);
