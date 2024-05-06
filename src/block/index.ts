/**
 * Copyright (c) 2024 Ryoji Kamei
 * Released under the MIT license
 * https://opensource.org/licenses/mit-license.php
 */

import { blockConfigType } from "../config"
import { ccLogType } from "../logger"
import { ccInType } from "../internode"
import { ccSystemType } from "../system"
import { ccKeyringType } from "../keyring"
import { ccMainType } from "../main"

import * as core from "./core"
export import BlockModule = core.BlockModule;
import { objTx } from "../datastore"
import { Ca3BlockFormat } from "./algorithm/ca3";

/**
 * Previous format of block
 * WARNING: The order of the contents must not be transposed.
 * It might be considered tampered with.
 */
export type Ca2BlockFormat = {
    _id: string,
    version: number, // 1
    tenant: string,
    height: number,
    size: number,
    data?: objTx[], // genesis block doesn't have it
    type?: string,  // genesis block doesn't have it
    settime: string,
    timestamp: string,
    miner?: string,  // genesis block doesn't have it
    prev_hash: string,
    hash: string
}
export type blockFormat = Ca2BlockFormat | Ca3BlockFormat;

/**
 * The core object of the BlockModule
 */
export type ccBlockType = {
    lib: BlockModule,
    algorithm: any,
    conf: blockConfigType,
    log: ccLogType,
    i: ccInType | undefined,
    s: ccSystemType | undefined,
    k: ccKeyringType | undefined,
    m: ccMainType | undefined
}

/**
 * The option for creating blocks
 */
export type createBlockOptions = {
    type: string
}