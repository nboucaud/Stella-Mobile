// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// *******************************************************************
// - [#] indicates a test step (e.g. # Go to a screen)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element testID when selecting an element. Create one if none.
// *******************************************************************

import {
    Setup,
    User,
} from '@support/server_api';
import {
    serverOneUrl,
    siteOneUrl,
    serverTwoUrl,
    siteTwoUrl,
} from '@support/test_config';
import {
    ChannelListScreen,
    HomeScreen,
    LoginScreen,
    ServerListScreen,
    ServerScreen,
} from '@support/ui/screen';
import {expect} from 'detox';

describe('Smoke Test - Server Login', () => {
    const serverOneDisplayName = 'Server 1';
    const serverTwoDisplayName = 'Server 2';

    afterAll(async () => {
        // # Log out
        await HomeScreen.logout(serverOneDisplayName);
    });

    it('MM-T4675_1 - should be able to connect to a server, log in, and show channel list screen', async () => {
        // * Verify on server screen
        await ServerScreen.toBeVisible();

        // # Connect to server with valid server url and non-empty server display name
        await ServerScreen.connectToServer(serverOneUrl, serverOneDisplayName);

        // * Verify on login screen
        await LoginScreen.toBeVisible();

        // # Log in to server with correct credentials
        const {team, user} = await Setup.apiInit(siteOneUrl);
        await LoginScreen.login(user);

        // * Verify on channel list screen and channel list header shows team display name and server display name
        await ChannelListScreen.toBeVisible();
        await expect(ChannelListScreen.headerTeamDisplayName).toHaveText(team.display_name);
        await expect(ChannelListScreen.headerServerDisplayName).toHaveText(serverOneDisplayName);
    });

    it('MM-T4675_2 - should be able to add a new server and log in to the new server', async () => {
        // # Open server list screen
        await ServerListScreen.open();

        // * Verify on server list screen
        await ServerListScreen.toBeVisible();

        // # Add a second server and log in to the second server
        await User.apiAdminLogin(siteTwoUrl);
        const {user} = await Setup.apiInit(siteTwoUrl);
        await ServerListScreen.addServerButton.tap();
        await expect(ServerScreen.headerTitleAddServer).toBeVisible();
        await ServerScreen.connectToServer(serverTwoUrl, serverTwoDisplayName);
        await LoginScreen.login(user);

        // * Verify on channel list screen of the second server
        await ChannelListScreen.toBeVisible();
        await expect(ChannelListScreen.headerServerDisplayName).toHaveText(serverTwoDisplayName);

        // # Go back to first server
        await ServerListScreen.open();
        await ServerListScreen.getServerItemInactive(serverOneDisplayName).tap();
    });
});
