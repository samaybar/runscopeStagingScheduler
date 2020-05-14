# runscopeStagingScheduler

This is a node.js application that allows you to use the [Runscope API](https://www.runscope.com/docs/api) to copy all tests schedules for a specified bucket from Production Runscope to Runscope Staging. Note that running this script may result in multiple notifications being triggered or other unexpected behavior.

## Installation
If Node.js is not installed, install it from https://nodejs.org/. Once complete, check by running ```node -v``` from a terminal window to show the install version.

Clone the repo:
`git clone https://github.com/samaybar/runscopeStagingScheduler.git`
`cd runscopeStagingScheduler`

Install node module dependencies:
`npm install`

Rename `mysettings.js` as `settings.js`

## How to Use

### Obtaining an Access Token

- Create an application at https://www.runscope.com/applications
- Use dummy URLs for the app and callback URL values (e.g. http://example.com)
- Copy the Personal Access Token from the created app and set the `apikey` in `settings.js`
- NOTE: if you are creating a new access token this script will not run properly. This will presently only work with tokens created before 4/20/20. If you have a Runscope agent you may be able to use that token from the .conf file

### Copy all tests in a bucket to Staging

- `node index.js copy YOUR_BUCKET_KEY`
- by default, this will just copy the schedules to staging.
- if you want to delete production schedules, set value on line 12 of index.js to `false` -- this will delete schedules for all tests in the bucket specified
- a file named `restore-YOUR_BUCKET_KEY-DATESTAMP.json` will be created for use in case you need to copy schedules back to production (see below for use)

### Resuming tests

- `node index.js resume restore-YOUR_BUCKET_KEY-DATESTAMP.json`
- this will schedule all tests in the specified file at the designated intervals
- **IMPORTANT WARNING**: in the unlikely event you have the same test running at two different intervals with the same environment only one instance will be restored. You wil need to restore the other instance through the UI


