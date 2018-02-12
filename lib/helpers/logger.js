"use strict";

const bunyan = require("bunyan")
    , bformat = require("bunyan-format")
    ;

const log_level = process.env.LOG_LEVEL || "info";
//const log_level = "info";

const formatOut = bformat({ outputMode: "short" , })
    , logger = bunyan.createLogger({
    name: "runscope",
    streams: [
        {
            level: log_level,
            stream: formatOut
        }/*,
         {
         level: 'info',
         // log ERROR and above to a file
         path: './output/test.log'
         }*/
    ]
});

module.exports = logger;
