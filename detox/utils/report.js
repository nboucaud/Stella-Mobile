// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable no-console, camelcase, no-process-env */

const axios = require('axios');
const fse = require('fs-extra');
const xml2js = require('xml2js');

const {ARTIFACTS_DIR} = require('./constants');

const MAX_FAILED_TITLES = 5;

function convertXmlToJson(xml) {
    const platform = process.env.IOS ? 'ios' : 'android';
    const jsonFile = `${ARTIFACTS_DIR}/${platform}-junit.json`;

    // Convert XML to JSON
    xml2js.parseString(xml, {mergeAttrs: true}, (err, result) => {
        if (err) {
            throw err;
        }

        // Convert result to a JSON string
        const json = JSON.stringify(result, null, 4);

        // Save JSON in a file
        fse.writeFileSync(jsonFile, json);
    });

    return readJsonFromFile(jsonFile);
}

function getAllTests(testSuites) {
    const suites = [];
    const tests = [];
    let skipped = 0;
    let firstTimestamp;
    let incrementalDuration = 0;
    testSuites.testsuite.forEach((testSuite) => {
        skipped += parseInt(testSuite.skipped[0], 10);
        if (!firstTimestamp) {
            firstTimestamp = testSuite.timestamp[0];
        }
        suites.push({
            name: testSuite.name[0],
            errors: parseInt(testSuite.errors[0], 10),
            failures: parseInt(testSuite.failures[0], 10),
            skipped: parseInt(testSuite.skipped[0], 10),
            timestamp: testSuite.timestamp[0],
            time: parseFloat(testSuite.time[0] * 1000),
            tests: testSuite.tests[0],
        });
        testSuite.testcase.filter((test) => !test.name[0].startsWith(' Test execution failure:')).forEach((test) => {
            const time = parseFloat(test.time[0] * 1000);
            incrementalDuration += time;
            let state = 'passed';
            let pass = 'true';
            let fail = 'false';
            let pending = 'false';
            if (test.failure) {
                state = 'failed';
                fail = 'true';
                pass = 'false';
            } else if (test.skipped) {
                state = 'skipped';
                pending = 'true';
                pass = 'false';
            }
            tests.push({
                classname: test.classname[0],
                name: test.name[0],
                time,
                failure: test.failure ? test.failure[0] : '',
                skipped: test.skipped ? test.skipped[0] : '',
                incrementalDuration,
                state,
                pass,
                fail,
                pending,
            });
        });
    });
    const startDate = new Date(firstTimestamp);
    const start = startDate.toISOString();
    startDate.setTime(startDate.getTime() + parseFloat(testSuites.time[0] * 1000));
    const end = startDate.toISOString();

    return {
        suites,
        tests,
        skipped,
        failures: parseInt(testSuites.failures[0], 10),
        errors: parseInt(testSuites.errors[0], 10),
        duration: parseFloat(testSuites.time[0] * 1000),
        start,
        end,
    };
}

function generateStats(allTests) {
    const suites = allTests.suites.length;
    const tests = allTests.tests.length;
    const skipped = allTests.skipped;
    const failures = allTests.failures;
    const errors = allTests.errors;
    const duration = allTests.duration;
    const start = allTests.start;
    const end = allTests.end;
    const passes = tests - (skipped + failures + errors);
    const passPercent = tests > 0 ? (passes / tests) * 100 : 0;

    return {
        suites,
        tests,
        skipped,
        failures,
        errors,
        duration,
        start,
        end,
        passes,
        passPercent,
    };
}

