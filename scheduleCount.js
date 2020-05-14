"use strict";

const fs = require('fs');
const axios = require('axios');
const moment = require("moment");
const log = require("./lib/helpers/logger");
//settings.js file with apikey
const settings = require('./settings.js');
let { apikey, altUrl } = settings;
const apiUrl = "https://api.runscope.com";

let csvFileName = `schedules-${moment().format("YYYYMMDDHmmss")}.csv`;
let csvWriteData = 'teamName;teamId;bucketName;bucketKey;testName;testId;environmentId;testScheduleId;scheduleFrequency\n';
writeToFile(csvWriteData, csvFileName);
//array to store scheduled tests
let testSchedules = [];


const baseUrl = altUrl || apiUrl;
log.debug(baseUrl);



const authHeader = `Bearer ${apikey}`;
axios.defaults.headers.common['Authorization'] = authHeader;

getBuckets();


function getRunscope(endpointUrl) {
    return axios.get(endpointUrl);
}

//function to get buckets and then get schedules for the API key user
async function getBuckets() {
   try{
        const bucketUrl = `${apiUrl}/buckets`
        const buckets = await getRunscope(bucketUrl);
        const bucketData = buckets.data.data;
        let bucketArray = [];
        for (let i = 0; i < bucketData.length; i++){
            let thisBucket = { 'bucketKey': bucketData[i].key, 'name':bucketData[i].name, 'teamName': bucketData[i].team.name, 'teamId': bucketData[i].team.id}
            bucketArray.push(thisBucket);
        }
        log.info(JSON.stringify(bucketArray,undefined,4));
        let jsonWriteData = JSON.stringify(bucketArray, undefined, 4);
        let jsonFileName = `buckets-${moment().format("YYYYMMDDHmmss")}.json`;
       writeToFile(jsonWriteData, jsonFileName);
        getTestSchedules(bucketArray);
   } catch (e) {
       log.warn(e);
   }
}

//helper function to get schedules
async function getTestSchedules(bucketArray) {
    try {
        for (let i = 0; i < bucketArray.length; i++) {
            let bucket_key = bucketArray[i].bucketKey;
            log.info(`Getting bucket ${bucket_key}`)

            //get list of tests for this bucket
            const testList = `${baseUrl}/buckets/${bucket_key}/tests?count=500`;
            let results;
            try {
                results = await getRunscope(testList);
                log.debug(`This is the status code: ${results.status}`);
            } catch (err) {
                results = {data: {data : []}};
                log.warn(`bucket ${bucket_key} gave 404 response - likely empty; script moving on`)
                log.warn(err);
            } finally {
                log.debug(`This is the status code: ${results.status}`);

                let thisBatch = results.data.data;
                if (thisBatch.length == 500) {
                    log.warn(`ONLY RETRIEVED FIRST 500 tests for bucket ${bucket_key}`)
                }
                if (thisBatch.length > 0) {
                    for (let j = 0; j < thisBatch.length; j++) {
                        const test_id = thisBatch[j].id;
                        const test_name = thisBatch[j].name;
                        //get schedules for tests in this buckets
                        const schedUrl = `${baseUrl}/buckets/${bucket_key}/tests/${test_id}/schedules`
                        log.debug(schedUrl);
                        const schedResults = await getRunscope(schedUrl);
                        //look for tests which actually have schedules

                        let scheduleData = schedResults.data.data
                        if (scheduleData.length > 0) {
                            let thisScheduleData = {
                                "bucket_key": bucket_key,
                                "test_id": test_id,
                                "schedule": scheduleData
                            }
                            for (let k = 0; k < scheduleData.length; k++){
                                let thisSchedData = `${bucketArray[i].teamName};${bucketArray[i].teamId};${bucketArray[i].name};${bucket_key};${test_name};${test_id};${scheduleData[k].environment_id};${scheduleData[k].id};${scheduleData[k].interval}\n`;
                                writeToFile(thisSchedData, csvFileName);
                            }

                            //array of test schedules
                            testSchedules.push(thisScheduleData);
                            //log.debug(JSON.stringify(thisScheduleData,undefined,4));
                        }
                    }
            }    

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
        log.debug("Saved data to: " + fileName);
    });
}