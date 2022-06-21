// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useRef, useCallback} from 'react';
import {useIntl} from 'react-intl';
import {
    LayoutChangeEvent,
    TextInput,
    TouchableWithoutFeedback,
    StatusBar,
    View,
    NativeSyntheticEvent,
    NativeScrollEvent,
    Platform,
    useWindowDimensions,
} from 'react-native';
import {KeyboardAwareScrollView} from 'react-native-keyboard-aware-scroll-view';
import {SafeAreaView, useSafeAreaInsets} from 'react-native-safe-area-context';

import Autocomplete from '@components/autocomplete';
import ErrorText from '@components/error_text';
import FloatingTextInput from '@components/floating_text_input_label';
import FormattedText from '@components/formatted_text';
import Loading from '@components/loading';
import OptionItem from '@components/option_item';
import {General, Channel} from '@constants';
import {useTheme} from '@context/theme';
import useHeaderHeight from '@hooks/header';
import {t} from '@i18n';
import {
    changeOpacity,
    makeStyleSheetFromTheme,
    getKeyboardAppearanceFromTheme,
} from '@utils/theme';
import {typography} from '@utils/typography';

const SCROLL_VERTICAL_PADDING = 32;
const getStyleSheet = makeStyleSheetFromTheme((theme) => ({
    container: {
        flex: 1,
    },
    scrollView: {
        paddingVertical: SCROLL_VERTICAL_PADDING,
        paddingHorizontal: 20,
    },
    errorContainer: {
        width: '100%',
    },
    errorWrapper: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    loading: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    makePrivateContainer: {
        marginBottom: 32,
    },
    fieldContainer: {
        marginBottom: 24,
    },
    helpText: {
        ...typography('Body', 75, 'Regular'),
        color: changeOpacity(theme.centerChannelColor, 0.5),
        marginTop: 8,
    },
}));

type Props = {
    channelType?: string;
    displayName: string;
    onDisplayNameChange: (text: string) => void;
    editing: boolean;
    error?: string | object;
    header: string;
    headerOnly?: boolean;
    onHeaderChange: (text: string) => void;
    onTypeChange: (type: ChannelType) => void;
    purpose: string;
    onPurposeChange: (text: string) => void;
    saving: boolean;
    type?: string;
}

