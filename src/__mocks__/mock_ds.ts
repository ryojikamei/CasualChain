/**
 * Copyright (c) 2024 Ryoji Kamei
 * Released under the MIT license
 * https://opensource.org/licenses/mit-license.php
 */

import { randomUUID } from "crypto"

import { gResult, gSuccess, gFailure, gError } from "../utils";

import { ccDsType, poolResultObject, blockResultObject, poolCursor, blockCursor, getPoolCursorOptions, getBlockCursorOptions } from "../datastore";
import { randomOid } from "../utils";
import { ObjectId, Condition } from "mongodb";
import { getBlockResult } from "../system";
import { objTx, objBlock } from "../datastore";
import { generateSamples } from "../__testdata__/generator";
import { cachedIoIterator } from "../datastore/ioiterator";

type Hints = {
    blockOidHint?: string,
    txOidHint?: string
}

function dOK<T>(response: T): gResult<T, never> {
    return new gSuccess(response)
}
function dError(func: string, pos?: string, message?: string): gResult<never, gError> {
    return new gFailure(new gError("block", func, pos, message));
}
let txOid: string;
let blockOid: string;

export class DsModuleMock {
    /**
     * Normal return method
     * @param response - response contents
     * @returns returns gSuccess instance contains response
     */
    private dOK<T>(response: T): gResult<T, never> {
        return new gSuccess(response)
    }
    /**
     * Abnormal return method
     * @param func - set the function/method name
     * @param pos - set the position in the func
     * @param message - set the error message
     * @returns returns gFailure instance contains gError instance
     */
    private dError(func: string, pos?: string, message?: string): gResult<never, gError> {
        return new gFailure(new gError("ds", func, pos, message));
    }


    constructor(hint?: Hints) {
        if (hint === undefined) {
            txOid = randomOid().byStr();
            blockOid = randomOid().byStr();
        } else {
            if (hint.txOidHint === undefined) {
                txOid = randomOid().byStr();
            } else {
                txOid = hint.txOidHint;
            }
            if (hint.blockOidHint === undefined) {
                blockOid = randomOid().byStr();
            } else {
                blockOid = hint.blockOidHint;
            }
        }
    }

    public async init(): Promise<gResult<any, gError>> {
        const ret = await generateSamples();
        return dOK({
            lib: {
                async cleanup(core: ccDsType): Promise<gResult<void, gError>> {
                    return dOK<void>(undefined);
                },
                async getPoolCursor(core: ccDsType, options: getPoolCursorOptions, __t?: string): Promise<gResult<poolCursor, gError>> {
                    const tx1 = ret.txs.get("tx1");
                    const tx2 = ret.txs.get("tx2");
                    if ((tx1 === undefined) || (tx2 === undefined)) return dError("getPoolCursor", "get", "unknown error");
                    const iter: cachedIoIterator<objTx> = new cachedIoIterator<objTx>([ tx1, tx2 ])
                    return dOK({session: undefined, cursor: iter});
                },
                async getBlockCursor(core: ccDsType, options: getBlockCursorOptions, __t?: string): Promise<gResult<blockCursor, gError>> {
                    const block0 = ret.blks.get("blk0");
                    if (block0 === undefined) return dError("getBlockCursor", "get", "unknown error");
                    const iter: cachedIoIterator<objBlock> = new cachedIoIterator<objBlock>([ block0 ]);
                    return dOK({session: undefined, cursor: iter});
                },
                async closeCursor(core: ccDsType, cursorSession: poolCursor | blockCursor): Promise<gResult<void, gError>> {
                    return dOK<void>(undefined);
                },
                async setPoolNewData(core: ccDsType, wObj: objTx | undefined, __t: string): Promise<gResult<poolResultObject, gError>> {
                    let cache: objTx[];
                    if (wObj === undefined) {
                        cache = [];
                    } else {
                        cache = [wObj];
                    }
                    const ret: poolResultObject = {
                        id: "",
                        status: 0,
                        cache: cache
                    }
                    return dOK<poolResultObject>(ret);
                },
                async setBlockNewData(core: ccDsType, wObj: objBlock | undefined, __t: string): Promise<gResult<blockResultObject, gError>> {
                    let cache: objBlock[];
                    if (wObj === undefined) {
                        cache = [];
                    } else {
                        cache = [wObj];
                    }
                    const ret: blockResultObject = {
                        id: "",
                        status: 0,
                        cache: cache
                    }
                    return dOK<blockResultObject>(ret);
                },
                async poolModifyReadsFlag(core: ccDsType, oids: string[], __t: string): Promise<gResult<void, gError>> {
                    return dOK(undefined);
                },
                async poolDeleteTransactions(core: ccDsType, oids: string[], __t: string): Promise<gResult<void, gError>> {
                    return dOK(undefined);
                },
                async blockUpdateBlocks(core: ccDsType, blocks: getBlockResult[], __t: string): Promise<gResult<void, gError>> {
                    return dOK(undefined);
                },
                async blockDeleteBlocks(core: ccDsType, oids: string[], __t: string): Promise<gResult<void, gError>> {
                    return dOK(undefined);
                }
            }
        })
    }
}