// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Database} from '@nozbe/watermelondb';
import {IntlShape} from 'react-intl';

import {doAppCall} from '@actions/remote/apps';
import {fetchChannelById, fetchChannelByName, searchChannels} from '@actions/remote/channel';
import {fetchUsersByIds, fetchUsersByUsernames, searchUsers} from '@actions/remote/user';
import {AppCallResponseTypes, AppCallTypes, AppFieldTypes, COMMAND_SUGGESTION_ERROR} from '@constants/apps';
import DatabaseManager from '@database/manager';
import {queryChannelById, queryChannelByName} from '@queries/servers/channel';
import {queryCurrentTeamId} from '@queries/servers/system';
import {queryUsersById, queryUsersByUsername} from '@queries/servers/user';
import ChannelModel from '@typings/database/models/servers/channel';
import UserModel from '@typings/database/models/servers/user';
import {createCallRequest, filterEmptyOptions} from '@utils/apps';

import {getChannelSuggestions, getUserSuggestions, inTextMentionSuggestions} from './mentions';
/* eslint-disable max-lines */

export enum ParseState {
    Start = 'Start',
    Command = 'Command',
    EndCommand = 'EndCommand',
    CommandSeparator = 'CommandSeparator',
    StartParameter = 'StartParameter',
    ParameterSeparator = 'ParameterSeparator',
    Flag1 = 'Flag1',
    Flag = 'Flag',
    FlagValueSeparator = 'FlagValueSeparator',
    StartValue = 'StartValue',
    NonspaceValue = 'NonspaceValue',
    QuotedValue = 'QuotedValue',
    TickValue = 'TickValue',
    EndValue = 'EndValue',
    EndQuotedValue = 'EndQuotedValue',
    EndTickedValue = 'EndTickedValue',
    Error = 'Error',
    Rest = 'Rest',
}

interface FormsCache {
    getForm: (location: string, binding: AppBinding) => Promise<{form?: AppForm; error?: string} | undefined>;
}

interface Intl {
    formatMessage(config: {id: string; defaultMessage: string}, values?: {[name: string]: any}): string;
}

// TODO: Implemnet app bindings
const getCommandBindings = () => {
    return [];
};
const getRHSCommandBindings = () => {
    return [];
};
const getAppRHSCommandForm = (key: string) => {// eslint-disable-line @typescript-eslint/no-unused-vars
    return undefined;
};
const getAppCommandForm = (key: string) => {// eslint-disable-line @typescript-eslint/no-unused-vars
    return undefined;
};
const setAppRHSCommandForm = (key: string, form: AppForm) => {// eslint-disable-line @typescript-eslint/no-unused-vars
    return undefined;
};
const setAppCommandForm = (key: string, form: AppForm) => {// eslint-disable-line @typescript-eslint/no-unused-vars
    return undefined;
};

// Common dependencies with Webapp. Due to the big change of removing redux, we may have to rethink how to deal with this.
const getExecuteSuggestion = (parsed: ParsedCommand) => null; // eslint-disable-line @typescript-eslint/no-unused-vars
export const EXECUTE_CURRENT_COMMAND_ITEM_ID = '_execute_current_command';
export const parserErrorMessage = (intl: IntlShape, error: string, _command: string, _position: number): string => { // eslint-disable-line @typescript-eslint/no-unused-vars
    return intl.formatMessage({
        id: 'apps.error.parser',
        defaultMessage: 'Parsing error: {error}',
    }, {
        error,
    });
};

export type ExtendedAutocompleteSuggestion = AutocompleteSuggestion & {
    type?: string;
    item?: UserProfile | UserModel | Channel | ChannelModel;
}

export class ParsedCommand {
    state = ParseState.Start;
    command: string;
    i = 0;
    incomplete = '';
    incompleteStart = 0;
    binding: AppBinding | undefined;
    form: AppForm | undefined;
    formsCache: FormsCache;
    field: AppField | undefined;
    position = 0;
    values: {[name: string]: string} = {};
    location = '';
    error = '';
    intl: Intl;

    constructor(command: string, formsCache: FormsCache, intl: IntlShape) {
        this.command = command;
        this.formsCache = formsCache || [];
        this.intl = intl;
    }

    private asError = (message: string): ParsedCommand => {
        this.state = ParseState.Error;
        this.error = message;
        return this;
    };

    private findBinding = (b: AppBinding) => b.label.toLowerCase() === this.incomplete.toLowerCase();

