/**
 * Copyright (c) 2024 Ryoji Kamei
 * Released under the MIT license
 * https://opensource.org/licenses/mit-license.php
 */

import clone from "clone"

import { gResult, gSuccess, gFailure, gError } from "../utils.js";

import { MongoClient, ClientSession, ObjectId, InsertManyResult, InsertOneResult, FindCursor, WithId, Document } from "mongodb"
import { dsConfigType } from "../config/index.js"

import { objTx, objBlock, poolCursor, blockCursor, ccCommonIoType } from "./index.js";
import { ccDirectIoType } from "./directio.js";
import { directIoIterator } from "./ioiterator.js";
import { getBlockResult } from "../system/index.js";
import { SignedBy } from "../block/algorithm/ca3.js";
import { RUNTIME_MASTER_IDENTIFIER } from "../system/index.js";

export type backendDbClient = MongoClient;

export const MAX_SAFE_PAYLOAD_SIZE = 15 * 1024 * 1024;

/**
 * DB insertion result type
 */
type dbInsertionResult = {
    status: number,
    result: InsertManyResult
}

/*export type backendDbSearchOptions = {
    oid?: string,
    type?: string,
    settime?: string,
    deliveryF?: boolean
}
*/
/*
const tOptions: TransactionOptions = {
    readPreference: 'primary',
    readConcern: { level: "local" },
    writeConcern: { w: 1 }
}
*/

/**
 * Low-level I/O modules at the deepest level
 */
export class BackendDbSubModule {
    /**
     * Normal return method
     * @param response - response contents
     * @returns returns gSuccess instance contains response
     */
    protected dbOK<T>(response: T): gResult<T, gError> {
        return new gSuccess(response)
    }
    /**
     * Abnormal return method
     * @param func - set the function/method name
     * @param pos - set the position in the func
     * @param message - set the error message
     * @returns returns gFailure instance contains gError instance
     */
    protected dbError(func: string, pos?: string, message?: string): gResult<any, gError> {
        return new gFailure(new gError("mongodb", func, pos, message));
    }

    /**
     * Stub values for features not supported in the open source version
     */
    protected master_key: string
    constructor() {
        this.master_key = RUNTIME_MASTER_IDENTIFIER;
    }

    /**
     * Connect to mongodb backend datastore.
     * @param conf - set dsConfigType instance
     * @param closeTarget - can set MongoClient instance to close first
     * @returns returns with gResult, that is wrapped by a Promise, that contains MongoClient if it's success, and gError if it's failure.
     */
    public async init(conf: dsConfigType, closeTarget?: MongoClient): Promise<gResult<MongoClient, gError>> {
        try {
            if (closeTarget !== undefined) await closeTarget.close();
        } catch (error) {
            // failed to close. it's OK
        }
        if (conf.mongo_port === -1) {
            conf.mongo_port = Number(process.env.MONGO_MS_PORT);
        }

        const uri =
            "mongodb://" + conf.mongo_dbuser + ":" + conf.mongo_password + "@" 
            + conf.mongo_host + ":" + conf.mongo_port + "/" + conf.mongo_dbname;
        let client: MongoClient;
        try {
            client = await MongoClient.connect(uri, {authSource : conf.mongo_authdb});
        } catch (error: any) {
            return this.dbError("db_init", "connect", error.toString());
        }
        return this.dbOK<MongoClient>(client);
    }

    /**
     * Force to clear mongodb database. Mainly used for tests.
     * @param core - set ccDirectIoType or ccCachedIoType instance
     * @param client - can inject MongoClient instance
     * @returns returns with gResult, that is wrapped by a Promise, that contains void if it's success, and gError if it's failure.
     */
    public async cleanup(core: ccCommonIoType, client?: MongoClient): Promise<gResult<void, gError>> {
        const LOG = core.log.lib.LogFunc(core.log);
        LOG("Info", 0, "mongodb:cleanup");

        if (client === undefined) {
            return this.dbError("mongodb:cleanup", "client", "Connection has not been established");
        }
        try {
            await client.db().dropDatabase();
        } catch (error: any) {
            return this.dbError("mongodb:cleanup", "dropDatabase", error.toString());
        }
        return this.dbOK<void>(undefined);
    }

