// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React, {useCallback, useMemo} from 'react';
import {Overlay} from 'react-native-elements';

import {ITEM_HEIGHT} from '@components/option_item';
import {useTheme} from '@context/theme';
import {GalleryAction} from '@typings/screens/gallery';
import {changeOpacity, makeStyleSheetFromTheme} from '@utils/theme';

import {XyOffset} from '../file_result';

import {useNumberItems} from './hooks';
import OptionMenus from './option_menus';

const getStyleSheet = makeStyleSheetFromTheme((theme: Theme) => ({
    tablet: {
        backgroundColor: theme.centerChannelBg,
        borderColor: changeOpacity(theme.centerChannelColor, 0.08),
        borderRadius: 8,
        borderWidth: 1,
        paddingLeft: 20,
        position: 'absolute',
        right: 20,
        width: 252,
        marginRight: 20,
    },
    backDrop: {opacity: 0},
}));

const openDownMargin = 64;

type Props = {
    action: GalleryAction;
    canDownloadFiles: boolean;
    fileInfo: FileInfo;
    openUp?: boolean;
    optionSelected: boolean;
    setShowOptions: (show: boolean) => void;
    publicLinkEnabled: boolean;
    setAction: (action: GalleryAction) => void;
    xyOffset: XyOffset;
}
const TabletOptions = ({
    action,
    canDownloadFiles,
    fileInfo,
    openUp = false,
    optionSelected,
    setShowOptions,
    publicLinkEnabled,
    setAction,
    xyOffset,
}: Props) => {
    const theme = useTheme();
    const styles = getStyleSheet(theme);
    const numOptions = useNumberItems(canDownloadFiles, publicLinkEnabled);

    const toggleOverlay = useCallback(() => {
        setShowOptions(false);
    }, []);

    const overlayStyle = useMemo(() => ({
        marginTop: openUp ? 0 : openDownMargin,
        top: xyOffset?.y ? xyOffset.y - (openUp ? ITEM_HEIGHT * numOptions : 0) : 0,
        right: xyOffset?.x,
    }), [numOptions, openUp, xyOffset]);

    return (
        <>
            <Overlay
                backdropStyle={styles.backDrop}
                fullScreen={false}
                isVisible={optionSelected}
                onBackdropPress={toggleOverlay}
                overlayStyle={[
                    styles.tablet,
                    overlayStyle,
                ]}
            >
                <OptionMenus
                    action={action}
                    setAction={setAction}
                    fileInfo={fileInfo}
                />
            </Overlay>
        </>
    );
};

export default TabletOptions;
