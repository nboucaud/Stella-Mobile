// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React, {useCallback, useEffect, useRef, useState} from 'react';
import {useIntl} from 'react-intl';
import {
    ActivityIndicator,
    Image,
    InteractionManager,
    Keyboard,
    SafeAreaView,
    StatusBar,
    StyleProp,
    Text,
    TextInput,
    TextStyle,
    TouchableWithoutFeedback,
    View,
    ViewStyle,
} from 'react-native';
import Button from 'react-native-button';
import {KeyboardAwareScrollView} from 'react-native-keyboard-aware-scroll-view';
import {NavigationFunctionComponent} from 'react-native-navigation';

import {GlobalStyles} from '@app/styles';
import ErrorText, {ClientErrorWithIntl} from '@components/error_text';
import {FORGOT_PASSWORD, MFA} from '@constants/screens';
import FormattedText from '@components/formatted_text';
import {useManagedConfig} from '@mattermost/react-native-emm';
import {scheduleExpiredNotification} from '@requests/remote/push_notification';
import {login} from '@requests/remote/user';
import {goToScreen, resetToChannel} from '@screens/navigation';
import {t} from '@utils/i18n';
import {preventDoubleTap} from '@utils/tap';
import {changeOpacity, makeStyleSheetFromTheme} from '@utils/theme';

type LoginProps = {
    componentId: string;
    config: ClientConfig;
    license: ClientLicense;
    theme: Theme;
};

export const MFA_EXPECTED_ERRORS = ['mfa.validate_token.authenticate.app_error', 'ent.mfa.validate_token.authenticate.app_error'];