    // matchBinding finds the closest matching command binding.
    public matchBinding = async (commandBindings: AppBinding[], autocompleteMode = false): Promise<ParsedCommand> => {
        if (commandBindings.length === 0) {
            return this.asError(this.intl.formatMessage({
                id: 'apps.error.parser.no_bindings',
                defaultMessage: 'No command bindings.',
            }));
        }
        let bindings = commandBindings;

        let done = false;
        while (!done) {
            let c = '';
            if (this.i < this.command.length) {
                c = this.command[this.i];
            }

            switch (this.state) {
                case ParseState.Start: {
                    if (c !== '/') {
                        return this.asError(this.intl.formatMessage({
                            id: 'apps.error.parser.no_slash_start',
                            defaultMessage: 'Command must start with a `/`.',
                        }));
                    }
                    this.i++;
                    this.incomplete = '';
                    this.incompleteStart = this.i;
                    this.state = ParseState.Command;
                    break;
                }

                case ParseState.Command: {
                    switch (c) {
                        case '': {
                            if (autocompleteMode) {
                                // Finish in the Command state, 'incomplete' will have the query string
                                done = true;
                            } else {
                                this.state = ParseState.EndCommand;
                            }
                            break;
                        }
                        case ' ':
                        case '\t': {
                            this.state = ParseState.EndCommand;
                            break;
                        }
                        default:
                            this.incomplete += c;
                            this.i++;
                            break;
                    }
                    break;
                }

                case ParseState.EndCommand: {
                    const binding = bindings.find(this.findBinding);
                    if (!binding) {
                    // gone as far as we could, this token doesn't match a sub-command.
                    // return the state from the last matching binding
                        done = true;
                        break;
                    }
                    this.binding = binding;
                    this.location += '/' + binding.label;
                    bindings = binding.bindings || [];
                    this.state = ParseState.CommandSeparator;
                    break;
                }

                case ParseState.CommandSeparator: {
                    if (c === '') {
                        done = true;
                    }

                    switch (c) {
                        case ' ':
                        case '\t': {
                            this.i++;
                            break;
                        }
                        default: {
                            this.incomplete = '';
                            this.incompleteStart = this.i;
                            this.state = ParseState.Command;
                            break;
                        }
                    }
                    break;
                }

                default: {
                    return this.asError(this.intl.formatMessage({
                        id: 'apps.error.parser.unexpected_state',
                        defaultMessage: 'Unreachable: Unexpected state in matchBinding: `{state}`.',
                    }, {
                        state: this.state,
                    }));
                }
            }
        }

        if (!this.binding) {
            if (autocompleteMode) {
                return this;
            }

            return this.asError(this.intl.formatMessage({
                id: 'apps.error.parser.no_match',
                defaultMessage: '`{command}`: No matching command found in this workspace.',
            }, {
                command: this.command,
            }));
        }

        if (!autocompleteMode && this.binding.bindings?.length) {
            return this.asError(this.intl.formatMessage({
                id: 'apps.error.parser.execute_non_leaf',
                defaultMessage: 'You must select a subcommand.',
            }));
        }

        if (!this.binding.bindings?.length) {
            this.form = this.binding?.form;
            if (!this.form) {
                const fetched = await this.formsCache.getForm(this.location, this.binding);
                if (fetched?.error) {
                    return this.asError(fetched.error);
                }
                this.form = fetched?.form;
            }
        }

        return this;
    };

