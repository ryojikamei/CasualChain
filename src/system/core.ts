/**
 * Copyright (c) 2024 Ryoji Kamei
 * Released under the MIT license
 * https://opensource.org/licenses/mit-license.php
 */

import clone from "clone";
import { randomUUID, randomInt } from 'crypto';

import { gResult, gSuccess, gFailure, gError } from "../utils.js";

import * as systemrpc from '../../grpc/systemrpc_pb.js';

import { RUNTIME_MASTER_IDENTIFIER, DEFAULT_PARSEL_IDENTIFIER, ccSystemType, postGenesisBlockOptions, postScanAndFixOptions, getBlockResult, examineHashes, examinedHashes } from "./index.js";
import { systemConfigType } from "../config/index.js";
import { ccLogType } from "../logger/index.js";
import { objTx, objBlock, poolResultObject, blockResultObject, ccDsType } from "../datastore/index.js";
import { rpcReturnFormat, heightDataFormat, digestDataFormat, ccInType } from '../internode/index.js';
import { blockFormat, createBlockOptions, ccBlockType } from '../block/index.js';
import { ccMainType } from '../main/index';
import { randomOid } from '../utils.js';
import { ccEventType, internalEventFormat } from '../event/index.js';
import { MAX_SAFE_PAYLOAD_SIZE } from "../datastore/mongodb.js";

/**
 * The result of single block diagnostics
 * data: the block data
 * dataAsObj: if the block data is illegal, it is stored here
 * block_status: -2: illegal data, -1: illegal block, 0: clean, 1: unchecked, 2: fixed, 3: problem, 
 *               +10: It's on a fork, +100: It's on a fragment, +1000: It's onwith a root missing
 * highest_hash: hash value of the highest(most recent) transaction of a chain.
 */
type blockDiagnosticsFormat = {
    data: objBlock,
    dataAsObj?: object,
    block_status: number,
    highest_hash: string
}

/**
 * The digest of the chain condition
 * number_of_errors: the total number of errors. A healthy node is 0.
 * has_illegal_data: the total number of illegal data. It is not a block or a heavily damaged block that the oid cannot be read
 * has_illegal_block: the total number of illegal blocks. Some part of a block cannot be read
 * has_malformed_block: the total number of malformed blocks. They are going to be fixed
 * lacks_genesis_block: the chain lacks genesis block
 * root_block_missing: the total number of missing root blocks. THe root part of the chain may be damaged
 */
type chainCondition = {
    number_of_errors: number,
    has_illegal_data: number,
    has_illegal_block: number,
    has_malformed_block: number,
    has_fork: number,
    has_fragment: number,
    lacks_genesis_block: boolean,
    root_block_missing: number
}

/**
 * The total report format of a chain's health
 * blocks: stores condition of each blocks
 * chain_status: stores digest of chain condition
 * genesis_hash: stores genesis block's hash
 */
type blockchainDiagnosticsFormat = {
    blocks: blockDiagnosticsFormat[],
    chain_status: chainCondition
    genesis_hash: string
}

/**
 * Status of majority of nodes
 */
type majorityNodes = {
    hash: string,
    count: number,
    height: number,
    hosts: string[]
}

/**
 * Status of an individual node
 */
type nodeStatus = {
    host: string,
    hash: string,
    height: number
}

/**
 * The list of healthy nodes
 */
type healthyNodesFormat = {
    hosts: nodeStatus[],
    majority: majorityNodes
}


/**
 * SystemModule, provides functions for administration
 */
export class SystemModule {
    /**
     * Normal return method
     * @param response - response contents
     * @returns returns gSuccess instance contains response
     */
    protected sOK<T>(response: T): gResult<T, never> {
        return new gSuccess(response)
    }
    /**
     * Abnormal return method
     * @param func - set the function/method name
     * @param pos - set the position in the func
     * @param message - set the error message
     * @returns returns gFailure instance contains gError instance
     */
    protected sError(func: string, pos?: string, message?: string): gResult<never, gError> {
        return new gFailure(new gError("system", func, pos, message));
    }

    /**
     * Stub values for features not supported in the open source version
     */
    protected master_key: string
    protected common_parsel: string
    constructor() {
        this.master_key = RUNTIME_MASTER_IDENTIFIER;
        this.common_parsel = DEFAULT_PARSEL_IDENTIFIER;
    }

    /**
     * Initialization for SystemModule.
     * @param conf - set systemConfigType instance
     * @param log - set ccLogType instance
     * @param dsInstance - can inject ccDsType instance
     * @param inInstance - can inject ccInType instance
     * @param blockInstance - can inject ccBlockType instance
     * @param mainInstance - can inject ccMainkType instance
     * @param eventInstance - can inject ccEventType instance
     * @returns returns with gResult type that contains ccSystemType if it's success, and unknown if it's failure.
     * So there is no need to be concerned about the failure status.
     */
    public init(conf: systemConfigType, log: ccLogType, dsInstance?: ccDsType, 
        inInstance?: ccInType, blockInstance?: ccBlockType, mainInstance?: ccMainType,
        eventInstance?: ccEventType): gResult<ccSystemType, unknown> {

        const core: ccSystemType = {
            lib: new SystemModule(),
            conf: conf,
            log: log,
            autoTasks: undefined,
            serializationLocks: {
                postDeliveryPool: false,
                postAppendBlocks: false,
                postGenesisBlock: false,
                postScanAndFixBlock: false,
                postScanAndFixPool: false
            },
            d: dsInstance ?? undefined,
            i: inInstance ?? undefined,
            b: blockInstance ?? undefined,
            m: mainInstance ?? undefined,
            e: eventInstance ?? undefined
        }

        return this.sOK<ccSystemType>(core);
    }

    /**
     * Rester auto tasks, such as blocking
     * @param core - set ccSystemType instance
     * @returns returns with gResult, that is wrapped by a Promise, that contains void if it's success, and unknown if it's failure.
     */
    public registerAutoTasks(core: ccSystemType): gResult<void, unknown> {
        const LOG = core.log.lib.LogFunc(core.log);
        LOG("Info", 0, "SystemModule:registerAutoTasks");

        if (core.e === undefined) {
            return this.sError("resiterAutoTasks", "registerInternalEvent", "The event module is down");
        }

        // Register internal events
        const currentTimeMs = new Date().valueOf();

        const event1: internalEventFormat = {
            eventId: randomUUID(), // Not critical at collision so far
            methodPath: "w.s.lib.postScanAndFixBlock",
            methodArgs: ["w.s"],
            status: "queue",
            executionResult: undefined,
            minIntervalMs: core.conf.events_internal.postScanAndFixBlockMinInterval * 60 * 1000,
            nextExecuteTimeMs: currentTimeMs + randomInt(1000, 2500),
            exitOnError: false
        }
        core.e.lib.registerInternalEvent(core.e, event1);
        
        const event2: internalEventFormat = {
            eventId: randomUUID(), // Not critical at collision so far
            methodPath: "w.s.lib.postScanAndFixPool",
            methodArgs: ["w.s"],
            status: "queue",
            executionResult: undefined,
            minIntervalMs: core.conf.events_internal.postScanAndFixPoolMinInterval * 60 * 1000,
            nextExecuteTimeMs: currentTimeMs,
            exitOnError: false
        }
        core.e.lib.registerInternalEvent(core.e, event2);

        const event3: internalEventFormat = {
            eventId: randomUUID(), // Not critical at collision so far
            methodPath: "w.s.lib.postDeliveryPool",
            methodArgs: ["w.s"],
            status:"queue",
            executionResult: undefined,
            minIntervalMs: core.conf.events_internal.postDeliveryPoolMinInterval * 60 * 1000,
            nextExecuteTimeMs: currentTimeMs + randomInt(5000, 7500),
            exitOnError: false
        }
        core.e.lib.registerInternalEvent(core.e, event3);

        const event4: internalEventFormat = {
            eventId: randomUUID(), // Not critical at collision so far
            methodPath: "w.s.lib.postAppendBlocks",
            methodArgs: ["w.s"],
            status: "queue",
            executionResult: undefined,
            minIntervalMs: core.conf.events_internal.postAppendBlocksMinInterval * 60 * 1000,
            nextExecuteTimeMs: currentTimeMs + randomInt(7500, 10000),
            exitOnError: false
        }
        core.e.lib.registerInternalEvent(core.e, event4);

        core.autoTasks = {
            postScanAndFixBlock: event1,
            postScanAndFixPool: event2,
            postDeliveryPool: event3,
            postAppendBlocks: event4
        }

        return this.sOK<void>(undefined);
    }

    /**
     * Unregister auto tasks
     * @param core - set ccSystemType instance
     * @returns returns with gResult, that is wrapped by a Promise, that contains void if it's success, and unknown if it's failure.
     */
    public unregisterAutoTasks(core: ccSystemType): gResult<void, unknown> {
        const LOG = core.log.lib.LogFunc(core.log);
        LOG("Info", 0, "SystemModule:unregisterAutoTasks");

        core.autoTasks = undefined;

        if (core.e === undefined) {
            return this.sError("resiterAutoTasks", "registerInternalEvent", "The event module is down");
        }
        core.e.lib.unregisterAllInternalEvents(core.e);

        return this.sOK<void>(undefined);
    }
    
