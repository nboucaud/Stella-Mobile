// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import {StyleSheet, TextStyle, View} from 'react-native';
import SyntaxHighlighter from 'react-syntax-highlighter';
import {github, monokai, solarizedDark, solarizedLight} from 'react-syntax-highlighter/dist/cjs/styles/hljs';

import {useTheme} from '@context/theme';

import CodeHighlightRenderer from './renderer';

type Props = {
    code: string;
    language: string;
    textStyle: TextStyle;
    selectable?: boolean;
}

const codeTheme: Record<string, any> = {
    github,
    monokai,
    'solarized-dark': solarizedDark,
    'solarized-light': solarizedLight,
};

const styles = StyleSheet.create({
    preTag: {
        padding: 5,
        width: '100%',
    },
    flex: {
        flex: 1,
    },
});

const Highlighter = ({code, language, textStyle, selectable = false}: Props) => {
    const theme = useTheme();
    const style = codeTheme[theme.codeTheme] || github;

    const nativeRenderer = useCallback(({rows, stylesheet}) => {
        const digits = rows.length.toString().length;
        return (
            <CodeHighlightRenderer
                digits={digits}
                rows={rows}
                stylesheet={stylesheet}
                defaultColor={style.hljs.color || theme.centerChannelColor}
                fontFamily={textStyle.fontFamily || 'monospace'}
                fontSize={textStyle.fontSize}
                selectable={selectable}
            />
        );
    }, [textStyle, theme, style]);

    const preTag = useCallback((info) => (
        <View
            style={[styles.preTag, selectable && styles.flex, {backgroundColor: style.hljs.background || theme.centerChannelBg}]}
        >
            {info.children}
        </View>
    ), [theme, selectable, style]);

    return (
        <SyntaxHighlighter
            style={style}
            language={language}
            horizontal={true}
            showLineNumbers={true}
            renderer={nativeRenderer}
            PreTag={preTag}
            CodeTag={View}
        >
            {code}
        </SyntaxHighlighter>
    );
};

export default Highlighter;