    // parseForm parses the rest of the command using the previously matched form.
    public parseForm = (autocompleteMode = false): ParsedCommand => {
        if (this.state === ParseState.Error || !this.form) {
            return this;
        }

        let fields: AppField[] = [];
        if (this.form.fields) {
            fields = this.form.fields;
        }

        fields = fields.filter((f) => f.type !== AppFieldTypes.MARKDOWN && !f.readonly);
        this.state = ParseState.StartParameter;
        this.i = this.incompleteStart || 0;
        let flagEqualsUsed = false;
        let escaped = false;

        // eslint-disable-next-line no-constant-condition
        while (true) {
            let c = '';
            if (this.i < this.command.length) {
                c = this.command[this.i];
            }

            switch (this.state) {
                case ParseState.StartParameter: {
                    switch (c) {
                        case '':
                            return this;
                        case '-': {
                            // Named parameter (aka Flag). Flag1 consumes the optional second '-'.
                            this.state = ParseState.Flag1;
                            this.i++;
                            break;
                        }
                        case '—': {
                            // Em dash, introduced when two '-' are set in iOS. Will be considered as such.
                            this.state = ParseState.Flag;
                            this.i++;
                            this.incomplete = '';
                            this.incompleteStart = this.i;
                            flagEqualsUsed = false;
                            break;
                        }
                        default: {
                            // Positional parameter.
                            this.position++;
                            // eslint-disable-next-line no-loop-func
                            let field = fields.find((f: AppField) => f.position === this.position);
                            if (!field) {
                                field = fields.find((f) => f.position === -1 && f.type === AppFieldTypes.TEXT);
                                if (!field || this.values[field.name]) {
                                    return this.asError(this.intl.formatMessage({
                                        id: 'apps.error.parser.no_argument_pos_x',
                                        defaultMessage: 'Unable to identify argument.',
                                    }));
                                }
                                this.incompleteStart = this.i;
                                this.incomplete = '';
                                this.field = field;
                                this.state = ParseState.Rest;
                                break;
                            }
                            this.field = field;
                            this.state = ParseState.StartValue;
                            break;
                        }
                    }
                    break;
                }

                case ParseState.Rest: {
                    if (!this.field) {
                        return this.asError(this.intl.formatMessage({
                            id: 'apps.error.parser.missing_field_value',
                            defaultMessage: 'Field value is missing.',
                        }));
                    }

                    if (autocompleteMode && c === '') {
                        return this;
                    }

                    if (c === '') {
                        this.values[this.field.name] = this.incomplete;
                        return this;
                    }

                    this.i++;
                    this.incomplete += c;
                    break;
                }

                case ParseState.ParameterSeparator: {
                    this.incompleteStart = this.i;
                    switch (c) {
                        case '':
                            this.state = ParseState.StartParameter;
                            return this;
                        case ' ':
                        case '\t': {
                            this.i++;
                            break;
                        }
                        default:
                            this.state = ParseState.StartParameter;
                            break;
                    }
                    break;
                }

                case ParseState.Flag1: {
                // consume the optional second '-'
                    if (c === '-') {
                        this.i++;
                    }
                    this.state = ParseState.Flag;
                    this.incomplete = '';
                    this.incompleteStart = this.i;
                    flagEqualsUsed = false;
                    break;
                }

                case ParseState.Flag: {
                    if (c === '' && autocompleteMode) {
                        return this;
                    }

                    switch (c) {
                        case '':
                        case ' ':
                        case '\t':
                        case '=': {
                            const field = fields.find((f) => f.label?.toLowerCase() === this.incomplete.toLowerCase());
                            if (!field) {
                                return this.asError(this.intl.formatMessage({
                                    id: 'apps.error.parser.unexpected_flag',
                                    defaultMessage: 'Command does not accept flag `{flagName}`.',
                                }, {
                                    flagName: this.incomplete,
                                }));
                            }
                            this.state = ParseState.FlagValueSeparator;
                            this.field = field;
                            this.incomplete = '';
                            break;
                        }
                        default: {
                            this.incomplete += c;
                            this.i++;
                            break;
                        }
                    }
                    break;
                }

                case ParseState.FlagValueSeparator: {
                    this.incompleteStart = this.i;
                    switch (c) {
                        case '': {
                            if (autocompleteMode) {
                                return this;
                            }
                            this.state = ParseState.StartValue;
                            break;
                        }
                        case ' ':
                        case '\t': {
                            this.i++;
                            break;
                        }
                        case '=': {
                            if (flagEqualsUsed) {
                                return this.asError(this.intl.formatMessage({
                                    id: 'apps.error.parser.multiple_equal',
                                    defaultMessage: 'Multiple `=` signs are not allowed.',
                                }));
                            }
                            flagEqualsUsed = true;
                            this.i++;
                            break;
                        }
                        default: {
                            this.state = ParseState.StartValue;
                        }
                    }
                    break;
                }

                case ParseState.StartValue: {
                    this.incomplete = '';
                    this.incompleteStart = this.i;
                    switch (c) {
                        case '"': {
                            this.state = ParseState.QuotedValue;
                            this.i++;
                            break;
                        }
                        case '`': {
                            this.state = ParseState.TickValue;
                            this.i++;
                            break;
                        }
                        case ' ':
                        case '\t':
                            return this.asError(this.intl.formatMessage({
                                id: 'apps.error.parser.unexpected_whitespace',
                                defaultMessage: 'Unreachable: Unexpected whitespace.',
                            }));
                        default: {
                            this.state = ParseState.NonspaceValue;
                            break;
                        }
                    }
                    break;
                }

                case ParseState.NonspaceValue: {
                    switch (c) {
                        case '':
                        case ' ':
                        case '\t': {
                            this.state = ParseState.EndValue;
                            break;
                        }
                        default: {
                            this.incomplete += c;
                            this.i++;
                            break;
                        }
                    }
                    break;
                }

                case ParseState.QuotedValue: {
                    switch (c) {
                        case '': {
                            if (!autocompleteMode) {
                                return this.asError(this.intl.formatMessage({
                                    id: 'apps.error.parser.missing_quote',
                                    defaultMessage: 'Matching double quote expected before end of input.',
                                }));
                            }
                            return this;
                        }
                        case '"': {
                            if (this.incompleteStart === this.i - 1) {
                                return this.asError(this.intl.formatMessage({
                                    id: 'apps.error.parser.empty_value',
                                    defaultMessage: 'Empty values are not allowed.',
                                }));
                            }
                            this.i++;
                            this.state = ParseState.EndQuotedValue;
                            break;
                        }
                        case '\\': {
                            escaped = true;
                            this.i++;
                            break;
                        }
                        default: {
                            this.incomplete += c;
                            this.i++;
                            if (escaped) {
                                //TODO: handle \n, \t, other escaped chars
                                escaped = false;
                            }
                            break;
                        }
                    }
                    break;
                }

                case ParseState.TickValue: {
                    switch (c) {
                        case '': {
                            if (!autocompleteMode) {
                                return this.asError(this.intl.formatMessage({
                                    id: 'apps.error.parser.missing_tick',
                                    defaultMessage: 'Matching tick quote expected before end of input.',
                                }));
                            }
                            return this;
                        }
                        case '`': {
                            if (this.incompleteStart === this.i - 1) {
                                return this.asError(this.intl.formatMessage({
                                    id: 'apps.error.parser.empty_value',
                                    defaultMessage: 'Empty values are not allowed.',
                                }));
                            }
                            this.i++;
                            this.state = ParseState.EndTickedValue;
                            break;
                        }
                        default: {
                            this.incomplete += c;
                            this.i++;
                            break;
                        }
                    }
                    break;
                }

                case ParseState.EndTickedValue:
                case ParseState.EndQuotedValue:
                case ParseState.EndValue: {
                    if (!this.field) {
                        return this.asError(this.intl.formatMessage({
                            id: 'apps.error.parser.missing_field_value',
                            defaultMessage: 'Field value is missing.',
                        }));
                    }

                    // special handling for optional BOOL values ('--boolflag true'
                    // vs '--boolflag next-positional' vs '--boolflag
                    // --next-flag...')
                    if (this.field.type === AppFieldTypes.BOOL &&
                    ((autocompleteMode && !'true'.startsWith(this.incomplete) && !'false'.startsWith(this.incomplete)) ||
                    (!autocompleteMode && this.incomplete !== 'true' && this.incomplete !== 'false'))) {
                    // reset back where the value started, and treat as a new parameter
                        this.i = this.incompleteStart;
                        this.values[this.field.name] = 'true';
                        this.state = ParseState.StartParameter;
                    } else {
                        if (autocompleteMode && c === '') {
                            return this;
                        }
                        this.values[this.field.name] = this.incomplete;
                        this.incomplete = '';
                        this.incompleteStart = this.i;
                        if (c === '') {
                            return this;
                        }
                        this.state = ParseState.ParameterSeparator;
                    }
                    break;
                }
            }
        }
    };
}

