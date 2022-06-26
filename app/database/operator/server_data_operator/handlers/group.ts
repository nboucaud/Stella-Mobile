// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {MM_TABLES} from '@constants/database';
import {transformGroupMembershipRecord, transformGroupRecord} from '@database/operator/server_data_operator/transformers/group';
import {getUniqueRawsBy} from '@database/operator/utils/general';
import {queryGroupMembershipForMember} from '@queries/servers/group';
import {logWarning} from '@utils/log';

import type {HandleGroupArgs, HandleGroupMembershipForMemberArgs} from '@typings/database/database';
import type GroupModel from '@typings/database/models/servers/group';
import type GroupMembershipModel from '@typings/database/models/servers/group_membership';

const {GROUP, GROUP_MEMBERSHIP} = MM_TABLES.SERVER;

export interface GroupHandlerMix {
    handleGroups: ({groups, prepareRecordsOnly}: HandleGroupArgs) => Promise<GroupModel[]>;
    handleGroupMembershipsForMember: ({userId, groups, prepareRecordsOnly}: HandleGroupMembershipForMemberArgs) => Promise<GroupMembershipModel[]>;
}

const GroupHandler = (superclass: any) => class extends superclass implements GroupHandlerMix {
    /**
      * handleGroups: Handler responsible for the Create/Update operations occurring on the Group table from the 'Server' schema
      * @param {HandleGroupArgs} groupsArgs
      * @param {Group[]} groupsArgs.groups
      * @param {boolean} groupsArgs.prepareRecordsOnly
      * @throws DataOperatorException
      * @returns {Promise<GroupModel[]>}
      */
    handleGroups = async ({groups, prepareRecordsOnly = true}: HandleGroupArgs): Promise<GroupModel[]> => {
        if (!groups?.length) {
            logWarning(
                'An empty or undefined "groups" array has been passed to the handleGroups method',
            );
            return [];
        }

        const createOrUpdateRawValues = getUniqueRawsBy({raws: groups, key: 'id'});

        return this.handleRecords({
            fieldName: 'id',
            transformer: transformGroupRecord,
            createOrUpdateRawValues,
            tableName: GROUP,
            prepareRecordsOnly,
        });
    };

    /**
     * handleGroupMembershipsForGroup: Handler responsible for the Create/Update operations occurring on the GroupMembership table from the 'Server' schema
     * @param {string} userId
     * @param {HandleGroupMembershipForMemberArgs} groupMembershipsArgs
     * @param {GroupMembership[]} groupMembershipsArgs.groupMemberships
     * @param {boolean} groupMembershipsArgs.prepareRecordsOnly
     * @throws DataOperatorException
     * @returns {Promise<GroupMembershipModel[]>}
     */
    handleGroupMembershipsForMember = async ({userId, groups, prepareRecordsOnly = true}: HandleGroupMembershipForMemberArgs): Promise<GroupMembershipModel[]> => {
        // Get existing group memberships
        const existingGroupMemberships = await queryGroupMembershipForMember(this.database, userId).fetch();

        let records: GroupMembershipModel[] = [];
        let rawValues: GroupMembership[] = [];

        // Nothing to add or remove
        if (!groups?.length && !existingGroupMemberships.length) {
            return records;
        }

        // No groups - remove all existing ones
        if (!groups?.length && existingGroupMemberships.length) {
            records = existingGroupMemberships.map((gm) => gm.prepareDestroyPermanently());
        }

        // No existing groups - add all new ones
        if (groups?.length && !existingGroupMemberships.length) {
            rawValues = groups.map((g) => ({id: `${g.id}-${userId}`, user_id: userId, group_id: g.id}));
        }

        if (groups?.length && existingGroupMemberships.length) {
            for (const gm of existingGroupMemberships) {
                // Check if existingGroups overlaps with groups
                const index = rawValues.findIndex((g) => g.id === gm.groupId);

                if (index > -1) {
                    // If there is an existing group already, we don't need to add it
                    rawValues.splice(index, 1);
                } else {
                    // No group? Remove existing one
                    records.push(gm.prepareDestroyPermanently());
                }
            }
        }

        records.push(...(await this.handleRecords({
            fieldName: 'id',
            transformer: transformGroupMembershipRecord,
            rawValues,
            tableName: GROUP_MEMBERSHIP,
            prepareRecordsOnly: true,
        })));

        // Batch update if there are records
        if (records.length && !prepareRecordsOnly) {
            await this.batchRecords(records);
        }

        return records;
    };
};

export default GroupHandler;
