// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Model} from '@nozbe/watermelondb';

import {queryMyTeamById} from '@app/queries/servers/team';
import DatabaseManager from '@database/manager';

import type TeamModel from '@typings/database/models/servers/team';
import type TeamMembershipModel from '@typings/database/models/servers/team_membership';

export const localRemoveUserFromTeam = async (serverUrl: string, teamId: string, userId: string) => {
    const serverDatabase = DatabaseManager.serverDatabases[serverUrl];
    if (!serverDatabase) {
        return;
    }

    const {operator, database} = serverDatabase;
    const myTeam = await queryMyTeamById(database, teamId);
    const models: Model[] = [];
    if (myTeam) {
        const team = await myTeam.team.fetch() as TeamModel;
        const members: TeamMembershipModel[] = await team.members.fetch();
        const member = members.find((m) => m.userId === userId);

        myTeam.prepareDestroyPermanently();
        models.push(myTeam);
        if (member) {
            member.prepareDestroyPermanently();
            models.push(member);
        }

        if (models.length) {
            await operator.batchRecords(models);
        }
    }
};
