// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {PureComponent} from 'react';
import PropTypes from 'prop-types';
import {intlShape} from 'react-intl';
import {
    Keyboard,
    FlatList,
    StyleSheet,
    View,
} from 'react-native';
import {Navigation} from 'react-native-navigation';

import {dismissModal, goToScreen, showSearchModal} from '@actions/navigation';
import ChannelLoader from '@components/channel_loader';
import DateHeader from '@components/post_list/date_header';
import FailedNetworkAction from '@components/failed_network_action';
import NoResults from '@components/no_results';
import PostSeparator from '@components/post_separator';
import StatusBar from '@components/status_bar';
import {isDateLine, getDateForDateLine} from '@mm-redux/utils/post_list';
import SearchResultPost from '@screens/search/search_result_post';
import ChannelDisplayName from '@screens/search/channel_display_name';
import mattermostManaged from 'app/mattermost_managed';

export default class RecentMentions extends PureComponent {
    static propTypes = {
        actions: PropTypes.shape({
            clearSearch: PropTypes.func.isRequired,
            getPostThread: PropTypes.func.isRequired,
            getRecentMentions: PropTypes.func.isRequired,
            selectPost: PropTypes.func.isRequired,
            showPermalink: PropTypes.func.isRequired,
        }).isRequired,
        postIds: PropTypes.array,
        theme: PropTypes.object.isRequired,
    };

    static defaultProps = {
        postIds: [],
    };

    static contextTypes = {
        intl: intlShape.isRequired,
    };

    constructor(props) {
        super(props);

        props.actions.clearSearch();
        this.state = {
            didFail: false,
            isLoading: false,
        };
    }

    getRecentMentions = async () => {
        const {actions} = this.props;

        this.setState({isLoading: true});
        const {error} = await actions.getRecentMentions();

        this.setState({
            isLoading: false,
            didFail: Boolean(error),
        });
    }

    componentDidMount() {
        this.navigationEventListener = Navigation.events().bindComponent(this);

        this.getRecentMentions();
    }

    setListRef = (ref) => {
        this.listRef = ref;
    }

    goToThread = (post) => {
        const {actions} = this.props;
        const channelId = post.channel_id;
        const rootId = (post.root_id || post.id);
        const screen = 'Thread';
        const title = '';
        const passProps = {
            channelId,
            rootId,
        };

        Keyboard.dismiss();
        actions.getPostThread(rootId);
        actions.selectPost(rootId);
        goToScreen(screen, title, passProps);
    };

    handlePermalinkPress = (postId, teamName) => {
        this.props.actions.showPermalink(this.context.intl, teamName, postId);
    };

    handleHashtagPress = async (hashtag) => {
        await dismissModal();
        showSearchModal('#' + hashtag);
    };

    keyExtractor = (item) => item;

    navigationButtonPressed({buttonId}) {
        if (buttonId === 'close-settings') {
            dismissModal();
        }
    }

    previewPost = (post) => {
        this.props.actions.showPermalink(this.context.intl, '', post.id, false);
    };

    renderEmpty = () => {
        const {formatMessage} = this.context.intl;
        const {theme} = this.props;

        return (
            <NoResults
                description={formatMessage({
                    id: 'mobile.recent_mentions.empty_description',
                    defaultMessage: 'Messages where someone mentions you or includes your trigger words are saved here.',
                })}
                iconName='at'
                title={formatMessage({id: 'mobile.recent_mentions.empty_title', defaultMessage: 'No Mentions yet'})}
                theme={theme}
            />
        );
    };

    renderPost = ({item, index}) => {
        const {postIds, theme} = this.props;

        if (isDateLine(item)) {
            return (
                <DateHeader
                    date={getDateForDateLine(item)}
                    index={index}
                />
            );
        }

        let separator;
        const nextPost = postIds[index + 1];
        if (nextPost && !isDateLine(nextPost)) {
            separator = <PostSeparator theme={theme}/>;
        }

        return (
            <View>
                <ChannelDisplayName postId={item}/>
                <SearchResultPost
                    postId={item}
                    previewPost={this.previewPost}
                    goToThread={this.goToThread}
                    onHashtagPress={this.handleHashtagPress}
                    onPermalinkPress={this.handlePermalinkPress}
                    managedConfig={mattermostManaged.getCachedConfig()}
                    showFullDate={false}
                    skipPinnedHeader={true}
                />
                {separator}
            </View>
        );
    };

    retry = () => {
        this.getRecentMentions();
    };

    render() {
        const {postIds, theme} = this.props;
        const {didFail, isLoading} = this.state;

        let component;
        if (didFail) {
            component = (
                <FailedNetworkAction
                    onRetry={this.retry}
                    theme={theme}
                />
            );
        } else if (isLoading) {
            component = (
                <ChannelLoader channelIsLoading={true}/>
            );
        } else if (postIds.length) {
            component = (
                <FlatList
                    ref={this.setListRef}
                    contentContainerStyle={style.sectionList}
                    data={postIds}
                    keyExtractor={this.keyExtractor}
                    keyboardShouldPersistTaps='always'
                    keyboardDismissMode='interactive'
                    renderItem={this.renderPost}
                />
            );
        } else {
            component = this.renderEmpty();
        }

        return (
            <View
                testID='recent_mentions.screen'
                style={style.container}
            >
                <StatusBar/>
                {component}
            </View>
        );
    }
}

const style = StyleSheet.create({
    container: {
        flex: 1,
    },
});
