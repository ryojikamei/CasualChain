/**
 * Copyright (c) 2024 Ryoji Kamei
 * Released under the MIT license
 * https://opensource.org/licenses/mit-license.php
 */

import { gResult, gSuccess, gFailure, gError } from "../utils.js";

import { ccLogType } from "../logger/index.js";
import { mainConfigType } from "../config/index.js";
import { ccMainType, getTransactionOptions, getTransactionHeightOptions, getAllBlockOptions, getTransactionOrBlockOptions, getJsonOptions, postJsonOptions, getBlockOptions } from "./index.js";
import { objTx, objBlock, getPoolCursorOptions, getBlockCursorOptions, poolIoIterator, blockIoIterator, ccDsType } from "../datastore/index.js";
import { randomOid } from "../utils.js";
import { MAX_SAFE_PAYLOAD_SIZE } from "../datastore/mongodb.js";
import { ccSystemType } from "../system/index.js";
import { moduleCondition } from "../index.js";

/**
 * Options for terminal processing for cursor
 */
type convIteratorOptions = {
    bareTransaction?: boolean,
    sortOrder?: number,
    constrainedSize?: number
}

/**
 * Options for terminal processing for arrray
 */
type convArrayOptions = convIteratorOptions;

/**
 * MainModule, for providing APIs for applications.
 * It provide fundamental functions to APIs or inter node RPCs,
 * and some functions that is backed by datastore module functions.
 */
export class MainModule {
    /**
     * Normal return method
     * @param response - response contents
     * @returns returns gSuccess instance contains response
     */
    protected mOK<T>(response: T): gResult<T, never> {
        return new gSuccess(response)
    }
    /**
     * Abnormal return method
     * @param func - set the function/method name
     * @param pos - set the position in the func
     * @param message - set the error message
     * @returns returns gFailure instance contains gError instance
     */
    protected mError(func: string, pos?: string, message?: string): gResult<never, gError> {
        return new gFailure(new gError("main", func, pos, message));
    }

    /**
     * Variable common to each class for setting the module condition
     */
    protected coreCondition: moduleCondition = "unloaded";
    /**
     * Return current condition of the module
     * @returns returns a word that represent the condition of the module
     */
    public getCondition(): moduleCondition {
        return this.coreCondition;
    }
    /**
     * Overwrite the condition of the module
     * @param condition - set a word that represent the condition of the module
     */
    public setCondition(condition: moduleCondition): void {
        this.coreCondition = condition;
    }

    /**
     * The initialization of the MainModule. 
     * @param conf - set mainConfigType instance
     * @param log - set ccLogType instance
     * @returns returns with gResult type that contains ccMainType if it's success, and unknown if it's failure.
     * So there is no need to be concerned about the failure status.
     */
    public init(conf: mainConfigType, log: ccLogType): gResult<ccMainType, unknown> {

        this.coreCondition = "loading";
        const core: ccMainType = {
            lib: new MainModule(),
            conf: conf,
            log: log,
            d: undefined,
            s: undefined
        }

        this.coreCondition = "active";
        core.lib.coreCondition = this.coreCondition;
        return this.mOK<ccMainType>(core);
    }

    /**
     * Restart this module
     * @param core - set ccMainType instance
     * @param log - set ccLogType instance
     * @param d - set ccDsType instance
     * @param s - set ccSystemType instance
     * @returns returns with gResult type that contains ccMainType if it's success, and unknown if it's failure.
     * So there is no need to be concerned about the failure status.
     */
    public restart(core: ccMainType, log: ccLogType, d: ccDsType, s: ccSystemType): gResult<ccMainType, unknown> {
        const LOG = core.log.lib.LogFunc(core.log, "Main", "restart");
        LOG("Info", "start");

        this.coreCondition = "unloaded";
        const ret1 = this.init(core.conf, log);
        if (ret1.isFailure()) { return this.mError("restart", "init", "unknown error") };
        const newCore: ccMainType = ret1.value;
        // reconnect
        newCore.d = d;
        newCore.s = s;

        return this.mOK<ccMainType>(newCore);
    }

    /**
     * Convert from cursor to array with some processing
     * @param dataCursor - set a data of cursor 
     * @param options - set options with convIteratorOptions format
     * @returns returns with a converted data array, that is wrapped by a Promise
     */
    private async convI<T extends object>(dataCursor: poolIoIterator | blockIoIterator | undefined, options: convIteratorOptions): Promise<any[]> {
        if (dataCursor === undefined) return [];

        return this.convA<T>(await dataCursor.toArray(), options);
    }