    /**
     * Deliver pooled transactions to other nodes.
     * @param core - set ccSystemType instance
     * @returns returns with gResult, that is wrapped by a Promise, that contains void if it's success, and gError if it's failure.
     * So there is no need to check the value of success.
     */
    public async postDeliveryPool(core: ccSystemType): Promise<gResult<void, gError>> {
        const LOG = core.log.lib.LogFunc(core.log);
        LOG("Info", 0, "SystemModule:postDeliveryPool");

        if (core.serializationLocks.postDeliveryPool === true) {
            return this.sError("postDeliveryPool", "serializationLocks", "This function is running. Wait for a while.");
        } else {
            core.serializationLocks.postDeliveryPool = true;
        }
        
        if (core.m === undefined) {
            core.serializationLocks.postDeliveryPool = false;
            return this.sError("postDeliveryPool", "getAllUndeliveredPool", "The main module is down");
        }
        // Prepare an array of tx's with the pool delivery flag false
        const ret1 = await core.m.lib.getAllUndeliveredPool(core.m);
        if (ret1.isFailure()) {
            core.serializationLocks.postDeliveryPool = false;
            return ret1;
        }

        // Send to other node => (Receiver) register data in pool and change flag to true
        let sObj: systemrpc.ccSystemRpcFormat.AsObject;
        sObj = {
            version: 3,
            request: "AddPool",
            param: undefined,
            dataasstring: JSON.stringify(ret1.value)
        }
        let rets: rpcReturnFormat[] = [];
        if (core.i !== undefined) {
            const ret2 = await core.i.lib.sendRpcAll(core.i, sObj);
            if (ret2.isSuccess()) rets = ret2.value;
        } else {
            core.serializationLocks.postDeliveryPool = false;
            return this.sError("postDeliveryPool", "sendRpcAll", "The internode module is down");
        }

        let failcnt: number = 0;
        for (const ret3 of rets) {
            if (ret3.status !== 0) failcnt--;
        }

        // If even one node succeeds, change its own node to true.
        if ((rets.length + failcnt) > 0) {
            let oids: string[] = [];
            let tx: any;
            for (tx of ret1.value) {
                oids.push(tx._id.toString());
            }
            // modify both db and readcache at same time
            if (core.d !== undefined) {
                const ret4 = core.d.lib.poolModifyReadsFlag(core.d, oids, this.master_key);
            } else {
                core.serializationLocks.postDeliveryPool = false;
                return this.sError("postDeliveryPool", "poolModifyReadsFlag", "The method returns error");
            }
        } else {
            core.serializationLocks.postDeliveryPool = false;
            return this.sError("postDeliveryPool", "sendRpcAll", (failcnt * -1).toString() + " errors occurs");
        }
        core.serializationLocks.postDeliveryPool = false;
        return this.sOK<void>(undefined);
    }
    /**
     * Request from a sibling, the original invoker, to make this node adding sent transactions to the pool.
     * @param core - set ccSystemType instance
     * @param txArr - set objTx[] instance to add this node
     * @returns returns with gResult, that is wrapped by a Promise, that contains void if it's success, and gError if it's failure.
     * So there is no need to check the value of success.
     */
    public async requestToAddPool(core: ccSystemType, txArr: objTx[]): Promise<gResult<void, gError>> {
        const LOG = core.log.lib.LogFunc(core.log);
        LOG("Info", 0, "SystemModule:requestToAddPool");

        if (core.d !== undefined) {
            let tx: any;
            let pArr: Promise<gResult<poolResultObject, gError>>[] = [];
            let failcnt = 0;
            for (tx of txArr) {
                // The oid is inherited from the transfer source
                tx.deliveryF = true;
                pArr.push(core.d.lib.setPoolNewData(core.d, tx, this.master_key));
            }
            await Promise.all(pArr).then((rArr) => {
                for (const ret of rArr) {
                    if (ret.isFailure()) { 
                        failcnt++;
                    } else {
                        if (ret.value.status !== 0) failcnt++;
                    }
                }
            })
            if (failcnt === 0) {
                return this.sOK<void>(undefined);
            } else {
                LOG("Warning", failcnt, "Some data has not been added to the pool. Use /sync/poolsync to fix it.");
                return this.sError("requestToAddPool", "setPoolNewData", "Some data has not been added to the pool.");
            }
        } else {
            return this.sError("requestToAddPool", "setPoolNewData", "The datastore module is down");
        }
    }

    /**
     * The method that append new blocks to the chain.
     * @param core - set ccSystemType instance
     * @returns returns with gResult, that is wrapped by a Promise, that contains void if it's success, and gError if it's failure.
     * So there is no need to check the value of success.
     */
    public async postAppendBlocks(core: ccSystemType): Promise<gResult<void, gError>> {
        const LOG = core.log.lib.LogFunc(core.log);
        LOG("Info", 0, "SystemModule:postAppendBlocks");

        if (core.serializationLocks.postAppendBlocks === true) {
            return this.sError("postAppendBlocks", "serializationLocks", "This function is running. Wait for a while.");
        } else {
            core.serializationLocks.postAppendBlocks = true;
        }

        if (core.m === undefined) {
            core.serializationLocks.postAppendBlocks = false;
            return this.sError("postAppendBlocks", "getAllDeliveredPool", "The main module is down");
        }
        // Prepare an array of txs in the pool with the delivery flag true
        // (However, the maximum payload size may not be exceeded)
        const ret1 = await core.m.lib.getAllDeliveredPool(core.m, { constrainedSize: MAX_SAFE_PAYLOAD_SIZE });
        if (ret1.isFailure()) {
            core.serializationLocks.postAppendBlocks = false;
            return ret1;
        }
        
        // Do not create empty block
        if (ret1.value.length === 0) {
            core.serializationLocks.postAppendBlocks = false;
            return this.sOK<void>(undefined);
        }

        // Create blocks and register them into the blockchain
        let ret2;
        if (core.b !== undefined) {
            let txArrPerTenant: { [index: string]: objTx[] } = {};
            for (const tx of ret1.value) {
                if (txArrPerTenant[tx.tenant] === undefined) {
                    txArrPerTenant[tx.tenant] = [tx];
                } else {
                    txArrPerTenant[tx.tenant].push(tx);
                }
            }
            for (const tenant of Object.keys(txArrPerTenant)) {
                if (core.b !== undefined) {
                    ret2 = await core.b.lib.createBlock(core.b, txArrPerTenant[tenant], tenant);
                    if (ret2.isFailure()) {
                        core.serializationLocks.postAppendBlocks = false;
                        return ret2;
                    }
                } else {
                    core.serializationLocks.postAppendBlocks = false;
                    return this.sError("postAppendBlocks", "createBlock", "The block module is down");
                }
            }
            core.serializationLocks.postAppendBlocks = false;
            return this.sOK<void>(undefined); // CA3 doesn't need the following procedures
        } else {
            core.serializationLocks.postAppendBlocks = false;
            return this.sError("postAppendBlocks", "createBlock", "The block module is down");
        }
    }
    /**
     * Removes unneeded pooling transactions.
     * @param core - set ccSystemType
     * @param txArr - set target transactions by objTx[] format
     * @returns returns with gResult, that is wrapped by a Promise, that contains void if it's success, and gError if it's failure.
     * So there is no need to check the value of success.
     */
    protected async removeFromPool(core: ccSystemType, txArr: objTx[]): Promise<gResult<void, gError>> {
        const LOG = core.log.lib.LogFunc(core.log);
        LOG("Info", 0, "SystemModule:removeFromPool");

        if (core.d === undefined) {
            return this.sError("removeFromPool", "poolDeleteTransactions", "The datastore module is down");
        }
        const oids: string[] = [];
        for (const tx of txArr) {
            oids.push(tx._id);
        }
        const ret = await core.d.lib.poolDeleteTransactions(core.d, oids, this.master_key);
        if (ret.isFailure()) return ret;

        return this.sOK(ret.value);
    }
    /**
     * Request from a sibling, the original invoker, to make this node adding the sent block to the chain.
     * @param core - set ccSystemType instance
     * @param bObj - set the block to add with objBlock
     * @param removeFromPool - set true or false to determine to remove duplicated transactions that are in the block from the pool of this node
     * @param trackingId - it can set the trackingId if the bObj should be tracked properly
     * @returns returns with gResult, that is wrapped by a Promise, that contains void if it's success, and gError if it's failure.
     * So there is no need to check the value of success.
     */
    public async requestToAddBlock(core: ccSystemType, bObj: objBlock, removeFromPool: boolean | undefined, trackingId?: string): Promise<gResult<void, gError>> {
        const LOG = core.log.lib.LogFunc(core.log);
        if (trackingId === undefined) {
            LOG("Info", 0, "SystemModule:requestToAddBlock");
        } else {
            LOG("Info", 0, "SystemModule:requestToAddBlock:" + trackingId);
        }

        if (core.b !== undefined) {
            const ret1 = await core.b.lib.verifyBlock(core.b, bObj, trackingId);
            if (ret1.isFailure()) return ret1;
            switch (ret1.value) {
                case -2:
                    return this.sError("requestToAddBlock", "verifyBlock", "The object that was sent is not a block.");
                case -1:
                    return this.sError("requestToAddBlock", "verifyBlock", "The block that was sent is broken.");
                case 0:
                    LOG("Info", 0, "requestToAddBlock: pass the verification");
                    break;
                case 3:
                    return this.sError("requestToAddBlock", "verifyBlock", "The block that was sent is malformed.");
                default:
                    return this.sError("requestToAddBlock", "verifyBlock", "unknown error");
            }
        } else {
            return this.sError("requestToAddBlock", "verifyBlock", "The block module is down");
        }

        if (core.d !== undefined) {
            const ret2 = await core.d.lib.setBlockNewData(core.d, bObj, this.master_key);
            if (ret2.isFailure()) return ret2;
            if (ret2.value.status !== 0) {
                LOG("Warning", ret2.value.status, "The data has not been added to the block. Use /sync/blocksync to fix it.");
                return this.sError("requestToAddBlock", "setBlockNewData", "The data has not been added to the block.");
            }
        } else {
            return this.sError("requestToAddBlock", "setBlockNewData", "The datastore module is down");
        }

        if ((removeFromPool === true) && (bObj.data !== undefined)) {
            const ret3 = await core.lib.removeFromPool(core, bObj.data);
            if (ret3.isFailure()) return ret3;
        }
        return this.sOK<void>(undefined);
    }

