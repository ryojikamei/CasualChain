/**
 * Copyright (c) 2024 Ryoji Kamei
 * Released under the MIT license
 * https://opensource.org/licenses/mit-license.php
 */

import { systemConfigType } from "../config/index.js"
import { ccLogType } from "../logger/index.js"
import { objTx, ccDsType } from "../datastore/index.js"
import { ccInType } from "../internode/index.js"
import { blockFormat } from "../block/index.js"
import { ccMainType } from "../main/index.js"

import * as core from "./core.js"
export import SystemModule = core.SystemModule

import { ccBlockType } from "../block/index.js"
import { internalEventFormat, ccEventType } from "../event/index.js"

/**
 * Defined internal tasks that run automatically
 */
type autoTasks = {
    postDeliveryPool: internalEventFormat,
    postAppendBlocks: internalEventFormat
    postScanAndFixBlock: internalEventFormat,
    postScanAndFixPool: internalEventFormat
}

/**
 * System tasks that cannot be executed more than once at the same time
 */
type serializationLocks = {
    postDeliveryPool: boolean,
    postAppendBlocks: boolean,
    postGenesisBlock: boolean,
    postScanAndFixBlock: boolean,
    postScanAndFixPool: boolean
}

/**
 * The core object of the SystemModule
 */
export type ccSystemType = {
    lib: SystemModule,
    conf: systemConfigType,
    log: ccLogType,
    autoTasks: autoTasks | undefined,
    serializationLocks: serializationLocks,
    activeTenants: string[],
    d: ccDsType | undefined,
    i: ccInType | undefined,
    b: ccBlockType | undefined,
    m: ccMainType | undefined,
    e: ccEventType | undefined
}

/**
 * The options for postScanAndFix
 * - scanonly: it only reports the condition of the pool or block and exit
 */
export type postScanAndFixOptions = {
    scanonly?: boolean
}

/**
 * The options for postGenesisBlock
 * trytoreset: set true when trying to reinit the chain. It won't work in production state.
 */
export type postGenesisBlockOptions = {
    trytoreset: boolean
}

/**
 * The rpc format for gRPC
 * - version: format version. Currenlty it's 3.
 * - request: the command string.
 * - params: the parameters for the command
 * - data: the data to be processed
 */
export type postSystemRpcFormat = {
    version: number,
    request: string,
    params: object,
    data: objTx[]
}

/**
 * The result format of the getBlock
 * - oid: ObjectId-Like string
 * - block: the target block if successful
 */
export type getBlockResult = {
    oid: string,
    block: blockFormat | undefined
}

/**
 * The hash that is going to be examined
 */
export type examineHash = {
    _id: string,
    hash: string
}
/**
 * The list of hashes are going to be examined
 */
export type examineHashes = examineHash[]

/**
 * A oid of a block that is to be deleted
 */
export type delTarget = string

/**
 * The result of examination
 * - add: blocks to be added
 * - del: blocks's oid to be deleted
 */
export type examinedHashes = {
    add: blockFormat[],
    del: delTarget[]
}

/**
 * The options for postOpenParcel
 * - adminId: administration_id to initialize
 * - recallPhrase: phrase to recall tenantId
 */
export type postOpenParcelOptions = {
    adminId: string,
    recallPhrase: string
}

/**
 * The options for postCloseParcel
 * - adminId: administration_id to disable
 * - tenantId: target tenant id to close
 */
export type postCloseParcelOptions = {
    adminId: string,
    tenantId: string
}