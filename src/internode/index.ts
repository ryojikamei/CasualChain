import { gResult, gError } from "../utils.js"

import ic from "../../grpc/interconnect_pb.js"

import { InModule } from "./core.js"
import { inConfigType, nodeProperty } from "../config/index.js"
import { ccLogType } from "../logger/index.js"
import { ccSystemType, examineHashes } from "../system/index.js"
import { ccBlockType } from "../block/index.js"
import { ccKeyringType } from "../keyring/index.js"

import { Ca3TravelingFormat } from "../block/algorithm/ca3.js"
import { InReceiverSubModule } from "./receiver.js"

import * as core from "./core.js"
export import InModule = core.InModule

/**
 * The core object of the InternodeModule
 */
export type ccInType = {
    lib: InModule,
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
 * The return format for any height functions
 */
export type inHeightReturnDataFormat = {
    height: number
}

/**
 * The data format for GetBlockDigest internode operation
 */
export type inGetBlockDigestDataFormat = {
    tenantId?: string,
    failIfUnhealthy?: boolean
}

/**
 * The return format for getBlockDigest
 */
export type inDigestReturnDataFormat = {
    hash: string
    height: number
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

export type rpcResultFormat = {
    id: string,
    node: nodeProperty,
    result: gResult<ic.icGeneralPacket, gError>
}

export type inConnectionResetLevel = "no" | "call" | "channel" | "check" | "never";