import { InModuleV2 } from "./v2_core"
import { inConfigType } from "../config"
import { ccLogType } from "../logger"
import { ccSystemType, examineHashes } from "../system"
import { ccBlockType } from "../block"
import { ccKeyringType } from "../keyring"

import { Ca3TravelingFormat } from "../block/algorithm/ca3"
import { InReceiverSubModule } from "./v2_receiver"

import * as core from "./v2_core.js"
export import InModuleV2 = core.InModuleV2

/**
 * The core object of the InternodeModule
 */
export type ccInTypeV2 = {
    lib: InModuleV2,
    conf: inConfigType,
    log: ccLogType,
    receiver: InReceiverSubModule,
    s: ccSystemType | undefined,
    b: ccBlockType | undefined,
    k: ccKeyringType | undefined
}

/**
 * The data format for AddBlock internode operation
 */
export type inAddBlockDataFormat = {
    traveling: Ca3TravelingFormat
    removeFromPool?: boolean
}

/**
 * The data format for GetPoolHeight internode operation
 */
export type inGetPoolHeightDataFormat = {
    tenantId?: string
}

/**
 * The data format for GetBlockHeight internode operation
 */
export type inGetBlockHeightDataFormat = {
    tenantId?: string
}

/**
 * The data format for GetBlockDigest internode operation
 */
export type inGetBlockDigestDataFormat = {
    tenantId?: string,
    failIfUnhealthy?: boolean
}

/**
 * The data format for GetBlock internode operation
 */
export type inGetBlockDataFormat = {
    oid: string,
    tenantId?: string,
    returnUndefinedIfFail?: boolean
}

/**
 * The data format for ExamineBlockDifference internode operation
 */
export type inExamineBlockDiffernceDataFormat = {
    list: examineHashes,
    tenantId?: string
}

/**
 * The data format for ExaminePoolDifference internode operation
 */
export type inExaminePoolDiffernceDataFormat = {
    list: string[],
    tenantId?: string
}