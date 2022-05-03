// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {ReactNode, useMemo, useRef} from 'react';
import {useIntl} from 'react-intl';
import {Keyboard, Platform, StyleProp, View, ViewStyle, TouchableHighlight} from 'react-native';

import {removePost} from '@actions/local/post';
import {showPermalink} from '@actions/remote/permalink';
import {fetchAndSwitchToThread} from '@actions/remote/thread';
import SystemAvatar from '@components/system_avatar';
import SystemHeader from '@components/system_header';
import * as Screens from '@constants/screens';
import {useServerUrl} from '@context/server';
import {useTheme} from '@context/theme';
import {useIsTablet} from '@hooks/device';
import {bottomSheetModalOptions, showModal, showModalOverCurrentContext} from '@screens/navigation';
import {fromAutoResponder, isFromWebhook, isPostPendingOrFailed, isSystemMessage} from '@utils/post';
import {preventDoubleTap} from '@utils/tap';
import {changeOpacity, makeStyleSheetFromTheme} from '@utils/theme';

import Avatar from './avatar';
import Body from './body';
import Footer from './footer';
import Header from './header';
import PreHeader from './pre_header';
import SystemMessage from './system_message';
import UnreadDot from './unread_dot';

import type PostModel from '@typings/database/models/servers/post';
import type ThreadModel from '@typings/database/models/servers/thread';
import type UserModel from '@typings/database/models/servers/user';

type PostProps = {
    appsEnabled: boolean;
    canDelete: boolean;
    currentUser: UserModel;
    differentThreadSequence: boolean;
    filesCount: number;
    hasReplies: boolean;
    highlight?: boolean;
    highlightPinnedOrSaved?: boolean;
    highlightReplyBar: boolean;
    isConsecutivePost?: boolean;
    isCRTEnabled?: boolean;
    isEphemeral: boolean;
    isFirstReply?: boolean;
    isSaved?: boolean;
    isJumboEmoji: boolean;
    isLastReply?: boolean;
    isPostAddChannelMember: boolean;
    location: string;
    post: PostModel;
    previousPost?: PostModel;
    reactionsCount: number;
    shouldRenderReplyButton?: boolean;
    showAddReaction?: boolean;
    skipSavedHeader?: boolean;
    skipPinnedHeader?: boolean;
    style?: StyleProp<ViewStyle>;
    testID?: string;
    thread?: ThreadModel;
};

const TIME_TO_FAIL = 10000;

const getStyleSheet = makeStyleSheetFromTheme((theme: Theme) => {
    return {
        consecutive: {marginTop: 0},
        consecutivePostContainer: {
            marginBottom: 10,
            marginRight: 10,
            marginLeft: Platform.select({ios: 34, android: 33}),
            marginTop: 10,
        },
        container: {flexDirection: 'row'},
        highlight: {backgroundColor: changeOpacity(theme.mentionHighlightBg, 0.5)},
        highlightBar: {
            backgroundColor: theme.mentionHighlightBg,
            opacity: 1,
        },
        highlightPinnedOrSaved: {
            backgroundColor: changeOpacity(theme.mentionHighlightBg, 0.2),
        },
        pendingPost: {opacity: 0.5},
        postStyle: {
            overflow: 'hidden',
            flex: 1,
            paddingHorizontal: 20,
        },
        profilePictureContainer: {
            marginBottom: 5,
            marginRight: 10,
            marginTop: 10,
        },
        rightColumn: {
            flex: 1,
            flexDirection: 'column',
        },
        rightColumnPadding: {paddingBottom: 3},
        touchableContainer: {marginHorizontal: -20, paddingHorizontal: 20},
    };
});