    /**
     * Convert from array to array with some processing
     * @param dataArr - set a data arrray
     * @param options - set options with convIteratorOptions format
     * @returns returns with a converted data array
     */
    private convA<T extends object>(dataArr: Array<any> | undefined, options: convIteratorOptions): any[] {
        if (dataArr === undefined) return [];

        // bareTransaction for block
        let iArr: any[] = [];
        if (options.bareTransaction !== true) {
            iArr = dataArr;
        } else {
            let blockObj: any = {};
            for (blockObj of dataArr) {
                if (blockObj["data"] !== undefined) {
                    iArr = iArr.concat(blockObj["data"]);
                }
            }

        }

        // sortOrder
        if ((options.sortOrder !== undefined) && (options.sortOrder > 0)) {
            iArr.sort(function(a: any, b: any) {
                if (a._id.toString() > b._id.toString()) {
                    return 1;
                } else {
                    return -1;
                }
            })
        } else if ((options.sortOrder !== undefined) && (options.sortOrder < 0)) {
            iArr.sort(function(a: any, b: any) {
                if (a._id.toString() < b._id.toString()) {
                    return 1;
                } else {
                    return -1;
                }
            })
        }

        // constrainedSize
        let jArr: any[] = [];
        if (options.constrainedSize === undefined) {
            jArr = iArr;
        } else {
            let amountSizeCurrent: number = 0;
            for (const i of iArr) {
                if (i.hasOwnProperty("data") === false) {
                    jArr.push(i);
                } else {
                    amountSizeCurrent = amountSizeCurrent + Buffer.from(JSON.stringify(i.data)).length;
                    if (amountSizeCurrent <= options.constrainedSize) {
                        jArr.push(i);
                    } else {
                        break;
                    }
                }
            }
        }

        return jArr;
    }

    /**
     * Pick pooling transactions up that have been already delivered to other node.
     * @param core - set ccMainType or ccSystemType
     * @param options - can set options with getTransactionOptions format
     * @returns returns with gResult, that is wrapped by a Promise, that contains corresponding transactions if it's success, and gError if it's failure.
     */
    public async getAllDeliveredPool(core: ccMainType, options?: getTransactionOptions): Promise<gResult<objTx[], gError>> {
        const LOG = core.log.lib.LogFunc(core.log, "Main", "getAllDeliveredPool");
        LOG("Info", "start");

        const optCursor: getPoolCursorOptions = {
            sortOrder: options?.sortOrder,
            constrainedSize: options?.constrainedSize
        }
        const optConv: convIteratorOptions = {}

        if (core.d !== undefined) {
            const ret1 = await core.d.lib.getPoolCursor(core.d, optCursor, options?.tenant);
            if (ret1.isSuccess()) {
                let tx: any;
                let txArr: objTx[] = [];
                if (ret1.value.cursor !== undefined) {
                    for await (tx of ret1.value.cursor) {
                        if (tx.value["deliveryF"] === true) {
                            txArr.push(tx.value);
                        }
                    }
                }
                await core.d.lib.closeCursor(core.d, ret1.value);
                return this.mOK(this.convA<objTx>(txArr, optConv));
            }
            return ret1;
        } else {
            return this.mError("getAllDeliveredPool", "getPoolCursor", "The datastore module is down");
        }
    }

    /**
     * Pick pooling transactions up that have NOT been delivered to other node yet.
     * @param core - set ccMainType or ccSystemType
     * @param options - can set options with getTransactionOptions format
     * @returns returns with gResult, that is wrapped by a Promise, that contains corresponding transactions if it's success, and gError if it's failure.
     */
    public async getAllUndeliveredPool(core: ccMainType, options?: getTransactionOptions): Promise<gResult<objTx[], gError>> {
        const LOG = core.log.lib.LogFunc(core.log, "Main", "getAllUndeliveredPool");
        LOG("Info", "start");

        if (options?.excludeNonpropergate === true) { return this.mOK([]) };

        const optCursor: getPoolCursorOptions = {
            sortOrder: options?.sortOrder,
            constrainedSize: options?.constrainedSize
        }
        const optConv: convIteratorOptions = {}

        if (core.d !== undefined) {
            const ret1 = await core.d.lib.getPoolCursor(core.d, optCursor, options?.tenant);
            if (ret1.isSuccess()) {
                let tx: any;
                let txArr: objTx[] = [];
                if (ret1.value.cursor !== undefined) {
                    for await (tx of ret1.value.cursor) {
                        if (tx.value["deliveryF"] === false) {
                            txArr.push(tx.value);
                        }
                    }
                }
                await core.d.lib.closeCursor(core.d, ret1.value);
                return this.mOK(this.convA<objTx>(txArr, optConv));
            }
            return ret1;
        } else {
            return this.mError("getAllDeliveredPool", "getPoolCursor", "The datastore module is down");
        }
    }