function generateStatsFieldValue(stats, failedFullTitles) {
    let statsFieldValue = `
| Key | Value |
|:---|:---|
| Passing Rate | ${stats.passPercent.toFixed(2)}% |
| Duration | ${(stats.duration / (60 * 1000)).toFixed(4)} mins |
| Suites | ${stats.suites} |
| Tests | ${stats.tests} |
| :white_check_mark: Passed | ${stats.passes} |
| :x: Failed | ${stats.failures} |
| :fast_forward: Skipped | ${stats.skipped} |
`;

    // If present, add full title of failing tests.
    // Only show per maximum number of failed titles with the last item as "more..." if failing tests are more than that.
    let failedTests;
    if (failedFullTitles && failedFullTitles.length > 0) {
        const re = /[:'"\\]/gi;
        const failed = failedFullTitles;
        if (failed.length > MAX_FAILED_TITLES) {
            failedTests = failed.slice(0, MAX_FAILED_TITLES - 1).map((f) => `- ${f.replace(re, '')}`).join('\n');
            failedTests += '\n- more...';
        } else {
            failedTests = failed.map((f) => `- ${f.replace(re, '')}`).join('\n');
        }
    }

    if (failedTests) {
        statsFieldValue += '###### Failed Tests:\n' + failedTests;
    }

    return statsFieldValue;
}

function generateShortSummary(allTests) {
    const failedFullTitles = allTests.tests.filter((t) => t.failure).map((t) => t.name);
    const stats = generateStats(allTests);
    const statsFieldValue = generateStatsFieldValue(stats, failedFullTitles);

    return {
        stats,
        statsFieldValue,
    };
}

function removeOldGeneratedReports() {
    const platform = process.env.IOS ? 'ios' : 'android';
    [
        'environment.json',
        'summary.json',
        `${platform}-junit.json`,
    ].forEach((file) => fse.removeSync(`${ARTIFACTS_DIR}/${file}`));
}

function writeJsonToFile(jsonObject, filename, dir) {
    fse.writeJson(`${dir}/${filename}`, jsonObject).
        then(() => console.log('Successfully written:', filename)).
        catch((err) => console.error(err));
}

function readJsonFromFile(file) {
    try {
        return fse.readJsonSync(file);
    } catch (err) {
        return {err};
    }
}

const result = [
    {status: 'Passed', priority: 'none', cutOff: 100, color: '#43A047'},
    {status: 'Failed', priority: 'low', cutOff: 98, color: '#FFEB3B'},
    {status: 'Failed', priority: 'medium', cutOff: 95, color: '#FF9800'},
    {status: 'Failed', priority: 'high', cutOff: 0, color: '#F44336'},
];

function generateTestReport(summary, isUploadedToS3, reportLink, environment, testCycleKey) {
    const {
        FULL_REPORT,
        TEST_CYCLE_LINK_PREFIX,
        IOS,
    } = process.env;
    const platform = IOS ? 'iOS' : 'Android';
    const {statsFieldValue, stats} = summary;
    const {
        detox_version,
        device_name,
        device_os_version,
        headless,
        os_name,
        os_version,
        node_version,
        npm_version,
    } = environment;

    let testResult;
    for (let i = 0; i < result.length; i++) {
        if (stats.passPercent >= result[i].cutOff) {
            testResult = result[i];
            break;
        }
    }

    const title = generateTitle();
    const envValue = `detox@${detox_version} | node@${node_version} | npm@${npm_version} | ${device_name}@${device_os_version}${headless ? ' (headless)' : ''} | ${os_name}@${os_version}`;

    if (FULL_REPORT === 'true') {
        let reportField;
        if (isUploadedToS3) {
            reportField = {
                short: false,
                title: `${platform} Test Report`,
                value: `[Link to the report](${reportLink})`,
            };
        }

        let testCycleField;
        if (testCycleKey) {
            testCycleField = {
                short: false,
                title: `${platform} Test Execution`,
                value: `[Recorded test executions](${TEST_CYCLE_LINK_PREFIX}${testCycleKey})`,
            };
        }

        return {
            username: 'Mobile Detox Test',
            icon_url: 'https://mattermost.com/wp-content/uploads/2022/02/icon_WS.png',
            attachments: [{
                color: testResult.color,
                author_name: 'Mobile End-to-end Testing',
                author_icon: 'https://mattermost.com/wp-content/uploads/2022/02/icon_WS.png',
                author_link: 'https://www.mattermost.com',
                title,
                fields: [
                    {
                        short: false,
                        title: 'Environment',
                        value: envValue,
                    },
                    reportField,
                    testCycleField,
                    {
                        short: false,
                        title: `Key metrics (required support: ${testResult.priority})`,
                        value: statsFieldValue,
                    },
                ],
            }],
        };
    }

    let quickSummary = `${stats.passPercent.toFixed(2)}% (${stats.passes}/${stats.tests}) in ${stats.suites} suites`;
    if (isUploadedToS3) {
        quickSummary = `[${quickSummary}](${reportLink})`;
    }

    let testCycleLink = '';
    if (testCycleKey) {
        testCycleLink = testCycleKey ? `| [Recorded test executions](${TEST_CYCLE_LINK_PREFIX}${testCycleKey})` : '';
    }

    return {
        username: 'Mobile Detox Test',
        icon_url: 'https://mattermost.com/wp-content/uploads/2022/02/icon_WS.png',
        attachments: [{
            color: testResult.color,
            author_name: 'Mobile End-to-end Testing',
            author_icon: 'https://mattermost.com/wp-content/uploads/2022/02/icon_WS.png',
            author_link: 'https://www.mattermost.com/',
            title,
            text: `${quickSummary} | ${(stats.duration / (60 * 1000)).toFixed(4)} mins ${testCycleLink}\n${envValue}`,
        }],
    };
}

function generateTitle() {
    const {
        BRANCH,
        IOS,
        RELEASE_VERSION,
        RELEASE_BUILD_NUMBER,
        PULL_REQUEST,
        RELEASE_DATE,
        TYPE,
    } = process.env;

    const platform = IOS ? 'iOS' : 'Android';
    const lane = `${platform} Build`;
    const appExtension = IOS ? 'ipa' : 'apk';
    const appFileName = TYPE === 'GEKIDOU' ? `Mattermost_Beta.${appExtension}` : `Mattermost.${appExtension}`;
    let buildLink = ` with [${lane}](https://pr-builds.mattermost.com/mattermost-mobile/${BRANCH}/${appFileName})`;
    if (RELEASE_VERSION && RELEASE_BUILD_NUMBER) {
        const releaseType = TYPE === 'GEKIDOU' ? 'mattermost-mobile-beta' : 'mattermost-mobile';
        buildLink = ` with [${RELEASE_VERSION}:${RELEASE_BUILD_NUMBER}](https://releases.mattermost.com/${releaseType}/${RELEASE_VERSION}/${RELEASE_BUILD_NUMBER}/${appFileName})`;
    }

    let releaseDate = '';
    if (RELEASE_DATE) {
        releaseDate = ` for ${RELEASE_DATE}`;
    }

    let title;

    switch (TYPE) {
        case 'PR':
            title = `${platform} E2E for Pull Request Build: [${BRANCH}](${PULL_REQUEST})${buildLink}`;
            break;
        case 'RELEASE':
            title = `${platform} E2E for Release Build${buildLink}${releaseDate}`;
            break;
        case 'MASTER':
            title = `${platform} E2E for Master Nightly Build (Prod tests)${buildLink}`;
            break;
        case 'GEKIDOU':
            title = `${platform} E2E for Gekidou Nightly Build (Prod tests)${buildLink}`;
            break;
        default:
            title = `${platform} E2E for Build${buildLink}`;
    }

    return title;
}

async function sendReport(name, url, data) {
    const requestOptions = {method: 'POST', url, data};

    try {
        const response = await axios(requestOptions);

        if (response.data) {
            console.log(`Successfully sent ${name}.`);
        }
        return response;
    } catch (er) {
        console.log(`Something went wrong while sending ${name}.`, er);
        return false;
    }
}

module.exports = {
    convertXmlToJson,
    generateShortSummary,
    generateTestReport,
    getAllTests,
    removeOldGeneratedReports,
    sendReport,
    readJsonFromFile,
    writeJsonToFile,
};
