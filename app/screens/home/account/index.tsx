// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {withDatabase} from '@nozbe/watermelondb/DatabaseProvider';
import withObservables from '@nozbe/with-observables';
import {useRoute} from '@react-navigation/native';
import React, {useCallback, useState} from 'react';
import {ScrollView, View} from 'react-native';
import Animated, {useAnimatedStyle, withTiming} from 'react-native-reanimated';
import {Edge, SafeAreaView, useSafeAreaInsets} from 'react-native-safe-area-context';
import {of as of$} from 'rxjs';
import {switchMap} from 'rxjs/operators';

import {View as ViewConstants} from '@constants';
import {MM_TABLES, SYSTEM_IDENTIFIERS} from '@constants/database';
import {useTheme} from '@context/theme';
import {useIsTablet} from '@hooks/device';
import {isCustomStatusExpirySupported, isMinimumServerVersion} from '@utils/helpers';
import {changeOpacity, makeStyleSheetFromTheme} from '@utils/theme';

import AccountOptions from './components/options';
import AccountTabletView from './components/tablet_view';
import AccountUserInfo from './components/user_info';

import type {WithDatabaseArgs} from '@typings/database/database';
import type SystemModel from '@typings/database/models/servers/system';
import type UserModel from '@typings/database/models/servers/user';

type AccountScreenProps = {
    currentUser: UserModel;
    customStatusExpirySupported: boolean;
    enableCustomUserStatuses: boolean;
    showFullName: boolean;
};

const {SERVER: {SYSTEM, USER}} = MM_TABLES;
const edges: Edge[] = ['left', 'right'];

const getStyleSheet = makeStyleSheetFromTheme((theme: Theme) => {
    return {
        container: {
            flex: 1,
            backgroundColor: theme.sidebarBg,
        },
        flex: {
            flex: 1,
        },
        flexRow: {
            flex: 1,
            flexDirection: 'row',
        },
        divider: {
            backgroundColor: changeOpacity(theme.centerChannelColor, 0.2),
            height: 1,
            marginHorizontal: 15,
        },
        tabletContainer: {
            backgroundColor: theme.centerChannelBg,
            flex: 1,
        },
        tabletDivider: {
            borderLeftWidth: 1,
            borderLeftColor: changeOpacity(theme.centerChannelColor, 0.16),
        },
    };
});

const AccountScreen = ({currentUser, enableCustomUserStatuses, customStatusExpirySupported, showFullName}: AccountScreenProps) => {
    const theme = useTheme();
    const [start, setStart] = useState(false);
    const route = useRoute();
    const insets = useSafeAreaInsets();
    const isTablet = useIsTablet();

    let tabletSidebarStyle;
    if (isTablet) {
        const {TABLET_SIDEBAR_WIDTH} = ViewConstants;
        tabletSidebarStyle = {maxWidth: TABLET_SIDEBAR_WIDTH};
    }

    const params = route.params! as {direction: string};
    const toLeft = params.direction === 'left';

    const onLayout = useCallback(() => {
        setStart(true);
    }, []);

    const animated = useAnimatedStyle(() => {
        if (start) {
            return {
                opacity: withTiming(1, {duration: 150}),
                transform: [{translateX: withTiming(0, {duration: 150})}],
            };
        }

        return {
            opacity: withTiming(0, {duration: 150}),
            transform: [{translateX: withTiming(toLeft ? -25 : 25, {duration: 150})}],
        };
    }, [start]);

    const styles = getStyleSheet(theme);

    return (
        <SafeAreaView
            edges={edges}
            style={styles.container}
        >
            <View style={[{height: insets.top, flexDirection: 'row'}]}>
                <View style={[styles.container, tabletSidebarStyle]}/>
                {isTablet && <View style={styles.tabletContainer}/>}
            </View>
            <Animated.View
                onLayout={onLayout}
                style={[styles.flexRow, animated]}
            >
                <ScrollView
                    contentContainerStyle={styles.flex}
                    alwaysBounceVertical={false}
                    style={tabletSidebarStyle}
                >
                    <AccountUserInfo
                        user={currentUser}
                        showFullName={showFullName}
                        theme={theme}
                    />
                    <AccountOptions
                        enableCustomUserStatuses={enableCustomUserStatuses}
                        isCustomStatusExpirySupported={customStatusExpirySupported}
                        isTablet={isTablet}
                        user={currentUser}
                        theme={theme}
                    />
                </ScrollView>
                {isTablet &&
                <View style={[styles.tabletContainer, styles.tabletDivider]}>
                    <AccountTabletView/>
                </View>
                }
            </Animated.View>
        </SafeAreaView>
    );
};

const enhanced = withObservables([], ({database}: WithDatabaseArgs) => {
    const config = database.
        get<SystemModel>(SYSTEM).
        findAndObserve(SYSTEM_IDENTIFIERS.CONFIG);
    const showFullName = config.pipe((switchMap((cfg) => of$((cfg.value as ClientConfig).ShowFullName === 'true'))));
    const enableCustomUserStatuses = config.pipe((switchMap((cfg) => {
        const ClientConfig = cfg.value as ClientConfig;
        return of$(ClientConfig.EnableCustomUserStatuses === 'true' && isMinimumServerVersion(ClientConfig.Version, 5, 36));
    })));
    const version = config.pipe(
        switchMap((cfg) => of$((cfg.value as ClientConfig).Version)),
    );
    const customStatusExpirySupported = config.pipe(
        switchMap((cfg) => of$(isCustomStatusExpirySupported((cfg.value as ClientConfig).Version))),
    );

    return {
        currentUser: database.
            get(SYSTEM).
            findAndObserve(SYSTEM_IDENTIFIERS.CURRENT_USER_ID).
            pipe(
                switchMap((id: SystemModel) =>
                    database.get(USER).findAndObserve(id.value),
                ),
            ),
        enableCustomUserStatuses,
        customStatusExpirySupported,
        showFullName,
        version,
    };
});

export default withDatabase(enhanced(AccountScreen));