    /**
     * Pick all pooling transactions. Several functions that use pool depend on it.
     * @param core - set ccMainType or ccSystemType
     * @param options - can set options with getTransactionOptions format
     * @returns returns with gResult, that is wrapped by a Promise, that contains corresponding transactions if it's success, and gError if it's failure.
     */
    public async getAllPool(core: ccMainType, options?: getTransactionOptions): Promise<gResult<objTx[], gError>> {
        const LOG = core.log.lib.LogFunc(core.log, "Main", "getAllPool");
        LOG("Info", "MainModule:start");

        if (options?.excludeNonpropergate === true) { return await core.lib.getAllDeliveredPool(core, options) };

        const optCursor: getPoolCursorOptions = {
            sortOrder: options?.sortOrder,
            constrainedSize: options?.constrainedSize
        }
        const optConv: convIteratorOptions = {}

        if (core.d !== undefined) {
            const ret1 = await core.d.lib.getPoolCursor(core.d, optCursor, options?.tenant);
            if (ret1.isSuccess()) {
                const ret2 = await this.convI<objTx>(ret1.value.cursor, optConv);
                await core.d.lib.closeCursor(core.d, ret1.value);
                return this.mOK(ret2);
            }
            return ret1;
        } else {
            return this.mError("getAllPool", "getPoolCursor", "The datastore module is down");
        }
    }

    /**
     * Pick all blockchained transactions. Several functions that use blockchain depend on it.
     * By default, provided all transactions are in a blockchain. 
     * Use bareTransaction option if you need to get a bare array of transactions.
     * @param core - set ccMainType or ccSystemType
     * @param options - can set options with getTransactionOptions format
     * @returns  returns with gResult, that is wrapped by a Promise, that contains corresponding blocks or transactions if the bareTransaction option is set if it's success, and gError if it's failure.
     */
    public async getAllBlock(core: ccMainType, options?: getAllBlockOptions): Promise<gResult<objBlock[] | objTx[], gError>> {
        const LOG = core.log.lib.LogFunc(core.log, "Main", "getAllBlock");
        LOG("Info", "start");

        let optCursor: getBlockCursorOptions;
        let optConv: convIteratorOptions;
        if (options?.bareTransaction === true) { // sort after baring transactions
            optCursor = {
                ignoreGenesisBlockIsNotFound: options.ignoreGenesisBlockIsNotFound,
                constrainedSize: options.constrainedSize
            }
            optConv = {
                bareTransaction: options.bareTransaction,
                sortOrder: options.sortOrder
            }
        } else {
            optCursor = {
                sortOrder: options?.sortOrder,
                ignoreGenesisBlockIsNotFound: options?.ignoreGenesisBlockIsNotFound
            }
            optConv = {}
        }

        if (core.d !== undefined) {
            const ret1 = await core.d.lib.getBlockCursor(core.d, optCursor, options?.tenant);
            if (ret1.isSuccess()) { 
                if (ret1.value.cursor === undefined) return this.mError("getAllBlock", "getBlockCursor", "unknown error");
                const ret2 = await this.convI<objBlock>(ret1.value.cursor, optConv);
                await core.d.lib.closeCursor(core.d, ret1.value);
                return this.mOK(ret2);
            }
            return ret1;
        } else {
            return this.mError("getAllBlock", "getBlockCursor", "The datastore module is down");
        }
    }

