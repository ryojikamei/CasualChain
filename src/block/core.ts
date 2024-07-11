/**
 * Copyright (c) 2024 Ryoji Kamei
 * Released under the MIT license
 * https://opensource.org/licenses/mit-license.php
 */

import clone from "clone";

import { gResult, gSuccess, gFailure, gError } from "../utils.js";

import { blockConfigType, ccConfigType } from "../config/index.js";
import { ccLogType } from "../logger/index.js";
import { ccBlockType, createBlockOptions, blockFormat } from "./index.js";
import { objTx } from "../datastore/index.js";
import { ccSystemType } from "../system/index.js";
//import { ccInType } from "../internode/index.js";
import { ccInTypeV2 } from "../internode/v2_index.js";
import { ccKeyringType } from "../keyring/index.js";
import { ccMainType } from "../main/index.js";
import { randomUUID } from "crypto";
import { Ca3ReturnFormat } from "./algorithm/ca3.js";
import { moduleCondition } from "../index.js";

/**
 * The BlockModule, to create blocks with a certain algorithm
 */
export class BlockModule {
    /**
     * Normal return method
     * @param response - response contents
     * @returns returns gSuccess instance contains response
     */
    protected bOK<T>(response: T): gResult<T, never> {
        return new gSuccess(response)
    }
    /**
     * Abnormal return method
     * @param func - set the function/method name
     * @param pos - set the position in the func
     * @param message - set the error message
     * @returns returns gFailure instance contains gError instance
     */
    protected bError(func: string, pos?: string, message?: string): gResult<never, gError> {
        return new gFailure(new gError("block", func, pos, message));
    }

    /**
     * Inter-class variable to set module condition
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
     * Initialize the BlockModule.
     * @param conf - set blockConfigType instance
     * @param log - set ccLogType instance
     * @param systemInstance - can set ccSystemType instance
     * @param internodeInstance - can set ccInType instance
     * @param keyringInstance - can set ccKeyring instance
     * @param mainInstance - can set ccMainType instance
     * @param configInstance - can set ccConfigType instance
     * @param algorithmFile - can set algorithm file to import
     * @returns returns with gResult, that is wrapped by a Promise, that contains ccBlockType if it's success, and gError if it's failure.
     */
    public async init(conf: blockConfigType, log: ccLogType, systemInstance?: ccSystemType, 
        internodeInstance?: ccInTypeV2, keyringInstance?: ccKeyringType, mainInstance?: 
        ccMainType, configInstance?: ccConfigType, algorithmFile?: string): Promise<gResult<ccBlockType, gError>> {

        this.coreCondition = "loading"
        let core: ccBlockType = {
            lib: new BlockModule(),
            algorithm: undefined,
            conf: conf,
            log: log,
            i: internodeInstance ?? undefined,
            s: systemInstance ?? undefined,
            k: keyringInstance ?? undefined,
            m: mainInstance ?? undefined,
            c: configInstance ?? undefined
        }

        const LOG = core.log.lib.LogFunc(core.log);
        LOG("Info", 0, "BlockModule:init");

        if (algorithmFile === undefined) {
            algorithmFile = "../../dist/block/algorithm/ca3.js";
        }

        try {
            core.algorithm = await import(algorithmFile);
        } catch (error: any) {
            return this.bError("init", "importAlgorithm", error.toString());
        }

        this.coreCondition = "active";
        core.lib.coreCondition = this.coreCondition;
        return this.bOK<ccBlockType>(core);
    }

    /**
     * Restart this module
     * @param core - set ccBlockType instance
     * @param log - set ccLogType instance
     * @param i - set ccInType instance
     * @param k - set ccKeyringType instance
     * @param m - set ccMainType instance
     * @param s - set ccSystemType instance
     * @param c - set ccConfigType instance
     * @returns returns with gResult, that is wrapped by a Promise, that contains ccBlockType if it's success, and gError if it's failure.
     */
    public async restart(core: ccBlockType, log: ccLogType, i: ccInTypeV2, k: ccKeyringType,
        m: ccMainType, s: ccSystemType, c: ccConfigType): Promise<gResult<ccBlockType, gError>> {
        const LOG = log.lib.LogFunc(log);
        LOG("Info", 0, "BlockModule:restart");

        this.coreCondition = "unloaded";
        const ret1 = await this.init(core.conf, log);
        if (ret1.isFailure()) return ret1;
        const newCore: ccBlockType = ret1.value;
        // reconnect
        newCore.i = i;
        newCore.k = k;
        newCore.m = m;
        newCore.s = s;
        newCore.c = c;

        return this.bOK(newCore);
    }


