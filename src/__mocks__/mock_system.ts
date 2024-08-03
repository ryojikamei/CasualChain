/**
 * Copyright (c) 2024 Ryoji Kamei
 * Released under the MIT license
 * https://opensource.org/licenses/mit-license.php
 */

import { gResult, gSuccess, gFailure, gError } from "../utils";

import { ccSystemType, postScanAndFixOptions, examineHashes, examinedHashes, RUNTIME_MASTER_IDENTIFIER, DEFAULT_PARSEL_IDENTIFIER } from "../system";
import { systemConfigType } from "../config";
import { inDigestReturnDataFormat } from "../internode";
import { blockFormat } from "../block";
import { objTx } from "../datastore";
import { logMock } from "./mock_logger";
import { postGenesisBlockOptions } from "../system";
import { generateSamples } from "../__testdata__/generator";

export function sOK<T>(response: T): gResult<T, never> {
    return new gSuccess(response)
}

export function sError(func: string, pos?: string, message?: string): gResult<never, gError> {
    return new gFailure(new gError("system", func, pos, message));
}

export const systemConf: systemConfigType = {
    node_mode: "",
    events_internal: {
        postScanAndFixBlockMinInterval: 300,
        postScanAndFixPoolMinInterval: 300,
        postDeliveryPoolMinInterval: 300,
        postAppendBlocksMinInterval: 300
    }
}

export class SystemModuleMock {

    public init(): gResult<any, gError> {
        return sOK({
            lib: {
                registerAutoTasks(core: ccSystemType): gResult<void, unknown> {
                    return sOK(undefined)
                },
                async postDeliveryPool(core: ccSystemType): Promise<gResult<void, gError>> {
                    return sOK(undefined);
                },
                async requestToAddPool(core: ccSystemType, txArr: objTx[]): Promise<gResult<void, gError>> {

                    if ((txArr[0] !== undefined) && (txArr[0].hasOwnProperty("wrong") === true)) {
                        return sError("Error");
                    } else {
                        return sOK(undefined);
                    }
                },
                async postAppendBlocks(core: ccSystemType): Promise<gResult<void, gError>> {
                    return sOK(undefined);
                },
                async requestToAddBlock(core: ccSystemType, bObj: blockFormat, removeFromPool: boolean | undefined, trackingId?: string): Promise<gResult<void, gError>> {
                    if (bObj.size < 0) {
                        return sError("Error");
                    } else {
                        return sOK(undefined);
                    }
                },
                async postGenesisBlock(core: ccSystemType, options?: postGenesisBlockOptions): Promise<gResult<any, gError>> {
                    return sOK(undefined);
                },
                async requestToGetPoolHeight(core: ccSystemType): Promise<gResult<number, gError>> {
                    return sOK(0);
                },
                async requestToGetBlockHeight(core: ccSystemType): Promise<gResult<number, gError>> {
                    return sOK(1);
                },
                async requestToGetBlock(core: ccSystemType, oid: string, returnUndefinedIfFail: boolean | undefined): Promise<gResult<blockFormat | undefined, gError>> {
                    if (oid === "OK") {
                        const ret = await generateSamples();
                        return sOK(ret.blks.get("blk0"));
                    } else {
                        return sOK(undefined);
                    }
                },
                async postScanAndFixBlock(core: ccSystemType, options?: postScanAndFixOptions): Promise<gResult<boolean, gError>> {
                    return sOK(true);
                },
                async requestToGetLastHash(core: ccSystemType, tenantId?: string, failIfUnhealthy?: boolean): Promise<gResult<inDigestReturnDataFormat, gError>> {
                    if (failIfUnhealthy === true) { // for a flag
                        return sOK({ hash: "fake", height: 1 })
                    } else {
                        return sError("Error");
                    }
                },
                async requestToExamineBlockDifference(core: ccSystemType, examineList: examineHashes): Promise<gResult<examinedHashes, gError>> {
                    if (examineList[0]._id === "wrong") {
                        return sError("Error");
                    } else {
                        return sOK({ add: [], del: [] });
                    }
                },
                async postScanAndFixPool(core: ccSystemType, options?: postScanAndFixOptions): Promise<gResult<void, gError>> {
                    return sOK(undefined);
                },
                async requestToExaminePoolDifference(core: ccSystemType, examineList: string[]): Promise<gResult<objTx[], gError>> {
                    if (examineList[0] === "wrong") {
                        return sError("Error");
                    } else {
                        return sOK([]);
                    }
                },
                async examinePoolDifference(core: ccSystemType, examineList: string[]): Promise<gResult<objTx[], gError>> {
                    return sOK([]);
                },
                async postSyncCaches(core: ccSystemType): Promise<gResult<void, gError>> {
                    return sOK(undefined);
                },

                // unused stubs
                sOK<T>(response: T): gResult<T, never> {
                    return new gSuccess(response)
                },
                sError(func: string, pos?: string, message?: string): gResult<never, gError> {
                    return new gFailure(new gError("system", func, pos, message));
                },
                master_key: RUNTIME_MASTER_IDENTIFIER,
                common_parsel: DEFAULT_PARSEL_IDENTIFIER,
                init(any: any): gResult<any, unknown> { return sOK(undefined) },
                async removeFromPool(core: ccSystemType, txArr: objTx[]): Promise<gResult<void, gError>> { return sOK(undefined) },
                markDiagStatusWithChain(core: ccSystemType, diagArr: any[], highest_hash: string, status: number): gResult<any, unknown> { return sOK(undefined) },
                async checkHealthOfChainRecursive(core: ccSystemType, diagChain: any, startidx: number, highest_hash: string): Promise<gResult<any, gError>> { return sOK(undefined) },
                async reportHealthOfChain(core: ccSystemType, omitdetail?: boolean): Promise<gResult<any, gError>> { return sOK(undefined) },
                async obtainHealthyNodes(core: ccSystemType, localCondition: number): Promise<gResult<any, gError>> { return sOK(undefined) },
                collectTargetOidsRecursive(core: ccSystemType, diagChain: any, replaceOids: string[], searchkey?: string): gResult<any, gError> { return sOK(undefined) },
                async getNormalBlocksAsPossible(core: ccSystemType, oidList: string[], healthyNodes: any): Promise<gResult<any, gError>> { return sOK(undefined) },
                async repairFalsifiedChain(core: ccSystemType, diagChain: any, normalNodes: any): Promise<gResult<void, gError>> { return sOK(undefined) },
                async getLastHashAndHeight(core: ccSystemType, tenantId?: string, failIfUnhealthy?: boolean): Promise<gResult<any, gError>> { return sOK(undefined) },
                async getAllBlockHashes(core: ccSystemType, tenantId?: string): Promise<gResult<any, gError>> { return sOK(undefined) },
                async examineBlockDifference(core: ccSystemType, examineList: examineHashes, tenantId?: string): Promise<gResult<any, gError>> { return sOK(undefined) }
            },
            conf: systemConf,
            log: new logMock(),
            autoTasks: undefined,
            serializationLocks: {
                postDelivryPool: false,
                postAppendBlocks: false,
                postGenesisBlock: false,
                postScanAndFixBlock: false,
                postScanAndFixPool: false
            },
            d: undefined,
            i: undefined,
            b: undefined,
            m: undefined,
            e: undefined
        });
    }
}
