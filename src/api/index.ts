/**
 * Copyright (c) 2024 Ryoji Kamei
 * Released under the MIT license
 * https://opensource.org/licenses/mit-license.php
 */

import { apiConfigType, ccConfigType } from "../config/index.js"
import { ccLogType } from "../logger/index.js"
import { ccMainType } from "../main/index.js"
import { ccSystemType } from "../system/index.js"

import * as core from "./core.js"
export import ApiModule = core.ApiModule

/**
 * The core object of the ApiModule
 */
export type ccApiType = {
    lib: ApiModule,
    conf: apiConfigType,
    status: number,
    log: ccLogType,
    m: ccMainType | undefined,
    s: ccSystemType | undefined,
    c: ccConfigType | undefined
}