    /**
     * Initialize the chain.
     * @param core - set ccSystemType instance
     * @param options - danger: force resetting all nodes only if they are testing.
     * Note that it guesses all node are testing if local node mode is set with testing.
     * @returns returns with gResult, that is wrapped by a Promise, that contains the object of blockFormat if it's success, and gError if it's failure.
     */
    public async postGenesisBlock(core: ccSystemType, options?: postGenesisBlockOptions): Promise<gResult<blockFormat | undefined, gError>> {
        const LOG = core.log.lib.LogFunc(core.log);
        LOG("Info", 0, "SystemModule:postGenesisBlock");

        if (core.serializationLocks.postGenesisBlock === true) {
            return this.sError("postGenesisBlock", "serializationLocks", "This function is running. Wait for a while.");
        } else {
            core.serializationLocks.postGenesisBlock = true;
        }

        let forceresetiftesting: boolean = false;
        if (options !== undefined) {
            try {
                forceresetiftesting = options.trytoreset;
            } catch (error) {
                core.serializationLocks.postGenesisBlock = false;
                return this.sError("postGenesisBlock", "Option parse", "The options are incorrect; it may have been forgotten to add Content-type.");
            }
        }
        
        if (forceresetiftesting !== true) {
            if (core.m === undefined) {
                core.serializationLocks.postGenesisBlock = false;
                return this.sError("postGenesisBlock", "getAllBlock", "The main module is down");
            }
            // Confirmation that there is no data in block and pool on default tenant of own node
            const ret1 = await core.m.lib.getAllBlock(core.m, {bareTransaction: false, ignoreGenesisBlockIsNotFound: true}, this.common_parsel);
            if (ret1.isFailure()) {
                core.serializationLocks.postGenesisBlock = false;
                return ret1;
            }
            const bArr: any = ret1.value;
            if (bArr.length !== 0) {
                core.serializationLocks.postGenesisBlock = false;
                return this.sError("postGenesisBlock", "getAllBlock", "There is some data in the block collection of its own node. No genesis block is created.");
            }

            // Confirmation that there is no data in blocks and pools on default tenant of other nodes
            const sObj4Block: systemrpc.ccSystemRpcFormat.AsObject = {
                version: 3,
                request: "GetBlockHeight",
                param: { tenant: this.common_parsel },
                dataasstring: ""
            }
            let retsBlock: rpcReturnFormat[] = [];
            if (core.i !== undefined) {
                const ret2 = await core.i.lib.sendRpcAll(core.i, sObj4Block);
                if (ret2.isSuccess()) retsBlock = ret2.value;
                for (const retBlock of retsBlock) {
                    if ((retBlock.status !== 0) || (retBlock.data === undefined)) {
                        LOG("Warning", -1, "There is a problem getting data from a remote node. No genesis block is created.");
                        core.serializationLocks.postGenesisBlock = false;
                        return this.sError("postGenesisBlock", "sendRpcAll", "GetBlockHeight is failed");
                    } else {
                        const d: heightDataFormat = JSON.parse(retBlock.data);
                        if (d.height !== 0) {
                            LOG("Warning", -1, "There is some data in the block collection on a remote node. No genesis block is created.");
                            core.serializationLocks.postGenesisBlock = false;
                            return this.sError("postGenesisBlock", "sendRpcAll", "GetBlockHeight indicates that there is data on a remote node");
                        }
                    }
                }
            } else {
                core.serializationLocks.postGenesisBlock = false;
                return this.sError("postGenesisBlock", "sendRpcAll", "The internode module is down");
            }
        } else { // check if force resetting can be done
            LOG("Caution", 0, "Checking whether force reset the chain can be done");
            if ((core.conf.node_mode === "testing") || (core.conf.node_mode === "testing+init")) {
                LOG("Caution", 0, "Node mode is OK since testing");
            } else {
                LOG("Error", -1, "It cannot be reset since the node mode is not testing");
                core.serializationLocks.postGenesisBlock = false;
                return this.sError("postGenesisBlock", "forceresetiftesting", "The node mode is not OK");
            }
            if (core.d !== undefined) {
                const ret3 = await core.d.lib.cleanup(core.d);
                if (ret3.isFailure()) {
                    LOG("Error", -1, "The clean the datastore up is failed: " + ret3.value.message);
                    core.serializationLocks.postGenesisBlock = false;
                    return ret3;
                }
            } else {
                core.serializationLocks.postGenesisBlock = false;
                return this.sError("postGenesisBlock", "cleanup", "The datastore module is down");
            }
        }

        // Create and post genesis block in the block
        const txArr: objTx[] = [];
        const blockOptions: createBlockOptions = { type: "genesis" };
        let bObj: objBlock | undefined;
        if (core.b !== undefined) {
            const ret3 = await core.b.lib.createBlock(core.b, txArr, this.common_parsel, blockOptions);
            if (ret3.isFailure()) {
                core.serializationLocks.postGenesisBlock = false;
                return ret3;
            }
            if (ret3.value === undefined) {
                LOG("Notice", 0, "Genesis block creation and posting are skipped.");
            }
            bObj = ret3.value;
        } else {
            core.serializationLocks.postGenesisBlock = false;
            return this.sError("postGenesisBlock", "createBlock", "The block module is down");
        }

        core.serializationLocks.postGenesisBlock = false;
        return this.sOK<blockFormat | undefined>(bObj);
    }
    /**
     * Request from a sibling, the original invoker, to make this node getting the count of transactions in the pool.
     * @param core - set ccSystemType instance
     * @returns returns with gResult, that is wrapped by a Promise, that contains the number of height if it's success, and gError if it's failure.
     */
    public async requestToGetPoolHeight(core: ccSystemType, __t?: string): Promise<gResult<number, gError>> {
        const LOG = core.log.lib.LogFunc(core.log);
        LOG("Info", 0, "SystemModule:requestToGetPoolHeight");
        if (core.m === undefined) {
            return this.sError("requestToGetPoolHeight", "getAllPool", "The main module is down");
        }

        if (__t === undefined) __t = this.common_parsel;

        const ret = await core.m.lib.getAllPool(core.m, undefined, __t);
        if (ret.isFailure()) return ret;

        return this.sOK(ret.value.length);
    }
    /**
     * Request from a sibling, the original invoker, to make this node getting the count of blocks in the chain.
     * @param core - set ccSystemType instance
     * @returns returns with gResult, that is wrapped by a Promise, that contains the number of height if it's success, and gError if it's failure.
     */    
    public async requestToGetBlockHeight(core: ccSystemType, __t?: string): Promise<gResult<number, gError>> {
        const LOG = core.log.lib.LogFunc(core.log);
        LOG("Info", 0, "SystemModule:requestToGetBlockHeight");
        if (core.m === undefined) {
            return this.sError("requestToGetBlockHeight", "getAllPool", "The main module is down");
        }

        if (__t === undefined) __t = this.common_parsel;

        const ret = await core.m.lib.getAllBlock(core.m, { bareTransaction: false, ignoreGenesisBlockIsNotFound: true }, __t);
        if (ret.isFailure()) return ret;

        return this.sOK(ret.value.length);
    }

    /**
     * Change the diagnostics status of a chain with a specific chain ID at once.
     * @param core - set ccSystemType instance
     * @param diagArr - the target array, by array of blockDiagnosticsFormat
     * @param highest_hash - the highest hash value that represents the chain ID
     * @param status - value to be added
     * @returns returns with gResult that contains modified diagArr by array of blockDiagnosticsFormat if it's success, and unknown if it's failure.
     * So there is no need to be concerned about the failure status.
     */
    private markDiagStatusWithChain(core: ccSystemType, diagArr: blockDiagnosticsFormat[], highest_hash: string, status: number): gResult<blockDiagnosticsFormat[], unknown> {
        const LOG = core.log.lib.LogFunc(core.log);
        LOG("Info", 0, "SystemModule:markDiagStatusWithChain");
        for (const diagObj of diagArr) {
            if (diagObj.highest_hash === highest_hash) diagObj.block_status = diagObj.block_status + status;
        }

        return this.sOK<blockDiagnosticsFormat[]>(diagArr);
    }

    /**
     * Check the health of the blockchain.
     * @param core - set ccSystemType instance
     * @param diagChain - set the target by blockchainDiagnosticsFormat
     * @param startidx - use this value at the starting point when it is called recursively
     * @param highest_hash - the highest hash value
     * @returns returns with gResult, that is wrapped by a Promise, that contains blockchainDiagnosticsFormat that has been checked if it's success, and gError if it's failure.
     */
    private async checkHealthOfChainRecursive(core: ccSystemType, diagChain: blockchainDiagnosticsFormat, startidx: number, highest_hash: string): Promise<gResult<blockchainDiagnosticsFormat, gError>> {
        const LOG = core.log.lib.LogFunc(core.log);
        LOG("Info", 0, "SystemModule:checkHealthOfChainRecursive");

        let idx: number = clone(startidx);
        let previous_block_prev_hash: string | undefined = undefined;
        for (idx; idx < diagChain.blocks.length; idx++) {
            const diagObj = diagChain.blocks[idx];
            if (diagObj.block_status !== 1) { // already examined
                continue;
            } else { // unchecked (1)
                // child block or the start block of a chain (otherwise, "yet another" start block)
                if ((diagObj.data.hash === previous_block_prev_hash) || (previous_block_prev_hash === undefined)) {
                    // Conflucense detection
                    if (diagObj.highest_hash === "") { // It's OK
                        diagObj.highest_hash = diagObj.data.hash;
                        if (core.b !== undefined) {
                            const ret1 = await core.b.lib.verifyBlock(core.b, diagObj.data);
                            if (ret1.isFailure()) return ret1;
                            diagObj.block_status = ret1.value;
                        } else {
                            return this.sError("checkHealthOfChainRecursive", "verifyBlock", "The block module is down. It cannot continue.");
                        }
                        if (diagObj.block_status !== 0) {
                            LOG("Warning", 1141, "The verifyBlock returns " + diagObj.block_status.toString() + ". Detected malformed block: " + diagObj.data.hash);
                            diagChain.chain_status.has_malformed_block++;
                            diagChain.chain_status.number_of_errors++;
                        }
                        previous_block_prev_hash = clone(diagObj.data.prev_hash);
                        // Arriving at the root of the chain. 
                        if ((diagObj.data.prev_hash === "0") || (diagObj.data.prev_hash === "")) {
                            previous_block_prev_hash = undefined; // The search ended with results
                            if (diagObj.data.hash === diagChain.genesis_hash) { // genesis block. general chain.
                                LOG("Notice", 0, "Arriving at the root of the chain with genesis block.");
                                break; // do not search any more
                            } else { // not genesis block. fragmenting chain
                                LOG("Warning", 1121, "Arriving at the root of the chain with non genesis block. It's a fragmenting chain.");
                                const ret1 = this.markDiagStatusWithChain(core, diagChain.blocks, highest_hash, 100) // fragmented chain
                                if (ret1.isSuccess()) diagChain.blocks = ret1.value;
                                diagChain.chain_status.has_fragment++;
                                diagChain.chain_status.number_of_errors++;
                                break; // do not search any more
                            }
                        }
                    } else { // Detected confluence. It's a fork if obtained diagObj had highest_hash value already
                        LOG("Warning", 1111, "Detected confluence. Fork state is settled.");
                        const ret2 = this.markDiagStatusWithChain(core, diagChain.blocks, highest_hash, 10) // forked chain
                        if (ret2.isSuccess()) diagChain.blocks = ret2.value;
                        const ret3 = this.markDiagStatusWithChain(core, diagChain.blocks, diagObj.highest_hash, 10) // forked chain also
                        if (ret3.isSuccess()) diagChain.blocks = ret3.value;
                        // One of two chain will be decomposed into transactions and they will be pushed back to pool
                        diagChain.chain_status.has_fork++;
                        diagChain.chain_status.number_of_errors++;
                        break; // do not search any more
                    }
                } else {
                    // Yet another start block is detected. It's a fork or a fragment. start recursion
                    LOG("Warning", 1101, "Detected a new chain. One of the new chain or current chain is a fork or fragment. Start searching.");
                    const ret4 = await this.checkHealthOfChainRecursive(core, diagChain, idx, diagObj.highest_hash);
                    if (ret4.isFailure()) return ret4;
                    diagChain = ret4.value;
                }   
            }
        }
        // went back to the beginning but could not find the block specified in prev_hash (the previous block that should have been there).
        if (previous_block_prev_hash !== undefined) {
            LOG("Warning", 1131, "Previous block for " + diagChain.blocks[startidx].data._id + " cannot be found. The blockchain is damaged, or the value of hash and previous_hash of the chain has been falsificated with.");
            const ret5 = this.markDiagStatusWithChain(core, diagChain.blocks, highest_hash, 1000) // root missing
            if (ret5.isSuccess()) diagChain.blocks = ret5.value;
            diagChain.chain_status.root_block_missing++; // This is counted as a duplicate with lacks_genesis_block
            diagChain.chain_status.number_of_errors++;
        }

        return this.sOK<blockchainDiagnosticsFormat>(diagChain);
    }