    /**
     * The function for creating one new block from an array of transactions.
     * @param core - set ccSystemType instance
     * @param txArr - set the source for creating a block with a objPool[] instance
     * @param __t - in open source version, it must be equal to DEFAULT_PARSEL_IDENTIFIER
     * @param blockOptions - can set options with createBlockOptions format
     * @param commonId - in open source version, it must be undefined or equal to DEFAULT_PARSEL_IDENTIFIER
     * @returns returns with gResult, that is wrapped by a Promise, that contains the created block with blockFormat if it's success, and gError if it's failure.
     */
    public async createBlock(core: ccBlockType, txArr: objTx[], __t: string, blockOptions?: createBlockOptions, commonId?: string): Promise<gResult<blockFormat | undefined, gError>> {
        const LOG = core.log.lib.LogFunc(core.log);
        LOG("Info", 0, "BlockModule:createBlock");
        if (blockOptions === undefined) {
            blockOptions = { type: "data" }
        }

        let pObj: any = {};
        if (blockOptions.type !== "genesis") {
            if (core.m !== undefined) {
                const ret1 = await core.m.lib.getLastBlock(core.m);
                if (ret1.isFailure()) return ret1;
                if (ret1.value === undefined) {
                    return this.bError("createBlock", "getLastBlock" ,"getLastBlock returns empty block. It cannot proceed.");
                }
                pObj = ret1.value;
            } else {
                return this.bError("createBlock", "getLastBlock" ,"The system module is down");
            }
        }

        // Simplified timer
        // Since stable preemption is not expected, non-preemptive processing is used.
        let lifeTime: number = core.conf.ca3.minLifeTime;
        // On retransmission, the same packet will have the same tracking ID, but the timeout will be updated
        let trackingId: `${string}-${string}-${string}-${string}-${string}`
        while (true) {
            trackingId = randomUUID(); // Critical at collision
            if (core.algorithm.travelingIds[trackingId] === undefined) break;
        }
        let errDetail: string = "unknown reason";
        do {
            const currentTimeMs = new Date().valueOf();
            const lifeTimeMs = lifeTime * 1000;
            if ((core.algorithm.travelingIds[trackingId] === undefined) || 
            ((core.algorithm.travelingIds[trackingId] !== undefined) && 
            (core.algorithm.travelingIds[trackingId].timeoutMs <= currentTimeMs))) {
                core.algorithm.setupCreator(core, blockOptions.type, txArr, __t, currentTimeMs, lifeTimeMs, trackingId, commonId);
                const ret1: gResult<Ca3ReturnFormat, gError> = await core.algorithm.proceedCreator(core, pObj, txArr, trackingId, __t, blockOptions);
                if (ret1.isFailure()) {
                    if (ret1.value.origin.pos === "Timeout") {
                        lifeTime = lifeTime * 1.5;
                        if ((core.conf.ca3 !== undefined) && (lifeTime > core.conf.ca3.maxLifeTime)) {
                            lifeTime = core.conf.ca3.maxLifeTime;
                        }
                    } else {
                        LOG("Debug", 0, "BlockModule:createBlock:proceedCreator:" + JSON.stringify(ret1));
                        if (ret1.value.origin.detail !== undefined) { errDetail = ret1.value.origin.detail; }
                    }
                }
            }
        } while (core.algorithm.travelingIds[trackingId].state !== "arrived");
        if (core.algorithm.travelingIds[trackingId].stored === true) {
            const block = clone(core.algorithm.travelingIds[trackingId].block);
            core.algorithm.stopCreator(core, trackingId);
            LOG("Info", 0, "BlockModule:created a block with CA3:" + trackingId);
            return this.bOK<blockFormat>(block);
        } else {
            core.algorithm.stopCreator(core, trackingId);
            if (errDetail === "Already started") { // It's a common event.
                LOG("Notice", -1, "BlockModule:create a block with CA3 skipped: " + errDetail);
                return this.bOK<undefined>(undefined);
            } else {
                LOG("Error", -1, "BlockModule:create a block with CA3 failed: " + errDetail);
                return this.bError("createBlock", "proceedCreator", "create a block with CA3 failed:" + errDetail);
            }
        }
    }

    /**
     * Verify a block whether any malformed have been occurred or not.
     * @param core - set ccBlockType instance
     * @param bObj - set a block to be verified
     * @param trackingId - can be set a tracking ID to trace
     * @returns returns with gResult, that is wrapped by a Promise, that contains number if it's success, and gError if it's failure.
     * The success means the success to process the verification, so it also returns wrong block status. The status can be one of the following:
     * - -2: It is a wrong data (It might not be a block)
     * - -1: It is a wrong block
     * - 0: It is a clean block
     * - 3: It is a problematic block
     */
    public async verifyBlock(core: ccBlockType, bObj: blockFormat, trackingId?: string): Promise<gResult<number, gError>> {
        const LOG = core.log.lib.LogFunc(core.log);
        LOG("Info", 0, "BlockModule:verifyBlock");

        // return value must be sync with block_status in system module:
        const ret2: gResult<Ca3ReturnFormat, gError> = await core.algorithm.verifyABlock(core, bObj, trackingId);
        if (ret2.isFailure()) {
            if (ret2.value.origin.pos === "illegalData") return this.bOK<number>(-2);
            if (ret2.value.origin.pos === "illegalBlock") return this.bOK<number>(-1);
            return ret2;
        }
        if (ret2.value.status === 0) return this.bOK<number>(0);
        // Currently, the returning method does not support the location of the problem.
        // Actually ret2.value.status + ret2.value.detail can identify the last wrong node.
        return this.bOK<number>(3);
    }
}
