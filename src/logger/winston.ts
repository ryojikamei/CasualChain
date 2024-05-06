/**
 * Copyright (c) 2024 Ryoji Kamei
 * Released under the MIT license
 * https://opensource.org/licenses/mit-license.php
 */

import { basename, dirname } from "path";
import { format, createLogger, transports, Logger } from "winston";
import DailyRotateFile from "winston-daily-rotate-file";

/**
 * Initialize winston logger submodule
 * @param level - set loglevel filter value that makes winston to determine whether writing the log or not
 * @param path - set log file full path. When the rotation is on, a date string (YYYY-MM-DD) is added to the beginning of the file name
 * @param rotation - set true when rotate the log by itself.
 * @returns returns winston Logger instance. On fail, it throws Error.
 */
export function winston_init(level: string, path: string, rotation: boolean): Logger {
    const fileFormat = format.combine(format.timestamp(), format.printf(({level, message, timestamp}) => {
        return `${timestamp}|${level}|${message}`;
    }))
    let fileTransport: any;
    const filename = basename(path);
    const dir = dirname(path);
    if (rotation === true) {
        fileTransport =  new DailyRotateFile({
            level: level,
            format: fileFormat,
            filename: dir + "/%DATE%-" + filename,
            datePattern: "YYYY-MM-DD",
            maxFiles: "14d"
        })
    } else {
        fileTransport = new transports.File({
            level: level,
            format: fileFormat,
            filename: dir + "/" + filename
        })
    }

    let winston: Logger;
    winston = createLogger({
        transports: [fileTransport]
    })
    return winston;
}