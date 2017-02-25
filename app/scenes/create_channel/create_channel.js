// Copyright (c) 2017 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.
import React, {PropTypes, PureComponent} from 'react';
import {injectIntl, intlShape} from 'react-intl';
import {
    Dimensions,
    Keyboard,
    Platform,
    StyleSheet,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View,
    findNodeHandle
} from 'react-native';
import {KeyboardAwareScrollView} from 'react-native-keyboard-aware-scroll-view';

import ErrorText from 'app/components/error_text';
import FormattedText from 'app/components/formatted_text';
import TextInputWithLocalizedPlaceholder from 'app/components/text_input_with_localized_placeholder';

import {changeOpacity, makeStyleSheetFromTheme} from 'app/utils/theme';

import {Constants, RequestStatus} from 'service/constants';
import EventEmitter from 'service/utils/event_emitter';

import CreateChannelButton from './create_channel_button';

const getStyleSheet = makeStyleSheetFromTheme((theme) => {
    const {height, width} = Dimensions.get('window');
    return StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: theme.centerChannelBg
        },
        scrollView: {
            flex: 1,
            backgroundColor: changeOpacity(theme.centerChannelColor, 0.03),
            paddingTop: 30,
            height: height + (Platform.OS === 'android' ? 200 : 0)
        },
        errorContainer: {
            position: 'absolute',
            width
        },
        inputContainer: {
            marginTop: 10,
            borderTopWidth: 1,
            borderBottomWidth: 1,
            borderTopColor: changeOpacity(theme.newMessageSeparator, 0.5),
            borderBottomColor: changeOpacity(theme.newMessageSeparator, 0.5),
            backgroundColor: theme.centerChannelBg
        },
        input: {
            color: theme.centerChannelColor,
            fontSize: 14,
            height: 40,
            paddingHorizontal: 15
        },
        title: {
            fontSize: 14,
            color: theme.centerChannelColor,
            marginLeft: 15
        },
        optional: {
            color: changeOpacity(theme.centerChannelColor, 0.5),
            fontSize: 14,
            marginLeft: 5
        },
        helpText: {
            fontSize: 14,
            color: changeOpacity(theme.centerChannelColor, 0.5),
            marginTop: 10,
            marginHorizontal: 15
        }
    });
});

class CreateChannel extends PureComponent {
    static propTypes = {
        intl: intlShape.isRequired,
        createChannelRequest: PropTypes.object.isRequired,
        theme: PropTypes.object.isRequired,
        channelType: PropTypes.string,
        subscribeToHeaderEvent: React.PropTypes.func.isRequired,
        unsubscribeFromHeaderEvent: React.PropTypes.func.isRequired,
        actions: PropTypes.shape({
            goBack: PropTypes.func.isRequired,
            handleCreateChannel: PropTypes.func.isRequired
        })
    };

    static defaultProps = {
        channelType: Constants.OPEN_CHANNEL
    };

    static navigationProps = {
        renderLeftComponent: (props, emitter, theme) => {
            return (
                <TouchableOpacity
                    style={{flex: 1, paddingHorizontal: 15, justifyContent: 'center'}}
                    onPress={() => emitter('close')}
                >
                    <FormattedText
                        id='more_direct_channels.close'
                        defaultMessage='Close'
                        style={{color: theme.sidebarHeaderTextColor}}
                    />
                </TouchableOpacity>
            );
        },
        renderRightComponent: (props, emitter) => {
            return <CreateChannelButton emitter={emitter}/>;
        }
    };

    constructor(props) {
        super(props);

        this.state = {
            displayName: '',
            header: '',
            purpose: ''
        };
    }

    onCreateChannel = async () => {
        Keyboard.dismiss();
        const {displayName, purpose, header} = this.state;
        await this.props.actions.handleCreateChannel(displayName, purpose, header, this.props.channelType);
    };

    onDisplayNameChangeText = (displayName) => {
        this.setState({displayName});
        if (displayName && displayName.length >= 2) {
            this.emitCanCreateChannel(true);
        } else {
            this.emitCanCreateChannel(false);
        }
    };

    onPurposeChangeText = (purpose) => {
        this.setState({purpose});
    };

    onHeaderChangeText = (header) => {
        this.setState({header});
    };

    emitCanCreateChannel = (enabled) => {
        EventEmitter.emit('can_create_channel', enabled);
    };

    emitCreating = (loading) => {
        EventEmitter.emit('creating_channel', loading);
    };

    blur = () => {
        this.nameInput.refs.wrappedInstance.blur();
        this.purposeInput.refs.wrappedInstance.blur();
        this.headerInput.refs.wrappedInstance.blur();
        this.refs.scroll.scrollToPosition(0, 0, true);
    };

    channelNameRef = (ref) => {
        this.nameInput = ref;
    };

    channelPurposeRef = (ref) => {
        this.purposeInput = ref;
    };

    channelHeaderRef = (ref) => {
        this.headerInput = ref;
    };

    scrollToEnd = () => {
        this.refs.scroll.scrollToFocusedInput(findNodeHandle(this.refs.headerHelp));
    };

    componentWillMount() {
        this.props.subscribeToHeaderEvent('close', this.props.actions.goBack);
        this.props.subscribeToHeaderEvent('create_channel', this.onCreateChannel);
    }

