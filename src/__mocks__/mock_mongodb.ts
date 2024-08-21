/**
 * Copyright (c) 2024 Ryoji Kamei
 * Released under the MIT license
 * https://opensource.org/licenses/mit-license.php
 */

import { InsertManyResult, ObjectId, Condition } from "mongodb";

import { gResult, gSuccess, gFailure, gError, randomOid } from "../utils";

import { dsConfigType } from "../config";
import { ccCommonIoType, objBlock, objTx, poolCursor, blockCursor } from "../datastore"
import { getBlockResult } from "../system"
import { ccDirectIoType } from "../datastore/directio";

export class BackendDbSubModuleMock {
    
    constructor() {}

    protected dbOK<T>(response: T): gResult<T, never> {
        return new gSuccess(response)
    }

    protected dbError(func: string, pos?: string, message?: string): gResult<never, gError> {
        return new gFailure(new gError("mongodb", func, pos, message));
    }
 
    public async init(conf: dsConfigType, closeTarget?: any): Promise<gResult<any, gError>> {
        if (conf.mongo_port > 0) {
            return this.dbOK({ client: "mongodb" });
        } else {
            return this.dbError("Error in mock_mongodb");
        }
    }

    public async cleanup(core: ccCommonIoType, client?: any): Promise<gResult<void, gError>> {
        if (core.conf.mongo_host === "returnError1") return this.dbError("mongodb:cleanup", "client", "Connection has not been established");
        if (core.conf.mongo_host === "returnError2") return this.dbError("mongodb:cleanup", "dropDatabase", "");
        return this.dbOK(undefined);
    }

    public async poolGetFromDbToCursor(core: ccDirectIoType, client: any, conf: dsConfigType, tenantId: string, sortOrder?: number, constrainedSize?: number): Promise<gResult<poolCursor, gError>> {
        if (core.conf.mongo_host === "returnError1") return this.dbError("poolGetFromDbToCursor", "sort", "The sortOrder value must be -1 or 1 or undefined");
        if (core.conf.mongo_host === "returnError2") return this.dbError("poolGetFromDbToCursor", "startSession", "");
        if (core.conf.mongo_host === "returnError3") return this.dbError("poolGetFromDbToCursor", "abortTransaction", "");
        if (core.conf.mongo_host === "returnError4") return this.dbError("poolGetFromDbToCursor", "commitTransaction", "");
        const fakeCursor: any = {
            [Symbol.asyncIterator](): any { 
                const nextValue: IteratorResult<string> = { done: true, value: undefined };
                const pNextValue = new Promise<IteratorResult<string>>((resolve, reject) => {
                    resolve(nextValue)
                });
                const pNextBool = new Promise<boolean>((resolve, result) => {
                    resolve(false)
                })
                return {
                    next(): Promise<IteratorResult<string>> { return pNextValue },
                    hasNext(): Promise<boolean> { return pNextBool}
                }
            }
        }
        return this.dbOK(fakeCursor);
    }

    public async blockGetFromDbToCursor(core: ccDirectIoType, client: any, conf: dsConfigType, tenantId: string, sortOrder?: number, constrainedSize?: number): Promise<gResult<blockCursor, gError>> {
        if (core.conf.mongo_host === "returnError1") return this.dbError("blockGetFromDbToCursor", "sort", "The sortOrder value must be -1 or 1 or undefined");
        if (core.conf.mongo_host === "returnError2") return this.dbError("blockGetFromDbToCursor", "startSession", "");
        if (core.conf.mongo_host === "returnError3") return this.dbError("blockGetFromDbToCursor", "abortTransaction", "");
        if (core.conf.mongo_host === "returnError4") return this.dbError("blockGetFromDbToCursor", "commitTransaction", "");
        const fakeCursor: any = {
            [Symbol.asyncIterator](): any { 
                const nextValue: IteratorResult<string> = { done: true, value: undefined };
                const pNextValue = new Promise<IteratorResult<string>>((resolve, reject) => {
                    resolve(nextValue)
                });
                const pNextBool = new Promise<boolean>((resolve, result) => {
                    resolve(false)
                })
                return {
                    next(): Promise<IteratorResult<string>> { return pNextValue },
                    hasNext(): Promise<boolean> { return pNextBool}
                }
            }
        }
        return this.dbOK(fakeCursor);
    }