export class AppCommandParser {
    private serverUrl: string;
    private database: Database;
    private channelID: string;
    private teamID: string;
    private rootPostID?: string;
    private intl: IntlShape;
    private theme: Theme;

    constructor(serverUrl: string, intl: IntlShape, channelID: string, teamID = '', rootPostID = '', theme: Theme) {
        this.serverUrl = serverUrl;
        this.database = DatabaseManager.serverDatabases[serverUrl]?.database;
        this.channelID = channelID;
        this.rootPostID = rootPostID;
        this.teamID = teamID;
        this.intl = intl;
        this.theme = theme;
    }

    // composeCallFromCommand creates the form submission call
    public composeCallFromCommand = async (command: string): Promise<{call: AppCallRequest | null; errorMessage?: string}> => {
        let parsed = new ParsedCommand(command, this, this.intl);

        const commandBindings = this.getCommandBindings();
        if (!commandBindings) {
            return {call: null,
                errorMessage: this.intl.formatMessage({
                    id: 'apps.error.parser.no_bindings',
                    defaultMessage: 'No command bindings.',
                })};
        }

        parsed = await parsed.matchBinding(commandBindings, false);
        parsed = parsed.parseForm(false);
        if (parsed.state === ParseState.Error) {
            return {call: null, errorMessage: parserErrorMessage(this.intl, parsed.error, parsed.command, parsed.i)};
        }

        await this.addDefaultAndReadOnlyValues(parsed);

        const missing = this.getMissingFields(parsed);
        if (missing.length > 0) {
            const missingStr = missing.map((f) => f.label).join(', ');
            return {call: null,
                errorMessage: this.intl.formatMessage({
                    id: 'apps.error.command.field_missing',
                    defaultMessage: 'Required fields missing: `{fieldName}`.',
                }, {
                    fieldName: missingStr,
                })};
        }

        return this.composeCallFromParsed(parsed);
    };

    private async addDefaultAndReadOnlyValues(parsed: ParsedCommand) {
        if (!parsed.form?.fields) {
            return;
        }

        await Promise.all(parsed.form.fields.map(async (f) => {
            if (!f.value) {
                return;
            }

            if (f.readonly || !(f.name in parsed.values)) {
                switch (f.type) {
                    case AppFieldTypes.TEXT:
                        parsed.values[f.name] = f.value as string;
                        break;
                    case AppFieldTypes.BOOL:
                        parsed.values[f.name] = 'true';
                        break;
                    case AppFieldTypes.USER: {
                        const userID = (f.value as AppSelectOption).value;
                        let user: UserModel | UserProfile = (await queryUsersById(this.database, [userID]))[0];
                        if (!user) {
                            const res = await fetchUsersByIds(this.serverUrl, [userID]);
                            if ('error' in res) {
                            // Silently fail on default value
                                break;
                            }
                            user = res.users[0] || res.existingUsers[0];
                        }
                        parsed.values[f.name] = user.username;
                        break;
                    }
                    case AppFieldTypes.CHANNEL: {
                        const channelID = (f.value as AppSelectOption).label;
                        let channel: ChannelModel | Channel | undefined = await queryChannelById(this.database, channelID);
                        if (!channel) {
                            const res = await fetchChannelById(this.serverUrl, channelID);
                            if ('error' in res) {
                            // Silently fail on default value
                                break;
                            }
                            channel = res.channel;
                        }
                        parsed.values[f.name] = channel.name;
                        break;
                    }
                    case AppFieldTypes.STATIC_SELECT:
                    case AppFieldTypes.DYNAMIC_SELECT:
                        parsed.values[f.name] = (f.value as AppSelectOption).value;
                        break;
                    case AppFieldTypes.MARKDOWN:

                    // Do nothing
                }
            }
        }) || []);
    }

    // getSuggestionsBase is a synchronous function that returns results for base commands
    public getSuggestionsBase = (pretext: string): AutocompleteSuggestion[] => {
        const command = pretext.toLowerCase();
        const result: AutocompleteSuggestion[] = [];

        const bindings = this.getCommandBindings();

        for (const binding of bindings) {
            let base = binding.label;
            if (!base) {
                continue;
            }

            if (base[0] !== '/') {
                base = '/' + base;
            }

            if (base.startsWith(command)) {
                result.push({
                    complete: binding.label,
                    suggestion: base,
                    description: binding.description || '',
                    hint: binding.hint || '',
                    iconData: binding.icon || '',
                });
            }
        }

        return result;
    };