    /**
     * Get a cursor of pool collection data to read.
     * @param core - set ccDirectIoType instance
     * @param client - set MongoClient instance
     * @param conf - set dsConfigType instance
     * @param __t - in open source version, it must be equal to DEFAULT_PARSEL_IDENTIFIER
     * @param sortOrder - can set -1 for descending order, 1 for ascending order
     * @returns returns with gResult, that is wrapped by a Promise, that contains objPool[] if it's success, and gError if it's failure.
     */
    public async poolGetFromDbToCursor(core: ccDirectIoType, client: MongoClient, conf: dsConfigType, __t: string, sortOrder?: number, constrainedSize?: number): Promise<gResult<poolCursor, gError>> {
        const LOG = core.log.lib.LogFunc(core.log);
        LOG("Info", 0, "mongodb:poolGetFromDbToCursor");

        if ((sortOrder !== undefined) && ((sortOrder !== -1) && (sortOrder !== 1))) {
            return this.dbError("poolGetFromDbToCursor", "sort", "The sortOrder value must be -1 or 1 or undefined");
        }

        let session: ClientSession;
        try {
            session = client.startSession();
        } catch (error: any) {
            return this.dbError("poolGetFromDbToCursor", "startSession", error.toString());
        }
        try {
            let cur: FindCursor<WithId<Document>> | undefined;
            await session.withTransaction(async () => {
                const dbObj = client.db();
                const pool = dbObj.collection(conf.mongo_poolcollection);
                if ((__t !== this.master_key) && (sortOrder !== undefined)) {
                    cur = pool.find({ tenant: __t }).sort("_id", sortOrder);
                } else if ((__t !== this.master_key) && (sortOrder === undefined)) {
                    cur = pool.find({ tenant: __t });
                } else if ((__t === this.master_key) && (sortOrder !== undefined)) {
                    cur = pool.find({}).sort("_id", sortOrder);
                } else { // __t === this.master_key, sortOrder === undefined
                    cur = pool.find({});
                }
            })
            await session.commitTransaction();
            const ret: poolCursor = {
                cursor: cur ? new directIoIterator<objTx>(cur, constrainedSize): undefined,
                session: session
            }
            return this.dbOK<poolCursor>(ret);
        } catch (error: any) {
            try {
                await session.abortTransaction();
            } catch (error: any) {
                return this.dbError("poolGetFromDbToCursor", "abortTransaction", error.toString());
            }
            return this.dbError("poolGetFromDbToCursor", "commitTransaction", error.toString());
        }
    }
    
    /**
     * Get a cursor of specified __t from block collection data to read.
     * @param core - set ccDirectIoType instance
     * @param client - set MongoClient instance
     * @param conf - set dsConfigType instance
     * @param __t - in open source version, it must be equal to DEFAULT_PARSEL_IDENTIFIER
     * @param sortOrder - can set -1 for descending order, 1 for ascending order
     * @returns returns with gResult, that is wrapped by a Promise, that contains objBlock[] if it's success, and gError if it's failure.
     */
    public async blockGetFromDbToCursor(core: ccDirectIoType, client: MongoClient, conf: dsConfigType, __t: string, sortOrder?: number, constrainedSize?: number): Promise<gResult<blockCursor, gError>> {
        const LOG = core.log.lib.LogFunc(core.log);
        LOG("Info", 0, "mongodb:blockGetFromDbToCursor");

        if ((sortOrder !== undefined) && ((sortOrder !== -1) && (sortOrder !== 1))) {
            return this.dbError("blockGetFromDbToCursor", "sort", "The sortOrder value must be -1 or 1 or undefined");
        }

        let session: ClientSession;
        try {
            session = client.startSession();
        } catch (error: any) {
            return this.dbError("blockGetFromDbToCursor", "startSession", error.toString());
        }
        try {
            let cur: FindCursor<WithId<Document>> | undefined;
            await session.withTransaction(async () => {
                const dbObj = client.db();
                const blocks = dbObj.collection(conf.mongo_blockcollection);
                if ((__t !== this.master_key) && (sortOrder !== undefined)) {
                    cur = blocks.find({ tenant: __t }).sort("_id", sortOrder);
                } else if ((__t !== this.master_key) && (sortOrder === undefined)) {
                    cur = blocks.find({ tenant: __t });
                } else if ((__t === this.master_key) && (sortOrder !== undefined)) {
                    cur = blocks.find({}).sort("_id", sortOrder);
                } else { // __t === this.master_key, sortOrder === undefined
                    cur = blocks.find({});
                }
            })
            await session.commitTransaction();
            const ret: blockCursor = {
                cursor: cur ? new directIoIterator<objBlock>(cur, constrainedSize): undefined,
                session: session
            }
            return this.dbOK<blockCursor>(ret);
        } catch (error: any) {
            try {
                await session.abortTransaction();
            } catch (error: any) {
                return this.dbError("blockGetFromDbToCursor", "abortTransaction", error.toString());
            }
            return this.dbError("blockGetFromDbToCursor", "commitTransaction", error.toString());
        }
    }