    /**
     * Pick all transactions both pooling and blockchained. Functions that need to treat all transactions use it.
     * @param core - set ccMainType or ccSystemType
     * @param options - can set options with getTransactionOptions format
     * @returns returns with gResult, that is wrapped by a Promise, that contains corresponding transactions if it's success, and gError if it's failure.
     */
    public async getAll(core: ccMainType, options?: getTransactionOptions): Promise<gResult<objTx[], gError>> {
        const LOG = core.log.lib.LogFunc(core.log, "Main", "getAll");
        LOG("Info", "start");

        const optCursor1: getPoolCursorOptions = {}
        const optCursor2: getBlockCursorOptions = {}
        const optConv1: convIteratorOptions = {
            bareTransaction: true
        }
        const optConv2: convArrayOptions = {
            sortOrder: options?.sortOrder,
            constrainedSize: options?.constrainedSize
        }

        // ToDo: reduce memory consumption
        let all: objTx[] = [];
        if (core.d !== undefined) {
            const ret1 = await core.d.lib.getPoolCursor(core.d, optCursor1, options?.tenant);
            if (ret1.isFailure()) return ret1;
            let ret2: any[] = [];
            if (ret1.value.cursor !== undefined) {
                if (options?.excludeNonpropergate === true) {
                    for await (const tx of ret1.value.cursor) {
                        if (tx.value["deliveryF"] === true) {
                            ret2.push(tx.value);
                        }
                    }
                } else {
                    ret2 = await ret1.value.cursor.toArray();
                }
            }
            const ret3 = await core.d.lib.getBlockCursor(core.d, optCursor2, options?.tenant);
            if (ret3.isFailure()) return ret3;
            const ret4: objTx[] = await this.convI<objTx>(ret3.value.cursor, optConv1);
            all = ret2.concat(ret4);
            await core.d.lib.closeCursor(core.d, ret1.value);
            await core.d.lib.closeCursor(core.d, ret3.value);
        } else {
            return this.mError("getAll", "getPoolCursor", "The datastore module is down");
        }

        if (all.length === 0) {
            return this.mOK<objTx[]>([]);
        }
        return this.mOK<objTx[]>(this.convA<objTx>(all, optConv2));
    }

    /**
     * Pick the last block. Mainly it uses to know last hash or height for constructing the chain.
     * @param core - set ccMainType or ccSystemType
     * @param options - can set options with getBlockOptions format
     * @returns returns with gResult, that is wrapped by a Promise, that contains the corresponding block if it's success, and gError if it's failure.
     */
    public async getLastBlock(core: ccMainType, options?: getBlockOptions): Promise<gResult<objBlock | undefined, gError>> {
        const LOG = core.log.lib.LogFunc(core.log, "Main", "getLastBlock");
        LOG("Info", "start");

        const optCursor: getBlockCursorOptions = {
            sortOrder: options?.sortOrder ?? -1,
            ignoreGenesisBlockIsNotFound: false,
            constrainedSize: undefined
        }

        if (core.d !== undefined) {
            const ret1 = await core.d.lib.getBlockCursor(core.d, optCursor, options?.tenant);
            if (ret1.isFailure()) return ret1;
            let topTx: any = null;
            if (ret1.value.cursor !== undefined) {
                topTx = await ret1.value.cursor.next();
                LOG("Debug", JSON.stringify(topTx));
            }
            if ((topTx === null) || (topTx === undefined)) {
                await core.d.lib.closeCursor(core.d, ret1.value);
                return this.mError("getLastBlock", "getBlockCursor", "Unknown error");
            } else {
                try {
                    if ((topTx.value.hasOwnProperty("data")) && (Array.isArray(topTx.value["data"]) === true) && (topTx.value["data"][0].hasOwnProperty("_id"))) {
                        delete topTx.value["data"];     
                    }
                } catch (error) {
                    
                }
                await core.d.lib.closeCursor(core.d, ret1.value);
                return this.mOK(topTx.value);
            }
        } else {
            return this.mError("getLastBlock", "getBlockCursor", "The datastore module is down");
        }
    }

