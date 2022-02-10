// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useState} from 'react';
import {LayoutChangeEvent, Platform, ScrollView, View} from 'react-native';
import {Edge, SafeAreaView} from 'react-native-safe-area-context';

import Autocomplete from '@components/autocomplete';
import {useTheme} from '@context/theme';
import {useIsTablet} from '@hooks/device';
import {useHeaderHeight} from '@hooks/header';
import {changeOpacity, makeStyleSheetFromTheme} from '@utils/theme';

import PostInput from '../post_input';
import QuickActions from '../quick_actions';
import SendAction from '../send_action';
import Typing from '../typing';
import Uploads from '../uploads';

type Props = {
    testID?: string;
    channelId: string;
    rootId?: string;

    // Cursor Position Handler
    updateCursorPosition: (pos: number) => void;
    cursorPosition: number;

    // Send Handler
    sendMessage: () => void;
    canSend: boolean;
    maxMessageLength: number;

    // Draft Handler
    files: FileInfo[];
    value: string;
    uploadFileError: React.ReactNode;
    updateValue: (value: string) => void;
    addFiles: (files: FileInfo[]) => void;
}

const SAFE_AREA_VIEW_EDGES: Edge[] = ['left', 'right'];
const AUTOCOMPLETE_MARGIN = 20;

const getStyleSheet = makeStyleSheetFromTheme((theme) => {
    return {
        actionsContainer: {
            display: 'flex',
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingBottom: Platform.select({
                ios: 1,
                android: 2,
            }),
        },
        inputContainer: {
            flex: 1,
            flexDirection: 'column',
        },
        inputContentContainer: {
            alignItems: 'stretch',
            paddingTop: Platform.select({
                ios: 7,
                android: 0,
            }),
        },
        inputWrapper: {
            alignItems: 'flex-end',
            flexDirection: 'row',
            justifyContent: 'center',
            paddingBottom: 2,
            backgroundColor: theme.centerChannelBg,
            borderTopWidth: 1,
            borderTopColor: changeOpacity(theme.centerChannelColor, 0.20),
        },
    };
});

export default function DraftInput({
    testID,
    channelId,
    files,
    maxMessageLength,
    rootId = '',
    value,
    uploadFileError,
    sendMessage,
    canSend,
    updateValue,
    addFiles,
    updateCursorPosition,
    cursorPosition,
}: Props) {
    const theme = useTheme();
    const isTablet = useIsTablet();

    const [top, setTop] = useState(0);

    const handleLayout = useCallback((e: LayoutChangeEvent) => {
        setTop(e.nativeEvent.layout.y);
    }, []);

    // Render
    const postInputTestID = `${testID}.post.input`;
    const quickActionsTestID = `${testID}.quick_actions`;
    const sendActionTestID = `${testID}.send_action`;
    const style = getStyleSheet(theme);

    // From component/navigation_header/index.tsx and screen/channel/channel.tsx
    const {defaultHeight} = useHeaderHeight(false, true, false);
    const autocompleteMaxHeight = Math.min(top - defaultHeight - AUTOCOMPLETE_MARGIN, isTablet ? 200 : 1450);

    return (
        <>
            <Typing
                channelId={channelId}
                rootId={rootId}
            />
            <Autocomplete
                maxHeight={autocompleteMaxHeight}
                updateValue={updateValue}
                rootId={rootId}
                channelId={channelId}
                offsetY={0}
                cursorPosition={cursorPosition}
                value={value}
                hasFilesAttached={Boolean(files.length)}
            />
            <SafeAreaView
                edges={SAFE_AREA_VIEW_EDGES}
                onLayout={handleLayout}
                style={style.inputWrapper}
                testID={testID}
            >

                <ScrollView
                    style={style.inputContainer}
                    contentContainerStyle={style.inputContentContainer}
                    keyboardShouldPersistTaps={'always'}
                    scrollEnabled={false}
                    showsVerticalScrollIndicator={false}
                    showsHorizontalScrollIndicator={false}
                    pinchGestureEnabled={false}
                    overScrollMode={'never'}
                    disableScrollViewPanResponder={true}
                >
                    <PostInput
                        testID={postInputTestID}
                        channelId={channelId}
                        maxMessageLength={maxMessageLength}
                        rootId={rootId}
                        cursorPosition={cursorPosition}
                        updateCursorPosition={updateCursorPosition}
                        updateValue={updateValue}
                        value={value}
                        addFiles={addFiles}
                        sendMessage={sendMessage}
                    />
                    <Uploads
                        files={files}
                        uploadFileError={uploadFileError}
                        channelId={channelId}
                        rootId={rootId}
                    />
                    <View style={style.actionsContainer}>
                        <QuickActions
                            testID={quickActionsTestID}
                            fileCount={files.length}
                            addFiles={addFiles}
                            updateValue={updateValue}
                            value={value}
                        />
                        <SendAction
                            testID={sendActionTestID}
                            disabled={!canSend}
                            sendMessage={sendMessage}
                        />
                    </View>
                </ScrollView>
            </SafeAreaView>
        </>
    );
}
