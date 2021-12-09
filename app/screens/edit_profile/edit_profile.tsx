// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useIntl} from 'react-intl';
import {BackHandler, DeviceEventEmitter, Keyboard, StyleSheet, View} from 'react-native';
import {KeyboardAwareScrollView} from 'react-native-keyboard-aware-scroll-view';
import {Navigation} from 'react-native-navigation';
import {Edge, SafeAreaView} from 'react-native-safe-area-context';

import {updateMe} from '@actions/remote/user';
import {FloatingTextInputRef} from '@components/floating_text_input_label';
import Loading, {SPINNER_LAYERS} from '@components/loading';
import ProfilePicture from '@components/profile_picture';
import TabletTitle from '@components/tablet_title';
import {Events} from '@constants';
import {useServerUrl} from '@context/server';
import {useTheme} from '@context/theme';
import {dismissModal, popTopScreen, setButtons} from '@screens/navigation';
import {EditProfileProps, FieldConfig, FieldSequence, UserInfo} from '@typings/screens/edit_profile';
import {preventDoubleTap} from '@utils/tap';

import EmailField from './components/email_field';
import Field from './components/field';
import ProfileError from './components/profile_error';

import type {MessageDescriptor} from '@formatjs/intl/src/types';

const edges: Edge[] = ['bottom', 'left', 'right'];

const styles = StyleSheet.create({
    flex: {
        flex: 1,
    },
    top: {
        padding: 25,
        alignItems: 'center',
        justifyContent: 'center',
    },
    separator: {
        height: 15,
    },
    footer: {
        height: 40,
        width: '100%',
    },
    spinner: {
        position: 'absolute',
        width: '100%',
        height: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
    },
});

const FIELDS: { [id: string]: MessageDescriptor } = {
    firstName: {
        id: 'user.settings.general.firstName',
        defaultMessage: 'First Name',
    },
    lastName: {
        id: 'user.settings.general.lastName',
        defaultMessage: 'Last Name',
    },
    username: {
        id: 'user.settings.general.username',
        defaultMessage: 'Username',
    },
    nickname: {
        id: 'user.settings.general.nickname',
        defaultMessage: 'Nickname',
    },
    position: {
        id: 'user.settings.general.position',
        defaultMessage: 'Position',
    },
    email: {
        id: 'user.settings.general.email',
        defaultMessage: 'Email',
    },
};