    /**
     * Close cursor's session
     * @param core - set ccDirectIoType or ccCachedIoType instance
     * @param session - set session to close
     * @returns returns with gResult, that is wrapped by a Promise, that contains void if it's success, and unknown if it's failure.
     * So there is no need to check the value of success, and there is no need to be concerned about the failure status also.
     */
    public async closeCursor(core: ccCommonIoType, session: ClientSession): Promise<gResult<void, unknown>> {
        const LOG = core.log.lib.LogFunc(core.log);
        LOG("Info", 0, "mongodb:closeCursor");

        await session.endSession(); // endSession won't throw any errors

        return this.dbOK<void>(undefined);
    }

    /**
     * Convert _id string to ObjectId object
     * @param objs - set objects with _id
     * @returns returns converted objects
     */
    private convIdStrToObjectId(objs: any[]): any[] {

        const convObjs = clone(objs);
        for (const convObj of convObjs) {
            //convObj._id = new ObjectId(convObj._id);
            convObj._id = ObjectId.createFromHexString(convObj._id);
        }
        return convObjs;
    }

    /**
     * Transfer pool data to the collection on db.
     * @param core - set ccDirectIoType or ccCachedIoType instance
     * @param client - set MongoClient instance
     * @param conf - set dsConfigType instance
     * @param wcache - source of data to transfer. set objTx_in[] instance
     * @param __t - in open source version, it must be equal to DEFAULT_PARSEL_IDENTIFIER
     * @param retryWithNonExistent - recommend to set true to care rare cases
     * @returns returns with gResult, that is wrapped by a Promise, that contains InsertManyResult if it's success, and gError if it's failure.
     */
    public async poolAppendToDb(core: ccCommonIoType, client: MongoClient, conf: dsConfigType, 
        wcache: objTx[], __t: string, retryWithNonExistent?: boolean): Promise<gResult<InsertManyResult, gError>> {
        // Investigation is needed whether retry is needed or not
        const LOG = core.log.lib.LogFunc(core.log);
        LOG("Info", 0, "mongodb:poolAppendToDb");

        let res: dbInsertionResult = {
            status: 0,
            result: {
                acknowledged: false,
                insertedCount: 0,
                insertedIds: {}
            }
        }
        if (retryWithNonExistent === undefined) retryWithNonExistent = false;

        if (__t !== this.master_key) {
            for (const tx of wcache) {
                if (tx.tenant !== __t) {
                    return this.dbError("poolAppendToDb", "Check tenant ID", "There are transactions whose tenant IDs do not match those specified");
                }
            }
        }

        let errPos: string = "";
        let errDetail: string = "";
        const session: ClientSession = client.startSession();
        await session.withTransaction(async () => {
            const dbObj = client.db();
            const pool = dbObj.collection(conf.mongo_poolcollection);
            LOG("Debug", 0, "mongodb:poolAppendToDb:insertMany:" + JSON.stringify(this.convIdStrToObjectId(wcache)));
            await pool.insertMany(this.convIdStrToObjectId(wcache))
            .then((result: InsertManyResult) => {
                session.commitTransaction();
                res.status = 0;
                res.result = result;
            })
            .catch((reason) => {
                session.abortTransaction();
                res.status--;
                errPos = "InsertAborted"
                errDetail = reason.toString();
                LOG("Debug", 0, "mongodb:poolAppendToDb:insertMany:" + errDetail);
            })
        }).catch((error: any) => {
            res.status--;
            errPos = "InsertException"
            errDetail = error.toString();
        });
        if ((retryWithNonExistent == true) && (res.status !== 0)) { // rare case. retry to insert only records with non-conflicting oids
            console.log("Some insertion failed. Retrying...");
            res.status = 0; // reset
            await session.withTransaction(async () => {
                const dbObj = client.db();
                const pool = dbObj.collection(conf.mongo_poolcollection);
                let wObj: objTx;
                let skipcnt: number = 0;
                let insertcnt: number = 0;
                for (wObj of wcache) {
                    await pool.insertOne(this.convIdStrToObjectId([wObj])[0])
                    .then((ret: InsertOneResult) => {
                        res.result.insertedCount++;
                        res.result.insertedIds[res.result.insertedCount] = ret.insertedId;
                        insertcnt++;
                    }).catch(() => {
                        skipcnt++;
                    });
                }   
                session.commitTransaction();
                console.log("Retry: Insert count: " + insertcnt);
                console.log("Retry: Skip count: " + skipcnt);
            }).catch((reason) => {
                session.abortTransaction();
                res.status = -1;
            });
            
        }
        await session.endSession();

        if (res.status === 0) {
            return this.dbOK<InsertManyResult>(res.result);
        } else {
            return this.dbError("poolAppendToDb", errPos, errDetail);
        }
    }
    
