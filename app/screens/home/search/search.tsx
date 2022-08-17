// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useIsFocused, useNavigation} from '@react-navigation/native';
import React, {useCallback, useMemo, useState} from 'react';
import {useIntl} from 'react-intl';
import {FlatList, LayoutChangeEvent, Platform, StyleSheet} from 'react-native';
import Animated, {useAnimatedStyle, withTiming} from 'react-native-reanimated';
import {Edge, SafeAreaView, useSafeAreaInsets} from 'react-native-safe-area-context';

import {addSearchToTeamSearchHistory} from '@actions/local/team';
import {searchPosts, searchFiles} from '@actions/remote/search';
import {queryPostsById} from '@app/queries/servers/post';
import Autocomplete from '@components/autocomplete';
import FreezeScreen from '@components/freeze_screen';
import Loading from '@components/loading';
import NavigationHeader from '@components/navigation_header';
import RoundedHeaderContext from '@components/rounded_header_context';
import {BOTTOM_TAB_HEIGHT} from '@constants/view';
import {useServerUrl} from '@context/server';
import {useTheme} from '@context/theme';
import DatabaseManager from '@database/manager';
import {useKeyboardHeight} from '@hooks/device';
import {useCollapsibleHeader} from '@hooks/header';
import {FileFilter, FileFilters, filterFileExtensions} from '@utils/file';
import {TabTypes, TabType} from '@utils/search';

import Initial from './initial';
import Results from './results';
import Header from './results/header';

import type PostModel from '@typings/database/models/servers/post';

const EDGES: Edge[] = ['bottom', 'left', 'right'];
const AnimatedFlatList = Animated.createAnimatedComponent(FlatList);

const emptyFileResults: FileInfo[] = [];
const emptyPosts: PostModel[] = [];
const emptyChannelIds: string[] = [];

const dummyData = [1];

const AutocompletePaddingTop = 4;
const AutocompleteZindex = 11;

type Props = {
    teamId: string;
}

const styles = StyleSheet.create({
    flex: {
        flex: 1,
    },
    loading: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
});

const getSearchParams = (terms: string, filterValue?: FileFilter) => {
    const fileExtensions = filterFileExtensions(filterValue);
    const extensionTerms = fileExtensions ? ' ' + fileExtensions : '';
    return {
        terms: terms + extensionTerms,
        is_or_search: true,
    };
};

const getPosts = async (serverUrl: string, ids: string[]) => {
    const database = DatabaseManager.serverDatabases[serverUrl]?.database;
    if (!database) {
        return [];
    }

    return queryPostsById(database, ids).fetch();
};

const searchScreenIndex = 1;

