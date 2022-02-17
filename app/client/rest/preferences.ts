// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export interface ClientPreferencesMix {
    savePreferences: (userId: string, preferences: PreferenceType[]) => Promise<any>;
    deletePreferences: (userId: string, preferences: PreferenceType[]) => Promise<any>;
    getMyPreferences: () => Promise<PreferenceType[]>;
}

const ClientPreferences = (superclass: any) => class extends superclass {
    savePreferences = async (userId: string, preferences: PreferenceType[]) => {
        //todo: confirm if this analytics string is used on other platforms; for it can be changed to action
        // event from v1 is 'action_posts_flag';
        this.analytics.trackAPI('api_preferences_save_post');
        return this.doFetch(
            `${this.getPreferencesRoute(userId)}`,
            {method: 'put', body: preferences},
        );
    };

    getMyPreferences = async () => {
        return this.doFetch(
            `${this.getPreferencesRoute('me')}`,
            {method: 'get'},
        );
    };

    deletePreferences = async (userId: string, preferences: PreferenceType[]) => {
        this.analytics.trackAPI('action_posts_unflag');
        return this.doFetch(
            `${this.getPreferencesRoute(userId)}/delete`,
            {method: 'post', body: preferences},
        );
    };
};

export default ClientPreferences;
