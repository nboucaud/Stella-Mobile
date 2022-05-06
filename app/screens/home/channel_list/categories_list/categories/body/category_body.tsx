// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useMemo} from 'react';
import {FlatList} from 'react-native';
import Animated, {Easing, useAnimatedStyle, useSharedValue, withTiming} from 'react-native-reanimated';

import ChannelItem from '@components/channel_item';
import {DMS_CATEGORY} from '@constants/categories';
import ChannelModel from '@typings/database/models/servers/channel';

import type CategoryModel from '@typings/database/models/servers/category';

type Props = {
    sortedChannels: ChannelModel[];
    hiddenChannelIds: Set<string>;
    category: CategoryModel;
    limit: number;
    onChannelSwitch: (channelId: string) => void;
    unreadChannelIds: Set<string>;
};

const extractKey = (item: ChannelModel) => item.id;

const CategoryBody = ({sortedChannels, category, hiddenChannelIds, limit, onChannelSwitch, unreadChannelIds}: Props) => {
    const ids = useMemo(() => {
        let filteredChannels = sortedChannels;

        // Remove all closed gm/dms
        if (hiddenChannelIds.size) {
            filteredChannels = sortedChannels.filter((item) => item && !hiddenChannelIds.has(item.id));
        }

        if (category.type === DMS_CATEGORY && limit > 0) {
            return filteredChannels.slice(0, limit - 1);
        }
        return filteredChannels;
    }, [category.type, limit, hiddenChannelIds, sortedChannels]);

    const unread = useMemo(() => {
        return ids.filter((c) => unreadChannelIds.has(c.id));
    }, [ids]);

    const renderItem = useCallback(({item}: {item: ChannelModel}) => {
        return (
            <ChannelItem
                channel={item}
                testID={`category.${category.displayName.replace(/ /g, '_').toLocaleLowerCase()}.channel_list_item`}
                onPress={onChannelSwitch}
                isCategoryMuted={category.muted}
            />
        );
    }, [onChannelSwitch]);

    const sharedValue = useSharedValue(category.collapsed);

    useEffect(() => {
        sharedValue.value = category.collapsed;
    }, [category.collapsed]);

    const height = ids.length ? ids.length * 40 : 0;
    const unreadHeight = unread.length ? unread.length * 40 : 0;

    const animatedStyle = useAnimatedStyle(() => {
        return {
            height: withTiming(sharedValue.value ? 0 : height, {duration: 300}),
            opacity: withTiming(sharedValue.value ? 0 : 1, {duration: sharedValue.value ? 200 : 300, easing: Easing.inOut(Easing.exp)}),
        };
    }, [height]);

    const unreadAnimatedStyle = useAnimatedStyle(() => {
        return {
            height: withTiming(sharedValue.value ? unreadHeight : 0, {duration: sharedValue.value ? 600 : 200}),
            opacity: withTiming(sharedValue.value ? 1 : 0, {duration: 100, easing: Easing.inOut(Easing.exp)}),
        };
    }, [unreadHeight]);

    return (
        <>
            <Animated.View style={unreadAnimatedStyle}>
                {category.collapsed && unread.map((item) => renderItem({item}))}
            </Animated.View>
            <Animated.View
                style={animatedStyle}
            >
                <FlatList
                    data={ids}
                    renderItem={renderItem}
                    keyExtractor={extractKey}

                    // @ts-expect-error strictMode not exposed on the types
                    strictMode={true}
                />
            </Animated.View>
        </>
    );
};

export default CategoryBody;