    /**
     * report the health of the blockchain.
     * @param core - set ccSystemType instance
     * @param omitdetail - omit the detail of the report and only returns the digest
     * @returns returns with gResult, that is wrapped by a Promise, that contains the report by blockchainDiagnosticsFormat if it's success, and gError if it's failure.
     */
    private async reportHealthOfChain(core: ccSystemType, omitdetail?: boolean): Promise<gResult<blockchainDiagnosticsFormat, gError>> {
        const LOG = core.log.lib.LogFunc(core.log);
        LOG("Info", 0, "SystemModule:reportHealthOfChain");

        LOG("Notice", 0, "Creating the blocklist to diagnostics: ", {lf: false});
        if (core.m === undefined) {
            return this.sError("reportHealthOfChain", "getAllBlock", "The main module is down");
        }
        const ret1 = await core.m.lib.getAllBlock(core.m, { bareTransaction: false, ignoreGenesisBlockIsNotFound: true }, this.master_key);
        if (ret1.isFailure()) return ret1;

        if (ret1.value.length === 0) {
            LOG("Warning", 1, "The datastore is empty. The blockchain might not be initialized");
            return this.sError("reportHealthOfChain", "getAllBlock", "The datastore is empty");
        }

        // The report
        let diagChain: blockchainDiagnosticsFormat = {
            blocks: [],
            chain_status: {
                number_of_errors: 0,
                has_illegal_block: 0,
                has_illegal_data: 0,
                has_malformed_block: 0,
                has_fork: 0,
                has_fragment: 0,
                lacks_genesis_block: false,
                root_block_missing: 0
            },
            genesis_hash: ""
        }

        let bObj: any;
        for (bObj of ret1.value) {
            try {
                let data: blockFormat;
                data = {
                    _id: bObj._id.toString(),
                    version: bObj.version,
                    tenant: bObj.tenant,
                    height: bObj.height,
                    size: bObj.size,
                    data: bObj.data ?? undefined,
                    type: bObj.type ?? undefined,
                    settime: bObj.settime,
                    timestamp: bObj.timestamp,
                    prev_hash: bObj.prev_hash,
                    signedby: bObj.signedby ?? undefined,
                    signcounter: bObj.signcounter ?? undefined,
                    hash: bObj.hash
                }
                diagChain.blocks.push({
                    data: data,
                    block_status: 1, // unchecked
                    highest_hash: ""
                })
                if (bObj.prev_hash === "0") { // genesis block
                    diagChain.genesis_hash = clone(bObj.hash);
                }
            } catch (error) {
                try {
                    LOG("Warning", 1001, "A data that has oid " + bObj._id.toString() + " cannot be read !");
                    const fakeData = {
                        _id: bObj._id,
                        version: 1,
                        tenant: "",
                        height: 0,
                        size: -1,
                        data: undefined,
                        type: undefined,
                        settime: "",
                        timestamp: "-1",
                        miner: undefined,
                        prev_hash: "",
                        signedby: undefined,
                        signcounter: undefined,
                        hash: ""
                    }
                    diagChain.blocks.push({data: fakeData, dataAsObj: bObj, block_status: -1, highest_hash: ""});
                    diagChain.chain_status.number_of_errors++;
                    diagChain.chain_status.has_illegal_block++;
                } catch (error) {
                    LOG("Warning", 1002, "A data cannot be read !");
                    const fakeData = {
                        _id: randomOid().byStr(),
                        version: 1,
                        tenant: "",
                        height: 0,
                        size: -1,
                        data: undefined,
                        type: undefined,
                        settime: "",
                        timestamp: "-1",
                        miner: undefined,
                        prev_hash: "",
                        signedby: undefined,
                        signcounter: undefined,
                        hash: ""
                    }
                    diagChain.blocks.push({data: fakeData, dataAsObj: bObj, block_status: -2, highest_hash: ""});
                    diagChain.chain_status.number_of_errors++
                    diagChain.chain_status.has_illegal_data++;
                }
            }
        };
        // descending sort by timestamp (Anomalous data have "-1" with timestamp)
        diagChain.blocks.sort(function(a: blockDiagnosticsFormat, b: blockDiagnosticsFormat) {
            if (a.data.timestamp < b.data.timestamp) {
                return 1;
            } else {
                return -1;
            }
        })
        LOG("Notice", 0, "done");

        // check information of genesis block
        if (diagChain.genesis_hash === "") {
            // The blockchain is damaged or lacks something
            LOG("Warning", 1003, "Not a normal blockchain, genesis block is not found!");
            diagChain.chain_status.lacks_genesis_block = true;
            diagChain.chain_status.number_of_errors++;
        }

        LOG("Notice", 0, "Start checking health of the blockchain");
        const ret2 = await this.checkHealthOfChainRecursive(core, diagChain, 0, "");
        if (ret2.isFailure()) return ret2;
        diagChain = ret2.value;
        LOG("Notice", 0, "End checking health of the blockchain");

        if ((omitdetail === undefined) || (omitdetail === false)) {
            return this.sOK<blockchainDiagnosticsFormat>(diagChain);
        } else {
            diagChain.blocks = []; // reduce network cost
            return this.sOK<blockchainDiagnosticsFormat>(diagChain);
        }
    }


    /**
     * List healthy nodes and determine the majority nodes.
     * @param core - set ccSystemType instance
     * @param localCondition - set the condition of the own node. If the own node is healthy, it is added to candidates
     * @returns returns with gResult, that is wrapped by a Promise, that contains the list of nodes by healthyNodesFormat if it's success, and gError if it's failure.
     */
    private async obtainHealthyNodes(core: ccSystemType, localCondition: number): Promise<gResult<healthyNodesFormat, gError>> {
        const LOG = core.log.lib.LogFunc(core.log);
        LOG("Info", 0, "SystemModule:obtainHealthyNodes");

        let healthyNodes: nodeStatus[] = [];

        // Determine the majority by obtaining the hash value (digest) of lastBlocks of all nodes

        // Get digest of own node (but only if it is healthy)
        if (localCondition === 0) {
            const ret1 = await core.lib.getLastHashAndHeight(core);
            if (ret1.isFailure()) return ret1;
            if (ret1.value.hash === "") {
                LOG("Error", -1, "Unable to obtain hash value");
                return this.sError("obtainHealthyNodes", "getLastHashAndHeight", "Unable to obtain hash value");
            }
            healthyNodes.push({host: "localhost", hash: ret1.value.hash, height: ret1.value.height});
        }

        // get the digest of other nodes
        const sObj: systemrpc.ccSystemRpcFormat.AsObject = {
            version: 3,
            request: "GetBlockDigest",
            param: { tenant: this.master_key, failifunhealthy: true },
            dataasstring: ""
        }
        let rets: rpcReturnFormat[] = [];
        if (core.i !== undefined) {
            const ret2 = await core.i.lib.sendRpcAll(core.i, sObj);
            if (ret2.isSuccess()) rets = ret2.value;

            for (const ret3 of rets) {
                if ((ret3.data !== undefined) && (ret3.data !== ""))  {
                    try {
                        const rLast: digestDataFormat = JSON.parse(ret3.data);
                        if (rLast.height >= 0) { // reject failed data
                            healthyNodes.push({host: ret3.targetHost, hash: rLast.hash, height: rLast.height})
                        }   
                    } catch (error) {
                        
                    }
                }
            }
        } else {
            return this.sError("obtainHealthyNodes", "sendRpcAll", "The internode module is down");
        }
        LOG("Debug", 0, "obtainHealthyNodes:healthyNodes");
        LOG("Debug", 0, JSON.stringify(healthyNodes));

        if (((localCondition === 0) && (healthyNodes.length < 2)) || ((localCondition !== 0) && (healthyNodes.length < 1))) {
            LOG("Error", -2, "Unable to obtain other healthy node's information.");
            return this.sError("obtainHealthyNodes", "sendRpcAll", "Unable to obtain other healthy node's information.");
        }

        // Determine the majority status. In case of a tie, the one with the higher height is considered the majority.
        // If there is a tie and the height is the same, the first hit (the youngest in siblings order) is treated as the majority.
        // ToDo: In the future, the prerequisite "among the nodes with the highest checkpoints, including the Genesis block" will be added.
        //       In the current code, if multiple nodes are added at once, they are considered a majority and all blocks may disappear (returned to the pool).
        //       With this prerequisite, one node can be kept as a cold standby backup and fully recovered in the event that all active nodes are wiped out.
        type countValue = {count: number, height:number, hosts: string[]};
        let counts: {[hash: string]: countValue} = {};
        for (const node of healthyNodes) {
            if (counts[node.hash] !== undefined) {
                counts[node.hash].count = counts[node.hash].count + 1;
                counts[node.hash].height = node.height;
                counts[node.hash].hosts.push(node.host);
            } else {
                const initialValue: countValue = {
                    count: 1,
                    height: node.height,
                    hosts: [node.host]
                }
                counts[node.hash] = initialValue;
            }
        }
        let mNodes: majorityNodes = { hash: "", count: 0, height: 0, hosts: [] };
        Object.keys(counts).forEach((hash) => {
            if (counts[hash].count > mNodes.count) {
                mNodes.hash = hash;
                mNodes.count = counts[hash].count;
                mNodes.height = counts[hash].height;
                mNodes.hosts = counts[hash].hosts;
            } else if (counts[hash].count === mNodes.count) {
                if (counts[hash].height > mNodes.height) {
                    mNodes.hash = hash;
                    mNodes.count = counts[hash].count;
                    mNodes.height = counts[hash].height;
                    mNodes.hosts = counts[hash].hosts;
                }
            }
        })
        LOG("Debug", 0, "obtainHealthyNodes:MajorityNodes");
        LOG("Debug", 0, JSON.stringify(mNodes));

        const healthyNodesReport: healthyNodesFormat = {
            hosts: healthyNodes,
            majority: mNodes
        }
        return this.sOK<healthyNodesFormat>(healthyNodesReport);
    }


