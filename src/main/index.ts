/**
 * Copyright (c) 2024 Ryoji Kamei
 * Released under the MIT license
 * https://opensource.org/licenses/mit-license.php
 */

import { mainConfigType } from "../config/index.js"
import { ccLogType } from "../logger/index.js"
import { ccDsType } from "../datastore/index.js"
import { ccSystemType } from "../system/index.js"

import * as main from "./core.js"
export import MainModule = main.MainModule



/**
 * The core object of the MainModule
 */
export type ccMainType = {
    lib: MainModule,
    conf: mainConfigType,
    log: ccLogType,
    d: ccDsType | undefined,
    s: ccSystemType | undefined
}

/**
 * Options for getAllBlock
 * - sortOrder: 1 for ascending order, -1 for descending order
 * - bareTranaction: returns transactions contained in blocks, not blocks 
 * - ignoreGenesisBlockIsNotFound: no error without the genesis block 
 * - constrainedSize: stops counting just before the specified size is exceeded
 */
export type getAllBlockOptions = {
    sortOrder?: number,
    bareTransaction?: boolean,
    ignoreGenesisBlockIsNotFound?: boolean,
    constrainedSize?: number
}

/**
 * Options for gettting blocks
 * - sortOrder: 1 for ascending order, -1 for descending order
 * - ignoreGenesisBlockIsNotFound: no error without the genesis block 
 * - constrainedSize: stops counting just before the specified size is exceeded
 */
export type getBlockOptions = {
    sortOrder?: number,
    ignoreGenesisBlockIsNotFound?: boolean,
    constrainedSize?: number
}

/**
 * General options for getting transactions 
 * - excludeNonpropergate: exclude transactions that are not propergated to other nodes
 * - sortOrder: 1 for ascending order, -1  for descending order
 * - constrainedSize: stops counting just before the specified size is exceeded
 */
export type getTransactionOptions = {
    excludeNonpropergate?: boolean,
    sortOrder?: number,
    constrainedSize?: number
}

/**
 * Options for getSearchByOid 
 * - targetIsBlock: limited to blocked transaction data
 * - constrainedSize: stops counting just before the specified size is exceeded
 */
export type getTransactionOrBlockOptions = {
    targetIsBlock?: boolean,
    constrainedSize?: number
}

/**
 * Options for getTransactionHeight
 * - excludeBlocked: count only pooling transaction data 
 * - excludePooling: count only blocked transaction data
 * - excludeNonpropergate: exclude transactions that are not propergated to other nodes
 */
export type getTransactionHeightOptions = {
    excludeBlocked?: boolean,
    excludePooling?: boolean,
    excludeNonpropergate?: boolean
}

/**
 * Options for getJson 
 * - key:  set a key
 * - value: set a value of the key 
 * - searchBlocks: search whole blocks instead of transactions
 * - excludeBlocked: search only pooling transaction data 
 * - excludePooling: search only blocked transaction data
 * - excludeNonpropergate: exclude transactions that are not propergated to other nodes
 * - ignoreGenesisBlockIsNotFound: no error without the genesis block 
 * - sortOrder: 1 for ascending order, -1  for descending order
 * - matcherType: "strict" for strict maching of key/value
 * - whole: search whole data instead of user data
 * - constrainedSize: stops counting just before the specified size is exceeded
 */
export type getJsonOptions = {
    key: string,
    value: any,
    searchBlocks?: boolean,
    excludeBlocked?: boolean,
    excludePooling?: boolean,
    excludeNonpropergate?: boolean,
    ignoreGenesisBlockIsNotFound?: boolean,
    sortOrder?: number,
    matcherType?: string,
    whole?: boolean,
    constrainedSize?: number
}

/**
 * Options for postJson
 * - type: set transaction type. "new", "update", and "delete" are special words to make a transaction chain
 * - prev_id: can set previous oid when type is "update" or "delete"
 * - data: set user data in JSON format
 * - compatDateTime: use human readable date format instead of unix timestamp
 */
export type postJsonOptions = {
    type: string,
    prev_id?: string,
    data: any,
    compatDateTime?: boolean
}