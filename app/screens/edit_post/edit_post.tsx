// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useRef, useState} from 'react';
import {useIntl} from 'react-intl';
import {Alert, Keyboard, KeyboardType, LayoutChangeEvent, Platform, SafeAreaView, useWindowDimensions, View} from 'react-native';
import Animated, {useAnimatedStyle, useSharedValue, withTiming} from 'react-native-reanimated';

import {deletePost, editPost} from '@actions/remote/post';
import Autocomplete from '@components/autocomplete';
import Loading from '@components/loading';
import {useServerUrl} from '@context/server';
import {useTheme} from '@context/theme';
import {useIsTablet} from '@hooks/device';
import useDidUpdate from '@hooks/did_update';
import useNavButtonPressed from '@hooks/navigation_button_pressed';
import PostError from '@screens/edit_post/post_error';
import {buildNavigationButton, dismissModal, setButtons} from '@screens/navigation';
import {switchKeyboardForCodeBlocks} from '@utils/markdown';
import {changeOpacity, makeStyleSheetFromTheme} from '@utils/theme';

import EditPostInput, {EditPostInputRef} from './edit_post_input';

import type PostModel from '@typings/database/models/servers/post';

const getStyleSheet = makeStyleSheetFromTheme((theme: Theme) => {
    return {
        body: {
            flex: 1,
            backgroundColor: changeOpacity(theme.centerChannelColor, 0.03),
        },
        container: {
            flex: 1,
        },
        loader: {
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
        },
    };
});

const RIGHT_BUTTON = buildNavigationButton('edit-post', 'edit_post.save.button');