    /**
     * recursive function to go back up the chain in descending order to get target oids.
     * @param core - set ccSystemType instance
     * @param diagChain - set the target by blockchainDiagnosticsFormat
     * @param replaceOids - in recursion, the list of oids collected so far is stored.
     * @param searchkey - in recursion, it is used to go back the chain
     * @returns returns with gResult, that is wrapped by a Promise, that contains the list of oids of blocks that should be replaced later if it's success, and gError if it's failure.
     */
    private collectTargetOidsRecursive(core: ccSystemType, diagChain: blockchainDiagnosticsFormat, replaceOids: string[], searchkey?: string): gResult<string[], gError> {
        const LOG = core.log.lib.LogFunc(core.log);
        LOG("Info", 0, "SystemModule:collectTargetOidsRecursive");

        let hash: string;
        if (searchkey === undefined) {
            hash = ""
        } else {
            hash = searchkey;
        }

        for (const diagObj of diagChain.blocks) {
            if (hash !== "") { // go-backing mode in recursioning
                if (hash === diagObj.data.prev_hash) {
                    if (typeof(diagObj.data._id) === "undefined") {
                        // do nothing
                        LOG("Warning", 1211, "There is a illegal block data with undefined _id");
                        diagObj.block_status = 4; // status checked and it's a target
                    } else { // ObjectId
                        replaceOids.push(diagObj.data._id.toString());
                        diagObj.block_status = 4; // status checked and it's a target
                        if (diagObj.data.prev_hash !== "") {
                            const ret1 = this.collectTargetOidsRecursive(core, diagChain, replaceOids, diagObj.data.prev_hash); // recurse go-backing mode
                            if (ret1.isFailure()) {
                                LOG("Warning", 1212, "There is a illegal block data that has unrecognized format");
                                return this.sError("collectTargetOidsRecursive", "go-backing", "There is a illegal block data that has unrecognized format");
                            }
                            replaceOids = ret1.value;
                        }
                    }
                    break;
                }
            } else { // go-forwarding mode in the 1st loop
                // 3: problem, -1(9): illegal block, -2(8): illegal data
                if ((diagObj.block_status % 10 === 3) || (diagObj.block_status % 10 === 9) || (diagObj.block_status % 10 === 8)
                || (diagObj.block_status % 10 === -1) || (diagObj.block_status % 10 === -2)) {
                    if (typeof(diagObj.data._id) === "undefined") {
                        // do nothing
                        LOG("Warning", 1201, "There is a illegal block data with undefined _id");
                        diagObj.block_status = 4; // status checked and it's a target
                    } else { // ObjectId
                        replaceOids.push(diagObj.data._id.toString());
                        diagObj.block_status = 4; // status checked and it's a target
                        if ((diagObj.data.prev_hash !== undefined) && (diagObj.data.prev_hash !== "")) {
                            const ret2 = this.collectTargetOidsRecursive(core, diagChain, replaceOids, diagObj.data.prev_hash); // fork go-backing mode
                            if (ret2.isFailure()) {
                                LOG("Warning", 1202, "There is a illegal block data that has unrecognized format");
                                return this.sError("collectTargetOidsRecursive", "go-forwarding", "There is a illegal block data that has unrecognized format");
                            }
                            replaceOids = ret2.value;
                        }
                    }
                }
            }
        }
        if (hash === "") // does not found any data!
            LOG("Warning", 1213, "The end of the search was reached without finding the block with the hash in question. The blockchain is broken.");

        return this.sOK<string[]>(replaceOids);
    }


    /**
     * Get normal blocks from a node as many as possible.
     * @param core - set ccSystemType instance
     * @param oidList - set target blocks' oid as a list
     * @param healthyNodes - set nodes that are candidate to obtain healthy blocks
     * @returns returns with gResult, that is wrapped by a Promise, that contains the array of getBlockResult if it's success, and gError if it's failure.
     */
    private async getNormalBlocksAsPossible(core: ccSystemType, oidList: string[], healthyNodes: healthyNodesFormat): Promise<gResult<getBlockResult[], gError>> {
        const LOG = core.log.lib.LogFunc(core.log);
        LOG("Info", 0, "SystemModule:getNormalBlocksAsPossible");

        if (oidList.length === 0) return this.sOK<getBlockResult[]>([]);

        let pArr = [];
        let bArr: getBlockResult[] = [];
        // At first, try to get data from majority nodes
        if (core.i !== undefined) {
            for (const oid of oidList) {
                const sObj: systemrpc.ccSystemRpcFormat.AsObject = {
                    version: 3,
                    request: "GetBlock",
                    param: { tenant: this.master_key, returnundefinedifnoexistent: true }, // return 200 with [], not 400
                    dataasstring: oid
                }
                // send request randomly
                const host = healthyNodes.majority.hosts[Math.floor(Math.random() * healthyNodes.majority.hosts.length)];
                for (const node of core.i.conf.nodes) {
                    if (node.host === host) {
                        const pRet = core.i.lib.sendRpc(core.i, node, sObj);
                        pArr.push(pRet);
                    }
                }
            } 
        } else {
            return this.sError("getNormalBlocksAsPossible", "sendRpc_ToMajority", "The internode module is down");
        }
        await Promise.all(pArr).then((rArr) => {
            for (const ret of rArr) {
                if (ret.isFailure()) {
                    LOG("Warning", 1301, "The process was aborted because data acquisition from some nodes are failed.");
                    return this.sError("getNormalBlocksAsPossible", "sendRpc_ToMajority", "Data acquisition from some nodes are failed");
                }
                if (ret.value.data !== undefined) {
                    bArr.push(JSON.parse(ret.value.data));
                }
            }
            LOG("Debug", 0, "getNormalBlocksAsPossible:bArr");
            LOG("Debug", 0, JSON.stringify(bArr));
            return bArr;
        })

        // Next, try to get data from other nodes

        // sort by height
        healthyNodes.hosts.sort(function(a: any, b: any) {
            if (a.height < b.height) {
                return 1;
            } else {
                return -1;
            }
        })

        // list non-majority nodes with nodeProperty information
        const otherNodesList = [];
        for (const nodeS of healthyNodes.hosts) {
            if (healthyNodes.majority.hosts.includes(nodeS.host) === false) {
                for (const nodeP of core.i.conf.nodes) {
                    if (nodeS.host === nodeP.host) {
                        otherNodesList.push(nodeP);
                        break;
                    }
                }
            }
        }

        // fill lacking blocks 1 by 1
        if (core.i !== undefined) {
            for (const bRes of bArr) {
                if (bRes.block === undefined) {
                    const sObj: systemrpc.ccSystemRpcFormat.AsObject = {
                        version: 3,
                        request: "GetBlock",
                        param: { returnundefinedifnoexistent: true },
                        dataasstring: bRes.oid
                    }
                    for (const node of otherNodesList) {
                        const ret = await core.i.lib.sendRpc(core.i, node, sObj);
                        if (ret.isFailure()) return ret;
                        if (ret.value.data !== undefined) {
                            const bRes2: getBlockResult = JSON.parse(ret.value.data);
                            if (bRes2.block !== undefined) {
                                bRes.block = bRes2.block;
                                break;
                            }
                        }
                    }
                    if (bRes.block === undefined) {
                        LOG("Caution", 1302, "The block that has oid " + bRes.oid + " cannot be repaired because it does not exist on any other node.");
                    }
                }
            }
        } else {
            return this.sError("getNormalBlocksAsPossible", "sendRpc_1by1", "The internode module is down");
        }
        return this.sOK<getBlockResult[]>(bArr);
    }

