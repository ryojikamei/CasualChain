/**
 * Copyright (c) 2024 Ryoji Kamei
 * Released under the MIT license
 * https://opensource.org/licenses/mit-license.php
 */

import clone from "clone";
import { randomUUID, randomInt } from 'crypto';
import { setInterval } from "timers/promises";

import { gResult, gSuccess, gFailure, gError } from "../utils.js";

import { ccSystemType, postGenesisBlockOptions, postScanAndFixOptions, getBlockResult, examineHashes, examinedHashes, postOpenParcelOptions, postCloseParcelOptions } from "./index.js";
import { systemConfigType } from "../config/index.js";
import { ccLogType } from "../logger/index.js";
import { objTx, objBlock, poolResultObject, blockResultObject, ccDsType } from "../datastore/index.js";
import { inHeightReturnDataFormat, inDigestReturnDataFormat, ccInType, inExamineBlockDiffernceDataFormat, inExaminePoolDiffernceDataFormat, inGetBlockDataFormat, inGetBlockDigestDataFormat, inGetBlockHeightDataFormat, rpcResultFormat } from "../internode/index.js";
import { blockFormat, createBlockOptions, ccBlockType } from '../block/index.js';
import { ccMainType } from '../main/index';
import { randomOid } from '../utils.js';
import { ccEventType, internalEventFormat } from '../event/index.js';
import { MAX_SAFE_PAYLOAD_SIZE } from "../datastore/mongodb.js";
import { moduleCondition } from "../index.js";
import ic from "../../grpc/interconnect_pb.js";

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

        this.coreCondition = "loading";
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
            activeTenants: [],
            d: dsInstance ?? undefined,
            i: inInstance ?? undefined,
            b: blockInstance ?? undefined,
            m: mainInstance ?? undefined,
            e: eventInstance ?? undefined
        }

        this.coreCondition = "active";
        core.lib.coreCondition = this.coreCondition;
        return this.sOK<ccSystemType>(core);
    }

    /**
     * Restart this module
     * @param core - set ccMainType instance
     * @param log - set ccLogType instance
     * @param dsInstance - can inject ccDsType instance
     * @param inInstance - can inject ccInType instance
     * @param blockInstance - can inject ccBlockType instance
     * @param mainInstance - can inject ccMainkType instance
     * @param eventInstance - can inject ccEventType instance
     * @returns returns with gResult type that contains ccSystemType if it's success, and unknown if it's failure.
     * So there is no need to be concerned about the failure status.
     */
    public restart(core: ccSystemType, log: ccLogType, dsInstance?: ccDsType, 
        inInstance?: ccInType, blockInstance?: ccBlockType, mainInstance?: ccMainType,
        eventInstance?: ccEventType): gResult<ccSystemType, unknown> {
        const LOG = core.log.lib.LogFunc(core.log, "System", "restart");
        LOG("Info", "start");

        this.coreCondition = "unloaded";
        const ret1 = this.init(core.conf, log);
        if (ret1.isFailure()) { return this.sError("restart", "init", "unknown error") };
        const newCore: ccSystemType = ret1.value;
        // reconnect
        newCore.d = dsInstance;
        newCore.i = inInstance;
        newCore.b = blockInstance;
        newCore.m = mainInstance;
        newCore.e = eventInstance;

        return this.sOK<ccSystemType>(newCore);
    }

    /**
     * Rester auto tasks, such as blocking
     * @param core - set ccSystemType instance
     * @returns returns with gResult, that is wrapped by a Promise, that contains void if it's success, and unknown if it's failure.
     */
    public registerAutoTasks(core: ccSystemType): gResult<void, unknown> {
        const LOG = core.log.lib.LogFunc(core.log, "System", "registerAutoTasks");
        LOG("Info", "start");

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
        const LOG = core.log.lib.LogFunc(core.log, "System", "unregisterAutoTasks");
        LOG("Info", "start");

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
     * @returns returns with gResult, that is wrapped by a Promise, that contains number of nodes successfully transferred if it's success, and gError if it's failure.
     */
    public async postDeliveryPool(core: ccSystemType, waitForUnLock?: boolean): Promise<gResult<number, gError>> {
        const LOG = core.log.lib.LogFunc(core.log, "System", "postDeliveryPool");
        LOG("Info", "start");

        if (waitForUnLock === true) {
            for await (const _ of setInterval(100)) {
                if (core.serializationLocks.postDeliveryPool === false) {
                    core.serializationLocks.postDeliveryPool = true;
                    break;
                }
            }
        } else {
            if (core.serializationLocks.postDeliveryPool === true) {
                return this.sError("postDeliveryPool", "serializationLocks", "This function is running. Wait for a while.");
            } else {
                core.serializationLocks.postDeliveryPool = true;
            }
        }
        
        if (core.m === undefined) {
            core.serializationLocks.postDeliveryPool = false;
            return this.sError("postDeliveryPool", "getAllUndeliveredPool", "The main module is down");
        }
        // Prepare an array of tx's with the pool delivery flag false
        const ret1 = await core.m.lib.getAllUndeliveredPool(core.m, { tenant: core.conf.administration_id });
        if (ret1.isFailure()) {
            core.serializationLocks.postDeliveryPool = false;
            return ret1;
        }

        // Send to other node => (Receiver) register data in pool and change flag to true
        const request = "AddPool";
        const data: objTx[] = ret1.value;
        let results: rpcResultFormat[] = [];
        if (core.i !== undefined) {
            const ret2 = await core.i.lib.runRpcs(core.i, core.i.conf.nodes, request, JSON.stringify(data));
            if (ret2.isFailure()) return ret2;
            results = ret2.value;
        } else {
            core.serializationLocks.postDeliveryPool = false;
            return this.sError("postDeliveryPool", "runRpcs", "The internode module is down");
        }

        let success: number = 0
        let errorNodes: string[] = [];
        for (const result of results) {
            try {
                if (result.result.isFailure()) {
                    errorNodes.push(result.node.nodename);
                } else {
                    const payload = result.result.value.getPayload()?.toObject();
                    if (payload === undefined) {
                        errorNodes.push(result.node.nodename);
                    } else {
                        switch (payload.payloadType) {
                            case ic.payload_type.RESULT_SUCCESS:
                                if (payload.dataAsString === "OK") {
                                    success++;
                                } else {
                                    errorNodes.push(result.node.nodename);
                                }
                                break;
                            case ic.payload_type.RESULT_FAILURE:
                                LOG("Info", "Node " + result.node.nodename + " has failed to save transaction data:" + payload.gErrorAsString);
                                errorNodes.push(result.node.nodename);
                                break;
                            default:
                                errorNodes.push(result.node.nodename);
                                break;
                        }
                    }
                }
            } catch (error) {
                errorNodes.push(result.node.nodename);
            }
        }
        LOG("Info", "postDeliveryPool:success:" + success.toString() + ",failure:" + errorNodes.length.toString());

        // Something error => need attension
        core.i.lib.disableAbnormalNodes(core.i, errorNodes);

        // If any one transfer succeeds, it is considered successful.
        if (success > 0) {
            let oids: string[] = [];
            let tx: any;
            for (tx of ret1.value) {
                oids.push(tx._id.toString());
            }
            if (core.d !== undefined) {
                const ret4 = await core.d.lib.poolModifyReadsFlag(core.d, oids, core.conf.administration_id);
                if (ret4.isFailure()) { 
                    core.serializationLocks.postDeliveryPool = false;
                    return ret4;
                };
            } else {
                core.serializationLocks.postDeliveryPool = false;
                return this.sError("postDeliveryPool", "poolModifyReadsFlag", "The datastore module is down");
            }
        } else {
            core.serializationLocks.postDeliveryPool = false;
            return this.sError("postDeliveryPool", "runRpcs", "All " + errorNodes.length.toString() + " nodes return error");
        }
        core.serializationLocks.postDeliveryPool = false;
        return this.sOK<number>(success);
    }
    /**
     * Request from a sibling, the original invoker, to make this node adding sent transactions to the pool.
     * @param core - set ccSystemType instance
     * @param txArr - set objTx[] instance to add this node
     * @returns returns with gResult, that is wrapped by a Promise, that contains void if it's success, and gError if it's failure.
     * So there is no need to check the value of success.
     */
    public async requestToAddPool(core: ccSystemType, txArr: objTx[]): Promise<gResult<void, gError>> {
        const LOG = core.log.lib.LogFunc(core.log, "System", "requestToAddPool");
        LOG("Info", "start");

        if (core.d !== undefined) {
            let tx: any;
            let pArr: Promise<gResult<poolResultObject, gError>>[] = [];
            let failcnt = 0;
            for (tx of txArr) {
                // The oid is inherited from the transfer source
                tx.deliveryF = true;
                pArr.push(core.d.lib.setPoolNewData(core.d, tx, core.conf.administration_id));
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
                LOG("Warning", "Some data has not been added to the pool. Use /sync/poolsync to fix it.");
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
        const LOG = core.log.lib.LogFunc(core.log, "System", "postAppendBlocks");
        LOG("Info", "start");

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
        const ret1 = await core.m.lib.getAllDeliveredPool(core.m, { constrainedSize: MAX_SAFE_PAYLOAD_SIZE, tenant: core.conf.administration_id });
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
        const LOG = core.log.lib.LogFunc(core.log, "System", "removeFromPool");
        LOG("Info", "start");
        LOG("Debug", "txArr:" + JSON.stringify(txArr));

        if (core.d === undefined) {
            return this.sError("removeFromPool", "poolDeleteTransactions", "The datastore module is down");
        }
        const oids: string[] = [];
        for (const tx of txArr) {
            oids.push(tx._id);
        }
        const ret = await core.d.lib.poolDeleteTransactions(core.d, oids, core.conf.administration_id);
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
        const LOG = core.log.lib.LogFunc(core.log, "System", "requestToAddBlock");
        if (trackingId === undefined) {
            LOG("Info", "start");
        } else {
            LOG("Info", "start:" + trackingId);
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
                    LOG("Info", "pass the verification");
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
            const ret2 = await core.d.lib.setBlockNewData(core.d, bObj, core.conf.administration_id);
            if (ret2.isFailure()) return ret2;
            if (ret2.value.status !== 0) {
                LOG("Warning", "The data has not been added to the block. Use /sync/blocksync to fix it.");
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
        const LOG = core.log.lib.LogFunc(core.log, "System", "postGenesisBlock");
        LOG("Info", "start");

        if (core.serializationLocks.postGenesisBlock === true) {
            return this.sError("postGenesisBlock", "serializationLocks", "This function is running. Wait for a while.");
        } else {
            core.serializationLocks.postGenesisBlock = true;
        }

        let forceresetiftesting: boolean  = false;
        if (options !== undefined) {
            try {
                if (options.trytoreset !== undefined) { forceresetiftesting = options.trytoreset; };
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
            const ret1 = await core.m.lib.getAllBlock(core.m, {bareTransaction: false, ignoreGenesisBlockIsNotFound: true, tenant: core.conf.default_tenant_id});
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
            const request = "GetBlockHeight";
            const data: inGetBlockHeightDataFormat = { tenantId: core.conf.default_tenant_id };
            let results: rpcResultFormat[] = [];
            if (core.i !== undefined) {
                const ret2 = await core.i.lib.runRpcs(core.i, core.i.conf.nodes, request, JSON.stringify(data));
                if (ret2.isFailure()) {
                    core.serializationLocks.postGenesisBlock = false;
                    return ret2;
                }
                results = ret2.value;

                let errorNodes: string[] = [];
                let returnError: gResult<never, gError> | undefined;
                for (const result of results) {
                    try {
                        if (result.result.isFailure()) {
                            LOG("Warning", "There is a problem getting data from a remote node. No genesis block is created.");
                            returnError = this.sError("postGenesisBlock", "runRpcs", "GetBlockHeight is failed");
                        } else {
                            const payload = result.result.value.getPayload()?.toObject();
                            if (payload === undefined) {
                                errorNodes.push(result.node.nodename);
                            } else {
                                switch (payload.payloadType) {
                                    case ic.payload_type.RESULT_SUCCESS:
                                        if (payload.dataAsString !== undefined) {
                                            const d: inHeightReturnDataFormat = JSON.parse(payload.dataAsString);
                                            if (d.height !== 0) {
                                                LOG("Warning", "There is some data in the block collection on a remote node. No genesis block is created.");
                                                returnError = this.sError("postGenesisBlock", "runRpcs", "GetBlockHeight indicates that there is data on a remote node");
                                            }
                                        } else {
                                            returnError = this.sError("postGenesisBlock", "runRpcs", "GetBlockHeight returns unknown error");
                                            errorNodes.push(result.node.nodename);
                                        }
                                        break;
                                    case ic.payload_type.RESULT_FAILURE:
                                        LOG("Info", "Node " + result.node.nodename + " has failed to get blockchain data:" + payload.gErrorAsString);
                                        errorNodes.push(result.node.nodename);
                                        break;
                                    default:
                                        errorNodes.push(result.node.nodename);
                                        break;
                                }
                            }
                        }
                    } catch (error) {
                        errorNodes.push(result.node.nodename);
                    }
                }

                // Something error => need attension
                core.i.lib.disableAbnormalNodes(core.i, errorNodes);

                if (returnError !== undefined) {
                    core.serializationLocks.postGenesisBlock = false;
                    return returnError;
                }
            } else {
                core.serializationLocks.postGenesisBlock = false;
                return this.sError("postGenesisBlock", "runRpcs", "The internode module is down");
            }
        } else { // check if force resetting can be done
            LOG("Notice", "Checking whether force reset the chain can be done");
            if ((core.conf.node_mode === "testing") || (core.conf.node_mode === "testing+init")) {
                LOG("Notice", "Node mode is OK since testing");
            } else {
                LOG("Error", "It cannot be reset since the node mode is not testing");
                core.serializationLocks.postGenesisBlock = false;
                return this.sError("postGenesisBlock", "forceresetiftesting", "The node mode is not OK");
            }
            if (core.d !== undefined) {
                const ret3 = await core.d.lib.cleanup(core.d);
                if (ret3.isFailure()) {
                    LOG("Error", "The clean the datastore up is failed: " + ret3.value.message);
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
            const ret3 = await core.b.lib.createBlock(core.b, txArr, core.conf.default_tenant_id, blockOptions);
            if (ret3.isFailure()) {
                core.serializationLocks.postGenesisBlock = false;
                return ret3;
            }
            if (ret3.value === undefined) {
                LOG("Notice", "Genesis block creation and posting are skipped.");
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
     * @param tenantId - can be set tenantId. If undefined, it is considered set if default_tenant_id is allowed and an error if it is not. To get a value across tenants, you must specify the administration_id for this node.
     * @returns returns with gResult, that is wrapped by a Promise, that contains the number of height if it's success, and gError if it's failure.
     */
    public async requestToGetPoolHeight(core: ccSystemType, tenantId?: string): Promise<gResult<number, gError>> {
        const LOG = core.log.lib.LogFunc(core.log, "System", "requestToGetPoolHeight");
        LOG("Info", "start");

        if (core.m === undefined) {
            return this.sError("requestToGetPoolHeight", "getAllPool", "The main module is down");
        }

        if (tenantId === undefined) { tenantId = core.conf.default_tenant_id; }

        const ret = await core.m.lib.getAllPool(core.m, { tenant: tenantId });
        if (ret.isFailure()) return ret;

        return this.sOK(ret.value.length);
    }
    /**
     * Request from a sibling, the original invoker, to make this node getting the count of blocks in the chain.
     * @param core - set ccSystemType instance
     * @returns returns with gResult, that is wrapped by a Promise, that contains the number of height if it's success, and gError if it's failure.
     */    
    public async requestToGetBlockHeight(core: ccSystemType, tenantId?: string): Promise<gResult<number, gError>> {
        const LOG = core.log.lib.LogFunc(core.log, "System", "requestToGetBlockHeight");
        LOG("Info", "start");

        if (core.m === undefined) {
            return this.sError("requestToGetBlockHeight", "getAllPool", "The main module is down");
        }
        
        if (tenantId === undefined) { tenantId = core.conf.default_tenant_id; }

        const ret = await core.m.lib.getAllBlock(core.m, { bareTransaction: false, ignoreGenesisBlockIsNotFound: true, tenant: tenantId });
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
        const LOG = core.log.lib.LogFunc(core.log, "System", "markDiagStatusWithChain");
        LOG("Info", "start");

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
        const LOG = core.log.lib.LogFunc(core.log, "System", "checkHealthOfChainRecursive");
        LOG("Info", "start");

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
                            LOG("Warning", "The verifyBlock returns " + diagObj.block_status.toString() + ". Detected malformed block: " + diagObj.data.hash);
                            diagChain.chain_status.has_malformed_block++;
                            diagChain.chain_status.number_of_errors++;
                        }
                        previous_block_prev_hash = clone(diagObj.data.prev_hash);
                        // Arriving at the root of the chain. 
                        if ((diagObj.data.prev_hash === "0") || (diagObj.data.prev_hash === "")) {
                            previous_block_prev_hash = undefined; // The search ended with results
                            if (diagObj.data.hash === diagChain.genesis_hash) { // genesis block. general chain.
                                LOG("Notice", "Arriving at the root of the chain with genesis block.");
                                break; // do not search any more
                            } else { // not genesis block. fragmenting chain
                                LOG("Warning", "Arriving at the root of the chain with non genesis block. It's a fragmenting chain.");
                                const ret1 = this.markDiagStatusWithChain(core, diagChain.blocks, highest_hash, 100) // fragmented chain
                                if (ret1.isSuccess()) diagChain.blocks = ret1.value;
                                diagChain.chain_status.has_fragment++;
                                diagChain.chain_status.number_of_errors++;
                                break; // do not search any more
                            }
                        }
                    } else { // Detected confluence. It's a fork if obtained diagObj had highest_hash value already
                        LOG("Warning", "Detected confluence. Fork state is settled.");
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
                    LOG("Warning", "Detected a new chain. One of the new chain or current chain is a fork or fragment. Start searching.");
                    const ret4 = await this.checkHealthOfChainRecursive(core, diagChain, idx, diagObj.highest_hash);
                    if (ret4.isFailure()) return ret4;
                    diagChain = ret4.value;
                }   
            }
        }
        // went back to the beginning but could not find the block specified in prev_hash (the previous block that should have been there).
        if (previous_block_prev_hash !== undefined) {
            LOG("Warning", "Previous block for " + diagChain.blocks[startidx].data._id + " cannot be found. The blockchain is damaged, or the value of hash and previous_hash of the chain has been falsificated with.");
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
        const LOG = core.log.lib.LogFunc(core.log, "System", "reportHealthOfChain");
        LOG("Info", "start");

        LOG("Notice", "Creating the blocklist to diagnostics: ", {lf: false});
        if (core.m === undefined) {
            return this.sError("reportHealthOfChain", "getAllBlock", "The main module is down");
        }
        const ret1 = await core.m.lib.getAllBlock(core.m, { bareTransaction: false, ignoreGenesisBlockIsNotFound: true, tenant: core.conf.administration_id});
        if (ret1.isFailure()) return ret1;

        if (ret1.value.length === 0) {
            LOG("Warning", "The datastore is empty. The blockchain might not be initialized");
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
                    LOG("Warning", "A data that has oid " + bObj._id.toString() + " cannot be read !");
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
                    LOG("Warning", "A data cannot be read !");
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
        LOG("Notice", "done");

        // check information of genesis block
        if (diagChain.genesis_hash === "") {
            // The blockchain is damaged or lacks something
            LOG("Warning", "Not a normal blockchain, genesis block is not found!");
            diagChain.chain_status.lacks_genesis_block = true;
            diagChain.chain_status.number_of_errors++;
        }

        LOG("Notice", "Start checking health of the blockchain");
        const ret2 = await this.checkHealthOfChainRecursive(core, diagChain, 0, "");
        if (ret2.isFailure()) return ret2;
        diagChain = ret2.value;
        LOG("Notice", "End checking health of the blockchain");

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
        const LOG = core.log.lib.LogFunc(core.log, "System", "obtainHealthyNodes");
        LOG("Info", "start");

        let healthyNodes: nodeStatus[] = [];

        // Determine the majority by obtaining the hash value (digest) of lastBlocks of all nodes

        // Get digest of own node (but only if it is healthy)
        if (localCondition === 0) {
            const ret1 = await core.lib.getLastHashAndHeight(core, core.conf.administration_id);
            if (ret1.isFailure()) { return ret1 };
            if (ret1.value.hash === "") {
                LOG("Error", "Unable to obtain hash value");
                return this.sError("obtainHealthyNodes", "getLastHashAndHeight", "Unable to obtain hash value");
            }
            healthyNodes.push({host: "localhost", hash: ret1.value.hash, height: ret1.value.height});
        }

        // get the digest of other nodes
        const request = "GetBlockDigest";
        const data: inGetBlockDigestDataFormat = {
            failIfUnhealthy: true
        }
        let results: rpcResultFormat[] = [];
        if (core.i !== undefined) {
            const ret2 = await core.i.lib.runRpcs(core.i, core.i.conf.nodes, request, JSON.stringify(data));
            if (ret2.isFailure()) return ret2;
            results = ret2.value;

            let errorNodes: string[] = [];
            for (const result of results) {
                // Only gathers right nodes' information
                try {
                    if (result.result.isFailure()) {
                        errorNodes.push(result.node.nodename);
                    } else {
                        const payload = result.result.value.getPayload()?.toObject();
                        if (payload === undefined) {
                            errorNodes.push(result.node.nodename);
                        } else {
                            switch (payload.payloadType) {
                                case ic.payload_type.RESULT_SUCCESS:
                                    if (payload.dataAsString !== undefined) {
                                        const rLast: inDigestReturnDataFormat = JSON.parse(payload.dataAsString);
                                        if (rLast.height >= 0) {
                                            healthyNodes.push({
                                                host: result.result.value.getSender(),
                                                hash: rLast.hash,
                                                height: rLast.height
                                            })
                                        }
                                    } else {
                                        errorNodes.push(result.node.nodename);
                                    }
                                    break;
                                case ic.payload_type.RESULT_FAILURE:
                                    LOG("Info", "Node " + result.node.nodename + " has failed to get blockchain data:" + payload.gErrorAsString);
                                    errorNodes.push(result.node.nodename);
                                    break;
                                default:
                                    errorNodes.push(result.node.nodename);
                                    break;
                            }
                        }
                    }
                } catch (error) {
                    errorNodes.push(result.node.nodename);
                }
            }

            // Something error => need attension
            core.i.lib.disableAbnormalNodes(core.i, errorNodes);
        } else {
            return this.sError("obtainHealthyNodes", "runRpcs", "The internode module is down");
        }
        LOG("Debug", "healthyNodes");
        LOG("Debug", JSON.stringify(healthyNodes));

        if (((localCondition === 0) && (healthyNodes.length < 2)) || ((localCondition !== 0) && (healthyNodes.length < 1))) {
            LOG("Error", "Unable to obtain other healthy node's information.");
            return this.sError("obtainHealthyNodes", "runRpcs", "Unable to obtain other healthy node's information.");
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
        LOG("Debug", "MajorityNodes");
        LOG("Debug", JSON.stringify(mNodes));

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
        const LOG = core.log.lib.LogFunc(core.log, "System", "collectTargetOidsRecursive");
        LOG("Info", "start");

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
                        LOG("Warning", "There is a illegal block data with undefined _id");
                        diagObj.block_status = 4; // status checked and it's a target
                    } else { // ObjectId
                        replaceOids.push(diagObj.data._id.toString());
                        diagObj.block_status = 4; // status checked and it's a target
                        if (diagObj.data.prev_hash !== "") {
                            const ret1 = this.collectTargetOidsRecursive(core, diagChain, replaceOids, diagObj.data.prev_hash); // recurse go-backing mode
                            if (ret1.isFailure()) {
                                LOG("Warning", "There is a illegal block data that has unrecognized format");
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
                        LOG("Warning", "There is a illegal block data with undefined _id");
                        diagObj.block_status = 4; // status checked and it's a target
                    } else { // ObjectId
                        replaceOids.push(diagObj.data._id.toString());
                        diagObj.block_status = 4; // status checked and it's a target
                        if ((diagObj.data.prev_hash !== undefined) && (diagObj.data.prev_hash !== "")) {
                            const ret2 = this.collectTargetOidsRecursive(core, diagChain, replaceOids, diagObj.data.prev_hash); // fork go-backing mode
                            if (ret2.isFailure()) {
                                LOG("Warning", "There is a illegal block data that has unrecognized format");
                                return this.sError("collectTargetOidsRecursive", "go-forwarding", "There is a illegal block data that has unrecognized format");
                            }
                            replaceOids = ret2.value;
                        }
                    }
                }
            }
        }
        if (hash === "") // does not found any data!
            LOG("Warning", "The end of the search was reached without finding the block with the hash in question. The blockchain is broken.");

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
        const LOG = core.log.lib.LogFunc(core.log, "System", "getNormalBlocksAsPossible");
        LOG("Info", "start");

        if (oidList.length === 0) return this.sOK<getBlockResult[]>([]);

        let pArr = [];
        let bArr: getBlockResult[] = [];
        // At first, try to get data from majority nodes
        if (core.i !== undefined) {
            for (const oid of oidList) {
                let cnt = 0;

                const request = "GetBlock";
                const data: inGetBlockDataFormat = {
                    oid: oid,
                    returnUndefinedIfFail: true
                }
                const dataAsString = JSON.stringify(data);

                // send request randomly
                const host = healthyNodes.majority.hosts[Math.floor(Math.random() * healthyNodes.majority.hosts.length)];
                for (const node of core.i.conf.nodes) {
                    if (node.host + ":" + node.rpc_port === host) {
                        const pRet = core.i.lib.runRpcs(core.i, [node], request, dataAsString);
                        pArr.push(pRet);
                        break;
                    }
                }
            }
        } else {
            return this.sError("getNormalBlocksAsPossible", "runRpcs_ToMajority", "The internode module is down");
        }
        await Promise.all(pArr).then((rArr) => {
            for (const ret of rArr) {
                let errorNodes: string[] = [];
                let returnError: gResult<never, gError> | undefined;
                if (ret.isFailure()) {
                    LOG("Warning", "The process was aborted because data acquisition from some nodes are failed.");
                    returnError = this.sError("getNormalBlocksAsPossible", "runRpcs_ToMajority", "Data acquisition from some nodes are failed");
                } else {
                    const result = ret.value[0];
                    try {
                        if (result.result.isFailure()) {
                            LOG("Warning", "The process was aborted because data acquisition from some nodes are failed.");
                            returnError = this.sError("getNormalBlocksAsPossible", "runRpcs_ToMajority", "Data acquisition from some nodes are failed");
                        } else {
                            const payload = result.result.value.getPayload()?.toObject();
                            if (payload === undefined) {
                                errorNodes.push(result.node.nodename);
                            } else {
                                switch (payload.payloadType) {
                                    case ic.payload_type.RESULT_SUCCESS:
                                        if (payload.dataAsString !== undefined) {
                                            bArr.push(JSON.parse(payload.dataAsString));
                                        } else {
                                            LOG("Warning", "The process was aborted because data acquisition from some nodes are failed.");
                                            returnError = this.sError("getNormalBlocksAsPossible", "runRpcs_ToMajority", "Data acquisition from some nodes are failed");
                                        }
                                        break;
                                    case ic.payload_type.RESULT_FAILURE:
                                        // Occurs when the receiving node failed to get block cursor
                                        LOG("Warning", "The process was aborted because data acquisition from some nodes are failed.");
                                        returnError = this.sError("getNormalBlocksAsPossible", "runRpcs_ToMajority", "Data acquisition from some nodes are failed");
                                        errorNodes.push(result.node.nodename);
                                        break;
                                    default:
                                        errorNodes.push(result.node.nodename);
                                        break;
                                }
                            }
                        }
                    } catch (error) {
                        LOG("Warning", "The process was aborted because data acquisition from some nodes are failed.");
                        returnError = this.sError("getNormalBlocksAsPossible", "runRpcs_ToMajority", "Data acquisition from some nodes are failed");
                        errorNodes.push(result.node.nodename);
                    }
                }

                // Something error => need attension
                if (core.i !== undefined) { core.i.lib.disableAbnormalNodes(core.i, errorNodes); }
            }
            LOG("Debug", "bArr");
            LOG("Debug", JSON.stringify(bArr));
            return bArr;
        });

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
        const request = "GetBlock";
        let results: rpcResultFormat[] = [];
        if (core.i !== undefined) {
            let errorNodes: string[] = [];
            for (const bRes of bArr) {
                if (bRes.block === undefined) {
                    const data: inGetBlockDataFormat = {
                        oid: bRes.oid,
                        returnUndefinedIfFail: true
                    }
                    let breakInternalFor: boolean = false;
                    for (const node of otherNodesList) {
                        const ret = await core.i.lib.runRpcs(core.i, [node], request, JSON.stringify(data))
                        if (ret.isSuccess()) {
                            results = ret.value;
                            if (results[0].result.isFailure()) {
                                errorNodes.push(node.nodename);
                            } else {
                                const payload = results[0].result.value.getPayload()?.toObject();
                                if (payload === undefined) {
                                    errorNodes.push(node.nodename);
                                } else {
                                    switch (payload.payloadType) {
                                        case ic.payload_type.RESULT_SUCCESS:
                                            if (payload.dataAsString !== undefined) {
                                                const bRes2: getBlockResult = JSON.parse(payload.dataAsString);
                                                if (bRes2.block !== undefined) {
                                                    bRes.block = bRes2.block;
                                                    breakInternalFor = true;
                                                }
                                            }
                                            break;
                                        case ic.payload_type.RESULT_FAILURE:
                                            LOG("Info", "Node " + node.nodename + " has failed to get blockchain data:" + payload.gErrorAsString);
                                            errorNodes.push(node.nodename);
                                            break;
                                        default:
                                            errorNodes.push(node.nodename);
                                            break;
                                    }
                                }
                            }
                        }
                        if (breakInternalFor === true) {
                            breakInternalFor = false;
                            break;
                        }
                    }
                    if (bRes.block === undefined) {
                        LOG("Notice", "The block that has oid " + bRes.oid + " cannot be repaired because it does not exist on any other node.");
                    }
                }
            }

            // Something error => need attension
            core.i.lib.disableAbnormalNodes(core.i, errorNodes);
        } else {
            return this.sError("getNormalBlocksAsPossible", "runRpcs_1by1", "The internode module is down");
        }
        return this.sOK<getBlockResult[]>(bArr);
    }

    /**
     * Request from a sibling for getting a block if possible.
     * @param core - set the ccSystemType instance
     * @param oid - set oid that is searching to get
     * @param returnUndefinedIfFail - it can be set true when the result may return success with undefined instead of any errors with gError format
     * @param tenantId - can be set tenantId. If undefined, it is considered set if default_tenant_id is allowed and an error if it is not. To get a value across tenants, you must specify the administration_id for this node.
     * @returns return with gResult, that is wrapped by a Promise, that contains a block by objBlock or nothing with undefined if it's success, and gError if it's failure.
     * Note that a success status is returned even if no block with the target oid is found.
     */
    public async requestToGetBlock(core: ccSystemType, oid: string, returnUndefinedIfFail: boolean | undefined, tenantId?: string): Promise<gResult<objBlock | undefined, gError>> {
        const LOG = core.log.lib.LogFunc(core.log, "System", "requestToGetBlock");
        LOG("Info", "start");

        if (core.m === undefined) {
            return this.sError("requestToGetBlock", "getSearchByOid", "The main module is down");
        }

        if (tenantId === undefined) { tenantId = core.conf.default_tenant_id; }

        const ret = await core.m.lib.getSearchByOid<objBlock>(core.m, oid, { targetIsBlock: true, tenant: tenantId });
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
        const LOG = core.log.lib.LogFunc(core.log, "System", "repairFalsifiedChain");
        LOG("Info", "start");

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
            const cnt = await core.d.lib.blockUpdateBlocks(core.d, ret2.value, core.conf.administration_id);
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
        const LOG = core.log.lib.LogFunc(core.log, "System", "postScanAndFixBlock");
        LOG("Info", "start");

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


        LOG("Notice", "First, get a health check report of the blockchain of its own node");
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
            LOG("Warning", "Failed to generate health check report:" + ret1.value +  " It needs to repair");
            repairNeeded = 2;
        } else {
            self_report = ret1.value;
        }
        LOG("Notice", JSON.stringify(self_report.chain_status));
        if (self_report.chain_status.number_of_errors === 0) {
            LOG("Notice", "OK. It doesn't need to repair")
            repairNeeded = 0;
        } else {
            LOG("Notice", "Some errors reported. It needs to repair");
            repairNeeded = 1;
        }
        

        LOG("Notice", "Obtain healthy nodes information ", {lf: false});
        let nodes: healthyNodesFormat;
        const ret2 = await core.lib.obtainHealthyNodes(core, repairNeeded);
        if (ret2.isFailure()) {
            LOG("Notice", "");
            LOG("Error", "Cannot obtain healthy node information. It's difficult to continue");
            core.serializationLocks.postScanAndFixBlock = false;
            return this.sError("postScanAndFixBlock", "obtainHealthyNode", "Cannot obtain healthy node information");
        }
        nodes = ret2.value;
        LOG("Notice", "OK");

        // Scan result
        // If it is a member of the majority node, complete the process
        if (nodes.majority.hosts.includes("localhost")) {
            LOG("Notice", "The blockchain of this node is healthy and properly synchronized with other nodes.");
            core.serializationLocks.postScanAndFixBlock = false;
            return this.sOK<boolean>(true);
        }
        // Cases with problems
        if (self_report.chain_status.number_of_errors !== 0) {
            LOG("Notice", "The blockchain of this node is NOT healthy. It needs to be fixed.");
        } else {
            LOG("Notice", "The blockchain of this node is NOT synchronized with other nodes. It needs to be fixed.");
        }

        // So much for checks only, returns false because it's an abnormal chain
        if ((options !== undefined) && (options.scanonly === true)) {
            core.serializationLocks.postScanAndFixBlock = false;
            return this.sOK<boolean>(false);
        }

        // Will attempt to correct the problem.
        if (self_report.chain_status.number_of_errors !== 0) {
            LOG("Notice", "Will attempt to correct the problem as best it can");
            const ret3 = await core.lib.repairFalsifiedChain(core, self_report, nodes);
            if (ret3.isFailure()) {
                LOG("Error", "Exception occured while reparing the chain. It cannot continue");
                core.serializationLocks.postScanAndFixBlock = false;
                return ret3;
            } else {
                LOG("Notice", "Finished fixing the problem");
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
        LOG("Debug", "postScanAndFixBlock:ownHashes");
        LOG("Debug", JSON.stringify(ret4.value));

        // Send to one of the majority nodes and receive the difference
        const request = "ExamineBlockDifference";
        const data: inExamineBlockDiffernceDataFormat = {
            list: ret4.value
        }
        let examinedList: examinedHashes = {add: [], del: []};
        if (core.i !== undefined) {
            let returnError: gResult<never, gError> | undefined = undefined;
            let errorNodes: string[] = [];
            const host = nodes.majority.hosts[Math.floor(Math.random() * nodes.majority.hosts.length)];
            for (const node of core.i.conf.nodes) {
                if (node.host + ":" + node.rpc_port === host) {
                    const ret5 = await core.i.lib.runRpcs(core.i, [node], request, JSON.stringify(data))
                    if (ret5.isFailure()) {
                        core.serializationLocks.postScanAndFixBlock = false;
                        return ret5;
                    }
                    const results: rpcResultFormat[] = ret5.value;
                    try {
                        if (results[0].result.isFailure()) {
                            errorNodes.push(results[0].node.nodename);
                            returnError = results[0].result;
                        } else {
                            const payload = results[0].result.value.getPayload()?.toObject();
                            if (payload === undefined) {
                                errorNodes.push(results[0].node.nodename);
                                returnError = this.sError("postScanAndFixBlock", "runRpcs", "postScanAndFixBlock returns unknown error");
                            } else {
                                switch (payload.payloadType) {
                                    case ic.payload_type.RESULT_SUCCESS:
                                        if (payload.dataAsString === undefined) {;
                                            returnError = this.sError("postScanAndFixBlock", "runRpcs", "postScanAndFixBlock returns unknown error");
                                        } else {
                                            examinedList = JSON.parse(payload.dataAsString);
                                        }
                                        break;
                                    case ic.payload_type.RESULT_FAILURE:
                                        errorNodes.push(results[0].node.nodename);
                                        returnError = this.sError("postScanAndFixBlock", "runRpcs", "postScanAndFixBlock returns unknown error");
                                        break;
                                    default:
                                        errorNodes.push(results[0].node.nodename);
                                        returnError = this.sError("postScanAndFixBlock", "runRpcs", "postScanAndFixBlock returns unknown error");
                                        break;
                                }
                            }
                        }
                    } catch (error: any) {
                        returnError = this.sError("postScanAndFixBlock", "runRpcs", error.toString());
                    }
                    break;
                }
            }
            
            // Something error => need attension
            core.i.lib.disableAbnormalNodes(core.i, errorNodes);

            if (returnError !== undefined) {
                core.serializationLocks.postScanAndFixBlock = false;
                return returnError;
            }
        } else {
            core.serializationLocks.postScanAndFixBlock = false;
            return this.sError("postScanAndFixBlock", "runRpcs_ExamineBlockDifference", "The internode module is down");
        }
        LOG("Debug", "examinedList");
        LOG("Debug", JSON.stringify(examinedList));

        // Process to be added
        LOG("Info", "postScanAndFixBlock:add a block:");
        let pArr: Promise<gResult<blockResultObject, gError>>[] = [];
        let failcnt = 0;
        if (core.d !== undefined) {
            for (const bObj of examinedList.add) {
                pArr.push(core.d.lib.setBlockNewData(core.d, bObj, core.conf.administration_id))
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
                LOG("Warning", "Some data has not been added to the block. Rerun /sync/blocksync later.");
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
        const ret8 = await core.m.lib.getAllBlock(core.m, { bareTransaction: false, ignoreGenesisBlockIsNotFound: true, tenant: core.conf.administration_id });
        if (ret8.isFailure()) {
            core.serializationLocks.postScanAndFixBlock = false;
            return ret8;
        }
        let pushBackTxArr: objTx[] = [];
        for (const id of examinedList.del) {
            let bObj: any;
            for (bObj of ret8.value) {
                LOG("Debug", "bObj:" + JSON.stringify(bObj));
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
        LOG("Debug", "pushBackTxArr(before):");
        LOG("Debug", JSON.stringify(pushBackTxArr));

        // If the extracted tx is included in the added block, remove the tx from the write-back candidate
        let bObj: any;
        for (bObj of examinedList.add) {
            let txObj: any;
            if (bObj.data !== undefined) {
                for (txObj of bObj.data) {
                    LOG("Debug", "txObj:" + JSON.stringify(txObj));
                    let pbObj: any;
                    let index: number = 0; 
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
        LOG("Debug", "examinedList.add:");
        LOG("Debug", JSON.stringify(examinedList.add));
        LOG("Debug", "pushBackTxArr(after):");
        LOG("Debug", JSON.stringify(pushBackTxArr));

        // Write the remaining tx back to pool
        if (core.d !== undefined) {
            let pArr: Promise<gResult<poolResultObject, gError>>[] = [];
            let failcnt = 0;
            for (const tx of pushBackTxArr) {
                pArr.push(core.d.lib.setPoolNewData(core.d, tx, core.conf.administration_id));
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
                LOG("Error", "Some data has not been added to the pool.");
                core.serializationLocks.postScanAndFixBlock = false;
                return this.sError("postScanAndFixBlock", "setPoolNewData", "Some data has not been added to the pool.");
            }
        } else {
            core.serializationLocks.postScanAndFixBlock = false;
            return this.sError("postScanAndFixBlock", "setPoolNewData", "The datastore module is down");
        }

        // Delete blocks enumerated by oid
        if (core.d !== undefined) {
            const ret10 = await core.d.lib.blockDeleteBlocks(core.d, examinedList.del, core.conf.administration_id);
            if (ret10.isFailure()) {
                core.serializationLocks.postScanAndFixBlock = false;
                return ret10;
            }
        } else {
            core.serializationLocks.postScanAndFixBlock = false;
            return this.sError("postScanAndFixBlock", "blockDeleteBlocks", "The datastore module is down");
        }
        LOG("Debug", "examinedList.del:");
        LOG("Debug", JSON.stringify(examinedList.del));

        core.serializationLocks.postScanAndFixBlock = false;
        return this.sOK<boolean>(true);
    }
    
    /**
     * Get last hash and its height of the blockchain.
     * @param core - set ccSystemType instance
     * @param tenantId - can be set tenantId. If undefined, it is considered set if default_tenant_id is allowed and an error if it is not. To get a value across tenants, you must specify the administration_id for this node.
     * @param failIfUnhealthy - check the health of the target and fail if it is not healthy 
     * @returns retruns with gResult, that is wrapped by a Promise, that contains digestDataFormat that has both values in one object if it's success, and gError if it's failure.
     */
    private async getLastHashAndHeight(core: ccSystemType, tenantId?: string, failIfUnhealthy?: boolean): Promise<gResult<inDigestReturnDataFormat, gError>> {
        const LOG = core.log.lib.LogFunc(core.log, "System", "getLastHashAndHeight");
        LOG("Info", "start");

        if ((failIfUnhealthy !== undefined) && (failIfUnhealthy === true)) {
            const ret1 = await core.lib.reportHealthOfChain(core, true);
            if (ret1.isFailure()) return ret1;
            const report = ret1.value;
            if (report.chain_status.number_of_errors !== 0) {
                return this.sError("getLastHashAndHeight", "reportHealthOfChain", "Errors are reported")
            }
        }

        if (core.m === undefined) {
            return this.sError("getLastHashAndHeight", "getLastBlock", "The main module is down");
        }
        const ret = await core.m.lib.getLastBlock(core.m, { tenant: tenantId });
        if (ret.isFailure()) return ret;
        if (ret.value !== undefined) {
            return this.sOK<inDigestReturnDataFormat>({ hash: ret.value.hash, height: ret.value.height });
        } else {
            return this.sOK<inDigestReturnDataFormat>({ hash: "", height: 0 });
        }
    }
    /**
     * Get all hashes of every blocks.
     * @param core - set CcSystemType instance
     * @param tenantId - can be set tenantId. If undefined, it is considered set if default_tenant_id is allowed and an error if it is not. To get a value across tenants, you must specify the administration_id for this node.
     * @returns returns Promise\<examineHashes\>
     */
    private async getAllBlockHashes(core: ccSystemType, tenantId?: string): Promise<gResult<examineHashes, gError>> {
        const LOG = core.log.lib.LogFunc(core.log, "System", "getAllBlockHashes");
        LOG("Info", "start");

        if (core.m === undefined) {
            return this.sError("getAllBlockHashes", "getAllBlock", "The main module is down");
        }

        const ret = await core.m.lib.getAllBlock(core.m, { bareTransaction: false, ignoreGenesisBlockIsNotFound: true, tenant: tenantId });
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
     * @param tenantId - can be set tenantId. If undefined, it is considered set if default_tenant_id is allowed and an error if it is not. To get a value across tenants, you must specify the administration_id for this node.
     * @returns returns with gResult, that is wrapped by a Promise, that contains the result by examinedHashes if it's success, and gError if it's failure.
     */
    private async examineBlockDifference(core: ccSystemType, examineList: examineHashes, tenantId?: string): Promise<gResult<examinedHashes, gError>> {
        const LOG = core.log.lib.LogFunc(core.log, "System", "examineBlockDifference");
        LOG("Info", "start");

        if (core.m === undefined) {
            return this.sError("examineBlockDifference", "getAllBlock", "The main module is down");
        }

        const ret = await core.m.lib.getAllBlock(core.m, { bareTransaction: false, ignoreGenesisBlockIsNotFound: false, tenant: tenantId });
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
     * @param tenantId - can be set tenantId. If undefined, it is considered set if default_tenant_id is allowed and an error if it is not. To get a value across tenants, you must specify the administration_id for this node.
     * @param failIfUnhealthy - fail if this node is not healthy as the result of checking
     * @returns returns with gResult, that is wrapped by a Promise, that contains digestDataFormat if it's success, and gError if it's failure.
     */
    public async requestToGetLastHash(core: ccSystemType, tenantId?: string, failIfUnhealthy?: boolean): Promise<gResult<inDigestReturnDataFormat, gError>> {
        const LOG = core.log.lib.LogFunc(core.log, "System", "requestToGetLastHash");
        LOG("Info", "start");

        if (tenantId === undefined) { tenantId = core.conf.default_tenant_id; }

        const ret = await this.getLastHashAndHeight(core, tenantId, failIfUnhealthy);
        if (ret.isFailure()) return ret;
        return this.sOK<inDigestReturnDataFormat>(ret.value);
    }
    /**
     * Request from a sibling, to examine the difference of blocks.
     * @param core - set ccSystemType instance
     * @param examineList - the list from a sibling to examine
     * @param tenantId - can be set tenantId. If undefined, it is considered set if default_tenant_id is allowed and an error if it is not. To get a value across tenants, you must specify the administration_id for this node.
     * @returns returns with gResult, that is wrapped by a Promise, that contains the result by examinedHashes if it's success, and gError if it's failure.
     */
    public async requestToExamineBlockDifference(core: ccSystemType, examineList: examineHashes, tenantId?: string): Promise<gResult<examinedHashes, gError>> {
        const LOG = core.log.lib.LogFunc(core.log, "System", "requestToExamineBlockDifference");
        LOG("Info", "start");

        if (tenantId === undefined) { tenantId = core.conf.default_tenant_id; }

        const ret = await this.examineBlockDifference(core, examineList, tenantId);
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
        const LOG = core.log.lib.LogFunc(core.log, "System", "postScanAndFixPool");
        LOG("Info", "start");

        if (core.serializationLocks.postScanAndFixPool === true) {
            return this.sError("postScanAndFixPool", "serializationLocks", "This function is running. Wait for a while.");
        } else {
            core.serializationLocks.postScanAndFixPool = true;
        }

        // (1) If there is a tx that overlaps with a block on its own node (while the block is synchronized), delete the tx.
        // (2) After the above state, acquire the transmitted tx that is in the other node but does not have it. (This may be necessary when returning from a fragmented state.)

        // Eliminate duplication of tx in pool and tx in block (in the future, target after checkpoint)
        LOG("Notice", "postScanAndFixPool:checking with local pool against local block:", {lf: false});
        if (core.m === undefined) {
            core.serializationLocks.postScanAndFixPool = false;
            return this.sError("postScanAndFixPool", "getAllBlock", "The main module is down");
        }
        const ret1 = await core.m.lib.getAllBlock(core.m, { bareTransaction: true, tenant: core.conf.administration_id });
        if (ret1.isFailure()) {
            core.serializationLocks.postScanAndFixPool = false;
            return ret1;
        }
        const ret2 = await core.m.lib.getAllPool(core.m, { tenant: core.conf.administration_id });
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
        LOG("Debug", "removePoolIds");
        LOG("Debug", JSON.stringify(removePoolIds));

        if (removePoolIds.length !== 0) {
            LOG("Notice", "Detected duplication of transactions, it should be fixed.");
            if (options?.scanonly === true) {
                core.serializationLocks.postScanAndFixPool = false;
                return this.sOK<boolean>(false);
            }
            if (core.d !== undefined) {
                LOG("Notice", "deleting duplication of transactions:", {lf: false});
                const ret3 = await core.d.lib.poolDeleteTransactions(core.d, removePoolIds, core.conf.administration_id);
                if (ret3.isFailure()) {
                    LOG("Error", "postScanAndFixPool:removePoolIds: error in deleting transactions");
                    core.serializationLocks.postScanAndFixPool = false;
                    return ret3
                } else {
                    LOG("Notice", "OK.");
                }
            } else {
                core.serializationLocks.postScanAndFixPool = false;
                return this.sError("postScanAndFixPool", "poolDeleteTransactions", "The datastore module is down");
            }
        } else {
            LOG("Notice", "There are no duplication of transactions to delete.");
        }

        // Send the tx list of the pool and get missing txs from all nodes
        LOG("Notice", "postScanAndFixPool:checking with local pool against remote pools: ", {lf: false});
        for (const removePoolId of removePoolIds) {
            poolIds = poolIds.filter(poolId => {
                return poolId !== removePoolId
            })
        }

        const request = "ExaminePoolDifference";
        const data: inExaminePoolDiffernceDataFormat = {
            list: poolIds
        }
        let results: rpcResultFormat[] = [];
        if (core.i !== undefined) {
            const ret4 = await core.i.lib.runRpcs(core.i, core.i.conf.nodes, request, JSON.stringify(data));
            if (ret4.isFailure()) {
                core.serializationLocks.postScanAndFixPool = false;
                return ret4;
            }
            results = ret4.value;
        } else {
            core.serializationLocks.postScanAndFixPool = false;
            return this.sError("postScanAndFixPool", "runRpcs", "The internode module is down");
        }
        let lackingTxs: objTx[] = [];
        let errorNodes: string[] = [];
        let returnError: gResult<never, gError> | undefined;
        let breakFor: boolean = false;
        for (const result of results) {
            try {
                if (result.result.isFailure()) {
                    LOG("Error", "error in collecting lacking transactions");
                    errorNodes.push(result.node.nodename);
                    returnError = this.sError("postScanAndFixPool", "runRpcs", "Error in collecting lacking transactions");
                    breakFor = true;
                } else {
                    const payload = result.result.value.getPayload()?.toObject();
                    if (payload === undefined) {
                        errorNodes.push(result.node.nodename);
                        returnError = this.sError("postScanAndFixPool", "runRpcs", "Node " + result.node.nodename + " returns wrong payload");
                        breakFor = true;
                    } else {
                        switch (payload.payloadType) {
                            case ic.payload_type.RESULT_SUCCESS:
                                if (payload.dataAsString !== undefined) {
                                    lackingTxs = lackingTxs.concat(JSON.parse(payload.dataAsString));
                                } else {
                                    errorNodes.push(result.node.nodename);
                                    returnError = this.sError("postScanAndFixPool", "runRpcs", "Node " + result.node.nodename + " returns wrong data");
                                    breakFor = true;
                                }
                                break;
                            case ic.payload_type.RESULT_FAILURE:
                                errorNodes.push(result.node.nodename);
                                returnError = this.sError("postScanAndFixPool", "runRpcs", "Node " + result.node.nodename + " returns error:" + payload.gErrorAsString);
                                breakFor = true;
                                break;
                            default:
                                errorNodes.push(result.node.nodename);
                                returnError = this.sError("postScanAndFixPool", "runRpcs", "Node " + result.node.nodename + " returns unknown result");
                                breakFor = true;
                                break;
                        }
                    }
                }
            } catch (error: any) {
                errorNodes.push(result.node.nodename);
                returnError = this.sError("postScanAndFixPool", "runRpcs", error.toString());
            }
            if (breakFor === true) { break; }

        }
        // Something error => need attension
        core.i.lib.disableAbnormalNodes(core.i, errorNodes);
        if (returnError !== undefined) {
            core.serializationLocks.postScanAndFixBlock = false;
            return returnError;
        }
        
        // Eliminate duplicate acquisitions
        let uniquedTxMap = new Map();
        for (const lackingTx of lackingTxs) {
            uniquedTxMap.set(lackingTx, true);
        }
        const uniqedTxArr: objTx[] = Array.from(uniquedTxMap.keys());
        LOG("Debug", "uniqedTxArr");
        LOG("Debug", JSON.stringify(uniqedTxArr));

        if (uniqedTxArr.length === 0) {
            LOG("Notice", "postScanAndFixPool:local pool is clean against remote pools.");
            core.serializationLocks.postScanAndFixPool = false;
            return this.sOK<boolean>(true);
        } else {
            LOG("Notice", "Detected some transmitted transactions on remote pools are not found on this node. It should be fixed.");
            if (options?.scanonly === true) {
                core.serializationLocks.postScanAndFixPool = false;
                return this.sOK<boolean>(false);
            } else {
                LOG("Notice", "postScanAndFixPool:syncing with local pool and remote pools: ", {lf: false});
            }
        }

        // Add missing amount
        if (core.d !== undefined) {
            let pArr: Promise<gResult<poolResultObject, gError>>[] = [];
            let failcnt = 0;
            for (const tx of uniqedTxArr) {
                pArr.push(core.d.lib.setPoolNewData(core.d, tx, core.conf.administration_id));
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
                LOG("Error", "Some data has not been added to the pool.");
                core.serializationLocks.postScanAndFixPool = false;
                return this.sError("postScanAndFixPool", "setPoolNewData", "Some data has not been added to the pool.");
            } else {
                LOG("Notice", "OK.");
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
     * @param tenantId - can be set tenantId. If undefined, it is considered set if default_tenant_id is allowed and an error if it is not. To get a value across tenants, you must specify the administration_id for this node.
     * @returns returns with gResult, that is wrapped by a Promise, that contains transactions if it's success, and gError if it's failure.
     */
    public async requestToExaminePoolDifference(core: ccSystemType, examineList: string[], tenantId?: string): Promise<gResult<objTx[], gError>> {
        const LOG = core.log.lib.LogFunc(core.log, "System", "requestToExaminePoolDifference");
        LOG("Info", "start");

        if (tenantId === undefined) { tenantId = core.conf.default_tenant_id; }

        const ret = await this.examinePoolDifference(core, examineList, tenantId);
        if (ret.isFailure()) return ret;
        return this.sOK<objTx[]>(ret.value);
    }
    /**
     * Examine the difference of pools between the list and this node.
     * @param core - set ccSystemType
     * @param examineList - set the list to be examined
     * @param tenantId - can be set tenantId. If undefined, it is considered set if default_tenant_id is allowed and an error if it is not. To get a value across tenants, you must specify the administration_id for this node.
     * @returns returns with gResult, that is wrapped by a Promise, that contains transactions if it's success, and gError if it's failure.
     */
    public async examinePoolDifference(core: ccSystemType, examineList: string[], tenantId?: string): Promise<gResult<objTx[], gError>> {
        const LOG = core.log.lib.LogFunc(core.log, "System", "examinePoolDifference");
        LOG("Info", "start");

        if (core.m === undefined) {
            return this.sError("examinePoolDifference", "getAllPool", "The main module is down");
        }

        const ret = await core.m.lib.getAllPool(core.m, { tenant: tenantId });
        if (ret.isFailure()) return ret;
        let txArr = ret.value;
        for (const id of examineList) {
            txArr = txArr.filter((tx: any) => {
                return (JSON.stringify(tx._id.toString()).split('"')[1] !== id)
            })
        }
        LOG("Debug", "TxArr" + JSON.stringify(txArr));
        return this.sOK<objTx[]>(txArr);
    }

    /**
     * Force syncing read caches of pool and block.
     * @param core - set ccSystemType
     * @returns  returns with gResult, that is wrapped by a Promise, that contains void if it's success, and gError if it's failure.
     * So there is no need to check the value of success.
     */
    public async postSyncCaches(core: ccSystemType): Promise<gResult<void, gError>> {
        const LOG = core.log.lib.LogFunc(core.log, "System", "postSyncCaches");
        LOG("Info", "start");

        if (core.d !== undefined) {
            const ret1 = await core.d.lib.setPoolNewData(core.d, undefined, core.conf.administration_id);
            if (ret1.isFailure()) return ret1;
            const ret2 = await core.d.lib.setBlockNewData(core.d, undefined, core.conf.administration_id);
            if (ret2.isFailure()) return ret2;
            if ((ret1.isSuccess()) && (ret2.isSuccess())) {
                if ((ret1.value.status !== 0) || (ret2.value.status !== 0)) {
                    LOG("Warning", "Syncing read cache failed")
                    return this.sError("postSyncCaches", "setNewData", "Syncing read cache failed");
                }
            }
        } else {
            return this.sError("postSyncCaches", "setNewData", "The datastore module is down");
        }

        return this.sOK<void>(undefined);
    }

    /**
     * Initialize one new parcel for the new tenant.
     * @param core - set ccSystemType instance
     * @param options - set options by postOpenParcelOptions
     * @returns returns new parcel ID.
     */
    public async postOpenParcel(core: ccSystemType, options: postOpenParcelOptions): Promise<gResult<string, gError>> {
        const LOG = core.log.lib.LogFunc(core.log, "System", "postOpenParcel");
        LOG("Info", "start");

        if (options.adminId !== core.conf.administration_id) {
            return this.sError("postOpenParcel", "Check adminId", "The administration_id is required to create a new parcel");
        }
        if ((options.recallPhrase === undefined) || (options.recallPhrase === "")) {
            return this.sError("postOpenParcel", "Check recallPhrase", "A valid recall phrase must be specified");
        }

        if (core.b === undefined) {
            return this.sError("postOpenParcel", "createBlock", "The block module is down");
        }
        const blockOptions: createBlockOptions = { type: "parcel_open" };

        if (core.m === undefined) return this.sError("postOpenParcel", "getSearchByJson", "The main module is down");
        let newId: `${string}-${string}-${string}-${string}-${string}`;
        while (true) {
            newId = randomUUID(); // Critical at collision
            const ret1 = await core.m.lib.getSearchByJson(core.m, {key: "tenant", value: newId, tenant: core.conf.administration_id});
            if (ret1.isFailure()) return ret1;
            if (ret1.value.length === 0) break;
        }
        const dateTime = new Date();
        const data: objTx = {
            _id: randomOid().byStr(),
            type: "new",
            tenant: newId,
            settime: dateTime.toLocaleString(),
            deliveryF: true,
            data: { recallPhrase: options.recallPhrase }
        }

        let bObj: objBlock;
        const ret2 = await core.b.lib.createBlock(core.b, [ data ], newId, blockOptions);
        if (ret2.isFailure()) return ret2;
        if (ret2.value === undefined) { return this.sError("postOpenParcel", "createBlock", "undefined object"); };
        bObj = ret2.value;

        LOG("Notice", "New parcel that has id " + newId + " is created and enabled");

        this.refreshParcelList(core);

        return this.sOK(bObj.tenant);
    }

    /**
     * Disable one existing parcel to stop using by the tenant
     * @param core - set ccSystemType instance
     * @param adminId - set administration_id to disable
     * @param tenantId - set the tenantId to close
     * @returns returns with gResult, that is wrapped by a Promise, that contains void if it's success, and gError if it's failure.
     * So there is no need to check the value of success.
     */
    public async postCloseParcel(core: ccSystemType, options: postCloseParcelOptions): Promise<gResult<void, gError>> {
        const LOG = core.log.lib.LogFunc(core.log, "System", "postCloseParcel");
        LOG("Info", "start");

        if (options.adminId !== core.conf.administration_id) {
            return this.sError("postCloseParcel", "Check administration ID", "The administration_id is required to disable a parcel");
        }
        if ((options.tenantId === undefined) || (options.tenantId === "")) {
            return this.sError("postOpenParcel", "Check recallPhrase", "A valid tenantId must be specified");
        }

        if (core.b === undefined) {
            return this.sError("postCloseParcel", "createBlock", "The block module is down");
        }
        if (core.m === undefined) {
            return this.sError("postCloseParcel", "createBlock", "The main module is down");
        }
        const ret1 = await core.m.lib.getSearchByJson<objBlock>(core.m, { key: "type", value: "parcel_open", searchBlocks: true, tenant: options.tenantId });
        if (ret1.isFailure()) return ret1;
        console.log(ret1.value.length)
        let found = false;
        for (const blk of ret1.value) {
            if (blk.tenant === options.tenantId) found = true
        }
        if (found === false) {
            return this.sError("postCloseParcel", "Find target parcel", "Cannot find parcel with id " + options.tenantId);
        }

        const blockOptions: createBlockOptions = { type: "parcel_close" };
        const ret2 = await core.b.lib.createBlock(core.b, [], options.tenantId, blockOptions);
        if (ret2.isFailure()) return ret2;

        LOG("Notice", "SystemModule:postCloseParcel: the parcel that has id " + options.tenantId + " is disabled");
        
        this.refreshParcelList(core);

        return this.sOK(undefined);
    }

    /**
     * Refresh active parcel list to check enabled tenants
     * @param core - set ccSystemType instance
     * @returns returns with gResult, that is wrapped by a Promise, that contains void if it's success, and gError if it's failure.
     * So there is no need to check the value of success.
     */
    public async refreshParcelList(core: ccSystemType): Promise<gResult<void, gError>> {
        const LOG = core.log.lib.LogFunc(core.log, "System", "refreshParcelList");
        LOG("Info", "start");

        if (core.m === undefined) {
            return this.sError("postCloseParcel", "createBlock", "The main module is down");
        }
        const ret1 = await core.m.lib.getSearchByJson<objBlock>(core.m, { key: "type", value: "parcel_close" , searchBlocks: true, tenant: core.conf.administration_id });
        if (ret1.isFailure()) return ret1;
        const closeList: string[] = [];
        for (const blk1 of ret1.value) {
            closeList.push(blk1.tenant);
        }
        const ret2 = await core.m.lib.getSearchByJson<objBlock>(core.m, { key: "type", value: "parcel_open" , searchBlocks: true, tenant: core.conf.administration_id });
        if (ret2.isFailure()) return ret2;
        const openList: string[] = [];
        for (const blk2 of ret2.value) {
            if (closeList.includes(blk2.tenant) === false) openList.push(blk2.tenant);
        }

        core.activeTenants = openList;
        return this.sOK(undefined);
    }

    /**
     * Check specified parcel is active or not from the cache. It doesn't include default/system parcel.
     * @param core - set ccSystemType instance
     * @param tenantId - set the tenantId to check
     * @returns returns with gResult that contains boolean if it's success, and unknown if it's failure.
     * So there is no need to be concerned about the failure status.
     */
    public isOpenParcel(core: ccSystemType, tenantId: string): gResult<boolean, unknown> {
        const LOG = core.log.lib.LogFunc(core.log, "System", "isOpenParcel");
        LOG("Info", "start");

        for (const id of core.activeTenants) {
            if (id === tenantId) return this.sOK(true);
        }
        return this.sOK(false)
    }

}