const Post = ({
    appsEnabled, canDelete, currentUser, differentThreadSequence, filesCount, hasReplies, highlight, highlightPinnedOrSaved = true, highlightReplyBar,
    isCRTEnabled, isConsecutivePost, isEphemeral, isFirstReply, isSaved, isJumboEmoji, isLastReply, isPostAddChannelMember,
    location, post, reactionsCount, shouldRenderReplyButton, skipSavedHeader, skipPinnedHeader, showAddReaction = true, style,
    testID, thread, previousPost,
}: PostProps) => {
    const pressDetected = useRef(false);
    const intl = useIntl();
    const serverUrl = useServerUrl();
    const theme = useTheme();
    const isTablet = useIsTablet();
    const styles = getStyleSheet(theme);
    const isAutoResponder = fromAutoResponder(post);
    const isPendingOrFailed = isPostPendingOrFailed(post);
    const isFailed = post.props?.failed || ((post.pendingPostId === post.id) && (Date.now() > post.createAt + TIME_TO_FAIL));
    const isSystemPost = isSystemMessage(post);
    const isWebHook = isFromWebhook(post);
    const hasSameRoot = useMemo(() => {
        if (isFirstReply) {
            return false;
        } else if (!post.rootId && !previousPost?.rootId && isConsecutivePost) {
            return true;
        } else if (post.rootId) {
            return true;
        }

        return false;
    }, [isConsecutivePost, post, previousPost, isFirstReply]);

    const handlePress = preventDoubleTap(() => {
        pressDetected.current = true;

        if (post) {
            if (location === Screens.THREAD) {
                Keyboard.dismiss();
            } else if ([Screens.SAVED_POSTS, Screens.MENTIONS, Screens.SEARCH].includes(location)) {
                showPermalink(serverUrl, '', post.id, intl);
                return;
            }

            const isValidSystemMessage = isAutoResponder || !isSystemPost;
            if (post.deleteAt === 0 && isValidSystemMessage && !isPendingOrFailed) {
                if ([Screens.CHANNEL, Screens.PERMALINK].includes(location)) {
                    const rootId = post.rootId || post.id;
                    fetchAndSwitchToThread(serverUrl, rootId);
                }
            } else if ((isEphemeral || post.deleteAt > 0)) {
                removePost(serverUrl, post);
            }

            const pressTimeout = setTimeout(() => {
                pressDetected.current = false;
                clearTimeout(pressTimeout);
            }, 300);
        }
    });

    const showPostOptions = () => {
        if (!post) {
            return;
        }

        const hasBeenDeleted = (post.deleteAt !== 0);
        if (isSystemPost && (!canDelete || hasBeenDeleted)) {
            return;
        }

        if (isPendingOrFailed || isEphemeral) {
            return;
        }

        Keyboard.dismiss();
        const passProps = {location, post, showAddReaction};
        const title = isTablet ? intl.formatMessage({id: 'post.options.title', defaultMessage: 'Options'}) : '';

        if (isTablet) {
            showModal(Screens.POST_OPTIONS, title, passProps, bottomSheetModalOptions(theme, 'close-post-options'));
        } else {
            showModalOverCurrentContext(Screens.POST_OPTIONS, passProps, bottomSheetModalOptions(theme));
        }
    };

    const highlightSaved = isSaved && !skipSavedHeader;
    const hightlightPinned = post.isPinned && !skipPinnedHeader;
    const itemTestID = `${testID}.${post.id}`;
    const rightColumnStyle = [styles.rightColumn, (post.rootId && isLastReply && styles.rightColumnPadding)];
    const failedPostStyle: StyleProp<ViewStyle> | undefined = isFailed ? styles.pendingPost : undefined;

    let highlightedStyle: StyleProp<ViewStyle>;
    if (highlight) {
        highlightedStyle = styles.highlight;
    } else if ((highlightSaved || hightlightPinned) && highlightPinnedOrSaved) {
        highlightedStyle = styles.highlightPinnedOrSaved;
    }

    let header: ReactNode;
    let postAvatar: ReactNode;
    let consecutiveStyle: StyleProp<ViewStyle>;
    const sameSecuence = hasReplies ? (hasReplies && post.rootId) : !post.rootId;
    if (hasSameRoot && isConsecutivePost && sameSecuence) {
        consecutiveStyle = styles.consective;
        postAvatar = <View style={styles.consecutivePostContainer}/>;
    } else {
        postAvatar = (
            <View style={[styles.profilePictureContainer, failedPostStyle]}>
                {(isAutoResponder || isSystemPost) ? (
                    <SystemAvatar theme={theme}/>
                ) : (
                    <Avatar
                        isAutoReponse={isAutoResponder}
                        post={post}
                    />
                )}
            </View>
        );

        if (isSystemPost && !isAutoResponder) {
            header = (
                <SystemHeader
                    createAt={post.createAt}
                    theme={theme}
                />
            );
        } else {
            header = (
                <Header
                    currentUser={currentUser}
                    differentThreadSequence={differentThreadSequence}
                    isAutoResponse={isAutoResponder}
                    isCRTEnabled={isCRTEnabled}
                    isEphemeral={isEphemeral}
                    isFailed={isFailed}
                    isSystemPost={isSystemPost}
                    isWebHook={isWebHook}
                    location={location}
                    post={post}
                    shouldRenderReplyButton={shouldRenderReplyButton}
                />
            );
        }
    }

    let body;
    if (isSystemPost && !isEphemeral && !isAutoResponder) {
        body = (
            <SystemMessage
                post={post}
            />
        );
    } else {
        body = (
            <Body
                appsEnabled={appsEnabled}
                filesCount={filesCount}
                hasReactions={reactionsCount > 0}
                highlight={Boolean(highlightedStyle)}
                highlightReplyBar={highlightReplyBar}
                isEphemeral={isEphemeral}
                isFirstReply={isFirstReply}
                isJumboEmoji={isJumboEmoji}
                isLastReply={isLastReply}
                isFailed={isFailed}
                isPostAddChannelMember={isPostAddChannelMember}
                location={location}
                post={post}
                showAddReaction={showAddReaction}
                theme={theme}
            />
        );
    }

    let unreadDot;
    let footer;
    if (isCRTEnabled && thread) {
        if (thread.replyCount > 0 || thread.isFollowing) {
            footer = (
                <Footer
                    testID={`${itemTestID}.footer`}
                    thread={thread}
                />
            );
        }
        if (thread.unreadMentions || thread.unreadReplies) {
            unreadDot = (
                <UnreadDot testID={`${itemTestID}.badge`}/>
            );
        }
    }

    return (
        <View
            testID={testID}
            style={[styles.postStyle, style, highlightedStyle]}
        >
            <TouchableHighlight
                testID={itemTestID}
                onPress={handlePress}
                onLongPress={showPostOptions}
                underlayColor={changeOpacity(theme.centerChannelColor, 0.1)}
                style={styles.touchableContainer}
            >
                <>
                    <PreHeader
                        isConsecutivePost={isConsecutivePost}
                        isSaved={isSaved}
                        isPinned={post.isPinned}
                        skipSavedHeader={skipSavedHeader}
                        skipPinnedHeader={skipPinnedHeader}
                    />
                    <View style={[styles.container, consecutiveStyle]}>
                        {postAvatar}
                        <View style={rightColumnStyle}>
                            {header}
                            {body}
                            {footer}
                        </View>
                        {unreadDot}
                    </View>
                </>
            </TouchableHighlight>
        </View>
    );
};

export default Post;
