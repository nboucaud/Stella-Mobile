// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Alert} from '@support/ui/component';
import {ChannelScreen} from '@support/ui/screen';
import {timeouts, wait} from '@support/utils';

class ChannelInfoScreen {
    testID = {
        channelInfoScreen: 'channel_info.screen',
        channelInfoScrollView: 'channel_info.scroll_view',
        closeChannelInfoButton: 'close.channel_info.button',
        channelIconGMMemberCount: 'channel_icon.gm_member_count',
        favoritePreferenceAction: 'channel_info.favorite.action',
        mutePreferenceAction: 'channel_info.mute.action',
        ignoreMentionsPreferenceAction: 'channel_info.ignore_mentions.action',
        notificationPreferenceAction: 'channel_info.notification_preference.action',
        pinnedMessagesAction: 'channel_info.pinned_messages.action',
        manageMembersAction: 'channel_info.manage_members.action',
        addMembersAction: 'channel_info.add_members.action',
        convertPrivateAction: 'channel_info.convert_private.action',
        editChannelAction: 'channel_info.edit_channel.action',
        leaveAction: 'channel_info.leave.action',
        archiveAction: 'channel_info.archive.action',
    }

    channelInfoScreen = element(by.id(this.testID.channelInfoScreen));
    channelInfoScrollView = element(by.id(this.testID.channelInfoScrollView));
    closeChannelInfoButton = element(by.id(this.testID.closeChannelInfoButton));
    channelIconGMMemberCount = element(by.id(this.testID.channelIconGMMemberCount));
    favoritePreferenceAction = element(by.id(this.testID.favoritePreferenceAction));
    mutePreferenceAction = element(by.id(this.testID.mutePreferenceAction));
    ignoreMentionsPreferenceAction = element(by.id(this.testID.ignoreMentionsPreferenceAction));
    notificationPreferenceAction = element(by.id(this.testID.notificationPreferenceAction));
    pinnedMessagesAction = element(by.id(this.testID.pinnedMessagesAction));
    manageMembersAction = element(by.id(this.testID.manageMembersAction));
    addMembersAction = element(by.id(this.testID.addMembersAction));
    convertPrivateAction = element(by.id(this.testID.convertPrivateAction));
    editChannelAction = element(by.id(this.testID.editChannelAction));
    leaveAction = element(by.id(this.testID.leaveAction));
    archiveAction = element(by.id(this.testID.archiveAction));

    toBeVisible = async () => {
        await wait(timeouts.TWO_SEC);
        await expect(this.channelInfoScreen).toBeVisible();

        return this.channelInfoScreen;
    }

    open = async () => {
        // # Open channel info screen
        await ChannelScreen.channelTitleButton.tap();

        return this.toBeVisible();
    }

    close = async () => {
        await wait(timeouts.TWO_SEC);
        await this.closeChannelInfoButton.tap();
        await expect(this.channelInfoScreen).not.toBeVisible();
    }

    archiveChannel = async (confirm = true) => {
        await this.channelInfoScrollView.scrollTo('bottom');
        await this.archiveAction.tap();
        const {
            archivePublicChannelTitle,
            noButton,
            yesButton,
        } = Alert;
        await expect(archivePublicChannelTitle).toBeVisible();
        if (confirm) {
            yesButton.tap();
        } else {
            noButton.tap();
        }
        await wait(timeouts.ONE_SEC);
        await expect(this.channelInfoScreen).not.toBeVisible();
    }
}

const channelInfoScreen = new ChannelInfoScreen();
export default channelInfoScreen;
