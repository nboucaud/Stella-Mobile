// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import InAppReview from 'react-native-in-app-review';

import {storeFirstLaunch} from '@actions/app/global';
import {General, Launch} from '@constants';
import {getDontAskForReview, getFirstLaunch, getLastAskedForReview} from '@queries/app/global';
import {showReviewOverlay} from '@screens/navigation';

export const tryRunAppReview = async (launchType: string, coldStart?: boolean) => {
    if (!coldStart) {
        return;
    }

    if (launchType !== Launch.Normal) {
        return;
    }

    if (!InAppReview.isAvailable()) {
        return;
    }

    const hasReviewed = await getDontAskForReview();
    if (hasReviewed) {
        return;
    }

    const lastReviewed = await getLastAskedForReview();
    if (lastReviewed) {
        if (Date.now() - lastReviewed > General.TIME_TO_NEXT_REVIEW) {
            showReviewOverlay(true);
        }

        return;
    }

    const firstLaunch = await getFirstLaunch();
    if (!firstLaunch) {
        storeFirstLaunch();
        return;
    }

    if ((Date.now() - firstLaunch) > General.TIME_TO_FIRST_REVIEW) {
        showReviewOverlay(false);
    }
};
