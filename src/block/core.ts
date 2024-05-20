/**
 * Copyright (c) 2024 Ryoji Kamei
 * Released under the MIT license
 * https://opensource.org/licenses/mit-license.php
 */

import { gResult, gSuccess, gFailure, gError } from "../utils.js";

import { blockConfigType } from "../config/index.js";
import { ccLogType } from "../logger/index.js";
import { ccBlockType, createBlockOptions, blockFormat } from "./index.js";
import { objTx } from "../datastore/index.js";
import { ccSystemType } from "../system/index.js";
import { ccInType } from "../internode/index.js";
import { ccKeyringType } from "../keyring/index.js";
import { ccMainType } from "../main/index.js";
import { randomUUID } from "crypto";
import { Ca3ReturnFormat } from "./algorithm/ca3.js";

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
     * Initialize the BlockModule.
     * @param conf - set blockConfigType instance
     * @param log - set ccLogType instance
     * @param systemInstance - can set ccSystemType instance
     * @param internodeInstance - can set ccInType instance
     * @param keyringInstance - can set ccKeyring instance
     * @param mainInstance - can set ccMainType instance
     * @param algorithmFile - can set algorithm file to import
     * @returns returns with gResult, that is wrapped by a Promise, that contains ccBlockType if it's success, and gError if it's failure.
     */
    public async init(conf: blockConfigType, log: ccLogType, systemInstance?: ccSystemType, 
        internodeInstance?: ccInType, keyringInstance?: ccKeyringType, mainInstance?: 
        ccMainType, algorithmFile?: string): Promise<gResult<ccBlockType, gError>> {

        let core: ccBlockType = {
            lib: new BlockModule(),
            algorithm: undefined,
            conf: conf,
            log: log,
            i: internodeInstance ?? undefined,
            s: systemInstance ?? undefined,
            k: keyringInstance ?? undefined,
            m: mainInstance ?? undefined
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

        return this.bOK<ccBlockType>(core);
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
    public async createBlock(core: ccBlockType, txArr: objTx[], __t: string, blockOptions?: createBlockOptions, commonId?: string): Promise<gResult<blockFormat, gError>> {
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
                        //return ret1;
                    }
                }
            }
        } while (core.algorithm.travelingIds[trackingId].finished === false);
        if (core.algorithm.travelingIds[trackingId].stored === true) {
            LOG("Info", 0, "BlockModule:created a block with CA3:" + trackingId);
            return this.bOK<blockFormat>(core.algorithm.travelingIds[trackingId].block);
        } else {
            LOG("Warning", -1, "BlockModule:create a block with CA3 failed");
            return this.bError("createBlock", "proceedCreator", "create a block with CA3 failed");
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
