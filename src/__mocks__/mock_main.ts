/**
 * Copyright (c) 2024 Ryoji Kamei
 * Released under the MIT license
 * https://opensource.org/licenses/mit-license.php
 */

import { randomUUID } from "crypto"

import { gResult, gSuccess, gFailure, gError } from "../utils";

import { ccMainType, getAllBlockOptions, getBlockOptions, getJsonOptions, getTransactionHeightOptions, getTransactionOptions, getTransactionOrBlockOptions, postJsonOptions } from "../main";
import { mainConfigType } from "../config";
import { objBlock, objTx } from "../datastore";

import { blockFormat } from "../block";
import { LogModule } from "../logger";
import { generateSamples } from "../__testdata__/generator";

function mOK<T>(response: T): gResult<T, never> {
    return new gSuccess(response)
}

function mError(func: string, pos?: string, message?: string): gResult<never, gError> {
    return new gFailure(new gError("main", func, pos, message));
}

const testId = randomUUID();

const MainConf: mainConfigType = {
    default_tenant_id: testId
}

export class MainModuleMock {
    constructor() {}

    public async init(): Promise<gResult<any, gError>> {
        const ret = await generateSamples(testId);
        const tx1 = ret.txs.get("tx1");
        const tx2 = ret.txs.get("tx2");
        const tx3 = ret.txs.get("tx3");
        const block0 = ret.blks.get("blk0");
        if ((tx1 === undefined) || (tx2 === undefined) || (tx3 === undefined) || (block0 === undefined)) {
            return mError("init", "get", "unknown error");
        }
        return mOK({
            lib: {
                async getAllDeliveredPool(core: ccMainType, options?: getTransactionOptions): Promise<gResult<objTx[], gError>> {
                    const txs = [tx1, tx2];
                    return mOK(txs);
                },
                async getAllUndeliveredPool(core: ccMainType, options?: getTransactionOptions): Promise<gResult<objTx[], gError>> {
                    const txs = [tx3];
                    return mOK(txs);
                },
                async getAllPool(core: ccMainType, options?: getTransactionOptions): Promise<gResult<objTx[], gError>> {
                    const txs = [tx1, tx2, tx3];
                    return mOK(txs);
                },
                async getAllBlock(core: ccMainType, options?: getAllBlockOptions): Promise<gResult<objBlock[] | objTx[], gError>> {
                    if ((options !== undefined) && (options?.bareTransaction === true)) {
                        const txs: any[] = [];
                        return mOK(txs);
                    } else {
                        const txs = [block0];
                        return mOK(txs);
                    }
                },
                async getAll(core: ccMainType, options?: getTransactionOptions): Promise<gResult<objTx[], gError>> {
                    const txs = [tx1, tx2, tx3];
                    return mOK(txs);
                },
                async getLastBlock(core: ccMainType, options?: getBlockOptions): Promise<gResult<blockFormat, gError>> {
                    return mOK(block0);
                },
                async getSearchByOid<T>(core: ccMainType, oid: string, options?: getTransactionOrBlockOptions): Promise<gResult<T | undefined, gError>> {
                    if (oid === "notFoundSample0000000000") {
                        return mOK(undefined);
                    } else {
                        let tx: any;
                        if ((options !== undefined) && (options.targetIsBlock === true)) {
                            tx = block0;
                        } else {
                            tx = tx3;
                        }
                        return mOK(tx);
                    }
                },
                async getSearchByJson(core: ccMainType, options: getJsonOptions): Promise<gResult<objTx[], gError>> {
                    if (options.key === "notFoundSample") {
                        return mOK([]);
                    } else {
                        const txs = [tx3];
                        return mOK(txs);
                    }
                },
                async postByJson(core: ccMainType, wObj: any, options?:postJsonOptions): Promise<gResult<string, gError>> {
                    return mOK(tx3._id);
                },
                async getHistoryByOid(core: ccMainType, oid: string, options?: getTransactionOptions): Promise<gResult<objTx[], gError>> {
                    if (oid === "notFoundSample0000000000") {
                        return mOK([]);
                    } else {
                        const txs = [tx3];
                        return mOK(txs);
                    }
                },
                async getTransactionHeight(core: ccMainType, options?: getTransactionHeightOptions): Promise<gResult<number, gError>> {
                    return mOK(1);
                },
            },
            conf: MainConf,
            status: 0,
            log: new LogModule(),
            d: undefined
        });
    }
}