    /**
     * Request from a sibling for getting a block if possible.
     * @param core - set the ccSystemType instance
     * @param oid - set oid that is searching to get
     * @param returnUndefinedIfFail - it can be set true when the result may return success with undefined instead of any errors with gError format
     * @param __t - in open source version, it must be undefined or equal to DEFAULT_PARSEL_IDENTIFIER
     * @returns return with gResult, that is wrapped by a Promise, that contains a block by objBlock or nothing with undefined if it's success, and gError if it's failure.
     * Note that a success status is returned even if no block with the target oid is found.
     */
    public async requestToGetBlock(core: ccSystemType, oid: string, returnUndefinedIfFail: boolean | undefined, __t?: string): Promise<gResult<objBlock | undefined, gError>> {
        const LOG = core.log.lib.LogFunc(core.log);
        LOG("Info", 0, "SystemModule:requestToGetBlock");

        if (core.m === undefined) {
            return this.sError("requestToGetBlock", "getSearchByOid", "The main module is down");
        }

        if (__t === undefined) __t = this.common_parsel;

        const ret = await core.m.lib.getSearchByOid<objBlock>(core.m, oid, { targetIsBlock: true }, __t);
        if (ret.isFailure()) {
            if ((returnUndefinedIfFail === undefined) || (returnUndefinedIfFail === false)) {
                return ret;
            } else {
                return this.sOK<undefined>(undefined);
            }
        }
        if (ret.value !== undefined) {
            return this.sOK<objBlock>(ret.value);
        }
        return this.sOK<undefined>(undefined);
    }

    /**
     * Replaces falsified blocks with right ones that are from other nodes.
     * It uses recursive function to go back up the chain in descending order.
     * @param core - set ccSystemType instance
     * @param diagChain - set the target to be repaired
     * @param normalNodes - set normal nodes that can obtain healthy blocks
     * @returns returns with gResult, that is wrapped by a Promise, that contains void if it's success, and gError if it's failure.
     * So there is no need to check the value of success.
     */
    private async repairFalsifiedChain(core: ccSystemType, diagChain: blockchainDiagnosticsFormat, normalNodes: healthyNodesFormat): Promise<gResult<void, gError>> {
        const LOG = core.log.lib.LogFunc(core.log);
        LOG("Info", 0, "SystemModule:repairFalsifiedChain");

        // Get the list of blocks to be replaced
        let replaceOids: string[] = [];
        const ret1 = this.collectTargetOidsRecursive(core, diagChain, replaceOids);
        if (ret1.isFailure()) return ret1;
        replaceOids = ret1.value;

        // Send the list of blocks to healthy nodes to get the normal blocks.
        const ret2 = await this.getNormalBlocksAsPossible(core, replaceOids, normalNodes);
        if (ret2.isFailure()) return ret2;

        // Do the replacement on DB and cache
        if (core.d !== undefined) {
            const cnt = await core.d.lib.blockUpdateBlocks(core.d, ret2.value, this.master_key);
        } else {
            this.sError("repairFalsifiedChain", "blockUpdateBlocks", "The datastore module is down.");
        }
        return this.sOK<void>(undefined);
    }


    /**
     * Diagnostics the blockchain and repair it if possible.
     * @param core - set ccSystemType
     * @param options - scanonly can be set if only the scan is expected
     * @returns returns with gResult, that is wrapped by a Promise, that contains boolean if it's success, and gError if it's failure.
     * On success status, true value means the chain is healthy and false value means the chain has not been healthy and is repaired when the scanonly option is not added.
     */
    public async postScanAndFixBlock(core: ccSystemType, options?: postScanAndFixOptions): Promise<gResult<boolean, gError>> {
        const LOG = core.log.lib.LogFunc(core.log);
        LOG("Info", 0, "SystemModule:postScanAndFixBlock");

        if (core.serializationLocks.postScanAndFixBlock === true) {
            return this.sError("postScanAndFixBlock", "serializationLocks", "This function is running. Wait for a while.");
        } else {
            core.serializationLocks.postScanAndFixBlock = true;
        }

        let fix_options: postScanAndFixOptions = {
            scanonly: false
        }
        if ((options !== undefined) && (options.scanonly !== undefined)) {
            fix_options.scanonly = options.scanonly
        }


        LOG("Notice", 0, "First, get a health check report of the blockchain of its own node");
        let self_report: blockchainDiagnosticsFormat = {
            blocks: [],
            chain_status: {
                number_of_errors: -100,
                has_illegal_block: -100,
                has_illegal_data: -100,
                has_malformed_block: -100,
                has_fork: -100,
                has_fragment: -100,
                lacks_genesis_block: false,
                root_block_missing: -100
            },
            genesis_hash: ""
        }
        let repairNeeded: number;
        const ret1 = await core.lib.reportHealthOfChain(core);
        if (ret1.isFailure()) {
            LOG("Warning", -2, "Failed to generate health check report. It needs to repair");
            repairNeeded = 2;
        } else {
            self_report = ret1.value;
        }
        LOG("Notice", 0, JSON.stringify(self_report.chain_status));
        if (self_report.chain_status.number_of_errors === 0) {
            LOG("Notice", 0, "OK. It doesn't need to repair")
            repairNeeded = 0;
        } else {
            LOG("Notice", -1, "Some errors reported. It needs to repair");
            repairNeeded = 1;
        }
        

        LOG("Notice", 0, "Obtain healthy nodes information ", {lf: false});
        let nodes: healthyNodesFormat;
        const ret2 = await core.lib.obtainHealthyNodes(core, repairNeeded);
        if (ret2.isFailure()) {
            LOG("Error", -3, "Cannot obtain healthy node information. It's difficult to continue");
            core.serializationLocks.postScanAndFixBlock = false;
            return this.sError("postScanAndFixBlock", "obtainHealthyNode", "Cannot obtain healthy node information");
        }
        nodes = ret2.value;
        LOG("Notice", 0, "OK");

        // Scan result
        // If it is a member of the majority node, complete the process
        if (nodes.majority.hosts.includes("localhost")) {
            LOG("Notice", 0, "The blockchain of this node is healthy and properly synchronized with other nodes.");
            core.serializationLocks.postScanAndFixBlock = false;
            return this.sOK<boolean>(true);
        }
        // Cases with problems
        if (self_report.chain_status.number_of_errors !== 0) {
            LOG("Notice", 1, "The blockchain of this node is NOT healthy. It needs to be fixed.");
        } else {
            LOG("Notice", 1, "The blockchain of this node is NOT synchronized with other nodes. It needs to be fixed.");
        }

        // So much for checks only, returns false because it's an abnormal chain
        if ((options !== undefined) && (options.scanonly === true)) {
            core.serializationLocks.postScanAndFixBlock = false;
            return this.sOK<boolean>(false);
        }

        // Will attempt to correct the problem.
        if (self_report.chain_status.number_of_errors !== 0) {
            LOG("Notice", 0, "Will attempt to correct the problem as best it can");
            const ret3 = await core.lib.repairFalsifiedChain(core, self_report, nodes);
            if (ret3.isFailure()) {
                LOG("Error", -4, "Exception occured while reparing the chain. It cannot continue");
                core.serializationLocks.postScanAndFixBlock = false;
                return ret3;
            } else {
                LOG("Notice", 0, "Finished fixing the problem");
            }
        }


        // If the node is not in the majority state, fetch the blocks that do not exist 
        // and disassemble the blocks that are not in the majority state.
        // Revert all but duplicate transactions in it back to the pool.

        // Create block (hash) list for own node
        const ret4 = await core.lib.getAllBlockHashes(core);
        if (ret4.isFailure()) {
            core.serializationLocks.postScanAndFixBlock = false;
            return ret4;
        }
        LOG("Debug", 0, "postScanAndFixBlock:ownHashes");
        LOG("Debug", 0, JSON.stringify(ret4.value));

        // Send to one of the majority nodes and receive the difference
        const sObj2: systemrpc.ccSystemRpcFormat.AsObject = {
            version: 3,
            request: "ExamineBlockDifference",
            param: { tenant: this.master_key },
            dataasstring: JSON.stringify(ret4.value)
        }
        let examinedList: examinedHashes = {add: [], del: []};
        if (core.i !== undefined) {
            const host = nodes.majority.hosts[Math.floor(Math.random() * nodes.majority.hosts.length)];
            for (const node of core.i.conf.nodes) {
                if (node.host + ":" + node.rpc_port === host) {
                    const ret5 = await core.i.lib.sendRpc(core.i, node, sObj2);
                    if (ret5.isFailure()) {
                        core.serializationLocks.postScanAndFixBlock = false;
                        return ret5;
                    }
                    if (ret5.value.data !== undefined) {
                        examinedList = JSON.parse(ret5.value.data);
                    }
                    break;
                }
            }
        } else {
            core.serializationLocks.postScanAndFixBlock = false;
            return this.sError("postScanAndFixBlock", "sendRpc_ExamineBlockDifference", "The internode module is down");
        }
        LOG("Debug", 0, "postScanAndFixBlock:examinedList");
        LOG("Debug", 0, JSON.stringify(examinedList));

        // Process to be added
        LOG("Info", 0, "postScanAndFixBlock:add a block:");
        let pArr: Promise<gResult<blockResultObject, gError>>[] = [];
        let failcnt = 0;
        if (core.d !== undefined) {
            for (const bObj of examinedList.add) {
                pArr.push(core.d.lib.setBlockNewData(core.d, bObj, this.master_key))
            }
            await Promise.all(pArr).then((rArr) => {
                for (const ret of rArr) {
                    if (ret.isFailure()) { 
                        failcnt++;
                    } else {
                        if (ret.value.status !== 0) failcnt++;
                    }
                }
            })
            if (failcnt !== 0) {
                LOG("Warning", failcnt, "Some data has not been added to the block. Rerun /sync/blocksync later.");
                core.serializationLocks.postScanAndFixBlock = false;
                return this.sError("postScanAndFixBlock", "setBlockNewData", "Some data has not been added to the block.");
            }
        } else {
            core.serializationLocks.postScanAndFixBlock = false;
            return this.sError("postScanAndFixBlock", "setBlockNewData", "The datastore module is down");
        }

        // Process to be deleted
        // Extract all tx of blocks to be deleted enumerated in oids
        if (core.m === undefined) {
            core.serializationLocks.postScanAndFixBlock = false;
            return this.sError("postScanAndFixBlock", "getAllBlock", "The main module is down");
        }
        const ret8 = await core.m.lib.getAllBlock(core.m, { bareTransaction: false, ignoreGenesisBlockIsNotFound: true }, this.master_key);
        if (ret8.isFailure()) {
            core.serializationLocks.postScanAndFixBlock = false;
            return ret8;
        }
        let pushBackTxArr: objTx[] = [];
        for (const id of examinedList.del) {
            let bObj: any;
            for (bObj of ret8.value) {
                LOG("Debug", 0, "bObj:" + JSON.stringify(bObj));
                if (bObj.data !== undefined) {
                    if (bObj._id.toString() === id) {
                        let pbObj: any;
                        for(pbObj of bObj.data) {
                            pushBackTxArr.push(pbObj);
                        }
                    }
                }
            }
        }
        LOG("Debug", 0, "postScanAndFixBlock:pushBackTxArr(before):");
        LOG("Debug", 0, JSON.stringify(pushBackTxArr));

        // If the extracted tx is included in the added block, remove the tx from the write-back candidate
        let bObj: any;
        for (bObj of examinedList.add) {
            let txObj: any;
            if (bObj.data !== undefined) {
                for (txObj of bObj.data) {
                    LOG("Debug", 0, "txObj:" + JSON.stringify(txObj));
                    let pbObj: any;
                    let index: number = 1; 
                    for(pbObj of pushBackTxArr) {
                        if (txObj._id.toString() === pbObj._id.toString()) {
                            pushBackTxArr.splice(index,1)
                            continue;
                        } else {
                            index++;
                        }
                    }
                }
            }
        }
        LOG("Debug", 0, "postScanAndFixBlock:examinedList.add:");
        LOG("Debug", 0, JSON.stringify(examinedList.add));
        LOG("Debug", 0, "postScanAndFixBlock:pushBackTxArr(after):");
        LOG("Debug", 0, JSON.stringify(pushBackTxArr));

        // Write the remaining tx back to pool
        if (core.d !== undefined) {
            let pArr: Promise<gResult<poolResultObject, gError>>[] = [];
            let failcnt = 0;
            for (const tx of pushBackTxArr) {
                pArr.push(core.d.lib.setPoolNewData(core.d, tx, this.master_key));
            }
            await Promise.all(pArr).then((rArr) => {
                for (const ret9 of rArr) {
                    if (ret9.isFailure()) { 
                        failcnt++;
                    } else {
                        if (ret9.value.status !== 0) failcnt++;
                    }
                }
            })
            if (failcnt !== 0) {
                LOG("Error", failcnt, "Some data has not been added to the pool.");
                core.serializationLocks.postScanAndFixBlock = false;
                return this.sError("postScanAndFixBlock", "setPoolNewData", "Some data has not been added to the pool.");
            }
        } else {
            core.serializationLocks.postScanAndFixBlock = false;
            return this.sError("postScanAndFixBlock", "setPoolNewData", "The datastore module is down");
        }

        // Delete blocks enumerated by oid
        if (core.d !== undefined) {
            const ret10 = await core.d.lib.blockDeleteBlocks(core.d, examinedList.del, this.master_key);
            if (ret10.isFailure()) {
                core.serializationLocks.postScanAndFixBlock = false;
                return ret10;
            }
        } else {
            core.serializationLocks.postScanAndFixBlock = false;
            return this.sError("postScanAndFixBlock", "blockDeleteBlocks", "The datastore module is down");
        }
        LOG("Debug", 0, "postScanAndFixBlock:examinedList.del:");
        LOG("Debug", 0, JSON.stringify(examinedList.del));

        core.serializationLocks.postScanAndFixBlock = false;
        return this.sOK<boolean>(true);
    }
    
