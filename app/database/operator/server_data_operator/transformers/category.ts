// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {MM_TABLES} from '@constants/database';
import {prepareBaseRecord} from '@database/operator/server_data_operator/transformers/index';
import {OperationType} from '@typings/database/enums';

import type {TransformerArgs} from '@typings/database/database';
import type CategoryModel from '@typings/database/models/servers/category';
import type CategoryChannelModel from '@typings/database/models/servers/category_channel';

const {
    CATEGORY,
    CATEGORY_CHANNEL,
} = MM_TABLES.SERVER;

/**
 * transformCategoryRecord: Prepares a record of the SERVER database 'Category' table for update or create actions.
 * @param {TransformerArgs} operator
 * @param {Database} operator.database
 * @param {RecordPair} operator.value
 * @returns {Promise<CategoryModel>}
 */
export const transformCategoryRecord = ({action, database, value}: TransformerArgs): Promise<CategoryModel> => {
    const raw = value.raw as Category;
    const record = value.record as CategoryModel;
    const isCreateAction = action === OperationType.CREATE;

    // id of category comes from server response
    const fieldsMapper = (category: CategoryModel) => {
        category._raw.id = isCreateAction ? (raw?.id ?? category.id) : record.id;
        category.displayName = raw.display_name;
        category.sorting = raw.sorting || 'recent';
        category.sortOrder = raw.sort_order === 0 ? 0 : raw.sort_order / 10; // Sort order from server is in multiples of 10
        category.muted = raw.muted ?? false;
        category.collapsed = isCreateAction ? false : record.collapsed;
        category.type = raw.type;
        category.teamId = raw.team_id;
    };

    return prepareBaseRecord({
        action,
        database,
        tableName: CATEGORY,
        value,
        fieldsMapper,
    }) as Promise<CategoryModel>;
};

/**
 * transformCategoryChannelRecord: Prepares a record of the SERVER database 'CategoryChannel' table for update or create actions.
 * @param {TransformerArgs} operator
 * @param {Database} operator.database
 * @param {RecordPair} operator.value
 * @returns {Promise<CategoryChannelModel>}
 */
export const transformCategoryChannelRecord = ({action, database, value}: TransformerArgs): Promise<CategoryChannelModel> => {
    const raw = value.raw as CategoryChannel;
    const record = value.record as CategoryChannelModel;
    const isCreateAction = action === OperationType.CREATE;

    // If isCreateAction is true, we will use the id (API response) from the RAW, else we shall use the existing record id from the database
    const fieldsMapper = (categoryChannel: CategoryChannelModel) => {
        categoryChannel._raw.id = isCreateAction ? (raw?.id ?? categoryChannel.id) : record.id;
        categoryChannel.channelId = raw.channel_id;
        categoryChannel.categoryId = raw.category_id;
        categoryChannel.sortOrder = raw.sort_order;
    };

    return prepareBaseRecord({
        action,
        database,
        tableName: CATEGORY_CHANNEL,
        value,
        fieldsMapper,
    }) as Promise<CategoryChannelModel>;
};
