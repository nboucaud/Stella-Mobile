// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {ClientResponse, ClientResponseError, ProgressPromise, UploadRequestOptions} from '@mattermost/react-native-network-client';

export interface ClientFilesMix {
    getFileUrl: (fileId: string, timestamp: number) => string;
    getFileThumbnailUrl: (fileId: string, timestamp: number) => string;
    getFilePreviewUrl: (fileId: string, timestamp: number) => string;
    getFilePublicLink: (fileId: string) => Promise<any>;
    uploadFile: (
        file: FileInfo,
        channelId: string,
        onProgress: (fractionCompleted: number) => void,
        onComplete: (response: ClientResponse) => void,
        onError: (response: ClientResponseError) => void,
    ) => () => void;
}

const ClientFiles = (superclass: any) => class extends superclass {
    getFileUrl(fileId: string, timestamp: number) {
        let url = `${this.apiClient.baseUrl}${this.getFileRoute(fileId)}`;
        if (timestamp) {
            url += `?${timestamp}`;
        }

        return url;
    }

    getFileThumbnailUrl(fileId: string, timestamp: number) {
        let url = `${this.apiClient.baseUrl}${this.getFileRoute(fileId)}/thumbnail`;
        if (timestamp) {
            url += `?${timestamp}`;
        }

        return url;
    }

    getFilePreviewUrl(fileId: string, timestamp: number) {
        let url = `${this.apiClient.baseUrl}${this.getFileRoute(fileId)}/preview`;
        if (timestamp) {
            url += `?${timestamp}`;
        }

        return url;
    }

    getFilePublicLink = async (fileId: string) => {
        return this.doFetch(
            `${this.getFileRoute(fileId)}/link`,
            {method: 'get'},
        );
    }

    uploadFile = async (
        file: FileInfo,
        channelId: string,
        onProgress: (fractionCompleted: number) => void,
        onComplete: (response: ClientResponse) => void,
        onError: (response: ClientResponseError) => void,
    ) => {
        const url = `${this.apiClient.baseUrl}${this.getFilesRoute()}`;
        const options: UploadRequestOptions = {
            skipBytes: 0,
            method: 'POST',
            multipart: {
                data: {
                    channel_id: channelId,
                },
            },
        };
        const promise = this.apiClient.upload(url, file.localPath, options) as ProgressPromise<ClientResponse>;
        promise.progress!(onProgress).then(onComplete).catch(onError);
        return promise.cancel!;
    }
};

export default ClientFiles;
