/**
 * Copyright (c) 2024 Ryoji Kamei
 * Released under the MIT license
 * https://opensource.org/licenses/mit-license.php
 */
import { randomUUID } from "crypto";
import { gResult, gSuccess, gFailure, gError } from "../utils";

import { ccSystemType, postScanAndFixOptions, examineHashes, examinedHashes } from "../system";
import { systemConfigType } from "../config";
import { inDigestReturnDataFormat } from "../internode";
import { blockFormat } from "../block";
import { objTx } from "../datastore";
import { logMock } from "./mock_logger";
import { postGenesisBlockOptions } from "../system";
import { generateSamples } from "../__testdata__/generator";
import { randomOid } from "../utils";

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
    },
    enable_default_tenant: true,
    administration_id: "8e921d59-00b4-48c2-9ed2-b9f2a90030d6",
    default_tenant_id: "a24e797d-84d1-4012-ba78-8882f2711f6c"
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
                        return sError("Error in mock_system");
                    } else {
                        return sOK(undefined);
                    }
                },
                async postAppendBlocks(core: ccSystemType): Promise<gResult<void, gError>> {
                    return sOK(undefined);
                },
                async requestToAddBlock(core: ccSystemType, bObj: blockFormat, removeFromPool: boolean | undefined, trackingId?: string): Promise<gResult<void, gError>> {
                    if (bObj.size < 0) {
                        return sError("Error in mock_system");
                    } else {
                        return sOK(undefined);
                    }
                },
                async postGenesisBlock(core: ccSystemType, options?: postGenesisBlockOptions): Promise<gResult<any, gError>> {
                    if (options?.trytoreset === true) {
                        return sError("postGenesisBlock", "cleanup", "failed")
                    } else {
                        const ret: blockFormat = {
                            _id: randomOid().byStr(),
                            version: 1,
                            tenant: systemConf.default_tenant_id,
                            height: 0,
                            size: 0,
                            settime: "1970/01/01 0:00:00",
                            timestamp: "0",
                            miner: "",
                            prev_hash: "0",
                            hash: "0"
                        }
                        return sOK(ret);
                    }
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
                        return sError("Error in mock_system");
                    }
                },
                async requestToExamineBlockDifference(core: ccSystemType, examineList: examineHashes): Promise<gResult<examinedHashes, gError>> {
                    if (examineList[0]._id === "wrong") {
                        return sError("Error in mock_system");
                    } else {
                        return sOK({ add: [], del: [] });
                    }
                },
                async postScanAndFixPool(core: ccSystemType, options?: postScanAndFixOptions): Promise<gResult<void, gError>> {
                    return sOK(undefined);
                },
                async requestToExaminePoolDifference(core: ccSystemType, examineList: string[]): Promise<gResult<objTx[], gError>> {
                    if (examineList[0] === "wrong") {
                        return sError("Error in mock_system");
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
                async postOpenParcel(core: ccSystemType, options: any): Promise<gResult<string, gError>> {
                    if (options.adminId === undefined) {
                        return sError("postOpenParcel", "Check adminId", "The administration_id is required to create a new parcel");
                    } else {
                        return sOK(randomUUID());
                    }
                },
                async postCloseParcel(core: ccSystemType, options: any): Promise<gResult<void, gError>> {
                    if (options.adminId === undefined) {
                        return sError("postCloseparcel", "Check administration ID", "The administration_id is required to disable a parcel");
                    } else {
                        return sOK(undefined);
                    }
                },
                async refreshParcelList(core: ccSystemType): Promise<gResult<void, gError>> {
                    return sOK(undefined);
                },
                isOpenParcel(core: ccSystemType, tenantId: string): gResult<boolean, unknown> {
                    if (tenantId === "") {
                        return sOK(false);
                    } else {
                        return sOK(true);
                    }
                },

                // unused stubs
                sOK<T>(response: T): gResult<T, never> {
                    return new gSuccess(response)
                },
                sError(func: string, pos?: string, message?: string): gResult<never, gError> {
                    return new gFailure(new gError("system", func, pos, message));
                },
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