type EditPostProps = {
    componentId: string;
    closeButtonId: string;
    post: PostModel;
    maxPostSize: number;
    hasFilesAttached: boolean;
    canDelete: boolean;
}
const EditPost = ({componentId, maxPostSize, post, closeButtonId, hasFilesAttached, canDelete}: EditPostProps) => {
    const [keyboardType, setKeyboardType] = useState<KeyboardType>('default');
    const [postMessage, setPostMessage] = useState(post.message);
    const [cursorPosition, setCursorPosition] = useState(post.message.length);
    const [errorLine, setErrorLine] = useState<string | undefined>();
    const [errorExtra, setErrorExtra] = useState<string | undefined>();
    const [isUpdating, setIsUpdating] = useState(false);
    const layoutHeight = useSharedValue(0);
    const keyboardHeight = useSharedValue(0);

    const postInputRef = useRef<EditPostInputRef>(null);
    const theme = useTheme();
    const intl = useIntl();
    const serverUrl = useServerUrl();
    const isTablet = useIsTablet();
    const {width, height} = useWindowDimensions();
    const isLandscape = width > height;
    const styles = getStyleSheet(theme);

    useEffect(() => {
        setButtons(componentId, {
            rightButtons: [{
                color: theme.sidebarHeaderTextColor,
                text: intl.formatMessage({id: 'edit_post.save', defaultMessage: 'Save'}),
                ...RIGHT_BUTTON,
                enabled: false,
            }],
        });
    }, []);

    useEffect(() => {
        const showListener = Keyboard.addListener('keyboardWillShow', (e) => {
            const {height: end} = e.endCoordinates;

            // on iPad if we use the hardware keyboard multiply its height by 2
            // otherwise use the software keyboard height
            const minKeyboardHeight = end < 100 ? end * 2 : end;
            keyboardHeight.value = minKeyboardHeight;
        });
        const hideListener = Keyboard.addListener('keyboardWillHide', () => {
            if (isTablet) {
                const offset = isLandscape ? 60 : 0;
                keyboardHeight.value = ((height - (layoutHeight.value + offset)) / 2);
                return;
            }

            keyboardHeight.value = 0;
        });

        return () => {
            showListener.remove();
            hideListener.remove();
        };
    }, [isTablet, height]);

    useEffect(() => {
        const t = setTimeout(() => {
            postInputRef.current?.focus();
        }, 320);

        return () => {
            clearTimeout(t);
        };
    }, []);

    useDidUpdate(() => {
        // Workaround to avoid iOS emdash autocorrect in Code Blocks
        if (Platform.OS === 'ios') {
            onTextSelectionChange();
        }
    }, [postMessage]);

    const onClose = useCallback(() => {
        Keyboard.dismiss();
        dismissModal({componentId});
    }, []);

    const onLayout = useCallback((e: LayoutChangeEvent) => {
        layoutHeight.value = e.nativeEvent.layout.height;
    }, [height]);

    const onTextSelectionChange = useCallback((curPos: number = cursorPosition) => {
        if (Platform.OS === 'ios') {
            setKeyboardType(switchKeyboardForCodeBlocks(postMessage, curPos));
        }
        setCursorPosition(curPos);
    }, [cursorPosition, postMessage]);

    const toggleSaveButton = useCallback((enabled = true) => {
        setButtons(componentId, {
            rightButtons: [{
                ...RIGHT_BUTTON,
                color: theme.sidebarHeaderTextColor,
                text: intl.formatMessage({id: 'edit_post.save', defaultMessage: 'Save'}),
                enabled,
            }],
        });
    }, [componentId, intl, theme]);

    const onChangeText = useCallback((message: string) => {
        setPostMessage(message);
        const tooLong = message.trim().length > maxPostSize;

        if (tooLong) {
            const line = intl.formatMessage({id: 'mobile.message_length.message_split_left', defaultMessage: 'Message exceeds the character limit'});
            const extra = `${message.trim().length} / ${maxPostSize}`;
            setErrorLine(line);
            setErrorExtra(extra);
        }
        toggleSaveButton(post.message !== message);
    }, [intl, maxPostSize, toggleSaveButton]);

    const handleUIUpdates = useCallback((res: {error?: unknown}) => {
        if (res.error) {
            setIsUpdating(false);
            const errorMessage = intl.formatMessage({id: 'mobile.edit_post.error', defaultMessage: 'There was a problem editing this message. Please try again.'});
            setErrorLine(errorMessage);
            postInputRef?.current?.focus();
        } else {
            setIsUpdating(false);
            onClose();
        }
    }, []);

    const handleDeletePost = useCallback(async () => {
        Alert.alert(
            intl.formatMessage({id: 'mobile.edit_post.delete_title', defaultMessage: 'Confirm Post Delete'}),
            intl.formatMessage({
                id: 'mobile.edit_post.delete_question',
                defaultMessage: 'Are you sure you want to delete this Post?',
            }),
            [{
                text: intl.formatMessage({id: 'mobile.post.cancel', defaultMessage: 'Cancel'}),
                style: 'cancel',
                onPress: () => {
                    setIsUpdating(false);
                    toggleSaveButton();
                    setPostMessage(post.message);
                },
            }, {
                text: intl.formatMessage({id: 'post_info.del', defaultMessage: 'Delete'}),
                style: 'destructive',
                onPress: async () => {
                    const res = await deletePost(serverUrl, post);
                    handleUIUpdates(res);
                },
            }],
        );
    }, [serverUrl, post.message]);

    const onSavePostMessage = useCallback(async () => {
        setIsUpdating(true);
        setErrorLine(undefined);
        setErrorExtra(undefined);
        toggleSaveButton(false);
        if (!postMessage && canDelete && !hasFilesAttached) {
            handleDeletePost();
            return;
        }

        const res = await editPost(serverUrl, post.id, postMessage);
        handleUIUpdates(res);
    }, [toggleSaveButton, serverUrl, post.id, postMessage, onClose]);

    const animatedStyle = useAnimatedStyle(() => {
        if (Platform.OS === 'android') {
            return {bottom: 0};
        }

        let bottom = 0;
        if (isTablet) {
            // 60 is the size of the navigation header
            const offset = isLandscape ? 60 : 0;

            bottom = keyboardHeight.value - ((height - (layoutHeight.value + offset)) / 2);
        } else {
            bottom = keyboardHeight.value;
        }

        return {
            bottom: withTiming(bottom, {duration: 250}),
        };
    });

    useNavButtonPressed(RIGHT_BUTTON.id, componentId, onSavePostMessage, [postMessage]);
    useNavButtonPressed(closeButtonId, componentId, onClose, []);

    if (isUpdating) {
        return (
            <View style={styles.loader}>
                <Loading color={theme.buttonBg}/>
            </View>
        );
    }

    return (
        <>
            <SafeAreaView
                testID='edit_post.screen'
                style={styles.container}
                onLayout={onLayout}
            >
                <View style={styles.body}>
                    {Boolean((errorLine || errorExtra)) &&
                        <PostError
                            errorExtra={errorExtra}
                            errorLine={errorLine}
                        />
                    }
                    <EditPostInput
                        hasError={Boolean(errorLine)}
                        keyboardType={keyboardType}
                        message={postMessage}
                        onChangeText={onChangeText}
                        onTextSelectionChange={onTextSelectionChange}
                        ref={postInputRef}
                    />
                </View>
            </SafeAreaView>
            <Animated.View style={animatedStyle}>
                <Autocomplete
                    channelId={post.channelId}
                    hasFilesAttached={hasFilesAttached}
                    nestedScrollEnabled={true}
                    rootId={post.rootId}
                    updateValue={onChangeText}
                    value={postMessage}
                    cursorPosition={cursorPosition}
                    postInputTop={1}
                    fixedBottomPosition={true}
                    maxHeightOverride={isTablet ? 200 : undefined}
                    inPost={false}
                />
            </Animated.View>

        </>
    );
};

export default EditPost;
