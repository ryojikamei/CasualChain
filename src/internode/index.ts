/**
 * Copyright (c) 2024 Ryoji Kamei
 * Released under the MIT license
 * https://opensource.org/licenses/mit-license.php
 */

import { ccLogType } from "../logger"
import { inConfigType } from "../config"
import { ccSystemType } from "../system"
import { ccBlockType } from "../block"
import { ccKeyringType } from "../keyring"

import systemrpc_grpc from "../../grpc/systemrpc_grpc_pb.js";

import * as core from "./core.js"
export import InModule = core.InModule

/**
 * The core object of the InternodeModule
 */
export type ccInType = {
    lib: InModule,
    conf: inConfigType,
    log: ccLogType,
    s: ccSystemType | undefined,
    b: ccBlockType | undefined,
    k: ccKeyringType | undefined
}

/**
 * The return format for any height functions
 */
export type heightDataFormat = {
    height: number
}

/**
 * The return format for getBlockDigest
 */
export type digestDataFormat = {
    hash: string
    height: number
}

/**
 * Type for storing client connections
 */
export type rpcConnectionFormat = {
    [target: string]: systemrpc_grpc.gSystemRpcClient
}

/**
 * General format when returning the result from other node
 */
export type rpcReturnFormat = {
    targetHost: string,
    request: string,
    status: number,
    data: string | undefined
}