/**
 * Copyright (c) 2024 Ryoji Kamei
 * Released under the MIT license
 * https://opensource.org/licenses/mit-license.php
 */

import { gResult, gSuccess, gFailure, gError } from "../utils";
import { ccCommonIoType } from "../datastore";
import { getBlockResult } from "../system";
import { LogModule } from "../logger";
import { getPoolCursorOptions, poolCursor, getBlockCursorOptions, blockCursor, objTx, poolResultObject, objBlock, blockResultObject } from "../datastore";

import { randomUUID } from "crypto";
const rand = randomUUID();

function ioOK<T>(response: T): gResult<T, never> {
    return new gSuccess(response)
}

function ioError(func: string, pos?: string, message?: string): gResult<never, gError> {
    return new gFailure(new gError("mockio", func, pos, message));
}

export class IoSubModuleMock {
    private initFail: boolean;

    constructor(initFail?: boolean, returnFail?: boolean) {
        if (initFail !== undefined) {
            this.initFail = initFail;
        } else {
            this.initFail = false;
        };
    }

    public async init(): Promise<gResult<any, gError>> {
        if (this.initFail === true) return ioError("init", "mock", "turn the flag on");
        return ioOK({
            lib: {
                async cleanup(core: ccCommonIoType): Promise<gResult<void, gError>> {
                    if (core.conf.mongo_dbname === "returnError1") return ioError("mongodb:cleanup", "client", "Connection has not been established");
                    return ioOK<void>(undefined);
                },
                async poolModifyReadsFlag(core: ccCommonIoType, oids: string[], tenantId: string): Promise<gResult<void, gError>> {
                    return ioOK(undefined);
                },
                async poolDeleteTransactions(core: ccCommonIoType, oids: string[], tenantId: string): Promise<gResult<void, gError>> {
                    return ioOK(undefined);
                },
                async blockDeleteBlocks(core: ccCommonIoType, oids: string[], tenantId: string): Promise<gResult<void, gError>> {
                    if (core.conf.mongo_dbname === "returnError1") return ioError("blockDeleteBlocks", "blockDeleteByOid", "DB connection may be lost");
                    if (core.conf.mongo_dbname === "returnError2") return ioError("blockDeleteBlocks", "updateOne", "");
                    if (core.conf.mongo_dbname === "returnError3") return ioError("blockDeleteBlocks", "other", "");
                    return ioOK(undefined);
                },
                async blockUpdateBlocks(core: ccCommonIoType, blocks: getBlockResult[], tenantId: string): Promise<gResult<void, gError>> {
                    if (core.conf.mongo_dbname === "returnError1") return ioError("blockUpdateBlocks", "blockDeleteByOid", "DB connection may be lost");
                    if (core.conf.mongo_dbname === "returnError2") return ioError("blockUpdateBlocks", "updateOne", "");
                    if (core.conf.mongo_dbname === "returnError3") return ioError("blockUpdateBlocks", "other", "");
                    return ioOK(undefined);
                },
                async getPoolCursor(core:  ccCommonIoType, options?: getPoolCursorOptions, __t?: string): Promise<gResult<poolCursor, gError>> {
                    return ioOK({session: undefined, cursor: undefined});
                },
                async getBlockCursor(core: ccCommonIoType, options?: getBlockCursorOptions, __t?: string): Promise<gResult<blockCursor, gError>> {
                    if (core.conf.mongo_dbname === "returnError1") return ioError("getBlockCursor", "blockGetFromDbToCursor", "DB connection may be lost");
                    return ioOK({session: undefined, cursor: undefined});
                },
                async closeCursor(core: ccCommonIoType, cursorSession: poolCursor | blockCursor): Promise<gResult<void, gError>> {
                    return ioOK(undefined);
                },
                async setPoolNewData(core: ccCommonIoType, wObj: objTx | undefined, tenantId: string): Promise<gResult<poolResultObject, gError>> {
                    if (core.conf.mongo_dbname === "returnError1") return ioError("setPoolNewData", "Check tenant ID", "Transaction tenant ID does not match authorization ID to write")
                    return ioOK<poolResultObject>({id: "", status: 0, cache: []});
                },
                async setBlockNewData(core: ccCommonIoType, wObj: objBlock | undefined, tenantId: string): Promise<gResult<blockResultObject, gError>> {
                    if (core.conf.mongo_dbname === "returnError1") return ioError("setBlockNewData", "blockAppendToDb", "DB connection may be lost");
                    if (core.conf.mongo_dbname === "returnError2") return ioError("blockAppendToDb", "Check tenant ID", "There are blocks whose tenant IDs do not match those specified");
                    if (core.conf.mongo_dbname === "returnError3") return ioError("blockAppendToDb", "InsertAborted", "");
                    if (core.conf.mongo_dbname === "returnError4") return ioError("blockAppendToDb", "InsertException", "");
                    return ioOK<blockResultObject>({id: "", status: 0, cache: []});
                },
            },
            db: {},
            conf: { mongo_dbname: "returnOK" },
            log: new LogModule(),
        })
    }
}