    /**
     * Transfer block data to the collection on db.
     * @param core - set ccDirectIoType or ccCachedIoType instance
     * @param client - set MongoClient instance
     * @param conf - set dsConfigType instance
     * @param wcache - source of data to transfer. set objBlock[] instance
     * @param __t - in open source version, it must be equal to DEFAULT_PARSEL_IDENTIFIER
     * @returns returns with gResult, that is wrapped by a Promise, that contains InsertManyResult if it's success, and gError if it's failure.
     */
    public async blockAppendToDb(core: ccCommonIoType, client: MongoClient, conf: dsConfigType, 
        wcache: objBlock[], __t: string): Promise<gResult<InsertManyResult, gError>> {
        const LOG = core.log.lib.LogFunc(core.log);
        LOG("Info", 0, "mongodb:blockAppendToDb");
        LOG("Debug", 0, "mongodb:blockAppendToDb:" + JSON.stringify(wcache));

        let res: dbInsertionResult = {
            status: 0,
            result: {
                acknowledged: false,
                insertedCount: 0,
                insertedIds: {}
            }
        }

        if (wcache.length === 0) { return this.dbOK<InsertManyResult>(res.result); }

        if (__t !== this.master_key) {
            for (const blk of wcache) {
                if (blk.tenant !== __t) {
                    return this.dbError("blockAppendToDb", "Check tenant ID", "There are blocks whose tenant IDs do not match those specified");
                }
            }
        }

        let errPos: string = "";
        let errDetail: string = "";
        const session: ClientSession = client.startSession();
        try {
            await session.withTransaction(async () => {
                const dbObj = client.db();
                const block = dbObj.collection(conf.mongo_blockcollection);
                await block.insertMany(this.convIdStrToObjectId(wcache))
                .then((result: InsertManyResult) => {
                    session.commitTransaction();
                    res.status = 0;
                    res.result = result;
                })
                .catch((reason) => {
                    session.abortTransaction();
                    res.status--;
                    errPos = "InsertAborted"
                    errDetail = reason.toString();
                })
            })
        } catch (error: any) {
            res.status--;
            errPos = "InsertException"
            errDetail = error.toString();
        }
        await session.endSession();

        if (res.status === 0) {
            return this.dbOK<InsertManyResult>(res.result);
        } else {
            return this.dbError("blockAppendToDb", errPos, errDetail);
        }
    }

