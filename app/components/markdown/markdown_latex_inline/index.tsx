// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useMemo} from 'react';
import {Platform, Text, View} from 'react-native';
import MathView from 'react-native-math-view';

import {makeStyleSheetFromTheme} from '@utils/theme';

type Props = {
    content: string;
    maxMathWidth: number | string;
    theme: Theme;
}

type MathViewErrorProps = {
    error: Error;
}

const getStyleSheet = makeStyleSheetFromTheme((theme: Theme) => {
    return {
        mathStyle: {
            marginBottom: Platform.select({default: -10, ios: 2.5}),
        },
        viewStyle: {
            flexDirection: 'row',
            flexWrap: 'wrap',
        },
        errorText: {
            flexDirection: 'row',
            color: theme.errorTextColor,
            flexWrap: 'wrap',
        },
    };
});

const LatexInline = ({content, maxMathWidth, theme}: Props) => {
    const style = getStyleSheet(theme);
    const mathStyle = useMemo(() => [
        style.mathStyle,
        {maxWidth: maxMathWidth || '100%'},
    ], [maxMathWidth]);

    const onErrorMessage = (error: Error) => {
        return <Text style={style.errorText}>{'Latex error: ' + error.message}</Text>;
    };

    const onRenderErrorMessage = (errorMsg: MathViewErrorProps) => {
        return <Text style={style.errorText}>{'Latex render error: ' + errorMsg.error.message}</Text>;
    };

    return (
        <View
            style={style.viewStyle}
            key={content}
        >
            <MathView
                style={mathStyle}
                math={content}
                onError={onErrorMessage}
                renderError={onRenderErrorMessage}
                resizeMode='contain'
            />
        </View>
    );
};

export default LatexInline;