    /**
     * Get last hash and its height of the blockchain.
     * @param core - set ccSystemType instance
     * @param __t - in open source version, it must be undefined or equal to DEFAULT_PARSEL_IDENTIFIER
     * @param failIfUnhealthy - check the health of the target and fail if it is not healthy 
     * @returns retruns with gResult, that is wrapped by a Promise, that contains digestDataFormat that has both values in one object if it's success, and gError if it's failure.
     */
    private async getLastHashAndHeight(core: ccSystemType, __t?: string, failIfUnhealthy?: boolean): Promise<gResult<digestDataFormat, gError>> {
        const LOG = core.log.lib.LogFunc(core.log);
        LOG("Info", 0, "SystemModule:getLastHashAndHeight");

        if ((failIfUnhealthy !== undefined) && (failIfUnhealthy === true)) {
            const ret1 = await core.lib.reportHealthOfChain(core, true);
            if (ret1.isFailure()) return ret1;
            const report = ret1.value;
            if (report.chain_status.number_of_errors !== 0) {
                return this.sError("getLastHashAndHeight", "reportHealthOfChain", "Errors are reported")
            }
        }

        if (__t === undefined) __t = this.common_parsel;

        if (core.m === undefined) {
            return this.sError("getLastHashAndHeight", "getLastBlock", "The main module is down");
        }
        const ret = await core.m.lib.getLastBlock(core.m, undefined, __t);
        if (ret.isFailure()) return ret;
        if (ret.value !== undefined) {
            return this.sOK<digestDataFormat>({ hash: ret.value.hash, height: ret.value.height });
        } else {
            return this.sOK<digestDataFormat>({ hash: "", height: 0 });
        }
    }
    /**
     * Get all hashes of every blocks.
     * @param core - set CcSystemType instance
     * @param __t - in open source version, it must be undefined or equal to DEFAULT_PARSEL_IDENTIFIER
     * @returns returns Promise\<examineHashes\>
     */
    private async getAllBlockHashes(core: ccSystemType, __t?: string): Promise<gResult<examineHashes, gError>> {
        const LOG = core.log.lib.LogFunc(core.log);
        LOG("Info", 0, "SystemModule:getAllBlockHashes");

        if (core.m === undefined) {
            return this.sError("getAllBlockHashes", "getAllBlock", "The main module is down");
        }

        if (__t === undefined) __t = this.common_parsel;

        const ret = await core.m.lib.getAllBlock(core.m, { bareTransaction: false, ignoreGenesisBlockIsNotFound: true }, __t);
        if (ret.isFailure()) return ret;
        let ownHashes: examineHashes = [];
        if (ret.value.length === 0) return this.sOK<examineHashes>(ownHashes);
        let bObj: any;
        for (bObj of ret.value) {
            ownHashes.push({ _id: bObj._id.toString(), hash: bObj.hash });
        }
        return this.sOK<examineHashes>(ownHashes);
    }
    /**
     * Examine differnce of blocks between the sent node and this node.
     * @param core - set CcSystemType instance
     * @param examineList - the list to be examined on this node
     * @param __t - in open source version, it must be undefined or equal to DEFAULT_PARSEL_IDENTIFIER
     * @returns returns with gResult, that is wrapped by a Promise, that contains the result by examinedHashes if it's success, and gError if it's failure.
     */
    private async examineBlockDifference(core: ccSystemType, examineList: examineHashes, __t?: string): Promise<gResult<examinedHashes, gError>> {
        const LOG = core.log.lib.LogFunc(core.log);
        LOG("Info", 0, "SystemModule:examineBlockDifference");

        if (core.m === undefined) {
            return this.sError("examineBlockDifference", "getAllBlock", "The main module is down");
        }

        if (__t === undefined) __t = this.common_parsel;

        const ret = await core.m.lib.getAllBlock(core.m, { bareTransaction: false, ignoreGenesisBlockIsNotFound: false }, __t);
        if (ret.isFailure()) return ret;
        let bObj: any;
        let examinedList: examinedHashes = { add: [], del: [] };
        // add
        for (bObj of ret.value) {
            let found: boolean = false;
            for (const examine of examineList) {
                if (bObj._id.toString() === examine._id) found = true;
            }
            if (found === false) {
                examinedList.add.push(bObj);
            }
        }
        // del
        for (const examine of examineList) {
            let found: boolean = false;
            for (bObj of ret.value) {
                if (examine._id === bObj._id) found = true;
            }
            if (found == false) {
                examinedList.del.push(examine._id);
            }
        }

        return this.sOK<examinedHashes>(examinedList);
    }
    /**
     * Request from a sibling, to get last hash value and height.
     * @param core - set ccSystemType instance
     * @param __t - in open source version, it must be undefined or equal to DEFAULT_PARSEL_IDENTIFIER
     * @param failIfUnhealthy - fail if this node is not healthy as the result of checking
     * @returns returns with gResult, that is wrapped by a Promise, that contains digestDataFormat if it's success, and gError if it's failure.
     */
    public async requestToGetLastHash(core: ccSystemType, __t?: string, failIfUnhealthy?: boolean): Promise<gResult<digestDataFormat, gError>> {
        const LOG = core.log.lib.LogFunc(core.log);
        LOG("Info", 0, "SystemModule:requestToGetLastHash");

        if (__t === undefined) __t = this.common_parsel;

        const ret = await this.getLastHashAndHeight(core, __t, failIfUnhealthy);
        if (ret.isFailure()) return ret;
        return this.sOK<digestDataFormat>(ret.value);
    }
    /**
     * Request from a sibling, to examine the difference of blocks.
     * @param core - set ccSystemType instance
     * @param examineList - the list from a sibling to examine
     * @param __t - in open source version, it must be undefined or equal to DEFAULT_PARSEL_IDENTIFIER
     * @returns returns with gResult, that is wrapped by a Promise, that contains the result by examinedHashes if it's success, and gError if it's failure.
     */
    public async requestToExamineBlockDifference(core: ccSystemType, examineList: examineHashes, __t?: string): Promise<gResult<examinedHashes, gError>> {
        const LOG = core.log.lib.LogFunc(core.log);
        LOG("Info", 0, "SystemModule:requestToExamineBlockDifference");

        if (__t === undefined) __t = this.common_parsel;

        const ret = await this.examineBlockDifference(core, examineList, __t);
        if (ret.isFailure()) return ret;
        return this.sOK<examinedHashes>(ret.value);
    }

