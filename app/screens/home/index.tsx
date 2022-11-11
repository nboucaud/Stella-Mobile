// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {createBottomTabNavigator, BottomTabBarProps} from '@react-navigation/bottom-tabs';
import {NavigationContainer} from '@react-navigation/native';
import React, {useEffect} from 'react';
import {useIntl} from 'react-intl';
import {DeviceEventEmitter, Platform} from 'react-native';
import HWKeyboardEvent from 'react-native-hw-keyboard-event';
import InAppReview from 'react-native-in-app-review';
import {enableFreeze, enableScreens} from 'react-native-screens';

import {storeFirstLaunch} from '@actions/app/global';
import {Events, General, Launch, Screens} from '@constants';
import {useTheme} from '@context/theme';
import {getFirstLaunch, getDontAskForReview, getLastAskedForReview} from '@queries/app/global';
import {findChannels, popToRoot, showReviewModal} from '@screens/navigation';
import NavigationStore from '@store/navigation_store';
import {alertChannelArchived, alertChannelRemove, alertTeamRemove} from '@utils/navigation';
import {notificationError} from '@utils/notification';

import Account from './account';
import ChannelList from './channel_list';
import RecentMentions from './recent_mentions';
import SavedMessages from './saved_messages';
import Search from './search';
import TabBar from './tab_bar';

import type {LaunchProps} from '@typings/launch';

if (Platform.OS === 'ios') {
    // We do this on iOS to avoid conflicts betwen ReactNavigation & Wix ReactNativeNavigation
    enableScreens(false);
}

enableFreeze(true);

type HomeProps = LaunchProps & {
    componentId: string;
    time?: number;
};

const Tab = createBottomTabNavigator();

// This is needed since the Database Provider is recreating this component
// when the database is changed (couldn't find exactly why), re-triggering
// the effect. This makes sure the rate logic is only handle on the first
// run. Most of the normal users won't see this issue, but on edge times
// (near the time you will see the rate dialog) will show when switching
// servers.
let hasShownRate = false;

export default function HomeScreen(props: HomeProps) {
    const theme = useTheme();
    const intl = useIntl();

    useEffect(() => {
        const listener = DeviceEventEmitter.addListener(Events.NOTIFICATION_ERROR, (value: 'Team' | 'Channel') => {
            notificationError(intl, value);
        });

        return () => {
            listener.remove();
        };
    }, [intl.locale]);

    useEffect(() => {
        const leaveTeamListener = DeviceEventEmitter.addListener(Events.LEAVE_TEAM, (displayName: string) => {
            alertTeamRemove(displayName, intl);
        });

        const leaveChannelListener = DeviceEventEmitter.addListener(Events.LEAVE_CHANNEL, (displayName: string) => {
            alertChannelRemove(displayName, intl);
        });

        const archivedChannelListener = DeviceEventEmitter.addListener(Events.CHANNEL_ARCHIVED, (displayName: string) => {
            alertChannelArchived(displayName, intl);
        });

        const crtToggledListener = DeviceEventEmitter.addListener(Events.CRT_TOGGLED, (isSameServer: boolean) => {
            if (isSameServer) {
                popToRoot();
            }
        });

        return () => {
            leaveTeamListener.remove();
            leaveChannelListener.remove();
            archivedChannelListener.remove();
            crtToggledListener.remove();
        };
    }, [intl.locale]);

    useEffect(() => {
        const listener = HWKeyboardEvent.onHWKeyPressed((keyEvent: {pressedKey: string}) => {
            const screen = NavigationStore.getAllNavigationComponents();
            if (!screen.includes(Screens.FIND_CHANNELS) && keyEvent.pressedKey === 'find-channels') {
                findChannels(
                    intl.formatMessage({id: 'find_channels.title', defaultMessage: 'Find Channels'}),
                    theme,
                );
            }
        });
        return () => {
            listener.remove();
        };
    }, [intl.locale]);

    // Init the rate app. Only run the effect on the first render
    useEffect(() => {
        if (hasShownRate) {
            return;
        }
        hasShownRate = true;
        (async () => {
            if (!props.coldStart) {
                return;
            }

            if (props.launchType !== Launch.Normal) {
                return;
            }

            if (!InAppReview.isAvailable()) {
                return;
            }

            const hasReviewed = await getDontAskForReview();
            if (hasReviewed) {
                return;
            }

            const lastReviewed = await getLastAskedForReview();
            if (lastReviewed) {
                if (Date.now() - lastReviewed > General.TIME_TO_NEXT_REVIEW) {
                    showReviewModal(true);
                }

                return;
            }

            const firstLaunch = await getFirstLaunch();
            if (!firstLaunch) {
                storeFirstLaunch();
                return;
            }

            if ((Date.now() - firstLaunch) > General.TIME_TO_FIRST_REVIEW) {
                showReviewModal(false);
            }
        })();
    }, []);

    return (
        <NavigationContainer
            theme={{
                dark: false,
                colors: {
                    primary: theme.centerChannelColor,
                    background: 'transparent',
                    card: theme.centerChannelBg,
                    text: theme.centerChannelColor,
                    border: 'white',
                    notification: theme.mentionHighlightBg,
                },
            }}
        >
            <Tab.Navigator
                screenOptions={{headerShown: false, lazy: true, unmountOnBlur: false}}
                backBehavior='none'
                tabBar={(tabProps: BottomTabBarProps) => (
                    <TabBar
                        {...tabProps}
                        theme={theme}
                    />)}
            >
                <Tab.Screen
                    name={Screens.HOME}
                    options={{title: 'Channel', unmountOnBlur: false, tabBarTestID: 'tab_bar.home.tab', freezeOnBlur: true}}
                >
                    {() => <ChannelList {...props}/>}
                </Tab.Screen>
                <Tab.Screen
                    name={Screens.SEARCH}
                    component={Search}
                    options={{unmountOnBlur: false, lazy: true, tabBarTestID: 'tab_bar.search.tab', freezeOnBlur: true}}
                />
                <Tab.Screen
                    name={Screens.MENTIONS}
                    component={RecentMentions}
                    options={{tabBarTestID: 'tab_bar.mentions.tab', lazy: true, unmountOnBlur: false, freezeOnBlur: true}}
                />
                <Tab.Screen
                    name={Screens.SAVED_MESSAGES}
                    component={SavedMessages}
                    options={{unmountOnBlur: false, lazy: true, tabBarTestID: 'tab_bar.saved_messages.tab', freezeOnBlur: true}}
                />
                <Tab.Screen
                    name={Screens.ACCOUNT}
                    component={Account}
                    options={{tabBarTestID: 'tab_bar.account.tab', lazy: true, unmountOnBlur: false, freezeOnBlur: true}}
                />
            </Tab.Navigator>
        </NavigationContainer>
    );
}