    /**
     * Turn true of the delivery flag on transactions in pool collection.
     * @param core - set ccDirectIoType or ccCachedIoType instance
     * @param client - set MongoClient instance
     * @param conf - set dsConfigType instance
     * @param oids - set target oids
     * @param __t - in open source version, it must be equal to DEFAULT_PARSEL_IDENTIFIER
     * @returns returns with gResult, that is wrapped by a Promise, that contains void if it's success, and gError if it's failure.
     * So there is no need to check the value of success. Note it returns success even if no update at all.
     */
    public async poolUpdateFlagsByOid(core: ccCommonIoType, client: MongoClient, conf: dsConfigType, oids: string[], __t: string): Promise<gResult<void, gError>> {
        const LOG = core.log.lib.LogFunc(core.log);
        LOG("Info", 0, "mongodb:poolUpdateFlagsByOid");

        let ret: number = 0;
        let errStr: string = "";

        const session: ClientSession = client.startSession();
        try {
            await session.withTransaction(async () => {
                const dbObj = client.db();
                const pool = dbObj.collection(conf.mongo_poolcollection);
                // ToDo: return UpdateResult by dbUpdateResult like poolAppendFromCacheToDb()
                for (const oid of oids) {
                    let condition: object;
                    if (__t !== this.master_key) {
                        condition = { _id: new ObjectId(oid), tenant: __t };
                    } else {
                        condition = { _id: new ObjectId(oid) };
                    }
                    await pool.updateOne(condition, { $set: { deliveryF: true }})
                    .catch((error: any) => {
                        ret = -1;
                        errStr = error.toString();
                    });
                }
            });
        } catch (error: any) {
            ret = -2;
            errStr = error.toString();
        }
        if (ret === 0) {
            await session.commitTransaction();
        } else {
            try {
                await session.abortTransaction();
            } catch (error) {
                
            }
        }
        await session.endSession();

        switch (ret) {
            case 0:
                return this.dbOK<void>(undefined);
            case -1:
                return this.dbError("poolUpdateFlagsByOid", "updateOne", errStr);
            default:
                return this.dbError("poolUpdateFlagsByOid", "other", errStr);
        }
    }


    /**
     * Danger: delete transactions in pool collection.
     * @param core - set ccDirectIoType or ccCachedIoType instance
     * @param client - set MongoClient instance
     * @param conf - set dsConfigType instance
     * @param oids - set target oids
     * @param __t - in open source version, it must be equal to DEFAULT_PARSEL_IDENTIFIER
     * @returns returns with gResult, that is wrapped by a Promise, that contains void if it's success, and gError if it's failure.
     * So there is no need to check the value of success. Note it returns success even if no deletion at all.
     */
    public async poolDeleteByOid(core: ccCommonIoType, client: MongoClient, conf: dsConfigType, oids: string[], __t: string): Promise<gResult<void, gError>> {
        const LOG = core.log.lib.LogFunc(core.log);
        LOG("Info", 0, "mongodb:poolDeleteByOid");

        let ret: number = 0;
        let errStr: string = "";

        const session: ClientSession = client.startSession();
        try {
            await session.withTransaction(async () => {
                const dbObj = client.db();
                const pool = dbObj.collection(conf.mongo_poolcollection);
                // ToDo: return DeleteResult by dbUpdateResult like poolAppendFromCacheToDb()
                for (const oid of oids) {
                    let condition: object;
                    if (__t !== this.master_key) {
                        condition = { _id: new ObjectId(oid), tenant: __t };
                    } else {
                        condition = { _id: new ObjectId(oid) };
                    }
                    await pool.deleteOne(condition)
                    .catch((error: any) => {
                        ret = -1;
                        errStr = error.toString();
                    });
                }
            });
        } catch (error: any) {
            ret = -1;
            errStr = error.toString();
        }
        if (ret === 0) {
            await session.commitTransaction();
        } else {
            try {
                await session.abortTransaction();
            } catch (error) {
                
            }
        }
        await session.endSession();

        switch (ret) {
            case 0:
                return this.dbOK<void>(undefined);
            case -1:
                return this.dbError("poolUpdateFlagsByOid", "updateOne", errStr);
            default:
                return this.dbError("poolUpdateFlagsByOid", "other", errStr);
        }
    }
    /**
     * Danger: delete transactions in block collection.
     * @param core - set ccDirectIoType or ccCachedIoType instance
     * @param client - set MongoClient instance
     * @param conf - set dsConfigType instance
     * @param oids - set target oids
     * @param __t - in open source version, it must be equal to DEFAULT_PARSEL_IDENTIFIER
     * @returns returns with gResult, that is wrapped by a Promise, that contains void if it's success, and gError if it's failure.
     * So there is no need to check the value of success. Note it returns success even if no deletion at all.
     */
    public async blockDeleteByOid(core: ccCommonIoType, client: MongoClient, conf: dsConfigType, oids: string[], __t: string): Promise<gResult<void, gError>> {
        const LOG = core.log.lib.LogFunc(core.log);
        LOG("Info", 0, "mongodb:blockDeleteByOid");

        let ret: number = 0;
        let errStr: string = "";

        const session: ClientSession = client.startSession();
        try {
            await session.withTransaction(async () => {
                const dbObj = client.db();
                const block = dbObj.collection(conf.mongo_blockcollection);
                for (const oid of oids) {
                    let condition: object;
                    if (__t !== this.master_key) {
                        condition = { _id: new ObjectId(oid), tenant: __t };
                    } else {
                        condition = { _id: new ObjectId(oid) };
                    }
                    await block.deleteOne(condition)
                    .catch((error: any) => {
                        ret = -1;
                        errStr = error.toString();
                    });
                }
            });
        } catch (error: any) {
            ret = -1;
            errStr = error.toString();
        }
        if (ret === 0) {
            await session.commitTransaction();
        } else {
            try {
                await session.abortTransaction();
            } catch (error) {
                
            }
        }
        await session.endSession();

        switch (ret) {
            case 0:
                return this.dbOK<void>(undefined);
            case -1:
                return this.dbError("blockDeleteByOid", "updateOne", errStr);
            default:
                return this.dbError("blockDeleteByOid", "other", errStr);
        }
    }

