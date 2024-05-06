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
 * - tenant: set tenant ID. If not, the value of default_tenant_id is used
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
 * General options for getting transactions 
 * - tenant: set tenant ID. If not, the value of default_tenant_id is used
 * - sortOrder: 1 for ascending order, -1  for descending order
 * - constrainedSize: stops counting just before the specified size is exceeded
 */
export type getTransactionOptions = {
    sortOrder?: number,
    constrainedSize?: number
}

/**
 * Options for getSearchByOid 
 * - tenant: set tenant ID. If not, the value of default_tenant_id is used
 * - targetIsBlock: limited to blocked transaction data
 * - constrainedSize: stops counting just before the specified size is exceeded
 */
export type getTransactionOrBlockOptions = {
    targetIsBlock?: boolean,
    constrainedSize?: number
}

/**
 * Options for getTransactionHeight
 * - tenant: set tenant ID. If not, the value of default_tenant_id is used
 * - skipblocked: count only pooling transaction data 
 * - skippooling: count only blocked transaction data
 */
export type getTransactionHeightOptions = {
    skipblocked?: boolean,
    skippooling?: boolean
}

/**
 * Options for getJson 
 * - key:  set a key
 * - value: set a value of the key 
 * - tenant: set tenant ID. If not, the value of default_tenant_id is used
 * - searchblock: search whole blocks instead of transactions
 * - skipblocked: search only pooling transaction data 
 * - skippooling: search only blocked transaction data
 * - ignoreGenesisBlockIsNotFound: no error without the genesis block 
 * - newonly: only get transactions with type "new" 
 * - sortOrder: 1 for ascending order, -1  for descending order
 * - matcherType: "strict" for strict maching of key/value
 * - whole: search whole data instead of user data
 * - constrainedSize: stops counting just before the specified size is exceeded
 */
export type getJsonOptions = {
    key: string,
    value: any,
    searchblock?: boolean,
    skipblocked?: boolean,
    skippooling?: boolean,
    ignoreGenesisBlockIsNotFound?: boolean,
    newonly?: boolean,
    sortOrder?: number,
    matcherType?: string,
    whole?: boolean,
    constrainedSize?: number
}

/**
 * Options for postJson
 * - compatDateTime: use human readable date format instead of unix timestamp
 */
export type postJsonOptions = {
    type: string,
    prev_id?: string,
    data: any,
    compatDateTime?: boolean
}