    /**
     * Obtains a transaction with the specified oid.
     * @param core - set ccMainType instance
     * @param oid - set the starting oid to the past
     * @param options - can set options with getTransactionOptions format
     * @returns returns with gResult, that is wrapped by a Promise, that contains the corresponding block if the targetIsBlock option is set or the corresponding transaction or undefined if there is no object that has the oid if it's success, and gError if it's failure.
     */
    public async getSearchByOid<T>(core: ccMainType, oid: string, options?: getTransactionOrBlockOptions): Promise<gResult<T | undefined, gError>> {
        const LOG = core.log.lib.LogFunc(core.log, "Main", "getSearchByOid");
        LOG("Info", "start");

        if (options?.targetIsBlock !== true) { // oid of all transactions
            if (core.d !== undefined) {
                const optCursor1: getPoolCursorOptions = { 
                    constrainedSize: options?.constrainedSize
                };
                const ret1 = await core.d.lib.getPoolCursor(core.d, optCursor1, options?.tenant);
                if (ret1.isFailure()) return ret1;
                let tx: any;
                if (ret1.value.cursor !== undefined) {
                    for await(tx of ret1.value.cursor) {
                        if (tx.value._id.toString() === oid) {
                            await core.d.lib.closeCursor(core.d, ret1.value);
                            return this.mOK<T>(tx.value);
                        }
                    }
                }
                await core.d.lib.closeCursor(core.d, ret1.value);
                const optCursor2: getBlockCursorOptions = {};
                const ret2 = await core.d.lib.getBlockCursor(core.d, optCursor2, options?.tenant);
                if (ret2.isFailure()) return ret2;
                let blk: any;
                if (ret2.value.cursor !== undefined) {
                    for await(blk of ret2.value.cursor) {
                        if (blk.data === undefined) continue;
                        let tx: any;
                        for (tx of blk.data) {
                            if (tx.value._id.toString() === oid) {
                                await core.d.lib.closeCursor(core.d, ret2.value);
                                return this.mOK<T>(tx.value);
                            }
                        }
                    }
                }
                await core.d.lib.closeCursor(core.d, ret2.value);
                return this.mOK<undefined>(undefined);
            } else {
                return this.mError("getSearchByOid", "getPoolCursor", "The datastore module is down");
            }
        } else { // oid of blocks
            if (core.d !== undefined) {
                const optCursor: getBlockCursorOptions = {
                    constrainedSize: options?.constrainedSize
                };
                const ret = await core.d.lib.getBlockCursor(core.d, optCursor, options.tenant);
                if (ret.isFailure()) return ret;
                let blk: any;
                if (ret.value.cursor !== undefined) {
                    for await(blk of ret.value.cursor) {
                        if (blk.value._id.toString() === oid) {
                            await core.d.lib.closeCursor(core.d, ret.value);
                            return this.mOK<T>(blk.value);
                        }
                    }
                }
                await core.d.lib.closeCursor(core.d, ret.value);
                return this.mOK<undefined>(undefined);
            } else {
                return this.mError("getSearchByOid", "getBlockCursor", "The datastore module is down");
            }
        }
    }


    /**
     * Searches within data. Currently only matcherType strict is provisionally implemented.
     * @param core - set ccMainType instance
     * @param data - set target data
     * @param options - set options with getJsonOptions format
     * @returns returns with gResult, that is wrapped by a Promise, that contains the result object or undefined if it's success, and gError if it's failure.
     */
    private async searchTxData(core: ccMainType, data: any, options: getJsonOptions): Promise<gResult<object | undefined, gError>> {
        const LOG = core.log.lib.LogFunc(core.log, "Main", "searchTxData");
        LOG("Info", "start");
        LOG("Debug", JSON.stringify(data));

        let dataObj: object | undefined = undefined;
        let matcherType: string = "";

        if (data === undefined) return this.mOK(dataObj);
        if (options.matcherType === undefined) { 
            matcherType = "strict";
        } else {
            matcherType = options.matcherType;
        }

        if (matcherType === "strict") {
            if ((data[options.key] !== undefined) && (data[options.key] === options.value)) { return this.mOK(data) };
            return this.mOK(dataObj);
        } else {
            return this.mError("searchForTxData", "Unimplemented", "matcherType " + matcherType + " is not implemented");
        }
    }


