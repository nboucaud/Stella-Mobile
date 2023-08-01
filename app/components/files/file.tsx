// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useRef} from 'react';
import {View, TouchableWithoutFeedback} from 'react-native';
import Animated from 'react-native-reanimated';

import TouchableWithFeedback from '@components/touchable_with_feedback';
import {useTheme} from '@context/theme';
import {useGalleryItem} from '@hooks/gallery';
import {isDocument, isImage, isVideo} from '@utils/file';
import {changeOpacity, makeStyleSheetFromTheme} from '@utils/theme';

import DocumentFile, {type DocumentFileRef} from './document_file';
import FileIcon from './file_icon';
import FileInfo from './file_info';
import FileOptionsIcon from './file_options_icon';
import ImageFile from './image_file';
import ImageFileOverlay from './image_file_overlay';
import VideoFile from './video_file';

type FileProps = {
    canDownloadFiles: boolean;
    file: FileInfo;
    galleryIdentifier: string;
    index: number;
    inViewPort: boolean;
    isSingleImage?: boolean;
    nonVisibleImagesCount: number;
    onPress: (index: number) => void;
    publicLinkEnabled: boolean;
    channelName?: string;
    onOptionsPress?: (fileInfo: FileInfo) => void;
    optionSelected?: boolean;
    wrapperWidth?: number;
    showDate?: boolean;
    updateFileForGallery: (idx: number, file: FileInfo) => void;
    asCard?: boolean;
};

const getStyleSheet = makeStyleSheetFromTheme((theme: Theme) => {
    return {
        fileWrapper: {
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            borderWidth: 1,
            borderColor: changeOpacity(theme.centerChannelColor, 0.24),
            borderRadius: 4,
        },
        iconWrapper: {
            marginTop: 8,
            marginRight: 7,
            marginBottom: 8,
            marginLeft: 6,
        },
        imageVideo: {
            height: 40,
            width: 40,
            margin: 4,
        },
    };
});

const File = ({
    asCard = false,
    canDownloadFiles,
    channelName,
    file,
    galleryIdentifier,
    inViewPort = false,
    index,
    isSingleImage = false,
    nonVisibleImagesCount = 0,
    onOptionsPress,
    onPress,
    optionSelected,
    publicLinkEnabled,
    showDate = false,
    updateFileForGallery,
    wrapperWidth = 300,
}: FileProps) => {
    const document = useRef<DocumentFileRef>(null);
    const theme = useTheme();
    const style = getStyleSheet(theme);

    const handlePreviewPress = useCallback(() => {
        if (document.current) {
            document.current.handlePreviewPress();
        } else {
            onPress(index);
        }
    }, [index]);

    const {styles, onGestureEvent, ref} = useGalleryItem(galleryIdentifier, index, handlePreviewPress);

    const handleOnOptionsPress = useCallback(() => {
        onOptionsPress?.(file);
    }, [file, onOptionsPress]);

    const renderCardWithImage = (fileIcon: JSX.Element) => {
        const fileInfo = (
            <FileInfo
                file={file}
                showDate={showDate}
                channelName={channelName}
                onPress={handlePreviewPress}
            />
        );

        return (
            <View style={[style.fileWrapper]}>
                <View style={style.iconWrapper}>
                    {fileIcon}
                </View>
                {fileInfo}
                {onOptionsPress &&
                <FileOptionsIcon
                    onPress={handleOnOptionsPress}
                    selected={optionSelected}
                />
                }
            </View>
        );
    };

    let fileComponent;
    if (isVideo(file) && publicLinkEnabled) {
        const renderVideoFile = (
            <TouchableWithoutFeedback onPress={onGestureEvent}>
                <Animated.View style={[styles, asCard ? style.imageVideo : null]}>
                    <VideoFile
                        file={file}
                        forwardRef={ref}
                        inViewPort={inViewPort}
                        isSingleImage={isSingleImage}
                        resizeMode={'cover'}
                        wrapperWidth={wrapperWidth}
                        updateFileForGallery={updateFileForGallery}
                        index={index}
                    />
                    {Boolean(nonVisibleImagesCount) &&
                    <ImageFileOverlay
                        value={nonVisibleImagesCount}
                    />
                    }
                </Animated.View>
            </TouchableWithoutFeedback>
        );

        fileComponent = asCard ? renderCardWithImage(renderVideoFile) : renderVideoFile;
    } else if (isImage(file)) {
        const renderImageFile = (
            <TouchableWithoutFeedback onPress={onGestureEvent}>
                <Animated.View style={[styles, asCard ? style.imageVideo : null]}>
                    <ImageFile
                        file={file}
                        forwardRef={ref}
                        inViewPort={inViewPort}
                        isSingleImage={isSingleImage}
                        resizeMode={'cover'}
                        wrapperWidth={wrapperWidth}
                    />
                    {Boolean(nonVisibleImagesCount) &&
                    <ImageFileOverlay
                        value={nonVisibleImagesCount}
                    />
                    }
                </Animated.View>
            </TouchableWithoutFeedback>
        );

        fileComponent = asCard ? renderCardWithImage(renderImageFile) : renderImageFile;
    } else if (isDocument(file)) {
        const renderDocumentFile = (
            <View style={style.iconWrapper}>
                <DocumentFile
                    ref={document}
                    canDownloadFiles={canDownloadFiles}
                    file={file}
                />
            </View>
        );

        const fileInfo = (
            <FileInfo
                file={file}
                showDate={showDate}
                channelName={channelName}
                onPress={handlePreviewPress}
            />
        );

        fileComponent = (
            <View style={[style.fileWrapper]}>
                {renderDocumentFile}
                {fileInfo}
                {onOptionsPress &&
                <FileOptionsIcon
                    onPress={handleOnOptionsPress}
                    selected={optionSelected}
                />
                }
            </View>
        );
    } else {
        const touchableWithPreview = (
            <TouchableWithFeedback
                onPress={handlePreviewPress}
                type={'opacity'}
            >
                <FileIcon
                    file={file}
                />
            </TouchableWithFeedback>
        );

        fileComponent = renderCardWithImage(touchableWithPreview);
    }
    return fileComponent;
};

export default File;