const EditProfile = ({
    closeButtonId,
    componentId,
    currentUser,
    isModal,
    isTablet,
    lockedFirstName,
    lockedLastName,
    lockedNickname,
    lockedPosition,
}: EditProfileProps) => {
    const intl = useIntl();
    const serverUrl = useServerUrl();
    const theme = useTheme();
    const keyboardAwareRef = useRef<KeyboardAwareScrollView>();
    const firstNameRef = useRef<FloatingTextInputRef>(null);
    const lastNameRef = useRef<FloatingTextInputRef>(null);
    const usernameRef = useRef<FloatingTextInputRef>(null);
    const emailRef = useRef<FloatingTextInputRef>(null);
    const nicknameRef = useRef<FloatingTextInputRef>(null);
    const positionRef = useRef<FloatingTextInputRef>(null);

    const [userInfo, setUserInfo] = useState<UserInfo>({
        email: currentUser.email,
        firstName: currentUser.firstName,
        lastName: currentUser.lastName,
        nickname: currentUser.nickname,
        position: currentUser.position,
        username: currentUser.username,
    });
    const [canSave, setCanSave] = useState(false);
    const [error, setError] = useState<ErrorText | undefined>();
    const [updating, setUpdating] = useState(false);

    const scrollViewRef = useRef<KeyboardAwareScrollView>();

    const buttonText = intl.formatMessage({id: 'mobile.account.settings.save', defaultMessage: 'Save'});
    const rightButton = useMemo(() => {
        return isTablet ? null : {
            id: 'update-profile',
            enabled: false,
            showAsAction: 'always' as const,
            testID: 'edit_profile.save.button',
            color: theme.sidebarHeaderTextColor,
            text: buttonText,
        };
    }, [isTablet, theme.sidebarHeaderTextColor]);

    useEffect(() => {
        const unsubscribe = Navigation.events().registerComponentListener({
            navigationButtonPressed: ({buttonId}: { buttonId: string }) => {
                switch (buttonId) {
                    case 'update-profile':
                        submitUser();
                        break;
                    case closeButtonId:
                        close();
                        break;
                }
            },
        }, componentId);

        return () => {
            unsubscribe.remove();
        };
    }, [userInfo, isTablet, componentId, closeButtonId]);

    useEffect(() => {
        const backHandler = BackHandler.addEventListener('hardwareBackPress', close);
        return () => {
            backHandler.remove();
        };
    }, []);

    useEffect(() => {
        if (!isTablet) {
            setButtons(componentId, {rightButtons: [rightButton!]});
        }
    }, [componentId, rightButton]);

    const service = currentUser.authService;

    const close = useCallback(() => {
        if (isModal) {
            dismissModal({componentId});
        } else if (isTablet) {
            DeviceEventEmitter.emit(Events.ACCOUNT_SELECT_TABLET_VIEW, '');
        } else {
            popTopScreen(componentId);
        }

        return true;
    }, [isModal, isTablet, componentId]);

    const enableSaveButton = useCallback((value: boolean) => {
        const buttons = {
            rightButtons: [{...rightButton!, enabled: value}],
        };
        setCanSave(value);
        setButtons(componentId, buttons);
    }, [componentId, rightButton]);

    const submitUser = useCallback(preventDoubleTap(async () => {
        enableSaveButton(false);
        setError(undefined);
        setUpdating(true);
        try {
            const partialUser: Partial<UserProfile> = {
                email: userInfo.email,
                first_name: userInfo.firstName,
                last_name: userInfo.lastName,
                nickname: userInfo.nickname,
                position: userInfo.position,
                username: userInfo.username,
            };

            const {error: reqError} = await updateMe(serverUrl, partialUser);

            if (reqError) {
                resetScreen(reqError as Error);
                return;
            }

            close();
        } catch (e) {
            resetScreen(e as Error);
        }
    }), [userInfo]);

    const resetScreen = useCallback((resetError: Error) => {
        setError(resetError?.message);
        Keyboard.dismiss();
        setUpdating(false);
        enableSaveButton(true);
        scrollViewRef.current?.scrollToPosition(0, 0, true);
    }, [enableSaveButton]);

    const updateField = useCallback((fieldKey: string, name: string) => {
        const update = {...userInfo};
        update[fieldKey] = name;
        setUserInfo(update);

        // @ts-expect-error access object property by string key
        const currentValue = currentUser[fieldKey];
        const didChange = currentValue !== name;
        enableSaveButton(didChange);
    }, [userInfo, currentUser]);

    const includesSsoService = (sso: string) => ['gitlab', 'google', 'office365'].includes(sso);
    const isSAMLOrLDAP = (protocol: string) => ['ldap', 'saml'].includes(protocol);

    const userProfileFields: FieldSequence = {
        firstName: {
            ref: firstNameRef,
            isDisabled: (isSAMLOrLDAP(service) && lockedFirstName) || includesSsoService(service),
        },
        lastName: {
            ref: lastNameRef,
            isDisabled: (isSAMLOrLDAP(service) && lockedLastName) || includesSsoService(service),
        },
        username: {
            ref: usernameRef,
            isDisabled: service !== '',
        },
        email: {
            ref: emailRef,
            isDisabled: true,
        },
        nickname: {
            ref: nicknameRef,
            isDisabled: isSAMLOrLDAP(service) && lockedNickname,
        },
        position: {
            ref: positionRef,
            isDisabled: isSAMLOrLDAP(service) && lockedPosition,
        },
    };

    const onFocusNextField = useCallback(((fieldKey: string) => {
        const findNextField = () => {
            const fields = Object.keys(userProfileFields);
            const curIndex = fields.indexOf(fieldKey);
            const searchIndex = curIndex + 1;

            if (curIndex === -1 || searchIndex > fields.length) {
                return undefined;
            }

            const remainingFields = fields.slice(searchIndex);

            const nextFieldIndex = remainingFields.findIndex((f: string) => {
                const field = userProfileFields[f];
                return !field.isDisabled;
            });

            if (nextFieldIndex === -1) {
                return {isLastEnabledField: true, nextField: undefined};
            }

            const fieldName = remainingFields[nextFieldIndex];

            return {isLastEnabledField: false, nextField: userProfileFields[fieldName]};
        };

        const next = findNextField();
        if (next?.isLastEnabledField && canSave) {
            // performs form submission
            Keyboard.dismiss();
            submitUser();
        } else if (next?.nextField) {
            next?.nextField?.ref?.current?.focus();
        } else {
            Keyboard.dismiss();
        }
    }), [canSave]);

    const fieldConfig: FieldConfig = {
        blurOnSubmit: false,
        enablesReturnKeyAutomatically: true,
        onFocusNextField,
        onTextChange: updateField,
        returnKeyType: 'next',
    };

    return (
        <>
            {isTablet &&
                <TabletTitle
                    action={buttonText}
                    enabled={canSave}
                    onPress={submitUser}
                    testID='custom_status.done.button'
                    title={intl.formatMessage({id: 'mobile.screen.your_profile', defaultMessage: 'Your Profile'})}
                />
            }
            <SafeAreaView
                edges={edges}
                style={styles.flex}
                testID='edit_profile.screen'
            >
                <KeyboardAwareScrollView
                    bounces={false}
                    enableAutomaticScroll={true}
                    enableOnAndroid={true}
                    enableResetScrollToCoords={true}
                    extraScrollHeight={25}
                    keyboardDismissMode='on-drag'
                    keyboardShouldPersistTaps='handled'

                    // @ts-expect-error legacy ref
                    ref={keyboardAwareRef}
                    scrollToOverflowEnabled={true}
                    testID='edit_profile.scroll_view'
                    style={styles.flex}
                >
                    {updating && (
                        <View
                            style={styles.spinner}
                        >
                            <Loading
                                colorFilters={[{keypath: SPINNER_LAYERS.layerOne, color: theme.buttonBg}]}
                            />
                        </View>

                    )}
                    {Boolean(error) && <ProfileError error={error!}/>}
                    <View style={styles.top}>
                        <ProfilePicture
                            author={currentUser}
                            size={153}
                            showStatus={false}
                        />
                    </View>
                    <Field
                        fieldKey='firstName'
                        fieldRef={firstNameRef}
                        isDisabled={userProfileFields.firstName.isDisabled}
                        label={intl.formatMessage(FIELDS.firstName)}
                        testID='edit_profile.text_setting.firstName'
                        value={userInfo.firstName}
                        {...fieldConfig}
                    />
                    <View style={styles.separator}/>
                    <Field
                        fieldKey='lastName'
                        fieldRef={lastNameRef}
                        isDisabled={userProfileFields.lastName.isDisabled}
                        label={intl.formatMessage(FIELDS.lastName)}
                        testID='edit_profile.text_setting.lastName'
                        value={userInfo.lastName}
                        {...fieldConfig}
                    />
                    <View style={styles.separator}/>
                    <Field
                        fieldKey='username'
                        fieldRef={usernameRef}
                        isDisabled={userProfileFields.username.isDisabled}
                        label={intl.formatMessage(FIELDS.username)}
                        maxLength={22}
                        testID='edit_profile.text_setting.username'
                        value={userInfo.username}
                        {...fieldConfig}
                    />
                    <View style={styles.separator}/>
                    {userInfo.email && (
                        <EmailField
                            authService={currentUser.authService}
                            isDisabled={userProfileFields.email.isDisabled}
                            email={userInfo.email}
                            label={intl.formatMessage(FIELDS.email)}
                            fieldRef={emailRef}
                            onChange={updateField}
                            onFocusNextField={onFocusNextField}
                        />
                    )}
                    <View style={styles.separator}/>
                    <Field
                        fieldKey='nickname'
                        fieldRef={nicknameRef}
                        isDisabled={userProfileFields.nickname.isDisabled}
                        label={intl.formatMessage(FIELDS.nickname)}
                        maxLength={22}
                        testID='edit_profile.text_setting.nickname'
                        value={userInfo.nickname}
                        {...fieldConfig}
                    />
                    <View style={styles.separator}/>
                    <Field
                        fieldKey='position'
                        fieldRef={positionRef}
                        isDisabled={userProfileFields.position.isDisabled}
                        isOptional={true}
                        label={intl.formatMessage(FIELDS.position)}
                        maxLength={128}
                        {...fieldConfig}
                        returnKeyType='done'
                        testID='edit_profile.text_setting.position'
                        value={userInfo.position}
                    />
                    <View style={styles.footer}/>
                </KeyboardAwareScrollView>
            </SafeAreaView>
        </>
    );
};

export default EditProfile;