    /**
     * Searching data of transactions by a pair of key and value with JSON format.
     * @param core - set ccMainType instance
     * @param options - can set options with getJsonOptions format
     * @returns returns with gResult, that is wrapped by a Promise, that contains corresponding transactions if it's success, and gError if it's failure.
     */
    public async getSearchByJson<T>(core: ccMainType, options: getJsonOptions): Promise<gResult<T[], gError>> {
        const LOG = core.log.lib.LogFunc(core.log, "Main", "getSearchByJson");
        LOG("Info", "start");
    
        if ((options.excludeBlocked === true) && (options.excludePooling === true)) { return this.mOK<T[]>([]) }
        
        const txArr: objTx[] = [];
        const blockArr: objBlock[] = [];

        const optConv: convArrayOptions = {
            sortOrder: options.sortOrder,
            constrainedSize: options.constrainedSize
        };


        if (core.d !== undefined) {
            if (options.excludePooling !== true) {
                const optCursor1: getPoolCursorOptions = {};
                const ret1 = await core.d.lib.getPoolCursor(core.d, optCursor1, options.tenant);
                if (ret1.isFailure()) return ret1;
                let tx: IteratorResult<objTx | undefined>;
                if (ret1.value.cursor !== undefined) { 
                    for await(tx of ret1.value.cursor) {
                        let ret2;
                        if (options.whole === true) {
                            ret2 = await this.searchTxData(core, tx.value, options);
                        } else {
                            ret2 = await this.searchTxData(core, tx.value.data, options);
                        }
                        if (ret2.isFailure()) return ret2;
                        if (ret2.value !== undefined) txArr.push(tx.value);
                    }
                }
                await core.d.lib.closeCursor(core.d, ret1.value);
            }
            if (options.excludeBlocked !== true) {
                const optCursor2: getBlockCursorOptions = {
                    ignoreGenesisBlockIsNotFound : options.ignoreGenesisBlockIsNotFound
                };
                const ret3 = await core.d.lib.getBlockCursor(core.d, optCursor2, options.tenant);
                if (ret3.isFailure()) return ret3;
                let blk: IteratorResult<objBlock | undefined>;
                if (ret3.value.cursor !== undefined) {
                    if (options.searchBlocks === true) {
                        for await(blk of ret3.value.cursor) {
                            const ret5 = await this.searchTxData(core, blk.value, options);
                            if (ret5.isSuccess()) {
                                if (ret5.value !== undefined) blockArr.push(blk.value)
                            }
                        }
                    } else {
                        for await(blk of ret3.value.cursor) {
                            if (blk.value.data === undefined) continue;
                            let tx: objTx;
                            for (tx of blk.value.data) {
                                let ret4;
                                if (options.whole === true) {
                                    ret4 = await this.searchTxData(core, tx, options);
                                } else {
                                    ret4 = await this.searchTxData(core, tx.data, options);
                                }
                                if (ret4.isFailure()) return ret4;
                                if (ret4.value !== undefined) txArr.push(tx);
                            }
                        }
                    }
                }
                await core.d.lib.closeCursor(core.d, ret3.value);
            }
            if (options.searchBlocks === true) {
                return this.mOK<T[]>(this.convA(blockArr, optConv));
            } else {
                return this.mOK<T[]>(this.convA(txArr, optConv));
            }
        } else {
            return this.mError("getSearchByJson", "getPoolCursor", "The datastore module is down");
        }
    }

