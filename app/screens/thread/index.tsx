// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {withDatabase, withObservables} from '@nozbe/watermelondb/react';
import {distinctUntilChanged, switchMap, combineLatest, of as of$} from 'rxjs';

import {observeCallsState, observeChannelsWithCalls, observeCurrentCall, observeIncomingCalls} from '@calls/state';
import {withServerUrl} from '@context/server';
import {observePost} from '@queries/servers/post';
import {observeIsCRTEnabled} from '@queries/servers/thread';
import EphemeralStore from '@store/ephemeral_store';

import Thread from './thread';

import type {WithDatabaseArgs} from '@typings/database/database';

type EnhanceProps = WithDatabaseArgs & {
    serverUrl: string;
    rootId: string;
}

const enhanced = withObservables(['rootId'], ({database, serverUrl, rootId}: EnhanceProps) => {
    const rId = rootId || EphemeralStore.getCurrentThreadId();
    const rootPost = observePost(database, rId);

    const channelId = rootPost.pipe(
        switchMap((r) => of$(r?.channelId || '')),
        distinctUntilChanged(),
    );
    const isCallInCurrentChannel = combineLatest([channelId, observeChannelsWithCalls(serverUrl)]).pipe(
        switchMap(([id, calls]) => of$(Boolean(calls[id]))),
        distinctUntilChanged(),
    );
    const currentCall = observeCurrentCall();
    const ccChannelId = currentCall.pipe(
        switchMap((call) => of$(call?.channelId)),
        distinctUntilChanged(),
    );
    const isInACall = currentCall.pipe(
        switchMap((call) => of$(Boolean(call?.connected))),
        distinctUntilChanged(),
    );
    const dismissed = combineLatest([channelId, observeCallsState(serverUrl)]).pipe(
        switchMap(([id, state]) => of$(Boolean(state.calls[id]?.dismissed[state.myUserId]))),
        distinctUntilChanged(),
    );
    const isInCurrentChannelCall = combineLatest([channelId, ccChannelId]).pipe(
        switchMap(([id, ccId]) => of$(id === ccId)),
        distinctUntilChanged(),
    );
    const showJoinCallBanner = combineLatest([isCallInCurrentChannel, dismissed, isInCurrentChannelCall]).pipe(
        switchMap(([isCall, dism, inCurrCall]) => of$(Boolean(isCall && !dism && !inCurrCall))),
        distinctUntilChanged(),
    );
    const showIncomingCalls = observeIncomingCalls().pipe(
        switchMap((ics) => of$(ics.incomingCalls.length > 0)),
        distinctUntilChanged(),
    );

    return {
        isCRTEnabled: observeIsCRTEnabled(database),
        showJoinCallBanner,
        isInACall,
        showIncomingCalls,
        rootId: of$(rId),
        rootPost,
    };
});

export default withDatabase(withServerUrl(enhanced(Thread)));