export default function ChannelInfoForm({
    channelType,
    displayName,
    onDisplayNameChange,
    editing,
    error,
    header,
    headerOnly,
    onHeaderChange,
    onTypeChange,
    purpose,
    onPurposeChange,
    saving,
    type,
}: Props) {
    const intl = useIntl();
    const {formatMessage} = intl;
    const titleBarHeight = useHeaderHeight();
    const {height: windowHeight} = useWindowDimensions();
    const {top: insetsTop, bottom: insetsBottom} = useSafeAreaInsets();
    const theme = useTheme();
    const styles = getStyleSheet(theme);

    const nameInput = useRef<TextInput>(null);
    const purposeInput = useRef<TextInput>(null);
    const headerInput = useRef<TextInput>(null);

    const scrollViewRef = useRef<KeyboardAwareScrollView>(null);

    const updateScrollTimeout = useRef<NodeJS.Timeout>();

    const [keyboardVisible, setKeyBoardVisible] = useState(false);
    const [keyboardHeight, setKeyboardHeight] = useState(0);
    const [keyboardPosition, setKeyboardPosition] = useState(windowHeight);
    const [scrollPosition, setScrollPosition] = useState(0);

    const [headerPosition, setHeaderPosition] = useState(0);
    const [headerHeight, setHeaderHeight] = useState(0);

    const optionalText = formatMessage({id: t('channel_modal.optional'), defaultMessage: '(optional)'});
    const labelDisplayName = formatMessage({id: t('channel_modal.name'), defaultMessage: 'Name'});
    const labelPurpose = formatMessage({id: t('channel_modal.purpose'), defaultMessage: 'Purpose'}) + ' ' + optionalText;
    const labelHeader = formatMessage({id: t('channel_modal.header'), defaultMessage: 'Header'}) + ' ' + optionalText;

    const placeholderDisplayName = formatMessage({id: t('channel_modal.nameEx'), defaultMessage: 'Bugs, Marketing'});
    const placeholderPurpose = formatMessage({id: t('channel_modal.purposeEx'), defaultMessage: 'A channel to file bugs and improvements'});
    const placeholderHeader = formatMessage({id: t('channel_modal.headerEx'), defaultMessage: 'Use Markdown to format header text'});

    const makePrivateLabel = formatMessage({id: t('channel_modal.makePrivate.label'), defaultMessage: 'Make Private'});
    const makePrivateDescription = formatMessage({id: t('channel_modal.makePrivate.description'), defaultMessage: 'When a channel is set to private, only invited team members can access and participate in that channel.'});

    const displayHeaderOnly = headerOnly || channelType === General.DM_CHANNEL || channelType === General.GM_CHANNEL;
    const showSelector = !displayHeaderOnly && !editing;

    const isPrivate = type === General.PRIVATE_CHANNEL;

    const handlePress = () => {
        const chtype = isPrivate ? General.OPEN_CHANNEL : General.PRIVATE_CHANNEL;
        onTypeChange(chtype);
    };

    const blur = useCallback(() => {
        nameInput.current?.blur();
        purposeInput.current?.blur();
        headerInput.current?.blur();
        scrollViewRef.current?.scrollToPosition(0, 0, true);
    }, []);

    const onHeaderLayout = useCallback(({nativeEvent}: LayoutChangeEvent) => {
        setHeaderPosition(nativeEvent.layout.y);
    }, []);

    const onHeaderInputLayout = useCallback(({nativeEvent}: LayoutChangeEvent) => {
        setHeaderHeight(nativeEvent.layout.height);
    }, []);

    const scrollHeaderToTop = useCallback(() => {
        if (scrollViewRef?.current) {
            setTimeout(() => scrollViewRef.current?.scrollToPosition(0, headerPosition), 100);
        }
    }, []);

    const onKeyboardDidShow = useCallback((frames: any) => {
        setKeyBoardVisible(true);
        setKeyboardPosition(frames.endCoordinates.screenY);
        setKeyboardHeight(frames.endCoordinates.height);
    }, []);

    const onKeyboardDidHide = useCallback((frames: any) => {
        setKeyBoardVisible(false);
        setKeyboardPosition(frames.endCoordinates.screenY);
        setKeyboardHeight(0);
    }, []);

    const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
        const pos = e.nativeEvent.contentOffset.y;
        if (updateScrollTimeout.current) {
            clearTimeout(updateScrollTimeout.current);
        }
        updateScrollTimeout.current = setTimeout(() => {
            setScrollPosition(pos);
            updateScrollTimeout.current = undefined;
        }, 200);
    }, []);

    if (saving) {
        return (
            <View style={styles.container}>
                <StatusBar/>
                <Loading
                    containerStyle={styles.loading}
                    color={theme.centerChannelColor}
                    size='large'
                />
            </View>
        );
    }

    let displayError;
    if (error) {
        displayError = (
            <SafeAreaView
                edges={['bottom', 'left', 'right']}
                style={styles.errorContainer}
            >
                <View style={styles.errorWrapper}>
                    <ErrorText
                        testID='edit_channel_info.error.text'
                        error={error}
                    />
                </View>
            </SafeAreaView>
        );
    }

    const autocompleteSize = Math.min(
        Math.max((keyboardPosition + scrollPosition) - (insetsBottom + titleBarHeight.defaultHeight + insetsTop + (StatusBar.currentHeight || 0) + SCROLL_VERTICAL_PADDING + headerPosition + headerHeight), 80),
        200);

    const position = Platform.select({ios: keyboardHeight - insetsBottom, default: 0});
    return (
        <>
            <SafeAreaView
                edges={['bottom', 'left', 'right']}
                style={styles.container}
                testID='create_or_edit_channel.screen'
            >
                <KeyboardAwareScrollView
                    testID={'create_or_edit_channel.scrollview'}
                    ref={scrollViewRef}
                    keyboardShouldPersistTaps={'always'}
                    onKeyboardDidShow={onKeyboardDidShow}
                    onKeyboardDidHide={onKeyboardDidHide}
                    enableAutomaticScroll={!keyboardVisible}
                    contentContainerStyle={styles.scrollView}
                    onScroll={onScroll}
                >
                    {displayError}
                    <TouchableWithoutFeedback
                        onPress={blur}
                    >
                        <View>
                            {showSelector && (
                                <OptionItem
                                    testID='channel_info_form.make_private'
                                    label={makePrivateLabel}
                                    description={makePrivateDescription}
                                    action={handlePress}
                                    type={'toggle'}
                                    selected={isPrivate}
                                    icon={'lock-outline'}
                                    containerStyle={styles.makePrivateContainer}
                                />
                            )}
                            {!displayHeaderOnly && (
                                <>
                                    <FloatingTextInput
                                        autoCorrect={false}
                                        autoCapitalize={'none'}
                                        blurOnSubmit={false}
                                        disableFullscreenUI={true}
                                        enablesReturnKeyAutomatically={true}
                                        label={labelDisplayName}
                                        placeholder={placeholderDisplayName}
                                        onChangeText={onDisplayNameChange}
                                        maxLength={Channel.MAX_CHANNEL_NAME_LENGTH}
                                        keyboardAppearance={getKeyboardAppearanceFromTheme(theme)}
                                        returnKeyType='next'
                                        showErrorIcon={false}
                                        spellCheck={false}
                                        testID='channel_info_form.display_name.input'
                                        value={displayName}
                                        ref={nameInput}
                                        containerStyle={styles.fieldContainer}
                                        theme={theme}
                                    />
                                    <View style={styles.fieldContainer}>
                                        <FloatingTextInput
                                            autoCorrect={false}
                                            autoCapitalize={'none'}
                                            blurOnSubmit={false}
                                            disableFullscreenUI={true}
                                            enablesReturnKeyAutomatically={true}
                                            label={labelPurpose}
                                            placeholder={placeholderPurpose}
                                            onChangeText={onPurposeChange}
                                            keyboardAppearance={getKeyboardAppearanceFromTheme(theme)}
                                            returnKeyType='next'
                                            showErrorIcon={false}
                                            spellCheck={false}
                                            testID='channel_info_form.purpose.input'
                                            value={purpose}
                                            ref={purposeInput}
                                            theme={theme}
                                        />
                                        <FormattedText
                                            style={styles.helpText}
                                            id='channel_modal.descriptionHelp'
                                            defaultMessage='Describe how this channel should be used.'
                                            testID='channel_info_form.purpose.description'
                                        />
                                    </View>
                                </>
                            )}
                            <View
                                style={styles.fieldContainer}
                                onLayout={onHeaderLayout}
                            >
                                <FloatingTextInput
                                    autoCorrect={false}
                                    autoCapitalize={'none'}
                                    blurOnSubmit={false}
                                    disableFullscreenUI={true}
                                    enablesReturnKeyAutomatically={true}
                                    label={labelHeader}
                                    placeholder={placeholderHeader}
                                    onChangeText={onHeaderChange}
                                    multiline={true}
                                    keyboardAppearance={getKeyboardAppearanceFromTheme(theme)}
                                    returnKeyType='next'
                                    showErrorIcon={false}
                                    spellCheck={false}
                                    testID='channel_info_form.header.input'
                                    value={header}
                                    ref={headerInput}
                                    theme={theme}
                                    onLayout={onHeaderInputLayout}
                                    onFocus={scrollHeaderToTop}
                                />
                                <FormattedText
                                    style={styles.helpText}
                                    id='channel_modal.headerHelp'
                                    defaultMessage={'Specify text to appear in the channel header beside the channel name. For example, include frequently used links by typing link text [Link Title](http://example.com).'}
                                    testID='channel_info_form.header.description'

                                />
                            </View>
                        </View>
                    </TouchableWithoutFeedback>
                </KeyboardAwareScrollView>
            </SafeAreaView>
            <View>
                <Autocomplete
                    postInputTop={position}
                    updateValue={onHeaderChange}
                    cursorPosition={header.length}
                    value={header}
                    nestedScrollEnabled={true}
                    maxHeightOverride={autocompleteSize}
                    inPost={false}
                />
            </View>
        </>
    );
}