    /**
     * Send a data to the transaction pool in JSON format with key/value pairs, with adding required fields for data management.
     * @param core - set ccMainType 
     * @param options - can set options in postJsonOptions format
     * @returns returns with gResult, that is wrapped by a Promise, that contains the transaction's oid if it's success, and gError if it's failure.
     */
    public async postByJson(core: ccMainType, options: postJsonOptions): Promise<gResult<string, gError>> {
        const LOG = core.log.lib.LogFunc(core.log, "Main", "postByJson");
        LOG("Info", "start");
        LOG("Debug", "options:" + JSON.stringify(options));

        let compatDateTime: boolean = false;
        if (options.compatDateTime !== undefined) compatDateTime = options.compatDateTime;
        let tenantId: string;
        if (options.tenant === undefined) {
            if ((core.s !== undefined) && (core.s.conf.enable_default_tenant === false)) {
                return this.mError("postByJson", "tenantId", "Default parcel is disabled")
            } else {
                tenantId = core.conf.default_tenant_id;
            }
        } else {
            if ((core.s !== undefined) && (options.tenant === core.s.conf.administration_id)) {
                tenantId = core.conf.default_tenant_id;
            } else {
                tenantId = options.tenant;
            }
        }

        // check if parcel is active
        if (tenantId !== core.conf.default_tenant_id) {
            if (core.s === undefined) {
                return this.mError("postByJson", "isOpenParcel", "Unable to post data to the specified tenant because SystemModule is down")
            } else {
                const ret = core.s.lib.isOpenParcel(core.s, tenantId);
                if (ret.isFailure() === true) { this.mError("postByJson", "isOpenParcel", "unknown error"); }
                if (ret.value === false) {
                    this.mError("postByJson", "isOpenParcel", "The specified parcel, " + tenantId + ", is not active.");
                }
            }
        }

        // check keys
        if (options.hasOwnProperty("data") === false) return this.mError("postByJson", "CheckKeys", "The data property is not found");
        if (options.hasOwnProperty("type") === false) {
            LOG("Warning", "The type property is not found. Skip");
            return this.mError("postByJson", "CheckKeys", "The type property is not found");
        } else {
            if ((options.hasOwnProperty("prev_id") === false) && ((options.type === "update") || (options.type === "delete"))) {
                LOG("Warning", "The update or delete type must have prev_id property also. Skip");
                return this.mError("postByJson", "CheckKeys", "The update or delete type must have prev_id property also");
            }
        }
        if (options.data === undefined) {
            LOG("Warning", "The data is not found. Skip");
            return this.mError("postByJson", "CheckData", "The data is not found");
        } else {
            if (typeof(options.data) !== "object") {
                LOG("Warning", "The data is not an object. Skip");
                return this.mError("postByJson", "CheckData", "The data is not an object");
            }
            if (Buffer.from(JSON.stringify(options.data)).length > MAX_SAFE_PAYLOAD_SIZE) {
                const maxSizeMiB = MAX_SAFE_PAYLOAD_SIZE / 1024 / 1024;
                LOG("Warning", "The data exceeds the maximum payload size. It must be less than " + maxSizeMiB + " MiB. Skip.");
                return this.mError("postByJson", "CheckData", "The data exceeds the maximum payload size.  It must be less than " + maxSizeMiB + " MiB.");
            }
        }

        // add more mandatory keys
        const dateTime = new Date();
        let stringDateTime: any = "";
        if (compatDateTime === true) {
            stringDateTime = dateTime.toLocaleString();
        } else {
            stringDateTime = dateTime.valueOf();
        }

        let tx: objTx;
        if (options.prev_id !== undefined) {
            tx = {
                _id: randomOid().byStr(),
                type: options.type,
                tenant: tenantId,
                settime: stringDateTime,
                prev_id: options.prev_id,
                deliveryF: false,
                data: options.data
            }
        } else {
            tx = {
                _id: randomOid().byStr(),
                type: options.type,
                tenant: tenantId,
                settime: stringDateTime,
                deliveryF: false,
                data: options.data
            }
        }

        if (core.d !== undefined) { 
            const ret1 = await core.d.lib.setPoolNewData(core.d, tx, tenantId);
            if (ret1.isFailure()) return ret1;
            return this.mOK<string>(tx._id);
        } else {
            return this.mError("postByJson", "enQueue", "The datastore module is down");
        }
    }

    /**
     * Recursive search function to follow the chain.
     * @param rcache - The search target. Set objTx[] instance
     * @param targetId - The starting id, from which the chain is explored into the past
     * @param appendingcache - The target to be added. Returned at the end.
     * @param start - The starting point of search to be taken over at the time of recursive call
     * @returns returns with gResult that contains a chain of transactions if it's success,  and unknown if it's failure.
     * So there is no need to be concerned about the failure status.
     */
    private findEntryRecursive(rcache: objTx[], targetId: string, appendingcache: objTx[], start: number): gResult<objTx[], unknown> {
        let index = 0;
        
        for (index = start; index < rcache.length; index++) {
            const dataObj: any = rcache[index];
            if (dataObj._id.toString() === targetId) {
                appendingcache = appendingcache.concat(dataObj);
            }
            if (dataObj.prev_id !== undefined) {
                targetId = dataObj.prev_id;
                const ret = this.findEntryRecursive(rcache, targetId, appendingcache, ++index);
                if (ret.isSuccess()) return this.mOK<objTx[]>(ret.value);
            } else {
                return this.mOK<objTx[]>(appendingcache);
            }
        }
        return this.mOK<objTx[]>(appendingcache); // Missing previous transaction?
    }