    componentWillReceiveProps(nextProps) {
        const {createChannelRequest} = nextProps;

        if (this.props.createChannelRequest !== createChannelRequest) {
            switch (createChannelRequest.status) {
            case RequestStatus.STARTED:
                this.emitCreating(true);
                this.setState({error: null});
                break;
            case RequestStatus.SUCCESS:
                this.emitCreating(false);
                this.setState({error: null});
                this.props.actions.goBack();
                break;
            case RequestStatus.FAILURE:
                this.emitCreating(false);
                this.setState({error: createChannelRequest.error});
                break;
            }
        }
    }

    componentDidMount() {
        this.emitCanCreateChannel(false);
    }

    componentWillUnmount() {
        this.props.unsubscribeFromHeaderEvent('close');
        this.props.unsubscribeFromHeaderEvent('create_channel');
    }

    render() {
        const {channelType, theme} = this.props;
        const {displayName, header, purpose, error} = this.state;
        const {formatMessage} = this.props.intl;

        const style = getStyleSheet(theme);

        let term;
        if (channelType === Constants.OPEN_CHANNEL) {
            term = formatMessage({id: 'channel_modal.channel', defaultMessage: 'Channel'});
        } else if (channelType === Constants.PRIVATE_CHANNEL) {
            term = formatMessage({id: 'channel_modal.group', defaultMessage: 'Group'});
        }

        let displayError;
        if (error) {
            displayError = (
                <View style={style.errorContainer}>
                    <View style={{justifyContent: 'center', alignItems: 'center', marginBottom: 10}}>
                        <ErrorText error={error}/>
                    </View>
                </View>
            );
        }

        return (
            <KeyboardAwareScrollView
                ref='scroll'
                style={style.container}
            >
                <TouchableWithoutFeedback onPress={this.blur}>
                    <View style={style.scrollView}>
                        {displayError}
                        <View>
                            <FormattedText
                                style={[style.title, {marginTop: (error ? 10 : 0)}]}
                                id='channel_modal.name'
                                defaultMessage='Name'
                            />
                        </View>
                        <View style={style.inputContainer}>
                            <TextInputWithLocalizedPlaceholder
                                ref={this.channelNameRef}
                                value={displayName}
                                onChangeText={this.onDisplayNameChangeText}
                                style={style.input}
                                autoCapitalize='none'
                                autoCorrect={false}
                                placeholder={{id: 'channel_modal.nameEx', defaultMessage: 'E.g.: "Bugs", "Marketing", "客户支持"'}}
                                placeholderTextColor={changeOpacity(theme.centerChannelColor, 0.4)}
                                underlineColorAndroid='transparent'
                            />
                        </View>
                        <View
                            style={{
                                flexDirection: 'row',
                                marginTop: 30
                            }}
                        >
                            <FormattedText
                                style={style.title}
                                id='channel_modal.purpose'
                                defaultMessage='Purpose'
                            />
                            <FormattedText
                                style={style.optional}
                                id='channel_modal.optional'
                                defaultMessage='(optional)'
                            />
                        </View>
                        <View style={style.inputContainer}>
                            <TextInputWithLocalizedPlaceholder
                                ref={this.channelPurposeRef}
                                value={purpose}
                                onChangeText={this.onPurposeChangeText}
                                style={[style.input, {height: 110}]}
                                placeholder={{id: 'channel_modal.purposeEx', defaultMessage: 'E.g.: "A channel to file bugs and improvements"'}}
                                placeholderTextColor={changeOpacity(theme.centerChannelColor, 0.4)}
                                multiline={true}
                                underlineColorAndroid='transparent'
                            />
                        </View>
                        <View>
                            <FormattedText
                                style={style.helpText}
                                id='channel_modal.descriptionHelp'
                                defaultMessage='Describe how this {term} should be used.'
                                values={{
                                    term
                                }}
                            />
                        </View>
                        <View
                            style={{
                                flexDirection: 'row',
                                marginTop: 15
                            }}
                        >
                            <FormattedText
                                style={style.title}
                                id='channel_modal.header'
                                defaultMessage='Header'
                            />
                            <FormattedText
                                style={style.optional}
                                id='channel_modal.optional'
                                defaultMessage='(optional)'
                            />
                        </View>
                        <View style={style.inputContainer}>
                            <TextInputWithLocalizedPlaceholder
                                ref={this.channelHeaderRef}
                                value={header}
                                onChangeText={this.onHeaderChangeText}
                                style={[style.input, {height: 110}]}
                                placeholder={{id: 'channel_modal.headerEx', defaultMessage: 'E.g.: "[Link Title](http://example.com)"'}}
                                placeholderTextColor={changeOpacity(theme.centerChannelColor, 0.4)}
                                multiline={true}
                                onFocus={this.scrollToEnd}
                                underlineColorAndroid='transparent'
                            />
                        </View>
                        <View ref='headerHelp'>
                            <FormattedText
                                style={style.helpText}
                                id='channel_modal.headerHelp'
                                defaultMessage={'Set text that will appear in the header of the {term} beside the {term} name. For example, include frequently used links by typing [Link Title](http://example.com).'}
                                values={{
                                    term
                                }}
                            />
                        </View>
                    </View>
                </TouchableWithoutFeedback>
            </KeyboardAwareScrollView>
        );
    }
}

export default injectIntl(CreateChannel);