    /**
     * Diagnostics the pool condition, and fixes if possible.
     * @param core -  set ccSystemType instance
     * @param options - can be set when only scanning is expected
     * @returns returns with gResult, that is wrapped by a Promise, that contains boolean if it's success, and gError if it's failure.
     */
    public async postScanAndFixPool(core: ccSystemType, options?: postScanAndFixOptions): Promise<gResult<boolean, gError>> {
        const LOG = core.log.lib.LogFunc(core.log);
        LOG("Info", 0, "SystemModule:postScanAndFixPool");

        if (core.serializationLocks.postScanAndFixPool === true) {
            return this.sError("postScanAndFixPool", "serializationLocks", "This function is running. Wait for a while.");
        } else {
            core.serializationLocks.postScanAndFixPool = true;
        }

        // (1) If there is a tx that overlaps with a block on its own node (while the block is synchronized), delete the tx.
        // (2) After the above state, acquire the transmitted tx that is in the other node but does not have it. (This may be necessary when returning from a fragmented state.)

        // Eliminate duplication of tx in pool and tx in block (in the future, target after checkpoint)
        LOG("Notice", 0, "postScanAndFixPool:checking with local pool against local block:", {lf: false});
        if (core.m === undefined) {
            core.serializationLocks.postScanAndFixPool = false;
            return this.sError("postScanAndFixPool", "getAllBlock", "The main module is down");
        }
        const ret1 = await core.m.lib.getAllBlock(core.m, { bareTransaction: true }, this.master_key);
        if (ret1.isFailure()) {
            core.serializationLocks.postScanAndFixPool = false;
            return ret1;
        }
        const ret2 = await core.m.lib.getAllPool(core.m, undefined, this.master_key);
        if (ret2.isFailure()) {
            core.serializationLocks.postScanAndFixPool = false;
            return ret2;
        }
        let blockIds: string[] = [];
        let poolIds: string[] = [];
        let blockId: string;
        let txPool: any;
        let removePoolIds: string[] = [];
        let txBlock: any;
        for (txBlock of ret1.value) {
            blockIds.push(txBlock._id);
        }
        for (txPool of ret2.value) {
            poolIds.push(txPool._id.toString());
        }
        for (blockId of blockIds) {
            for (const poolId of poolIds) {
                if (blockId === poolId) {
                    removePoolIds.push(poolId);
                }
            }
        }
        LOG("Debug", 0, "postScanAndFixPool:removePoolIds");
        LOG("Debug", 0, JSON.stringify(removePoolIds));

        if (removePoolIds.length !== 0) {
            LOG("Notice", 0, "Detected duplication of transactions, it should be fixed.");
            if (options?.scanonly === true) {
                core.serializationLocks.postScanAndFixPool = false;
                return this.sOK<boolean>(false);
            }
            if (core.d !== undefined) {
                LOG("Notice", 0, "deleting duplication of transactions:", {lf: false});
                const ret3 = await core.d.lib.poolDeleteTransactions(core.d, removePoolIds, this.master_key);
                if (ret3.isFailure()) {
                    LOG("Error", -1, "postScanAndFixPool:removePoolIds: error in deleting transactions");
                    core.serializationLocks.postScanAndFixPool = false;
                    return ret3
                } else {
                    LOG("Notice", 0, "OK.");
                }
            } else {
                core.serializationLocks.postScanAndFixPool = false;
                return this.sError("postScanAndFixPool", "poolDeleteTransactions", "The datastore module is down");
            }
        } else {
            LOG("Notice", 0, "there are no duplication of transactions to delete.");
        }

        // Send the tx list of the pool and get missing txs from all nodes
        LOG("Notice", 0, "postScanAndFixPool:checking with local pool against remote pools: ", {lf: false});
        for (const removePoolId of removePoolIds) {
            poolIds = poolIds.filter(poolId => {
                return poolId !== removePoolId
            })
        }

        const sObj: systemrpc.ccSystemRpcFormat.AsObject = {
            version: 3,
            request: "ExaminePoolDifference",
            param: { tenant: this.master_key },
            dataasstring: poolIds.join(",")
        }
        let rets: rpcReturnFormat[] = [];
        if (core.i !== undefined) {
            const ret4 = await core.i.lib.sendRpcAll(core.i, sObj);
            if (ret4.isSuccess()) rets = ret4.value;
        } else {
            core.serializationLocks.postScanAndFixPool = false;
            return this.sError("postScanAndFixPool", "sendRpcAll", "The internode module is down");
        }
        let lackingTxs: objTx[] = [];
        for (const ret5 of rets) {
            if (ret5.status !== 0) {
                LOG("Error", -2, "error in collecting lacking transactions");
                core.serializationLocks.postScanAndFixPool = false;
                return this.sError("postScanAndFixPool", "sendRpcAll", "error in collecting lacking transactions");
            } else {
                LOG("Notice", 0, "OK.");
            }
            if ((ret5.data !== undefined) && (ret5.data !== "[]")) lackingTxs = lackingTxs.concat(JSON.parse(ret5.data));
        }
        
        // Eliminate duplicate acquisitions
        let uniquedTxMap = new Map();
        for (const lackingTx of lackingTxs) {
            uniquedTxMap.set(lackingTx, true);
        }
        const uniqedTxArr: objTx[] = Array.from(uniquedTxMap.keys());
        LOG("Debug", 0, "postScanAndFixPool:uniqedTxArr");
        LOG("Debug", 0, JSON.stringify(uniqedTxArr));

        if (uniqedTxArr.length === 0) {
            LOG("Notice", 0, "postScanAndFixPool:local pool is clean against remote pools.");
            core.serializationLocks.postScanAndFixPool = false;
            return this.sOK<boolean>(true);
        } else {
            LOG("Notice", 0, "Detected some transmitted transactions on remote pools are not found on this node. It should be fixed.");
            if (options?.scanonly === true) {
                core.serializationLocks.postScanAndFixPool = false;
                return this.sOK<boolean>(false);
            } else {
                LOG("Notice", 0, "postScanAndFixPool:syncing with local pool and remote pools: ", {lf: false});
            }
        }

        // Add missing amount
        if (core.d !== undefined) {
            let pArr: Promise<gResult<poolResultObject, gError>>[] = [];
            let failcnt = 0;
            for (const tx of uniqedTxArr) {
                pArr.push(core.d.lib.setPoolNewData(core.d, tx, this.master_key));
            }
            await Promise.all(pArr).then((rArr) => {
                for (const ret6 of rArr) {
                    if (ret6.isFailure()) { 
                        failcnt++;
                    } else {
                        if (ret6.value.status !== 0) failcnt++;
                    }
                }
            })
            if (failcnt !== 0) {
                LOG("Error", -3 * failcnt, "Some data has not been added to the pool.");
                core.serializationLocks.postScanAndFixPool = false;
                return this.sError("postScanAndFixPool", "setPoolNewData", "Some data has not been added to the pool.");
            } else {
                LOG("Notice", 0, "OK.");
                core.serializationLocks.postScanAndFixPool = false;
                return this.sOK<boolean>(true);
            }
        } else {
            core.serializationLocks.postScanAndFixPool = false;
            return this.sError("postScanAndFixPool", "setPoolNewData", "The datastore module is down");
        }
    }
    /**
     * Request from a sibling, to examine the difference of pools between the sibling and this node.
     * @param core - set ccSystemType
     * @param examineList - set the list to be examined
     * @param __t - in open source version, it must be undefined or equal to DEFAULT_PARSEL_IDENTIFIER
     * @returns returns with gResult, that is wrapped by a Promise, that contains transactions if it's success, and gError if it's failure.
     */
    public async requestToExaminePoolDifference(core: ccSystemType, examineList: string[], __t?: string): Promise<gResult<objTx[], gError>> {
        const LOG = core.log.lib.LogFunc(core.log);
        LOG("Info", 0, "SystemModule:requestToExaminePoolDifference");

        if (__t === undefined) __t = this.common_parsel;

        const ret = await this.examinePoolDifference(core, examineList, __t);
        if (ret.isFailure()) return ret;
        return this.sOK<objTx[]>(ret.value);
    }
    /**
     * Examine the difference of pools between the list and this node.
     * @param core - set ccSystemType
     * @param examineList - set the list to be examined
     * @param __t - in open source version, it must be undefined or equal to DEFAULT_PARSEL_IDENTIFIER
     * @returns returns with gResult, that is wrapped by a Promise, that contains transactions if it's success, and gError if it's failure.
     */
    public async examinePoolDifference(core: ccSystemType, examineList: string[], __t?: string): Promise<gResult<objTx[], gError>> {
        const LOG = core.log.lib.LogFunc(core.log);
        LOG("Info", 0, "SystemModule:examinePoolDifference");

        if (core.m === undefined) {
            return this.sError("examinePoolDifference", "getAllPool", "The main module is down");
        }
        
        if (__t === undefined) __t = this.common_parsel;

        const ret = await core.m.lib.getAllPool(core.m, undefined, __t);
        if (ret.isFailure()) return ret;
        let txArr = ret.value;
        for (const id of examineList) {
            txArr = txArr.filter((tx: any) => {
                return (JSON.stringify(tx._id.toString()).split('"')[1] !== id)
            })
        }
        LOG("Debug", 0, "TxArr" + JSON.stringify(txArr));
        return this.sOK<objTx[]>(txArr);
    }

    /**
     * Force syncing read caches of pool and block.
     * @param core - set ccSystemType
     * @returns  returns with gResult, that is wrapped by a Promise, that contains void if it's success, and gError if it's failure.
     * So there is no need to check the value of success.
     */
    public async postSyncCaches(core: ccSystemType): Promise<gResult<void, gError>> {
        const LOG = core.log.lib.LogFunc(core.log);
        LOG("Info", 0, "SystemModule:postSyncCaches");

        if (core.d !== undefined) {
            const ret1 = await core.d.lib.setPoolNewData(core.d, undefined, this.master_key);
            if (ret1.isFailure()) return ret1;
            const ret2 = await core.d.lib.setBlockNewData(core.d, undefined, this.master_key);
            if (ret2.isFailure()) return ret2;
            if ((ret1.isSuccess()) && (ret2.isSuccess())) {
                if ((ret1.value.status !== 0) || (ret2.value.status !== 0)) {
                    LOG("Warning", -1, "Syncing read cache failed")
                    return this.sError("postSyncCaches", "setNewData", "Syncing read cache failed");
                }
            }
        } else {
            return this.sError("postSyncCaches", "setNewData", "The datastore module is down");
        }

        return this.sOK<void>(undefined);
    }
}

