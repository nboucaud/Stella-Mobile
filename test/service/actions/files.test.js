// Copyright (c) 2017 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import fs from 'fs';
import assert from 'assert';

import * as Actions from 'service/actions/files';
import Client from 'service/client';
import configureStore from 'app/store';
import {RequestStatus} from 'service/constants';
import TestHelper from 'test/test_helper';

describe('Actions.Files', () => {
    let store;
    before(async () => {
        await TestHelper.initBasic(Client);
    });

    beforeEach(() => {
        store = configureStore();
    });

    after(async () => {
        await TestHelper.basicClient.logout();
    });

    it('getFilesForPost', async () => {
        const {basicClient, basicTeam, basicChannel, basicPost} = TestHelper;
        const testImgData = fs.readFileSync('test/assets/images/test.png');
        const clientId = TestHelper.generateId();
        const fileUploadResp = await basicClient.
            uploadFile(basicTeam.id, basicChannel.id, clientId, testImgData);
        const fileId = fileUploadResp.file_infos[0];

        await Actions.getFilesForPost(
            basicTeam.id, basicChannel.id, basicPost.id
        )(store.dispatch, store.getState);

        const filesRequest = store.getState().requests.files.getFilesForPost;
        const {files: allFiles, fileIdsByPostId} = store.getState().entities.files;

        if (filesRequest.status === RequestStatus.FAILURE) {
            throw new Error(JSON.stringify(filesRequest.error));
        }

        assert.ok(allFiles);
        assert.ok(allFiles[fileId]);
        assert.ok(fileIdsByPostId[basicPost.id]);
    });
});
