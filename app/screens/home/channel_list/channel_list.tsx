// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useManagedConfig} from '@mattermost/react-native-emm';
import {useIsFocused, useRoute} from '@react-navigation/native';
import React, {useEffect} from 'react';
import {StyleSheet} from 'react-native';
import Animated, {useAnimatedStyle, withTiming} from 'react-native-reanimated';
import {Edge, SafeAreaView, useSafeAreaInsets} from 'react-native-safe-area-context';

import ChannelList from '@components/channel_list';
import FreezeScreen from '@components/freeze_screen';
import TeamSidebar from '@components/team_sidebar';
import {useTheme} from '@context/theme';
import {useIsTablet} from '@hooks/device';
import Channel from '@screens/channel';
import {resetToTeams} from '@screens/navigation';

import Servers from './servers';

type ChannelProps = {
    channelsCount: number;
    currentTeamId?: string;
    teamsCount: number;
    time?: number;
};

const edges: Edge[] = ['bottom', 'left', 'right'];

const styles = StyleSheet.create({
    flex: {
        flex: 1,
    },
    content: {
        flex: 1,
        flexDirection: 'row',
    },
});

const ChannelListScreen = (props: ChannelProps) => {
    const theme = useTheme();
    const managedConfig = useManagedConfig<ManagedConfig>();

    const isTablet = useIsTablet();
    const route = useRoute();
    const isFocused = useIsFocused();
    const insets = useSafeAreaInsets();
    const params = route.params as {direction: string};
    const canAddOtherServers = managedConfig?.allowOtherServers !== 'false';

    const animated = useAnimatedStyle(() => {
        if (!isFocused) {
            let initial = 0;
            if (params?.direction) {
                initial = -25;
            }
            return {
                opacity: withTiming(0, {duration: 150}),
                transform: [{translateX: withTiming(initial, {duration: 150})}],
            };
        }
        return {
            opacity: withTiming(1, {duration: 150}),
            transform: [{translateX: withTiming(0, {duration: 150})}],
        };
    }, [isFocused, params]);

    const top = useAnimatedStyle(() => {
        return {height: insets.top, backgroundColor: theme.sidebarBg};
    }, [theme]);

    useEffect(() => {
        if (!props.teamsCount) {
            resetToTeams();
        }
    }, [Boolean(props.teamsCount)]);

    const content = (
        <>
            {<Animated.View style={top}/>}
            <SafeAreaView
                style={styles.content}
                edges={edges}
                testID='channel_list.screen'
            >
                {canAddOtherServers && <Servers/>}
                <Animated.View
                    style={[styles.content, animated]}
                >
                    <TeamSidebar
                        iconPad={canAddOtherServers}
                        teamsCount={props.teamsCount}
                    />
                    <ChannelList
                        iconPad={canAddOtherServers && props.teamsCount <= 1}
                        isTablet={isTablet}
                        teamsCount={props.teamsCount}
                        channelsCount={props.channelsCount}
                        currentTeamId={props.currentTeamId}
                    />
                    {isTablet && Boolean(props.currentTeamId) &&
                        <Channel/>
                    }
                </Animated.View>
            </SafeAreaView>
        </>
    );

    if (isTablet) {
        return (
            <FreezeScreen>
                {content}
            </FreezeScreen>
        );
    }

    return content;
};

export default ChannelListScreen;
