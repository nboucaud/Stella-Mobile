// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {useIntl} from 'react-intl';
import {BackHandler, StatusBar, View} from 'react-native';
import {Navigation} from 'react-native-navigation';
import {Edge, SafeAreaView} from 'react-native-safe-area-context';

import {savePreference} from '@actions/remote/preference';
import Block from '@components/block';
import OptionItem from '@components/option_item';
import {Preferences} from '@constants';
import {useServerUrl} from '@context/server';
import {useTheme} from '@context/theme';
import {t} from '@i18n';
import {popTopScreen, setButtons} from '@screens/navigation';
import EphemeralStore from '@store/ephemeral_store';
import {changeOpacity, makeStyleSheetFromTheme} from '@utils/theme';

const footer = {
    id: t('settings_display.clock.preferTime'),
    defaultMessage: 'Select how you prefer time displayed.',
};

const edges: Edge[] = ['left', 'right'];
const CLOCK_TYPE = {
    NORMAL: 'NORMAL',
    MILITARY: 'MILITARY',
} as const;

const getStyleSheet = makeStyleSheetFromTheme((theme) => {
    return {
        container: {
            flex: 1,
            backgroundColor: theme.centerChannelBg,
        },
        wrapper: {
            backgroundColor: changeOpacity(theme.centerChannelColor, 0.06),
            flex: 1,
            paddingTop: 35,
        },
        divider: {
            backgroundColor: changeOpacity(theme.centerChannelColor, 0.1),
            height: 1,
        },
        containerStyle: {
            paddingHorizontal: 8,
        },
    };
});

const SAVE_CLOCK_BUTTON_ID = 'settings_display.clock.save.button';

type DisplayClockProps = {
    componentId: string;
    currentUserId: string;
    hasMilitaryTimeFormat: boolean;
}
const DisplayClock = ({componentId, currentUserId, hasMilitaryTimeFormat}: DisplayClockProps) => {
    const theme = useTheme();
    const [isMilitaryTimeFormat, setIsMilitaryTimeFormat] = useState(hasMilitaryTimeFormat);
    const serverUrl = useServerUrl();
    const intl = useIntl();

    const styles = getStyleSheet(theme);

    const saveButton = useMemo(() => {
        return {
            id: SAVE_CLOCK_BUTTON_ID,
            enabled: false,
            showAsAction: 'always' as const,
            testID: 'settings_display.save.button',
            color: theme.sidebarHeaderTextColor,
            text: intl.formatMessage({id: 'settings.display.militaryClock.save', defaultMessage: 'Save'}),
        };
    }, [theme.sidebarHeaderTextColor]);

    const canSave = useCallback((enabled: boolean) => {
        const buttons = {
            rightButtons: [{
                ...saveButton,
                enabled,
            }],
        };
        setButtons(componentId, buttons);
    }, [componentId, saveButton]);

    const onSelectClockPreference = useCallback((clockType: keyof typeof CLOCK_TYPE) => {
        const militaryTimeFormat = clockType === CLOCK_TYPE.MILITARY;
        setIsMilitaryTimeFormat(militaryTimeFormat);
        canSave(hasMilitaryTimeFormat !== militaryTimeFormat);
    }, [canSave]);

    const close = useCallback(() => popTopScreen(componentId), [componentId]);

    const saveClockDisplayPreference = useCallback(async () => {
        const timePreference: PreferenceType = {
            category: Preferences.CATEGORY_DISPLAY_SETTINGS,
            name: 'use_military_time',
            user_id: currentUserId,
            value: `${isMilitaryTimeFormat}`,
        };

        savePreference(serverUrl, [timePreference]);
        close();
    }, []);

    useEffect(() => {
        setButtons(componentId, {
            rightButtons: [saveButton],
        });
    }, []);

    useEffect(() => {
        const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
            if (EphemeralStore.getNavigationTopComponentId() === componentId) {
                close();
                return true;
            }

            return false;
        });

        return () => {
            backHandler.remove();
        };
    }, []);

    useEffect(() => {
        const unsubscribe = Navigation.events().registerComponentListener({
            navigationButtonPressed: ({buttonId}: { buttonId: string }) => {
                if (buttonId === SAVE_CLOCK_BUTTON_ID) {
                    saveClockDisplayPreference();
                }
            },
        }, componentId);

        return () => {
            unsubscribe.remove();
        };
    }, []);

    return (
        <SafeAreaView
            edges={edges}
            style={styles.container}
            testID='settings_display.screen'
        >
            <StatusBar/>
            <View style={styles.wrapper}>
                <Block
                    disableHeader={true}
                    footerText={footer}
                >
                    <OptionItem
                        action={onSelectClockPreference}
                        containerStyle={styles.containerStyle}
                        label={intl.formatMessage({id: 'settings_display.clock.normal', defaultMessage: '12-hour clock (example: 4:00 PM)'})}
                        selected={!isMilitaryTimeFormat}
                        testID='clock_display_settings.normal_clock.action'
                        type='select'
                        value={CLOCK_TYPE.NORMAL}
                    />
                    <View style={styles.divider}/>
                    <OptionItem
                        action={onSelectClockPreference}
                        containerStyle={styles.containerStyle}
                        label={intl.formatMessage({id: 'settings_display.clock.military', defaultMessage: '24-hour clock (example: 16:00)'})}
                        selected={isMilitaryTimeFormat}
                        testID='clock_display_settings.military_clock.action'
                        type='select'
                        value={CLOCK_TYPE.MILITARY}
                    />
                </Block>
            </View>
        </SafeAreaView>
    );
};

export default DisplayClock;