    public async closeCursor(core: ccCommonIoType, session: any): Promise<gResult<void, unknown>> {

        return this.dbOK<void>(undefined);
    }

    public async poolAppendToDb(core: ccCommonIoType, client: any, conf: dsConfigType, 
        wcache: objTx[], tenantId: string, retryWithNonExistent?: boolean): Promise<gResult<InsertManyResult, gError>> {
        if (core.conf.mongo_host === "returnError1") return this.dbError("poolAppendToDb", "Check tenant ID", "There are transactions whose tenant IDs do not match those specified");
        if (core.conf.mongo_host === "returnError2") return this.dbError("poolAppendToDb", "InsertAborted", "");
        if (core.conf.mongo_host === "returnError3") return this.dbError("poolAppendToDb", "InsertException", "");
        
        const ret: InsertManyResult = {
            acknowledged: true,
            insertedCount: 1,
            insertedIds: { 1: randomOid().byObj() } 
        }
        return this.dbOK(ret);
    }

    public async blockAppendToDb(core: ccCommonIoType, client: any, conf: dsConfigType, 
        wcache: objBlock[], tenantId: string): Promise<gResult<InsertManyResult, gError>> {
        if (core.conf.mongo_host === "returnError1") return this.dbError("blockAppendToDb", "Check tenant ID", "There are transactions whose tenant IDs do not match those specified");
        if (core.conf.mongo_host === "returnError2") return this.dbError("blockAppendToDb", "InsertAborted", "");
        if (core.conf.mongo_host === "returnError3") return this.dbError("blockAppendToDb", "InsertException", "");
        
        const ret: InsertManyResult = {
            acknowledged: true,
            insertedCount: 1,
            insertedIds: { 1: randomOid().byObj() } 
        }
        return this.dbOK(ret);
    }

    public async poolUpdateFlagsByOid(core: ccCommonIoType, client: any, conf: dsConfigType, oids: string[], tenantId: string): Promise<gResult<void, gError>> {
        if (core.conf.mongo_host === "returnError1") return this.dbError("poolUpdateFlagsByOid", "updateOne", "");
        if (core.conf.mongo_host === "returnError2") return this.dbError("poolUpdateFlagsByOid", "other", "");
        return this.dbOK(undefined);
    }

    public async poolDeleteByOid(core: ccCommonIoType, client: any, conf: dsConfigType, oids: string[], tenantId: string): Promise<gResult<void, gError>> {
        if (core.conf.mongo_host === "returnError1") return this.dbError("poolDeleteByOid", "updateOne", "");
        if (core.conf.mongo_host === "returnError2") return this.dbError("poolDeleteByOid", "other", "");
        return this.dbOK(undefined);
    }

    public async blockDeleteByOid(core: ccCommonIoType, client: any, conf: dsConfigType, oids: string[], tenantId: string): Promise<gResult<void, gError>> {
        if (core.conf.mongo_host === "returnError1") return this.dbError("blockDeleteByOid", "updateOne", "");
        if (core.conf.mongo_host === "returnError2") return this.dbError("blockDeleteByOid", "other", "");
        return this.dbOK(undefined);
    }

    public async blockReplaceByBlocks(core: ccCommonIoType, client: any, conf: dsConfigType, blockResults: getBlockResult[], tenantId: string): Promise<gResult<void, gError>> {
        if (core.conf.mongo_host === "returnError1") return this.dbError("blockDeleteByOid", "updateOne", "");
        if (core.conf.mongo_host === "returnError2") return this.dbError("blockDeleteByOid", "other", "");
        return this.dbOK(undefined);
    }
}