    // getSuggestions returns suggestions for subcommands and/or form arguments
    public getSuggestions = async (pretext: string): Promise<ExtendedAutocompleteSuggestion[]> => {
        let parsed = new ParsedCommand(pretext, this, this.intl);
        let suggestions: ExtendedAutocompleteSuggestion[] = [];

        const commandBindings = this.getCommandBindings();
        if (!commandBindings) {
            return [];
        }

        parsed = await parsed.matchBinding(commandBindings, true);
        if (parsed.state === ParseState.Error) {
            suggestions = this.getErrorSuggestion(parsed);
        }

        if (parsed.state === ParseState.Command) {
            suggestions = this.getCommandSuggestions(parsed);
        }

        if (parsed.form || parsed.incomplete) {
            parsed = parsed.parseForm(true);
            if (parsed.state === ParseState.Error) {
                suggestions = this.getErrorSuggestion(parsed);
            }
            const argSuggestions = await this.getParameterSuggestions(parsed);
            suggestions = suggestions.concat(argSuggestions);
        }

        // Add "Execute Current Command" suggestion
        // TODO get full text from SuggestionBox
        const executableStates: string[] = [
            ParseState.EndCommand,
            ParseState.CommandSeparator,
            ParseState.StartParameter,
            ParseState.ParameterSeparator,
            ParseState.EndValue,
        ];
        const call = parsed.form?.call || parsed.binding?.call || parsed.binding?.form?.call;
        const hasRequired = this.getMissingFields(parsed).length === 0;
        const hasValue = (parsed.state !== ParseState.EndValue || (parsed.field && parsed.values[parsed.field.name] !== undefined));

        if (executableStates.includes(parsed.state) && call && hasRequired && hasValue) {
            const execute = getExecuteSuggestion(parsed);
            if (execute) {
                suggestions = [execute, ...suggestions];
            }
        } else if (suggestions.length === 0 && (parsed.field?.type !== AppFieldTypes.USER && parsed.field?.type !== AppFieldTypes.CHANNEL)) {
            suggestions = this.getNoMatchingSuggestion();
        }
        return suggestions.map((suggestion) => this.decorateSuggestionComplete(parsed, suggestion));
    };

    getNoMatchingSuggestion = (): AutocompleteSuggestion[] => {
        return [{
            complete: '',
            suggestion: '',
            hint: this.intl.formatMessage({
                id: 'apps.suggestion.no_suggestion',
                defaultMessage: 'No matching suggestions.',
            }),
            iconData: COMMAND_SUGGESTION_ERROR,
            description: '',
        }];
    };

    getErrorSuggestion = (parsed: ParsedCommand): AutocompleteSuggestion[] => {
        return [{
            complete: '',
            suggestion: '',
            hint: this.intl.formatMessage({
                id: 'apps.suggestion.errors.parser_error',
                defaultMessage: 'Parsing error',
            }),
            iconData: COMMAND_SUGGESTION_ERROR,
            description: parsed.error,
        }];
    };

    // composeCallFromParsed creates the form submission call
    private composeCallFromParsed = async (parsed: ParsedCommand): Promise<{call: AppCallRequest | null; errorMessage?: string}> => {
        if (!parsed.binding) {
            return {call: null,
                errorMessage: this.intl.formatMessage({
                    id: 'apps.error.parser.missing_binding',
                    defaultMessage: 'Missing command bindings.',
                })};
        }

        const call = parsed.form?.call || parsed.binding.call;
        if (!call) {
            return {call: null,
                errorMessage: this.intl.formatMessage({
                    id: 'apps.error.parser.missing_call',
                    defaultMessage: 'Missing binding call.',
                })};
        }

        const values: AppCallValues = parsed.values;
        const {errorMessage} = await this.expandOptions(parsed, values);

        if (errorMessage) {
            return {call: null, errorMessage};
        }

        const context = await this.getAppContext(parsed.binding);
        return {call: createCallRequest(call, context, {}, values, parsed.command)};
    };

    private expandOptions = async (parsed: ParsedCommand, values: AppCallValues): Promise<{errorMessage?: string}> => {
        if (!parsed.form?.fields) {
            return {};
        }

        const errors: {[key: string]: string} = {};
        await Promise.all(parsed.form.fields.map(async (f) => {
            if (!values[f.name]) {
                return;
            }
            switch (f.type) {
                case AppFieldTypes.DYNAMIC_SELECT:
                    values[f.name] = {label: '', value: values[f.name]};
                    break;
                case AppFieldTypes.STATIC_SELECT: {
                    const option = f.options?.find((o) => (o.value === values[f.name]));
                    if (!option) {
                        errors[f.name] = this.intl.formatMessage({
                            id: 'apps.error.command.unknown_option',
                            defaultMessage: 'Unknown option for field `{fieldName}`: `{option}`.',
                        }, {
                            fieldName: f.name,
                            option: values[f.name],
                        });
                        return;
                    }
                    values[f.name] = option;
                    break;
                }
                case AppFieldTypes.USER: {
                    let userName = values[f.name] as string;
                    if (userName[0] === '@') {
                        userName = userName.substr(1);
                    }
                    let user: UserModel | UserProfile | undefined = (await queryUsersByUsername(this.database, [userName]))[0];
                    if (!user) {
                        const res = await fetchUsersByUsernames(this.serverUrl, [userName]);
                        if ('error' in res) {
                            errors[f.name] = this.intl.formatMessage({
                                id: 'apps.error.command.unknown_user',
                                defaultMessage: 'Unknown user for field `{fieldName}`: `{option}`.',
                            }, {
                                fieldName: f.name,
                                option: values[f.name],
                            });
                            return;
                        }
                        user = res.users[0];
                    }
                    values[f.name] = {label: user.username, value: user.id};
                    break;
                }
                case AppFieldTypes.CHANNEL: {
                    let channelName = values[f.name] as string;
                    if (channelName[0] === '~') {
                        channelName = channelName.substr(1);
                    }
                    let channel: ChannelModel | Channel | undefined = await queryChannelByName(this.database, channelName);
                    if (!channel) {
                        const res = await fetchChannelByName(this.serverUrl, this.teamID, channelName);
                        if ('error' in res) {
                            errors[f.name] = this.intl.formatMessage({
                                id: 'apps.error.command.unknown_channel',
                                defaultMessage: 'Unknown channel for field `{fieldName}`: `{option}`.',
                            }, {
                                fieldName: f.name,
                                option: values[f.name],
                            });
                            return;
                        }
                        channel = res.channel;
                    }
                    const label = 'display_name' in channel ? channel.display_name : channel.displayName;
                    values[f.name] = {label, value: channel?.id};
                    break;
                }
            }
        }));

        if (Object.keys(errors).length === 0) {
            return {};
        }

        let errorMessage = '';
        Object.keys(errors).forEach((v) => {
            errorMessage = errorMessage + errors[v] + '\n';
        });
        return {errorMessage};
    };