    /**
     * Obtain past transactions in the chain using the oid as the starting key.
     * @param core - set ccMainType instance 
     * @param oid - set the starting oid to the past
     * @param options - can set options with getTransactionOptions format
     * @returns returns with gResult, that is wrapped by a Promise, that contains a chain of transactions if it's success, and gError if it's failure.
     */
    public async getHistoryByOid(core: ccMainType, oid: string, options?: getTransactionOptions): Promise<gResult<objTx[], gError>> {
        const LOG = core.log.lib.LogFunc(core.log, "Main", "getHistoryByOid");
        LOG("Info", "start");

        const optCursor1: getPoolCursorOptions = {}
        const optCursor2: getBlockCursorOptions = {}
        const optConv1: convIteratorOptions = {
            bareTransaction: true
        }
        const optConv2: convArrayOptions = {
            sortOrder: -1
        }
        const optConv3: convArrayOptions = {
            constrainedSize: options?.constrainedSize
        }

        // ToDo: reduce memory consumption
        let all: objTx[] = [];
        if (core.d !== undefined) {
            const ret1 = await core.d.lib.getPoolCursor(core.d, optCursor1, options?.tenant);
            if (ret1.isFailure()) return ret1;
            let ret2: any[] = [];
            if (ret1.value.cursor !== undefined) {
                if (options?.excludeNonpropergate === true) {
                    for await (const tx of ret1.value.cursor) {
                        if (tx.value["deliveryF"] === true) {
                            ret2.push(tx.value);
                        }
                    }
                } else {
                    ret2 = await ret1.value.cursor.toArray();
                }
            }
            const ret3 = await core.d.lib.getBlockCursor(core.d, optCursor2, options?.tenant);
            if (ret3.isFailure()) return ret3;
            const ret4: objTx[] = await this.convI<objTx>(ret3.value.cursor, optConv1);
            all = this.convA(ret2.concat(ret4), optConv2);
            await core.d.lib.closeCursor(core.d, ret1.value);
            await core.d.lib.closeCursor(core.d, ret3.value);
        } else {
            return this.mError("getAll", "getPoolCursor", "The datastore module is down");
        }

        if (all.length === 0) {
            return this.mOK<objTx[]>([]);
        }

        let txArr: objTx[] = [];
        const ret2 = this.findEntryRecursive(all, oid, txArr, 0);
        if (ret2.isSuccess()) txArr = ret2.value;
        return this.mOK<objTx[]>(this.convA<objTx>(txArr, optConv3));
    }

    /**
     * Obtains the number of transaction count
     * @param core - set ccMainType instance
     * @param options - can set options with getTransactionOptions format
     * @returns returns with gResult, that is wrapped by a Promise, that contains the value of height if it's success, and gError if it's failure.
     */
    public async getTransactionHeight(core: ccMainType, options?: getTransactionHeightOptions): Promise<gResult<number, gError>> {
        const LOG = core.log.lib.LogFunc(core.log, "Main", "getTransactionHeight");
        LOG("Info", "start");

        if ((options?.excludeBlocked === true) && (options?.excludePooling === true)) { return this.mOK(0); }
        
        let count: number = 0;
        const optCursor1: getPoolCursorOptions = {}
        const optCursor2: getBlockCursorOptions = {}

        if (options?.excludePooling !== true) {
            if (core.d !== undefined) {
                const ret1 = await core.d.lib.getPoolCursor(core.d, optCursor1, options?.tenant);
                if (ret1.isFailure()) return ret1;
                if (ret1.value.cursor !== undefined) {
                    if (options?.excludeNonpropergate === true) {
                        for await (const tx of ret1.value.cursor) {
                            if (tx.value["deliveryF"] === true) { count++; }
                        }
                    } else {
                        for await (const tx of ret1.value.cursor) { count++; }
                    }
                }
                await core.d.lib.closeCursor(core.d, ret1.value);
            } else {
                return this.mError("getAll", "getPoolCursor", "The datastore module is down");
            }
        }
        if (options?.excludeBlocked !== true) {
            if (core.d !== undefined) {
                const ret2 = await core.d.lib.getBlockCursor(core.d, optCursor2, options?.tenant);
                if (ret2.isFailure()) return ret2;
                let blk: any;
                if (ret2.value.cursor !== undefined) {
                    for await (blk of ret2.value.cursor) {
                        count = count + blk.value.size;
                    }
                }
                await core.d.lib.closeCursor(core.d, ret2.value);
            } else {
                return this.mError("getAll", "getBlockCursor", "The datastore module is down");
            }
        }
        return this.mOK<number>(count);
    }
}
