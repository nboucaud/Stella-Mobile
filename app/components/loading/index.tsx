// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import LottieView from 'lottie-react-native';
import React from 'react';
import {StyleSheet, View, ViewStyle} from 'react-native';

type ColorFilter = {
    keypath: typeof SPINNER_LAYERS[keyof typeof SPINNER_LAYERS] ;
    color: string;
}

type LoadingProps = {
    containerStyle?: ViewStyle;
    style?: ViewStyle;
    colorFilters?: ColorFilter[];
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        padding: 20,
        maxHeight: 40,
    },
    lottie: {
        height: 32,
        width: 32,
    },
});

export const SPINNER_LAYERS = {
    layerOne: 'Shape Layer 1',
    layerTwo: 'Shape Layer 2',
} as const;

const Loading = ({containerStyle, style, colorFilters}: LoadingProps) => {
    return (
        <View style={[styles.container, containerStyle]}>
            <LottieView
                source={require('./spinner.json')}
                autoPlay={true}
                loop={true}
                style={[styles.lottie, style]}
                colorFilters={colorFilters}
            />
        </View>
    );
};
export default Loading;
