// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// *******************************************************************
// - [#] indicates a test step (e.g. # Go to a screen)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element testID when selecting an element. Create one if none.
// *******************************************************************

import {
    CameraQuickAction,
    FileQuickAction,
    ImageQuickAction,
} from '@support/ui/component';
import {
    ChannelScreen,
} from '@support/ui/screen';
import {
    Setup,
    System,
} from '@support/server_api';

describe('Disable Upload', () => {
    beforeAll(async () => {
        // # Disable mobile upload
        await System.apiUpdateConfig({FileSettings: {EnableMobileUpload: false}});

        const {user} = await Setup.apiInit();
        await ChannelScreen.open(user);
    });

    afterAll(async () => {
        await ChannelScreen.logout();
    });

    it('MM-T3453 should disable file, image, camera icons when mobile file upload is disabled', async () => {
        // * Verify disabled file, image, camera icons are visible
        await expect(CameraQuickAction.cameraQuickActionDisabled).toBeVisible();
        await expect(FileQuickAction.fileQuickActionDisabled).toBeVisible();
        await expect(ImageQuickAction.imageQuickActionDisabled).toBeVisible();
    });
});
