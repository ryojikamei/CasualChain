/**
 * Copyright (c) 2024 Ryoji Kamei
 * Released under the MIT license
 * https://opensource.org/licenses/mit-license.php
 */

import { ClientSession } from "mongodb";

import { dsConfigType } from "../config/index.js"
import { ccLogType } from "../logger/index.js";
import { blockFormat } from "../block/index.js";
import { BackendDbSubModule, backendDbClient } from "./mongodb.js";
import { cachedIoIterator, directIoIterator } from "./ioiterator.js";

import * as core from "./core.js"
export import DsModule = core.DsModule;

/**
 * Transaction format before being processed by the main module
 */
export type objTx_in = {
    type: string,
    tenant?: string,
    prev_id?: string,
    data: object
}
/**
 * The transaction format
 */
export type objTx = {
    _id: string,
    type: string,
    tenant: string,
    settime: string,
    prev_id?: string,
    deliveryF: boolean,
    data?: object
};

/**
 * The block format
 */
export type objBlock = blockFormat;

/**
 * Common part of ccDirectIoType and ccCachedIoType
 */
export type ccCommonIoType = {
    db: {
        lib: BackendDbSubModule,
        obj: backendDbClient | undefined
    },
    conf: dsConfigType,
    log: ccLogType
}
export type ccCommonIoTypeWithAnyLib = {
    lib: any,
    db: {
        lib: BackendDbSubModule,
        obj: backendDbClient | undefined
    },
    conf: dsConfigType,
    log: ccLogType
}


/**
 * The core object of the DatastoreModule
 */
export type ccDsType = {
    lib: DsModule,
    conf: dsConfigType,
    io: ccCommonIoTypeWithAnyLib | undefined,
    log: ccLogType
}


/**
 * I/O result with pool objects
 */
export type poolResultObject = {
    id: string,
    status: number,
    cache: objTx[]
}
/**
 * I/O result with block objects
 */
export type blockResultObject = {
    id: string,
    status: number,
    cache: objBlock[]
}

/**
 * Common type of I/O result
 */
export type commonResultObject = {
    id: string,
    status: number,
    cache: object[]
}

/** 
 * Options for getPoolCursor
 */
export type getPoolCursorOptions = {
    sortOrder?: number,
    constrainedSize?: number
}

/**
 * Options for getBlockCursor
 */
export type getBlockCursorOptions = {
    sortOrder?: number,
    ignoreGenesisBlockIsNotFound?: boolean,
    constrainedSize?: number
}

export type blockIoIterator = directIoIterator<objBlock> | cachedIoIterator<objBlock>
export type poolIoIterator = directIoIterator<objTx> | cachedIoIterator<objTx>

/**
 * The cursor and session of the db. The session must be closed when finished
 */
export type blockCursor = {
    session: ClientSession | undefined,
    cursor: blockIoIterator | undefined
}
export type poolCursor = {
    session: ClientSession | undefined,
    cursor: poolIoIterator | undefined
}