    // decorateSuggestionComplete applies the necessary modifications for a suggestion to be processed
    private decorateSuggestionComplete = (parsed: ParsedCommand, choice: AutocompleteSuggestion): AutocompleteSuggestion => {
        if (choice.complete && choice.complete.endsWith(EXECUTE_CURRENT_COMMAND_ITEM_ID)) {
            return choice as AutocompleteSuggestion;
        }

        let goBackSpace = 0;
        if (choice.complete === '') {
            goBackSpace = 1;
        }
        let complete = parsed.command.substring(0, parsed.incompleteStart - goBackSpace);
        complete += choice.complete === undefined ? choice.suggestion : choice.complete;
        choice.hint = choice.hint || '';
        complete = complete.substring(1);

        return {
            ...choice,
            complete,
        };
    };

    // getCommandBindings returns the commands in the redux store.
    // They are grouped by app id since each app has one base command
    private getCommandBindings = (): AppBinding[] => {
        if (this.rootPostID) {
            return getRHSCommandBindings();
        }
        return getCommandBindings();
    };

    // getChannel gets the channel in which the user is typing the command
    private getChannel = async () => {
        return queryChannelById(this.database, this.channelID);
    };

    public setChannelContext = (channelID: string, teamID = '', rootPostID?: string) => {
        this.channelID = channelID;
        this.rootPostID = rootPostID;
        this.teamID = teamID;
    };

    // isAppCommand determines if subcommand/form suggestions need to be returned.
    // When this returns true, the caller knows that the parser should handle all suggestions for the current command string.
    // When it returns false, the caller should call getSuggestionsBase() to check if there are any base commands that match the command string.
    public isAppCommand = (pretext: string): boolean => {
        const command = pretext.toLowerCase();
        for (const binding of this.getCommandBindings()) {
            let base = binding.label;
            if (!base) {
                continue;
            }

            if (base[0] !== '/') {
                base = '/' + base;
            }

            if (command.startsWith(base + ' ')) {
                return true;
            }
        }
        return false;
    };

    // getAppContext collects post/channel/team info for performing calls
    private getAppContext = async (binding: AppBinding): Promise<AppContext> => {
        const context: AppContext = {
            app_id: binding.app_id,
            location: binding.location,
            root_id: this.rootPostID,
        };

        const channel = await this.getChannel();
        if (!channel) {
            return context;
        }

        context.channel_id = channel.id;
        context.team_id = channel.teamId || await queryCurrentTeamId(this.database);

        return context;
    };

    // fetchForm unconditionaly retrieves the form for the given binding (subcommand)
    private fetchForm = async (binding: AppBinding): Promise<{form?: AppForm; error?: string} | undefined> => {
        if (!binding.call) {
            return {error: this.intl.formatMessage({
                id: 'apps.error.parser.missing_call',
                defaultMessage: 'Missing binding call.',
            })};
        }

        const payload = createCallRequest(
            binding.call,
            await this.getAppContext(binding),
        );

        const res = await doAppCall(this.serverUrl, payload, AppCallTypes.FORM, this.intl, this.theme);
        if (res.error) {
            const errorResponse = res.error;
            return {error: errorResponse.error || this.intl.formatMessage({
                id: 'apps.error.unknown',
                defaultMessage: 'Unknown error.',
            })};
        }

        const callResponse = res.data!;
        switch (callResponse.type) {
            case AppCallResponseTypes.FORM:
                break;
            case AppCallResponseTypes.NAVIGATE:
            case AppCallResponseTypes.OK:
                return {error: this.intl.formatMessage({
                    id: 'apps.error.responses.unexpected_type',
                    defaultMessage: 'App response type was not expected. Response type: {type}',
                }, {
                    type: callResponse.type,
                })};
            default:
                return {error: this.intl.formatMessage({
                    id: 'apps.error.responses.unknown_type',
                    defaultMessage: 'App response type not supported. Response type: {type}.',
                }, {
                    type: callResponse.type,
                })};
        }

        return {form: callResponse.form};
    };

    public getForm = async (location: string, binding: AppBinding): Promise<{form?: AppForm; error?: string} | undefined> => {
        const rootID = this.rootPostID || '';
        const key = `${this.channelID}-${rootID}-${location}`;
        const form = this.rootPostID ? getAppRHSCommandForm(key) : getAppCommandForm(key);
        if (form) {
            return {form};
        }

        const fetched = await this.fetchForm(binding);
        if (fetched?.form) {
            if (this.rootPostID) {
                setAppRHSCommandForm(key, fetched.form);
            } else {
                setAppCommandForm(key, fetched.form);
            }
        }
        return fetched;
    };

    // getSuggestionsForSubCommands returns suggestions for a subcommand's name
    private getCommandSuggestions = (parsed: ParsedCommand): AutocompleteSuggestion[] => {
        if (!parsed.binding?.bindings?.length) {
            return [];
        }
        const bindings = parsed.binding.bindings;
        const result: AutocompleteSuggestion[] = [];

        bindings.forEach((b) => {
            if (b.label.toLowerCase().startsWith(parsed.incomplete.toLowerCase())) {
                result.push({
                    complete: b.label,
                    suggestion: b.label,
                    description: b.description || '',
                    hint: b.hint || '',
                    iconData: b.icon || '',
                });
            }
        });

        return result;
    };

