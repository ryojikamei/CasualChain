/**
 * Copyright (c) 2024 Ryoji Kamei
 * Released under the MIT license
 * https://opensource.org/licenses/mit-license.php
 */

import { eventConfigType } from "../config/index.js"
import { ccLogType } from "../logger/index.js";

import * as core from "./core.js"
export import EventModule = core.EventModule;
import { ccType } from "../index.js";
import { gResult } from "../utils.js";

/**
 * The core object of the EventModule, a simple interval timer so far
 */
export type ccEventType = {
    lib: EventModule,
    eventLoopIsActive: boolean,
    conf: eventConfigType,
    log: ccLogType,
    w: ccType | undefined // EventModule needs global gateway
}

/**
 * Event registration format
 * - methodPath: the target method. The path must start with "w."
 * - status: "queue", "run", "done", or "error"
 * - executionResult: when the execution finishes, the result is stored in the gResult type
 * - minIntervalMs: set minimum interval in milliseconds
 * - nextExecuteTimeMs: after this time, the function is executed 
 * - exitOnError: treat error as fatal, and exit the system
 */
export type internalEventFormat = {
    eventId: string, // UUIDv4
    methodPath: string,
    methodArgs: any[],
    status: string,
    executionResult: gResult<any, any> | undefined,
    minIntervalMs: number,
    nextExecuteTimeMs: number | undefined,
    exitOnError: boolean
}