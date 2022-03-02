// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useMemo, useRef} from 'react';
import {useWindowDimensions} from 'react-native';
import FastImage, {Source} from 'react-native-fast-image';
import {TapGestureHandler} from 'react-native-gesture-handler';
import Animated from 'react-native-reanimated';

import {Device as DeviceConstant, View as ViewConstants} from '@constants';
import {GalleryInit} from '@context/gallery';
import {useGalleryItem} from '@hooks/gallery';
import {lookupMimeType} from '@utils/file';
import {openGalleryAtIndex} from '@utils/gallery';
import {generateId} from '@utils/general';
import {calculateDimensions} from '@utils/images';
import {BestImage, getNearestPoint} from '@utils/opengraph';
import {changeOpacity, makeStyleSheetFromTheme} from '@utils/theme';
import {extractFilenameFromUrl, isValidUrl} from '@utils/url';

type OpengraphImageProps = {
    isReplyPost: boolean;
    location: string;
    metadata: PostMetadata;
    openGraphImages: never[];
    postId: string;
    theme: Theme;
}

const MAX_IMAGE_HEIGHT = 150;
const VIEWPORT_IMAGE_OFFSET = 93;
const VIEWPORT_IMAGE_REPLY_OFFSET = 13;

const getStyleSheet = makeStyleSheetFromTheme((theme: Theme) => {
    return {
        imageContainer: {
            alignItems: 'center',
            borderColor: changeOpacity(theme.centerChannelColor, 0.2),
            borderWidth: 1,
            borderRadius: 3,
            marginTop: 5,
        },
        image: {
            borderRadius: 3,
        },
    };
});

const getViewPostWidth = (isReplyPost: boolean, deviceHeight: number, deviceWidth: number) => {
    const deviceSize = deviceWidth > deviceHeight ? deviceHeight : deviceWidth;
    const viewPortWidth = deviceSize - VIEWPORT_IMAGE_OFFSET - (isReplyPost ? VIEWPORT_IMAGE_REPLY_OFFSET : 0);
    const tabletOffset = DeviceConstant.IS_TABLET ? ViewConstants.TABLET_SIDEBAR_WIDTH : 0;

    return viewPortWidth - tabletOffset;
};

const OpengraphImage = ({isReplyPost, location, metadata, openGraphImages, postId, theme}: OpengraphImageProps) => {
    const fileId = useRef(generateId('uid')).current;
    const dimensions = useWindowDimensions();
    const style = getStyleSheet(theme);
    const galleryIdentifier = `${postId}-OpenGraphImage-${location}`;

    const bestDimensions = useMemo(() => ({
        height: MAX_IMAGE_HEIGHT,
        width: getViewPostWidth(isReplyPost, dimensions.height, dimensions.width),
    }), [isReplyPost, dimensions]);
    const bestImage = getNearestPoint(bestDimensions, openGraphImages, 'width', 'height') as BestImage;
    const imageUrl = (bestImage.secure_url || bestImage.url)!;
    const imagesMetadata = metadata.images;

    let ogImage;
    if (imagesMetadata && imagesMetadata[imageUrl]) {
        ogImage = imagesMetadata[imageUrl];
    }

    if (!ogImage) {
        ogImage = openGraphImages.find((i: BestImage) => i.url === imageUrl || i.secure_url === imageUrl);
    }

    // Fallback when the ogImage does not have dimensions but there is a metaImage defined
    const metaImages = imagesMetadata ? Object.values(imagesMetadata) : null;
    if ((!ogImage?.width || !ogImage?.height) && metaImages?.length) {
        ogImage = metaImages[0];
    }

    let imageDimensions = bestDimensions;
    if (ogImage?.width && ogImage?.height) {
        imageDimensions = calculateDimensions(ogImage.height, ogImage.width, getViewPostWidth(isReplyPost, dimensions.height, dimensions.width));
    }

    const onPress = () => {
        const item: GalleryItemType = {
            id: fileId,
            postId,
            uri: imageUrl,
            width: imageDimensions.width,
            height: imageDimensions.height,
            name: extractFilenameFromUrl(imageUrl) || 'openGraph.png',
            mime_type: lookupMimeType(imageUrl) || 'images/png',
            type: 'image',
        };
        openGalleryAtIndex(galleryIdentifier, 0, [item]);
    };

    const source: Source = {};
    if (isValidUrl(imageUrl)) {
        source.uri = imageUrl;
    }

    const {ref, onGestureEvent, styles} = useGalleryItem(
        galleryIdentifier,
        0,
        onPress,
    );

    const dimensionsStyle = {width: imageDimensions.width, height: imageDimensions.height};
    return (
        <GalleryInit galleryIdentifier={galleryIdentifier}>
            <Animated.View style={[styles, style.imageContainer, dimensionsStyle]}>
                <TapGestureHandler onGestureEvent={onGestureEvent}>
                    <Animated.View testID={`OpenGraphImage-${fileId}`}>
                        <FastImage
                            style={[style.image, dimensionsStyle]}
                            source={source}

                            // @ts-expect-error legacy ref
                            ref={ref}
                            resizeMode='contain'
                            nativeID={`OpenGraphImage-${fileId}`}
                        />
                    </Animated.View>
                </TapGestureHandler>
            </Animated.View>
        </GalleryInit>
    );
};

export default OpengraphImage;
