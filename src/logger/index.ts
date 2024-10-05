/**
 * Copyright (c) 2024 Ryoji Kamei
 * Released under the MIT license
 * https://opensource.org/licenses/mit-license.php
 */

import { logConfigType } from "../config/index.js"

import * as core from "./core.js"
export import LogModule = core.LogModule;

/**
 * The core object of the LogModule
 */
export type ccLogType = {
    lib: LogModule,
    conf: logConfigType,
    console_linefeed_pending: boolean,
    file_pending_message: string
}

/**
 * Optons to change behavior of output
 * - lf: set false if the message doesn't want end with line feed(\\n).
 * - skipconsole: only output to file
 * - skipfile: only output to console
 */
export type logOptions = {
    lf?: boolean,
    skipconsole?: boolean,
    skipfile?: boolean
}

/**
 * The log level of CasualChain
 */
export type logLevel = "Debug" | "Info" | "Notice" | "Warning" | "Error"