    // getParameterSuggestions computes suggestions for positional argument values, flag names, and flag argument values
    private getParameterSuggestions = async (parsed: ParsedCommand): Promise<ExtendedAutocompleteSuggestion[]> => {
        switch (parsed.state) {
            case ParseState.StartParameter: {
            // see if there's a matching positional field
                const positional = parsed.form?.fields?.find((f: AppField) => f.position === parsed.position + 1);
                if (positional) {
                    parsed.field = positional;
                    return this.getValueSuggestions(parsed);
                }
                return this.getFlagNameSuggestions(parsed);
            }

            case ParseState.Flag:
                return this.getFlagNameSuggestions(parsed);

            case ParseState.EndValue:
            case ParseState.FlagValueSeparator:
            case ParseState.NonspaceValue:
                return this.getValueSuggestions(parsed);
            case ParseState.EndQuotedValue:
            case ParseState.QuotedValue:
                return this.getValueSuggestions(parsed, '"');
            case ParseState.EndTickedValue:
            case ParseState.TickValue:
                return this.getValueSuggestions(parsed, '`');
            case ParseState.Rest: {
                const execute = getExecuteSuggestion(parsed);
                const value = await this.getValueSuggestions(parsed);
                if (execute) {
                    return [execute, ...value];
                }
                return value;
            }
        }
        return [];
    };

    // getMissingFields collects the required fields that were not supplied in a submission
    private getMissingFields = (parsed: ParsedCommand): AppField[] => {
        const form = parsed.form;
        if (!form) {
            return [];
        }

        const missing: AppField[] = [];

        const values = parsed.values || [];
        const fields = form.fields || [];
        for (const field of fields) {
            if (field.is_required && !values[field.name]) {
                missing.push(field);
            }
        }

        return missing;
    };

    // getFlagNameSuggestions returns suggestions for flag names
    private getFlagNameSuggestions = (parsed: ParsedCommand): AutocompleteSuggestion[] => {
        if (!parsed.form || !parsed.form.fields || !parsed.form.fields.length) {
            return [];
        }

        // There have been 0 to 2 dashes in the command prior to this call, adjust.
        const prevCharIndex = parsed.incompleteStart - 1;
        let prefix = '--';
        for (let i = prevCharIndex; i > 0 && i >= parsed.incompleteStart - 2 && parsed.command[i] === '-'; i--) {
            prefix = prefix.substring(1);
        }
        if (prevCharIndex > 0 && parsed.command[prevCharIndex] === '—') {
            prefix = '';
        }

        const applicable = parsed.form.fields.filter((field) => field.label && field.label.toLowerCase().startsWith(parsed.incomplete.toLowerCase()) && !parsed.values[field.name]);
        if (applicable) {
            return applicable.map((f) => {
                return {
                    complete: prefix + (f.label || f.name),
                    suggestion: '--' + (f.label || f.name),
                    description: f.description || '',
                    hint: f.hint || '',
                    iconData: parsed.binding?.icon || '',
                };
            });
        }

        return [];
    };

    // getSuggestionsForField gets suggestions for a positional or flag field value
    private getValueSuggestions = async (parsed: ParsedCommand, delimiter?: string): Promise<ExtendedAutocompleteSuggestion[]> => {
        if (!parsed || !parsed.field) {
            return [];
        }
        const f = parsed.field;

        switch (f.type) {
            case AppFieldTypes.USER:
                return this.getUserFieldSuggestions(parsed);
            case AppFieldTypes.CHANNEL:
                return this.getChannelFieldSuggestions(parsed);
            case AppFieldTypes.BOOL:
                return this.getBooleanSuggestions(parsed);
            case AppFieldTypes.DYNAMIC_SELECT:
                return this.getDynamicSelectSuggestions(parsed, delimiter);
            case AppFieldTypes.STATIC_SELECT:
                return this.getStaticSelectSuggestions(parsed, delimiter);
        }

        const mentionSuggestions = await inTextMentionSuggestions(this.serverUrl, parsed.incomplete, this.channelID, this.teamID, delimiter);
        if (mentionSuggestions) {
            return mentionSuggestions;
        }

        // Handle text values
        let complete = parsed.incomplete;
        if (complete && delimiter) {
            complete = delimiter + complete + delimiter;
        }

        const fieldName = parsed.field.modal_label || parsed.field.label || parsed.field.name;
        return [{
            complete,
            suggestion: `${fieldName}: ${delimiter || '"'}${parsed.incomplete}${delimiter || '"'}`,
            description: f.description || '',
            hint: '',
            iconData: parsed.binding?.icon || '',
        }];
    };

    // getStaticSelectSuggestions returns suggestions specified in the field's options property
    private getStaticSelectSuggestions = (parsed: ParsedCommand, delimiter?: string): AutocompleteSuggestion[] => {
        const f = parsed.field as AutocompleteStaticSelect;
        const opts = f.options?.filter((opt) => opt.label.toLowerCase().startsWith(parsed.incomplete.toLowerCase()));
        if (!opts?.length) {
            return [{
                complete: '',
                suggestion: '',
                hint: this.intl.formatMessage({
                    id: 'apps.suggestion.no_static',
                    defaultMessage: 'No matching options.',
                }),
                description: '',
                iconData: COMMAND_SUGGESTION_ERROR,
            }];
        }
        return opts.map((opt) => {
            let complete = opt.value;
            if (delimiter) {
                complete = delimiter + complete + delimiter;
            } else if (isMultiword(opt.value)) {
                complete = '`' + complete + '`';
            }
            return {
                complete,
                suggestion: opt.label,
                hint: f.hint || '',
                description: f.description || '',
                iconData: opt.icon_data || parsed.binding?.icon || '',
            };
        });
    };

