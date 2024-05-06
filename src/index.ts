/**
 * Copyright (c) 2024 Ryoji Kamei
 * Released under the MIT license
 * https://opensource.org/licenses/mit-license.php
 */

import { CC } from "./cc.js"
import { ccConfigType } from "./config/index.js"
import { ccLogType } from "./logger/index.js"
import { ccSystemType } from "./system/index.js"
import { ccMainType } from "./main/index.js"
import { ccDsType } from "./datastore/index.js"
import { ccApiType } from "./api/index.js"
import { ccInType } from "./internode/index.js"
import { ccBlockType } from "./block/index.js"
import { ccKeyringType } from "./keyring/index.js"
import { ccEventType } from "./event/index.js"

/**
 * The central core module of CasuclChain
 */
export type ccType = {
    lib: CC,
    c: ccConfigType, // Config object
    l: ccLogType, // Logger object
    s: ccSystemType, // System object
    m: ccMainType, // Main object
    d: ccDsType, // DataStore object
    a: ccApiType, // API object
    i: ccInType, // Internode object
    b: ccBlockType, // Block object
    k: ccKeyringType, // Keyring object
    e: ccEventType // Event object
}