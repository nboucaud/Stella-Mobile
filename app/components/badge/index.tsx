// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as React from 'react';
import {Animated, StyleProp, StyleSheet, TextStyle} from 'react-native';

import {useTheme} from '@context/theme';

type Props = {

  /**
   * Whether the badge is visible
   */
  visible: boolean;

  /**
   * Content of the `Badge`.
   */
  children?: string | number;

  /**
   * Size of the `Badge`.
   */
  size?: number;

  /**
   * Style object for the tab bar container.
   */
  style?: Animated.WithAnimatedValue<StyleProp<TextStyle>>;
};

export default function Badge({
    visible = true,
    size = 18,
    children,
    style,
    ...rest
}: Props) {
    const [opacity] = React.useState(() => new Animated.Value(visible ? 1 : 0));
    const [rendered, setRendered] = React.useState(Boolean(visible));

    const theme = useTheme();

    React.useEffect(() => {
        if (!rendered) {
            return;
        }

        Animated.timing(opacity, {
            toValue: visible ? 1 : 0,
            duration: 200,
            useNativeDriver: true,
        }).start(({finished}) => {
            if (finished && !visible) {
                setRendered(false);
            }
        });
    }, [opacity, rendered, visible]);

    if (visible && !rendered) {
        setRendered(true);
    }

    if (!visible && !rendered) {
        return null;
    }

    // @ts-expect-error: backgroundColor definitely exists
    const {backgroundColor = theme.buttonBg, ...restStyle} =
    StyleSheet.flatten(style) || {};
    const textColor = theme.buttonColor;
    const borderRadius = size / 2;
    const fontSize = Math.floor((size * 3) / 4);

    return (
        <Animated.Text
            numberOfLines={1}
            style={[
                {
                    opacity,
                    transform: [
                        {
                            scale: opacity.interpolate({
                                inputRange: [0, 1],
                                outputRange: [0.5, 1],
                            }),
                        },
                    ],
                    backgroundColor,
                    color: textColor,
                    fontSize,
                    lineHeight: size - 1,
                    height: size,
                    minWidth: size,
                    borderRadius,
                },
                styles.container,
                restStyle,
            ]}
            {...rest}
        >
            {children}
        </Animated.Text>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: -1,
        left: 15,
        alignSelf: 'flex-end',
        textAlign: 'center',
        paddingHorizontal: 4,
        overflow: 'hidden',
    },
});
