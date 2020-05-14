"use strict";

const fs = require('fs');
const axios = require('axios');
const moment = require("moment");
const log = require("./lib/helpers/logger");
//settings.js file with apikey, buckets to modify location on scheduled environments
const settings = require('./settings.js');
let { apikey, buckets, altUrl, restoreFileNames } = settings;
const apiUrl = "https://api.runscope.com";

const importOnlyMode = true; //true to leave production schedules untouched (false will delete production schedules)

//array to store scheduled tests
let testSchedules = [];

//restoreFileData
let restoreData = [];


var args = process.argv.slice(2);
log.debug(args[0]);
if (!((args[0] === 'copy') || (args[0] === 'restore'))) {
    throw new Error('FAIL: You must indicate "copy" or "restore"');
}

let operation = args[0];


log.debug(args);
log.debug(args.length);
const baseUrl = altUrl || apiUrl;
log.debug(baseUrl);



const authHeader = `Bearer ${apikey}`;
axios.defaults.headers.common['Authorization'] = authHeader;


if (operation === 'copy') {
    if (args.length > 1) {
        buckets = args.slice(1)

    }
    log.debug(buckets);
    copyTestSchedules();
} else if (operation === 'restore') {
    if (!args[1]) {
        throw new Error('FAIL: You must provide a filename to restore schedules')
    } else {
        restoreFileNames = args.slice(1)
    }
    restoreTests();
}


function getRunscope(endpointUrl) {
    return axios.get(endpointUrl);
}

function deleteRunscopeSchedule(endpointUrl) {
    return axios.delete(endpointUrl);
}

function writeRunscopeSchedule(endpointUrl, postData) {
    return axios.post(endpointUrl, postData);
}

//function to copy production schedules
async function copyTestSchedules() {
    try {
        for (let i = 0; i < buckets.length; i++) {
            let bucket_key = buckets[i];
            log.info(`Getting bucket ${bucket_key}`)

            //get list of tests for this bucket
            const testList = `${baseUrl}/buckets/${bucket_key}/tests?count=500`;
            const results = await getRunscope(testList);
            log.debug(`This is the status code: ${results.status}`);

            let thisBatch = results.data.data;
            for (let j = 0; j < thisBatch.length; j++) {
                const test_id = thisBatch[j].id;
                //get schedules for tests in this buckets
                const schedUrl = `${baseUrl}/buckets/${bucket_key}/tests/${test_id}/schedules`
                const schedResults = await getRunscope(schedUrl);
                //look for tests which actually have schedules

                let scheduleData = schedResults.data.data
                if (scheduleData.length > 0) {
                    let thisScheduleData = {
                        "bucket_key": bucket_key,
                        "test_id": test_id,
                        "schedule": scheduleData
                    }

                    //array of test schedules
                    testSchedules.push(thisScheduleData);
                    //log.debug(JSON.stringify(thisScheduleData,undefined,4));
                }
            }

            log.debug(JSON.stringify(testSchedules, undefined, 4));
            let jsonWriteData = JSON.stringify(testSchedules, undefined, 4);
            let jsonFileName = `${bucket_key}-${moment().format("YYYYMMDDHmmss")}.json`;
            writeToFile(jsonWriteData, jsonFileName);

            log.debug("going to write tasks to delete");

            //this should probably be a function...
            //deleteListOfSchedules(testSchedules);
            let taskList = [];
            //loop through tests in file
            for (let count = 0; count < testSchedules.length; count++) {
                let thisTestSched = testSchedules[count];
                let thisBucket = thisTestSched.bucket_key;
                let thisTest = thisTestSched.test_id;
                //loop through schedules in test
                log.debug("loop through schedules");
                for (let schedCount = 0; schedCount < thisTestSched.schedule.length; schedCount++) {
                    let thisRestore = {};
                    let restoreUrl = `${baseUrl}/buckets/${thisBucket}/tests/${thisTest}/schedules`;
                    let deleteUrl = `${restoreUrl}/${thisTestSched.schedule[schedCount].id}`;
                    log.debug(`URL to delete: ${deleteUrl}`);
                    thisRestore.url = restoreUrl;

                    thisRestore.data = {
                        "test_id": thisTest,
                        "environment_id": thisTestSched.schedule[schedCount].environment_id,
                        "interval": thisTestSched.schedule[schedCount].interval,
                        "note": thisTestSched.schedule[schedCount].note
                    };
                    taskList.push(deleteUrl);
                    //deleteRunscopeSchedule
                    if (!importOnlyMode) {
                        const deleteResult = await deleteRunscopeSchedule(deleteUrl);
                        thisRestore.originalScheduleStatus = deleteResult.status;
                    } else {
                        thisRestore.originalScheduleStatus = "copied to GCP Staging"
                    }
                    restoreData.push(thisRestore);
                }
            }

            log.warn(taskList);
            jsonWriteData = JSON.stringify(restoreData, undefined, 4);            
            jsonFileName = `restore-${bucket_key}-${moment().format("YYYYMMDDHmmss")}.json`;
            writeToFile(jsonWriteData, jsonFileName);
            //write test schedules to Staging Environment
            scheduleStagingTests(restoreData);

        }
    } catch (e) {
        log.warn(e);
    }
}

//helper function to write copied schedules to staging
async function scheduleStagingTests(productionSchedule) {
    try {

        var myRestoreData = productionSchedule;
        for (let j = 0; j < myRestoreData.length; j++) {
            let thisUrl = myRestoreData[j].url.replace(/https:\/\/api/g, 'https://stageapi')
            log.debug(thisUrl);
            let thisTest = `test: ${myRestoreData[j].data.test_id} environment: ${myRestoreData[j].data.environment_id} freq: ${myRestoreData[j].data.interval}`;
            let thisData = myRestoreData[j].data
            const createResults = await writeRunscopeSchedule(thisUrl, thisData)
            if (createResults.status == 201) {
                log.info(`Success! Scheduled on GCP: ${thisTest}`);
            } else {
                log.warn(`There was a problem with ${thisTest}`);
            }

        }

    } catch (e) {
        log.warn(e);
    }
}

//function to restore saved test schedules to production
async function restoreTests() {
    try {
        for (let i = 0; i < restoreFileNames.length; i++) {
            let thisRestoreFile = restoreFileNames[i];
            log.info(`Restoring from ${thisRestoreFile}`);
            var myRestoreData = JSON.parse(fs.readFileSync(thisRestoreFile, 'utf8'));


            for (let j = 0; j < myRestoreData.length; j++) {
                let thisUrl = myRestoreData[j].url
                log.debug(thisUrl);
                let thisData = myRestoreData[j].data
                const createResults = await writeRunscopeSchedule(thisUrl, thisData)

            }
        }
    } catch (e) {
        log.warn(e);
    }
}

//writes data to file
function writeToFile(outputData, fileName) {
    fs.appendFile(fileName, outputData, function (err) {
        if (err) {
            return log.warn(err);
        }
        log.info("Saved data to: " + fileName);
    });
}