    // getDynamicSelectSuggestions fetches and returns suggestions from the server
    private getDynamicSelectSuggestions = async (parsed: ParsedCommand, delimiter?: string): Promise<AutocompleteSuggestion[]> => {
        const f = parsed.field;
        if (!f) {
            // Should never happen
            return this.makeDynamicSelectSuggestionError(this.intl.formatMessage({
                id: 'apps.error.parser.unexpected_error',
                defaultMessage: 'Unexpected error.',
            }));
        }

        const {call, errorMessage} = await this.composeCallFromParsed(parsed);
        if (!call) {
            return this.makeDynamicSelectSuggestionError(this.intl.formatMessage({
                id: 'apps.error.lookup.error_preparing_request',
                defaultMessage: 'Error preparing lookup request: {errorMessage}',
            }, {
                errorMessage,
            }));
        }
        call.selected_field = f.name;
        call.query = parsed.incomplete;

        const res = await doAppCall<AppLookupResponse>(this.serverUrl, call, AppCallTypes.LOOKUP, this.intl, this.theme);

        if (res.error) {
            const errorResponse = res.error;
            return this.makeDynamicSelectSuggestionError(errorResponse.error || this.intl.formatMessage({
                id: 'apps.error.unknown',
                defaultMessage: 'Unknown error.',
            }));
        }

        const callResponse = res.data!;
        switch (callResponse.type) {
            case AppCallResponseTypes.OK:
                break;
            case AppCallResponseTypes.NAVIGATE:
            case AppCallResponseTypes.FORM:
                return this.makeDynamicSelectSuggestionError(this.intl.formatMessage({
                    id: 'apps.error.responses.unexpected_type',
                    defaultMessage: 'App response type was not expected. Response type: {type}',
                }, {
                    type: callResponse.type,
                }));
            default:
                return this.makeDynamicSelectSuggestionError(this.intl.formatMessage({
                    id: 'apps.error.responses.unknown_type',
                    defaultMessage: 'App response type not supported. Response type: {type}.',
                }, {
                    type: callResponse.type,
                }));
        }

        let items = callResponse?.data?.items;
        items = items?.filter(filterEmptyOptions);
        if (!items?.length) {
            return [{
                complete: '',
                suggestion: '',
                hint: this.intl.formatMessage({
                    id: 'apps.suggestion.no_static',
                    defaultMessage: 'No matching options.',
                }),
                iconData: '',
                description: this.intl.formatMessage({
                    id: 'apps.suggestion.no_dynamic',
                    defaultMessage: 'No data was returned for dynamic suggestions',
                }),
            }];
        }

        return items.map((s): AutocompleteSuggestion => {
            let complete = s.value;
            if (delimiter) {
                complete = delimiter + complete + delimiter;
            } else if (isMultiword(s.value)) {
                complete = '`' + complete + '`';
            }
            return ({
                complete,
                description: s.label || s.value,
                suggestion: s.value,
                hint: '',
                iconData: s.icon_data || parsed.binding?.icon || '',
            });
        });
    };

    private makeDynamicSelectSuggestionError = (message: string): AutocompleteSuggestion[] => {
        const errMsg = this.intl.formatMessage({
            id: 'apps.error',
            defaultMessage: 'Error: {error}',
        }, {
            error: message,
        });
        return [{
            complete: '',
            suggestion: '',
            hint: this.intl.formatMessage({
                id: 'apps.suggestion.dynamic.error',
                defaultMessage: 'Dynamic select error',
            }),
            iconData: COMMAND_SUGGESTION_ERROR,
            description: errMsg,
        }];
    };

    private getUserFieldSuggestions = async (parsed: ParsedCommand): Promise<AutocompleteSuggestion[]> => {
        let input = parsed.incomplete.trim();
        if (input[0] === '@') {
            input = input.substring(1);
        }
        const res = await searchUsers(this.serverUrl, input, this.channelID);
        return getUserSuggestions(res.users);
    };

    private getChannelFieldSuggestions = async (parsed: ParsedCommand): Promise<AutocompleteSuggestion[]> => {
        let input = parsed.incomplete.trim();
        if (input[0] === '~') {
            input = input.substring(1);
        }
        const res = await searchChannels(this.serverUrl, input);
        return getChannelSuggestions(res.channels);
    };

    // getBooleanSuggestions returns true/false suggestions
    private getBooleanSuggestions = (parsed: ParsedCommand): AutocompleteSuggestion[] => {
        const suggestions: AutocompleteSuggestion[] = [];

        if ('true'.startsWith(parsed.incomplete)) {
            suggestions.push({
                complete: 'true',
                suggestion: 'true',
                description: parsed.field?.description || '',
                hint: parsed.field?.hint || '',
                iconData: parsed.binding?.icon || '',
            });
        }
        if ('false'.startsWith(parsed.incomplete)) {
            suggestions.push({
                complete: 'false',
                suggestion: 'false',
                description: parsed.field?.description || '',
                hint: parsed.field?.hint || '',
                iconData: parsed.binding?.icon || '',
            });
        }
        return suggestions;
    };
}

function isMultiword(value: string) {
    if (value.indexOf(' ') !== -1) {
        return true;
    }

    if (value.indexOf('\t') !== -1) {
        return true;
    }

    return false;
}
