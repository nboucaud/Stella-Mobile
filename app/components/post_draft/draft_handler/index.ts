// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {withDatabase} from '@nozbe/watermelondb/DatabaseProvider';
import withObservables from '@nozbe/with-observables';
import {combineLatest, of as of$} from 'rxjs';
import {switchMap} from 'rxjs/operators';

import {MM_TABLES, SYSTEM_IDENTIFIERS} from '@constants/database';
import {DEFAULT_SERVER_MAX_FILE_SIZE} from '@constants/post_draft';
import {isMinimumServerVersion} from '@utils/helpers';

import DraftHandler from './draft_handler';

import type {WithDatabaseArgs} from '@typings/database/database';
import type SystemModel from '@typings/database/models/servers/system';

const {SERVER: {SYSTEM}} = MM_TABLES;

const enhanced = withObservables([], ({database}: WithDatabaseArgs) => {
    const config = database.get<SystemModel>(SYSTEM).findAndObserve(SYSTEM_IDENTIFIERS.CONFIG).pipe(
        switchMap(({value}) => of$(value as ClientConfig)),
    );

    const license = database.get<SystemModel>(SYSTEM).findAndObserve(SYSTEM_IDENTIFIERS.LICENSE).pipe(
        switchMap(({value}) => of$(value as ClientLicense)),
    );

    const canUploadFiles = combineLatest([config, license]).pipe(
        switchMap(([c, l]) => of$(
            c.EnableFileAttachments !== 'false' &&
                (l.IsLicensed === 'false' || l.Compliance === 'false' || c.EnableMobileFileUpload !== 'false'),
        ),
        ),
    );

    const maxFileSize = config.pipe(
        switchMap((cfg) => of$(parseInt(cfg.MaxFileSize || '0', 10) || DEFAULT_SERVER_MAX_FILE_SIZE)),
    );

    const maxFileCount = config.pipe(
        switchMap((cfg) => of$(isMinimumServerVersion(cfg.Version, 6, 0) ? 10 : 5)),
    );

    return {
        maxFileSize,
        maxFileCount,
        canUploadFiles,
    };
});

export default withDatabase(enhanced(DraftHandler));