const Login: NavigationFunctionComponent = ({config, license, theme}: LoginProps) => {
    const styles = getStyleSheet(theme);

    const loginRef = useRef<TextInput>(null);
    const passwordRef = useRef<TextInput>(null);
    const scrollRef = useRef<KeyboardAwareScrollView>(null);

    const intl = useIntl();
    const managedConfig = useManagedConfig();
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<ClientErrorWithIntl | string | undefined | null>();

    const [loginId, setLoginId] = useState<string>('');
    const [password, setPassword] = useState<string>('');

    // useEffect to set userName for EMM
    useEffect(() => {
        const setEmmUsernameIfAvailable = async () => {
            if (managedConfig?.username && loginRef.current) {
                loginRef.current.setNativeProps({text: managedConfig.username});
                setLoginId(managedConfig.username);
            }
        };

        setEmmUsernameIfAvailable();
    }, []);

    const preSignIn = preventDoubleTap(async () => {
        setIsLoading(true);
        setError(null);

        Keyboard.dismiss();
        InteractionManager.runAfterInteractions(async () => {
            if (!loginId) {
                t('login.noEmail');
                t('login.noEmailLdapUsername');
                t('login.noEmailUsername');
                t('login.noEmailUsernameLdapUsername');
                t('login.noLdapUsername');
                t('login.noUsername');
                t('login.noUsernameLdapUsername');

                // it's slightly weird to be constructing the message ID, but it's a bit nicer than triply nested if statements
                let msgId = 'login.no';
                if (config.EnableSignInWithEmail === 'true') {
                    msgId += 'Email';
                }
                if (config.EnableSignInWithUsername === 'true') {
                    msgId += 'Username';
                }
                if (license.IsLicensed === 'true' && config.EnableLdap === 'true') {
                    msgId += 'LdapUsername';
                }

                const ldapUsername = intl.formatMessage({
                    id: 'login.ldapUsernameLower',
                    defaultMessage: 'AD/LDAP username',
                });

                setIsLoading(false);
                setError(intl.formatMessage(
                    {
                        id: msgId,
                        defaultMessage: '',
                    },
                    {
                        ldapUsername: config.LdapLoginFieldName || ldapUsername,
                    },
                ));
                return;
            }

            if (!password) {
                setIsLoading(false);
                setError(intl.formatMessage({
                    id: t('login.noPassword'),
                    defaultMessage: 'Please enter your password',
                }));

                return;
            }

            signIn();
        });
    });

    const signIn = async () => {
        const result = await login({loginId: loginId.toLowerCase(), password, config, license});
        if (checkLoginResponse(result)) {
            await goToChannel();
        }
    };

    const goToChannel = async () => {
        await scheduleExpiredNotification(intl);
        resetToChannel();
    };

    const checkLoginResponse = (data: any) => {
        if (MFA_EXPECTED_ERRORS.includes(data?.error?.server_error_id)) {
            goToMfa();
            setIsLoading(false);
            return false;
        }

        if (data?.error) {
            setIsLoading(false);
            setError(getLoginErrorMessage(data.error));
            return false;
        }

        setIsLoading(false);

        return true;
    };

    const goToMfa = () => {
        const screen = MFA;
        const title = intl.formatMessage({id: 'mobile.routes.mfa', defaultMessage: 'Multi-factor SSO'});

        goToScreen(screen, title, {goToChannel, loginId, password});
    };

    const getLoginErrorMessage = (loginError: any) => {
        return (getServerErrorForLogin(loginError) || loginError);
    };

    const getServerErrorForLogin = (serverError: any) => {
        if (!serverError) {
            return null;
        }

        const errorId = serverError.server_error_id;

        if (!errorId) {
            return serverError.message;
        }

        if (errorId === 'store.sql_user.get_for_login.app_error' || errorId === 'ent.ldap.do_login.user_not_registered.app_error') {
            return {
                intl: {
                    id: t('login.userNotFound'),
                    defaultMessage: 'We couldn\'t find an account matching your login credentials.',
                },
            };
        }

        if (errorId === 'api.user.check_user_password.invalid.app_error' || errorId === 'ent.ldap.do_login.invalid_password.app_error') {
            return {
                intl: {
                    id: t('login.invalidPassword'),
                    defaultMessage: 'Your password is incorrect.',
                },
            };
        }

        return serverError.message;
    };

    const onPressForgotPassword = () => {
        const screen = FORGOT_PASSWORD;
        const title = intl.formatMessage({id: 'password_form.title', defaultMessage: 'Password Reset'});

        goToScreen(screen, title);
    };

    const createLoginPlaceholder = () => {
        const {formatMessage} = intl;
        const loginPlaceholders = [];

        if (config.EnableSignInWithEmail === 'true') {
            loginPlaceholders.push(formatMessage({id: 'login.email', defaultMessage: 'Email'}));
        }

        if (config.EnableSignInWithUsername === 'true') {
            loginPlaceholders.push(formatMessage({id: 'login.username', defaultMessage: 'Username'}));
        }

        if (license.IsLicensed === 'true' && license.LDAP === 'true' && config.EnableLdap === 'true') {
            if (config.LdapLoginFieldName) {
                loginPlaceholders.push(config.LdapLoginFieldName);
            } else {
                loginPlaceholders.push(formatMessage({id: 'login.ldapUsername', defaultMessage: 'AD/LDAP Username'}));
            }
        }

        if (loginPlaceholders.length >= 2) {
            return loginPlaceholders.slice(0, loginPlaceholders.length - 1).join(', ') +
                ` ${formatMessage({id: 'login.or', defaultMessage: 'or'})} ` +
                loginPlaceholders[loginPlaceholders.length - 1];
        }

        if (loginPlaceholders.length === 1) {
            return loginPlaceholders[0];
        }

        return '';
    };

    const onBlur = () => {
        loginRef?.current?.blur();
        passwordRef?.current?.blur();
        Keyboard.dismiss();
    };

    const onLoginChange = useCallback((text) => {
        setLoginId(text);
    }, []);

    const onPasswordChange = useCallback((text) => {
        setPassword(text);
    }, []);

    const onPasswordFocus = useCallback(() => {
        passwordRef?.current?.focus();
    }, []);

    // **** **** ****   RENDER METHOD **** **** ****

    const renderProceedButton = () => {
        if (isLoading) {
            return (
                <ActivityIndicator
                    animating={true}
                    size='small'
                />
            );
        }

        const additionalStyle: StyleProp<ViewStyle> = {
            ...(config.EmailLoginButtonColor && {
                backgroundColor: config.EmailLoginButtonColor,
            }),
            ...(config.EmailLoginButtonBorderColor && {
                borderColor: config.EmailLoginButtonBorderColor,
            }),
        };

        const additionalTextStyle: StyleProp<TextStyle> = {
            ...(config.EmailLoginButtonTextColor && {
                color: config.EmailLoginButtonTextColor,
            }),
        };

        return (
            <Button
                testID='login.signin.button'
                onPress={preSignIn}
                containerStyle={[GlobalStyles.signupButton, additionalStyle]}
            >
                <FormattedText
                    id='login.signIn'
                    defaultMessage='Sign in'
                    style={[GlobalStyles.signupButtonText, additionalTextStyle]}
                />
            </Button>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar/>
            <TouchableWithoutFeedback
                onPress={onBlur}
                accessible={false}
            >
                <KeyboardAwareScrollView
                    ref={scrollRef}
                    style={styles.container}
                    contentContainerStyle={styles.innerContainer}
                    keyboardShouldPersistTaps='handled'
                    enableOnAndroid={true}
                >
                    <Image
                        source={require('@assets/images/logo.png')}
                        style={{height: 72, resizeMode: 'contain'}}
                    />
                    {config?.SiteName && (<View testID='login.screen'>
                        <Text style={GlobalStyles.header}>{config?.SiteName}</Text>
                        <FormattedText
                            style={GlobalStyles.subheader}
                            id='web.root.signup_info'
                            defaultMessage='All team communication in one place, searchable and accessible anywhere'
                        />
                    </View>)}
                    {error && (
                        <ErrorText
                            testID='login.error.text'
                            error={error}
                            theme={theme}
                        />
                    )}
                    <TextInput
                        testID='login.username.input'
                        autoCapitalize='none'
                        autoCorrect={false}
                        blurOnSubmit={false}
                        disableFullscreenUI={true}
                        keyboardType='email-address'
                        onChangeText={onLoginChange}
                        onSubmitEditing={onPasswordFocus}
                        placeholder={createLoginPlaceholder()}
                        placeholderTextColor={changeOpacity('#000', 0.5)}
                        ref={loginRef}
                        returnKeyType='next'
                        style={GlobalStyles.inputBox}
                        underlineColorAndroid='transparent'
                        value={loginId} //to remove
                    />
                    <TextInput
                        testID='login.password.input'
                        autoCapitalize='none'
                        autoCorrect={false}
                        disableFullscreenUI={true}
                        onChangeText={onPasswordChange}
                        onSubmitEditing={preSignIn}
                        style={GlobalStyles.inputBox}
                        placeholder={intl.formatMessage({
                            id: 'login.password',
                            defaultMessage: 'Password',
                        })}
                        placeholderTextColor={changeOpacity('#000', 0.5)}
                        ref={passwordRef}
                        returnKeyType='go'
                        secureTextEntry={true}
                        underlineColorAndroid='transparent'
                        value={password} //to remove
                    />
                    {renderProceedButton()}
                    {(config.EnableSignInWithEmail === 'true' || config.EnableSignInWithUsername === 'true') && (
                        <Button
                            onPress={onPressForgotPassword}
                            containerStyle={[styles.forgotPasswordBtn]}
                        >
                            <FormattedText
                                id='login.forgot'
                                defaultMessage='I forgot my password'
                                style={styles.forgotPasswordTxt}
                                testID={'login.forgot'}
                            />
                        </Button>
                    )}
                </KeyboardAwareScrollView>
            </TouchableWithoutFeedback>
        </SafeAreaView>
    );
};

const getStyleSheet = makeStyleSheetFromTheme(() => ({
    container: {
        flex: 1,

        // backgroundColor: theme.centerChannelBg,
    },
    innerContainer: {
        alignItems: 'center',
        flexDirection: 'column',
        justifyContent: 'center',
        paddingHorizontal: 15,
        paddingVertical: 50,
    },
    forgotPasswordBtn: {
        borderColor: 'transparent',
        marginTop: 15,
    },
    forgotPasswordTxt: {
        color: '#2389D7',
    },
}));

export default Login;
