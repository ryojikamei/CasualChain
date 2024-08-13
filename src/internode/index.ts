import { ClientDuplexStream } from "@grpc/grpc-js";

import { gResult, gError } from "../utils.js"

import ic_grpc from "../../grpc/interconnect_grpc_pb.js";
import ic from "../../grpc/interconnect_pb.js";

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
    s: ccSystemType,
    b: ccBlockType,
    k: ccKeyringType
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

/**
 * The data format when obtaining RPC results
 */
export type rpcResultFormat = {
    id: string,
    node: nodeProperty,
    result: gResult<ic.icGeneralPacket, gError>
}

/**
 * Policy to reset the client connection
 * - no: communicate with current connetion. If it failed, the connection will be reset at call level before retrying
 * - call: create new call, and then communicate with new connection. If it failed, the connection will be reset at channel level before retrying
 * - channel: create new channel and create call, and then communicate with new connection. If it failed, an error will be reported.
 * - check: repeat retrying at call level. It is useful for checking connection.
 * - never: communicate with current connetion. If it failed, an error will be reported immediately.
 */
export type inConnectionResetLevel = "no" | "call" | "channel" | "check" | "never";

export type inConnection = {
    channel: ic_grpc.interconnectClient,
    call: ClientDuplexStream<ic.icGeneralPacket, ic.icGeneralPacket>
}

/**
 * The RPC requests
 */
export type inRequestType = "Ping" | "AddPool" | "AddBlock" | "AddBlockCa3" | "GetPoolHeight" | "GetBlockHeight" | "GetBlockDigest" | "GetBlock" | 
    "ExamineBlockDifference" | "ExaminePoolDifference" | "DeclareBlockCreation" | "SignAndResendOrStore" | "ResetTestNode" | "TestMode";