    /**
     * Danger: replace blocks by new ones.
     * @param core - set ccDirectIoType or ccCachedIoType instance
     * @param client - set MongoClient instance
     * @param conf - set dsConfigType instance
     * @param blockResults - set the new blocks
     * @param __t - in open source version, it must be equal to DEFAULT_PARSEL_IDENTIFIER
     * @returns returns with gResult, that is wrapped by a Promise, that contains void if it's success, and gError if it's failure.
     * So there is no need to check the value of success. Note it returns success even if no updates at all.
     */
    public async blockReplaceByBlocks(core: ccCommonIoType, client: MongoClient, conf: dsConfigType, blockResults: getBlockResult[], __t: string): Promise<gResult<void, gError>> {
        const LOG = core.log.lib.LogFunc(core.log);
        LOG("Info", 0, "mongodb:blockReplaceByBlocks");

        let ret: number = 0;
        let errStr: string = "";

        let ca3Specific : {
            version: number | undefined,
            signedby: SignedBy | undefined,
            signcounter: number | undefined
        } = {
            version: undefined,
            signedby: undefined,
            signcounter: undefined
        }

        const session: ClientSession = client.startSession();
        try {
            await session.withTransaction(async () => {
                const dbObj = client.db();
                const block = dbObj.collection(conf.mongo_blockcollection);
                for (const blockResult of blockResults) {
                    Object.assign(ca3Specific, blockResult.block);
                    if (blockResult.block !== undefined) {
                        const blk = {...ca3Specific, ...blockResult.block }
                        let condition: object;
                        if (__t !== this.master_key) {
                            condition = { _id: new ObjectId(blockResult.oid), tenant: __t };
                        } else {
                            condition = { _id: new ObjectId(blockResult.oid) };
                        }
                        await block.replaceOne(condition,{
                            _id: new ObjectId(blk._id),
                            tenant: blk.tenant,
                            version: blk.version ?? undefined,
                            height: blk.height,
                            size: blk.size,
                            data: blk.data ?? undefined,
                            type: blk.type ?? undefined,
                            settime: blk.settime,
                            timestamp: blk.timestamp,
                            miner: blk.miner ?? undefined,
                            prev_hash: blk.prev_hash,
                            hash: blk.hash,
                            signedby: blk.signedby ?? undefined,
                            signcounter: blk.signcounter ?? undefined
                            },{ upsert: true })
                    }
                }
            })
        } catch (error: any) {
            ret = -1;
            errStr = error.toString();
        }
        if (ret === 0) {
            await session.commitTransaction();
        } else {
            try {
                await session.abortTransaction();
            } catch (error: any) {
                ret = -2;
                errStr = error.toString();
            }
        }
        await session.endSession();

        switch (ret) {
            case 0:
                return this.dbOK<void>(undefined);
            case -1:
                return this.dbError("blockDeleteByOid", "updateOne", errStr);
            default:
                return this.dbError("blockDeleteByOid", "other", errStr);
        }
    }
}
