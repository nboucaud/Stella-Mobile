// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useRef, useState} from 'react';
import {useIntl} from 'react-intl';

import {fetchChannels, searchChannels} from '@actions/remote/channel';
import ChannelSelector from '@components/channel_selector';
import {useServerUrl} from '@context/server';
import DatabaseManager from '@database/manager';
import {debounce} from '@helpers/api/general';
import {observeCanManageChannelMembers} from '@queries/servers/role';
import {getCurrentUser} from '@queries/servers/user';

import FooterButton from './footer_button';

const defaultChannels: Channel[] = [];

const filterInvitableChannels = async (serverUrl: string, channels: Channel[]) => {
    const {database} = DatabaseManager.getServerDatabaseAndOperator(serverUrl);
    const currentUser = await getCurrentUser(database);

    if (!database || !currentUser) {
        return [];
    }

    return channels.filter((channel) => {
        const canManage = observeCanManageChannelMembers(database, channel.id, currentUser);

        return canManage.subscribe();
    });
};

type SelectionChannelsProps = {
    teamId: string;
    selectedChannels: Channel[];
    onAddChannels: (channels: Channel[]) => void;
    onGetFooterButton: (button: React.ReactNode) => void;
}

export default function SelectionChannels({
    teamId,
    selectedChannels,
    onAddChannels,
    onGetFooterButton,
}: SelectionChannelsProps) {
    const {formatMessage, locale} = useIntl();
    const serverUrl = useServerUrl();

    const [preselectedChannels, setPreselectedChannels] = useState(selectedChannels);
    const [term, setTerm] = useState('');
    const [loading, setLoading] = useState(false);
    const [channels, setChannels] = useState<Channel[]>(defaultChannels);
    const [searchResults, setSearchResults] = useState<Channel[]>(defaultChannels);
    const [visibleChannels, setVisibleChannels] = useState<Channel[]>([]);
    const [modified, setModified] = useState(false);

    const page = useRef<number>(-1);
    const next = useRef(true);
    const searchTimeout = useRef<NodeJS.Timeout>();

    const stopSearch = useCallback(() => {
        setSearchResults(defaultChannels);
        setTerm('');
    }, []);

    const doGetChannels = useCallback(debounce(async () => {
        if (next.current && !loading && !term) {
            setLoading(true);
            page.current += 1;

            const {channels: channelsData} = await fetchChannels(serverUrl, teamId, page.current);
            const results: Channel[] = channelsData ? await filterInvitableChannels(serverUrl, channelsData) : [];

            if (results.length) {
                setChannels([...channels, ...results]);
            } else {
                next.current = false;
            }

            setLoading(false);
        }
    }, 100), [loading, term, serverUrl, teamId]);

    const doSearchChannels = useCallback((text: string) => {
        setLoading(true);

        if (text) {
            setSearchResults(defaultChannels);

            if (searchTimeout.current) {
                clearTimeout(searchTimeout.current);
            }

            searchTimeout.current = setTimeout(async () => {
                const {channels: searchChannelsData} = await searchChannels(serverUrl, text, teamId);
                const results: Channel[] = searchChannelsData ? await filterInvitableChannels(serverUrl, searchChannelsData) : [];

                if (channels) {
                    setSearchResults(results);
                }
            }, 500);
            setTerm(text);
        } else {
            stopSearch();
        }

        setLoading(false);
    }, [stopSearch]);

    const handleOnSelectChannel = useCallback((channel: Channel) => {
        const {id: channelId} = channel;
        const index = preselectedChannels.findIndex(({id}) => id === channelId);

        if (index === -1) {
            setPreselectedChannels([...preselectedChannels, channel]);
        } else {
            const newChannels = [...preselectedChannels];
            newChannels.splice(index, 1);

            setPreselectedChannels(newChannels);
        }

        setModified(true);
    }, [preselectedChannels]);

    const handleOnAddChannels = useCallback(() => {
        onAddChannels(preselectedChannels);
    }, [onAddChannels, preselectedChannels]);

    useEffect(() => {
        doGetChannels();
    }, []);

    useEffect(() => {
        if (term) {
            setVisibleChannels(searchResults);
        } else {
            setVisibleChannels(channels);
        }
    }, [channels, searchResults, term]);

    useEffect(() => {
        onGetFooterButton(
            <FooterButton
                text={formatMessage({id: 'invite.selection_channel.add', defaultMessage: 'Add selected channels'})}
                disabled={!preselectedChannels.length || !modified}
                onPress={handleOnAddChannels}
                testID='add_channels'
            />,
        );
    }, [handleOnAddChannels, !preselectedChannels.length, locale]);

    useEffect(() => {
        return () => {
            if (searchTimeout.current) {
                clearTimeout(searchTimeout.current);
            }
        };
    }, []);

    return (
        <ChannelSelector
            term={term}
            searchChannels={doSearchChannels}
            stopSearch={stopSearch}
            channels={visibleChannels}
            selectedChannels={preselectedChannels}
            loading={loading}
            itemSeparator={false}
            itemSelectable={true}
            onEndReached={doGetChannels}
            onSelectChannel={handleOnSelectChannel}
        />
    );
}
