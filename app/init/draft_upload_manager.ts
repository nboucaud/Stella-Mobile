// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {ClientResponse, ClientResponseError} from '@mattermost/react-native-network-client';
import {AppState, AppStateStatus} from 'react-native';

import {updateDraftFile} from '@actions/local/draft';
import {uploadFile} from '@actions/remote/file';
import {PROGRESS_TIME_TO_STORE} from '@constants/files';

type FileHandler = {
    [clientId: string]: {
        cancel?: () => void;
        fileInfo: FileInfo;
        serverUrl: string;
        channelId: string;
        rootId: string;
        lastTimeStored: number;
        onError: Array<(msg: string) => void>;
        onProgress: Array<(p: number, b: number) => void>;
    };
}

class DraftUploadManager {
    private handlers: FileHandler = {};
    private previousAppState: AppStateStatus;

    constructor() {
        this.previousAppState = AppState.currentState;
        AppState.addEventListener('change', this.onAppStateChange);
    }

    public prepareUpload = (
        serverUrl: string,
        file: FileInfo,
        channelId: string,
        rootId: string,
        skipBytes = 0,
    ) => {
        this.handlers[file.clientId!] = {
            fileInfo: file,
            serverUrl,
            channelId,
            rootId,
            lastTimeStored: 0,
            onError: [],
            onProgress: [],
        };

        const onProgress = (progress: number, bytesRead?: number | null | undefined) => {
            this.handleProgress(file.clientId!, progress, bytesRead || 0);
        };

        const onComplete = (response: ClientResponse) => {
            this.handleComplete(response, file.clientId!);
        };

        const onError = (response: ClientResponseError) => {
            this.handleError(response.message, file.clientId!);
        };

        const {error, cancel} = uploadFile(serverUrl, file, channelId, onProgress, onComplete, onError, skipBytes);
        if (error) {
            this.handleError(error.message, file.clientId!);
            return;
        }
        this.handlers[file.clientId!].cancel = cancel;
    };

    public cancel = (clientId: string) => {
        const {cancel} = this.handlers[clientId];
        delete this.handlers[clientId];
        cancel?.();
    };

    public isUploading = (clientId: string) => {
        return Boolean(this.handlers[clientId]);
    };

    public registerProgressHandler = (clientId: string, callback: (progress: number, bytes: number) => void) => {
        const h1 = this.handlers[clientId];
        if (!h1) {
            return null;
        }

        h1.onProgress.push(callback);
        return () => {
            const h2 = this.handlers[clientId];
            if (!h2) {
                return;
            }

            h2.onProgress = h2.onProgress.filter((v) => v !== callback);
        };
    };

    public registerErrorHandler = (clientId: string, callback: (errMessage: string) => void) => {
        const h1 = this.handlers[clientId];
        if (!h1) {
            return null;
        }

        h1.onError.push(callback);
        return () => {
            const h2 = this.handlers[clientId];
            if (!h2) {
                return;
            }

            h2.onError = h2.onError.filter((v) => v !== callback);
        };
    };

    private handleProgress = (clientId: string, progress: number, bytes: number) => {
        const h = this.handlers[clientId];
        if (!h) {
            return;
        }

        h.fileInfo.progress = progress;
        h.fileInfo.bytesRead = bytes;

        h.onProgress.forEach((c) => c(progress, bytes));
        if (AppState.currentState !== 'active' && h.lastTimeStored + PROGRESS_TIME_TO_STORE < Date.now()) {
            updateDraftFile(h.serverUrl, h.channelId, h.rootId, this.handlers[clientId].fileInfo);
            h.lastTimeStored = Date.now();
        }
    };

    private handleComplete = (response: ClientResponse, clientId: string) => {
        const h = this.handlers[clientId];
        if (!h) {
            return;
        }
        if (response.code !== 201) {
            this.handleError((response.data as any).message, clientId);
            return;
        }
        if (!response.data) {
            this.handleError('Failed to upload the file: no data received', clientId);
            return;
        }
        const data = response.data.file_infos as FileInfo[];
        if (!data || !data.length) {
            this.handleError('Failed to upload the file: no data received', clientId);
            return;
        }

        delete this.handlers[clientId!];

        const fileInfo = data[0];
        fileInfo.clientId = h.fileInfo.clientId;
        fileInfo.localPath = h.fileInfo.localPath;

        updateDraftFile(h.serverUrl, h.channelId, h.rootId, this.handlers[clientId].fileInfo);
    };

    private handleError = (errorMessage: string, clientId: string) => {
        const h = this.handlers[clientId];
        delete this.handlers[clientId];

        h.onError.forEach((c) => c(errorMessage));

        const fileInfo = {...h.fileInfo};
        fileInfo.failed = true;
        updateDraftFile(h.serverUrl, h.channelId, h.rootId, this.handlers[clientId].fileInfo);
    };

    private onAppStateChange = async (appState: AppStateStatus) => {
        if (appState !== 'active' && this.previousAppState === 'active') {
            this.storeProgress();
        }

        this.previousAppState = appState;
    };

    private storeProgress = () => {
        for (const h of Object.values(this.handlers)) {
            updateDraftFile(h.serverUrl, h.channelId, h.rootId, h.fileInfo);
        }
    };
}

export default new DraftUploadManager();