const SearchScreen = ({teamId}: Props) => {
    const nav = useNavigation();
    const isFocused = useIsFocused();
    const intl = useIntl();
    const theme = useTheme();
    const insets = useSafeAreaInsets();
    const keyboardHeight = useKeyboardHeight();

    const stateIndex = nav.getState().index;
    const serverUrl = useServerUrl();
    const searchTerm = (nav.getState().routes[stateIndex].params as any)?.searchTerm;

    const [cursorPosition, setCursorPosition] = useState(searchTerm?.length);
    const [searchValue, setSearchValue] = useState<string>(searchTerm);
    const [searchTeamId, setSearchTeamId] = useState<string>(teamId);
    const [selectedTab, setSelectedTab] = useState<TabType>(TabTypes.MESSAGES);
    const [filter, setFilter] = useState<FileFilter>(FileFilters.ALL);
    const [showResults, setShowResults] = useState(false);
    const [containerHeight, setContainerHeight] = useState(0);

    const [loading, setLoading] = useState(false);
    const [lastSearchedValue, setLastSearchedValue] = useState('');
    const [posts, setPosts] = useState<PostModel[]>(emptyPosts);
    const [fileInfos, setFileInfos] = useState<FileInfo[]>(emptyFileResults);
    const [fileChannelIds, setFileChannelIds] = useState<string[]>([]);

    const onSnap = (offset: number) => {
        scrollRef.current?.scrollToOffset({offset, animated: true});
    };

    const {scrollPaddingTop, scrollRef, scrollValue, onScroll, headerHeight, hideHeader} = useCollapsibleHeader<FlatList>(true, onSnap);

    const handleCancelAndClearSearch = useCallback(() => {
        setSearchValue('');
        setLastSearchedValue('');
        setFilter(FileFilters.ALL);
        setShowResults(false);
    }, []);

    const handleTextChange = useCallback((newValue: string) => {
        setSearchValue(newValue);
        setCursorPosition(newValue.length);
    }, []);

    const handleSearch = useCallback(async (newSearchTeamId: string, term: string) => {
        const searchParams = getSearchParams(term);
        if (!searchParams.terms) {
            handleCancelAndClearSearch();
            return;
        }
        setLoading(true);
        setFilter(FileFilters.ALL);
        setLastSearchedValue(term);
        addSearchToTeamSearchHistory(serverUrl, newSearchTeamId, term);
        const [postResults, {files, channels}] = await Promise.all([
            searchPosts(serverUrl, newSearchTeamId, searchParams),
            searchFiles(serverUrl, newSearchTeamId, searchParams),
        ]);

        setFileInfos(files?.length ? files : emptyFileResults);
        setPosts(postResults?.order?.length ? await getPosts(serverUrl, postResults.order) : emptyPosts);
        setFileChannelIds(channels?.length ? channels : emptyChannelIds);

        setShowResults(true);
        setLoading(false);
    }, [handleCancelAndClearSearch]);

    const onSubmit = useCallback(() => {
        handleSearch(searchTeamId, searchValue);
    }, [handleSearch, searchTeamId, searchValue]);

    const handleRecentSearch = useCallback((text: string) => {
        handleTextChange(text);
        handleSearch(searchTeamId, text);
    }, [handleSearch, handleTextChange, searchTeamId]);

    const handleFilterChange = useCallback(async (filterValue: FileFilter) => {
        setLoading(true);
        setFilter(filterValue);
        const searchParams = getSearchParams(lastSearchedValue, filterValue);
        const {files, channels} = await searchFiles(serverUrl, searchTeamId, searchParams);
        setFileInfos(files?.length ? files : emptyFileResults);
        setFileChannelIds(channels?.length ? channels : emptyChannelIds);

        setLoading(false);
    }, [lastSearchedValue, searchTeamId]);

    const handleResultsTeamChange = useCallback((newTeamId: string) => {
        setSearchTeamId(newTeamId);
        handleSearch(newTeamId, lastSearchedValue);
    }, [lastSearchedValue]);

    const loadingComponent = useMemo(() => (
        <Loading
            containerStyle={[styles.loading, {paddingTop: scrollPaddingTop}]}
            color={theme.buttonBg}
            size='large'
        />
    ), [theme, scrollPaddingTop]);

    const initialComponent = useMemo(() => (
        <Initial
            searchValue={searchValue}
            setRecentValue={handleRecentSearch}
            setSearchValue={handleTextChange}
            setTeamId={setSearchTeamId}
            teamId={searchTeamId}
        />
    ), [searchValue, searchTeamId, handleRecentSearch, handleTextChange]);

    const renderItem = useCallback(() => {
        if (loading) {
            return loadingComponent;
        }
        return initialComponent;
    }, [
        loading && loadingComponent,
        initialComponent,
    ]);

    const paddingTop = useMemo(() => ({paddingTop: scrollPaddingTop, flexGrow: 1}), [scrollPaddingTop]);

    const animated = useAnimatedStyle(() => {
        if (isFocused) {
            return {
                opacity: withTiming(1, {duration: 150}),
                flex: 1,
                transform: [{translateX: withTiming(0, {duration: 150})}],
            };
        }

        return {
            opacity: withTiming(0, {duration: 150}),
            transform: [{translateX: withTiming(stateIndex < searchScreenIndex ? 25 : -25, {duration: 150})}],
        };
    }, [isFocused, stateIndex]);

    const top = useAnimatedStyle(() => {
        return {
            top: headerHeight.value,
            zIndex: lastSearchedValue ? 10 : 0,
        };
    }, [headerHeight.value, lastSearchedValue]);

    const onLayout = useCallback((e: LayoutChangeEvent) => {
        setContainerHeight(e.nativeEvent.layout.height);
    }, []);

    let header = null;
    if (lastSearchedValue && !loading) {
        header = (
            <Header
                teamId={searchTeamId}
                setTeamId={handleResultsTeamChange}
                onTabSelect={setSelectedTab}
                onFilterChanged={handleFilterChange}
                numberMessages={posts.length}
                selectedTab={selectedTab}
                numberFiles={fileInfos.length}
                selectedFilter={filter}
            />
        );
    }

    const autocompleteRemoveFromHeight = headerHeight.value + Platform.select({
        ios: keyboardHeight ? keyboardHeight - BOTTOM_TAB_HEIGHT : insets.bottom,
        default: 0,
    });
    const autocompleteMaxHeight = containerHeight - autocompleteRemoveFromHeight;
    const autocompletePosition = AutocompletePaddingTop;
    const autocomplete = useMemo(() => (
        <Autocomplete
            updateValue={handleTextChange}
            cursorPosition={cursorPosition}
            value={searchValue}
            isSearch={true}
            hasFilesAttached={false}
            availableSpace={autocompleteMaxHeight}
            position={autocompletePosition}
            growDown={true}
        />
    ), [cursorPosition, handleTextChange, searchValue, autocompleteMaxHeight, autocompletePosition]);

    return (
        <FreezeScreen freeze={!isFocused}>
            <NavigationHeader
                isLargeTitle={true}
                showBackButton={false}
                title={intl.formatMessage({id: 'screen.search.title', defaultMessage: 'Search'})}
                hasSearch={true}
                scrollValue={scrollValue}
                hideHeader={hideHeader}
                onChangeText={handleTextChange}
                onSubmitEditing={onSubmit}
                blurOnSubmit={true}
                placeholder={intl.formatMessage({id: 'screen.search.placeholder', defaultMessage: 'Search messages & files'})}
                onClear={handleCancelAndClearSearch}
                onCancel={handleCancelAndClearSearch}
                defaultValue={searchValue}
            />
            <Animated.View style={[top, {zIndex: AutocompleteZindex}]}>
                {autocomplete}
            </Animated.View>
            <SafeAreaView
                style={styles.flex}
                edges={EDGES}
                onLayout={onLayout}
            >
                <Animated.View style={animated}>
                    <Animated.View style={top}>
                        <RoundedHeaderContext/>
                        {header}
                    </Animated.View>
                    {!showResults &&
                        <AnimatedFlatList
                            data={dummyData}
                            contentContainerStyle={paddingTop}
                            keyboardShouldPersistTaps='handled'
                            keyboardDismissMode={'interactive'}
                            nestedScrollEnabled={true}
                            indicatorStyle='black'
                            onScroll={onScroll}
                            scrollEventThrottle={16}
                            removeClippedSubviews={false}
                            scrollToOverflowEnabled={true}
                            overScrollMode='always'
                            ref={scrollRef}
                            renderItem={renderItem}
                        />
                    }
                    {showResults &&
                        <Results
                            selectedTab={selectedTab}
                            searchValue={lastSearchedValue}
                            posts={posts}
                            fileInfos={fileInfos}
                            scrollPaddingTop={scrollPaddingTop}
                            fileChannelIds={fileChannelIds}
                        />
                    }
                </Animated.View>
            </SafeAreaView>
        </FreezeScreen>
    );
};

export default SearchScreen;
