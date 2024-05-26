
/**
 * Copyright (c) 2024 Ryoji Kamei
 * Released under the MIT license
 * https://opensource.org/licenses/mit-license.php
 */

import { gResult, gSuccess, gFailure, gError } from "../utils";

import { objBlock, objTx, poolResultObject, blockResultObject, getPoolCursorOptions, getBlockCursorOptions, poolCursor, blockCursor, ccCommonIoType } from ".";
import { RUNTIME_MASTER_IDENTIFIER, DEFAULT_PARSEL_IDENTIFIER, getBlockResult } from "../system";
import { dsConfigType } from "../config"
import { ccLogType } from "../logger"
import { BackendDbSubModule } from "./mongodb"
import { cachedIoIterator } from "./ioiterator";

/**
 * ccDirectIoType definition
 */
export type ccDirectIoType = ccCommonIoType & {
    lib: DirectIoSubModule,
    queue: objTx[], // use when queue_ondisk === false
}

/**
 * (Direct)IoSubModule, for storing transaction data directory
 */
export class DirectIoSubModule {

    /**
     * Normal return method
     * @param response - response contents
     * @returns returns gSuccess instance contains response
     */
    protected ioOK<T>(response: T): gResult<T, never> {
        return new gSuccess(response)
    }
    /**
     * Abnormal return method
     * @param func - set the function/method name
     * @param pos - set the position in the func
     * @param message - set the error message
     * @returns returns gFailure instance contains gError instance
     */
    protected ioError(func: string, pos?: string, message?: string): gResult<never, gError> {
        return new gFailure(new gError("directio", func, pos, message));
    }

    /**
     * Stub values for features not supported in the open source version
     */
    protected master_key: string
    protected common_parsel: string
    constructor() {
        this.master_key = RUNTIME_MASTER_IDENTIFIER;
        this.common_parsel = DEFAULT_PARSEL_IDENTIFIER;
    }

    /**
     * IoSubModule initialization
     * @param conf - set dsConfigType instance
     * @param log - set ccLogType instance
     * @param backendDB  - can inject backendDB instance on testing
     * @returns returns with gResult, that is wrapped by a Promise, that contains ccDsType if it's success, and gError if it's failure.
     */
    public async init(conf: dsConfigType, log: ccLogType, backendDB?: BackendDbSubModule): Promise<gResult<ccDirectIoType, gError>> {

        const core: ccDirectIoType = {
            lib: new DirectIoSubModule(),
            db: {
                lib: backendDB ?? new BackendDbSubModule(),
                obj: undefined // MongoClient
            },
            queue: [],
            conf: conf,
            log: log
        }

        const LOG = core.log.lib.LogFunc(core.log);
        LOG("Info", 0, "DirectIoSubModule:init:" + conf.mongo_port.toString());

        const ret = await core.db.lib.init(conf);
        if (ret.isFailure()) {
            return ret;
        }
        core.db.obj = ret.value;

        return this.ioOK<ccDirectIoType>(core);
    }


    /**
     * Force to reset DB.
     * @param core - set ccDirectIoType instance
     * @returns returns with gResult, that is wrapped by a Promise, that contains void if it's success, and gError if it's failure.
     * So there is no need to check the value of success.
     */
    public async cleanup(core: ccDirectIoType): Promise<gResult<void, gError>> {
        const LOG = core.log.lib.LogFunc(core.log);
        LOG("Info", 0, "DirectIoSubModule:cleanup");

        const ret1 = await core.db.lib.cleanup(core, core.db.obj);
        if (ret1.isFailure()) {
            return ret1;
        }

        return this.ioOK<void>(undefined);
    }

    /**
     * Turn some the delivery flags true on the queue.
     * @param core - set ccCachedIoType instance
     * @param oids - set target oids
     * @param __t - in open source version, it must be equal to RUNTIME_MASTER_IDENTIFIER
     * @returns returns with gResult, that is wrapped by a Promise, that contains void if it's success, and gError if it's failure.
     * So there is no need to check the value of success.
     */
    public async poolModifyReadsFlag(core: ccDirectIoType, oids: string[], __t: string): Promise<gResult<void, gError>> {
        const LOG = core.log.lib.LogFunc(core.log);
        LOG("Info", 0, "DirectIoSubModule:poolModifyReadsFlag");

        if (__t !== this.master_key) {
            LOG("Debug", 0, "DirectIoSubModule:poolModifyReadsFlag:IncorrectAuthorization:" + __t);
            return this.ioError("poolModifyReadsFlag", "CheckAuthorization", "IncorrectAuthorization:" + __t);
        }

        for (const tx of core.queue) {
            for (const oid of oids) {
                if (tx._id === oid) tx.deliveryF = true;
            }
        }

        return this.ioOK<void>(undefined);
    }

    /**
     * Danger: delete some transactions of pool on the queue.
     * @param core - set ccCachedIoType instance
     * @param oids - set target oids
     * @param __t - in open source version, it must be equal to RUNTIME_MASTER_IDENTIFIER
     * @returns returns with gResult, that is wrapped by a Promise, that contains void if it's success, and gError if it's failure.
     * So there is no need to check the value of success.
     */
    public async poolDeleteTransactions(core: ccDirectIoType, oids: string[], __t: string): Promise<gResult<void, gError>> {
        const LOG = core.log.lib.LogFunc(core.log);
        LOG("Info", 0, "DirectIoSubModule:poolDeleteTransactions");

        if (__t !== this.master_key) {
            LOG("Debug", 0, "DirectIoSubModule:poolDeleteTransactions:IncorrectAuthorization:" + __t);
            return this.ioError("poolDeleteTransactions", "CheckAuthorization", "IncorrectAuthorization:" + __t);
        }

        for (const oid of oids) {
            let index = 0;
            for (const qItem of core.queue) {
                if (qItem._id === oid) {
                    core.queue.splice(index, 1);
                    continue;
                }
            }
            index++;
        }

        return this.ioOK<void>(undefined);
    }

    /**
     * Danger: delete some blocks on the db.
     * @param core - set ccCachedIoType instance
     * @param oids - set target oids
     * @param __t - in open source version, it must be equal to RUNTIME_MASTER_IDENTIFIER
     * @returns returns with gResult, that is wrapped by a Promise, that contains void if it's success, and gError if it's failure.
     * So there is no need to check the value of success.
     */
    public async blockDeleteBlocks(core: ccDirectIoType, oids: string[], __t: string): Promise<gResult<void, gError>> {
        const LOG = core.log.lib.LogFunc(core.log);
        LOG("Info", 0, "DirectIoSubModule:blockDeleteBlocks");

        if (__t !== this.master_key) {
            LOG("Debug", 0, "DirectIoSubModule:blockDeleteBlocks:IncorrectAuthorization:" + __t);
            return this.ioError("blockDeleteBlocks", "CheckAuthorization", "IncorrectAuthorization:" + __t);
        }

        if (core.db.obj !== undefined) {
            const ret2 = await core.db.lib.blockDeleteByOid(core, core.db.obj, core.conf, oids, __t);
            if (ret2.isFailure()) return ret2;
        } else {
            return this.ioError("blockDeleteBlocks", "blockDeleteByOid", "DB connection may be lost");
        }

        return this.ioOK<void>(undefined);
    }

    /**
     * Update blocks with specified blocks.
     * @param core - set ccDirectIoType instance
     * @param blocks - a legitimate block of blocks.
     * @param __t - in open source version, it must be equal to RUNTIME_MASTER_IDENTIFIER
     * @returns returns with gResult, that is wrapped by a Promise, that contains void if it's success, and gError if it's failure.
     * So there is no need to check the value of success.
     */
    public async blockUpdateBlocks(core: ccDirectIoType, blocks: getBlockResult[], __t: string): Promise<gResult<void, gError>> {
        const LOG = core.log.lib.LogFunc(core.log);
        LOG("Info", 0, "DirectIoSubModule:blockUpdateBlocks");

        if (blocks.length === 0) return this.ioOK<void>(undefined);

        if (__t !== this.master_key) {
            LOG("Debug", 0, "DirectIoSubModule:blockUpdateBlocks:IncorrectAuthorization:" + __t);
            return this.ioError("blockUpdateBlocks", "CheckAuthorization", "IncorrectAuthorization:" + __t);
        }

        if (core.db.obj !== undefined) {
            const ret2 = await core.db.lib.blockReplaceByBlocks(core, core.db.obj, core.conf, blocks, __t);
            if (ret2.isFailure()) return ret2;
        } else {
            return this.ioError("blockUpdateBlocks", "blockReplaceByBlocks", "DB connection may be lost");
        }

        return this.ioOK<void>(undefined);
    }

    /**
     * Return the cursor that points pooling transactions. Several functions that use pool depend on it.
     * @param core - set ccDirectIoType instanc
     * @param options - set options that is listed in getPoolCursorOptions
     * @param __t - in open source version, it must be undefined or equal to DEFAULT_PARSEL_IDENTIFIER
     * @returns returns with gResult, that is wrapped by a Promise, that contains corresponding transactions if it's success, and gError if it's failure.
     */
    public async getPoolCursor(core: ccDirectIoType, options?: getPoolCursorOptions, __t?: string): Promise<gResult<poolCursor, gError>> {
        const LOG = core.log.lib.LogFunc(core.log);
        LOG("Info", 0, "DirectIoSubModule:getPoolCursor");

        let filter_key: string | undefined;
        if (__t !== this.master_key) {
            filter_key = __t;
        }
        if (options?.sortOrder === -1) {
            core.queue.sort(function(a: any, b: any) {
                if (a._id < b._id) {
                    return 1;
                } else {
                    return -1;
                }
            })
        } else if (options?.sortOrder === 1) {
            core.queue.sort(function(a: any, b: any) {
                if (a._id > b._id) {
                    return 1;
                } else {
                    return -1;
                }
            })
        }
        return this.ioOK<poolCursor>({ session: undefined, cursor: new cachedIoIterator(core.queue, filter_key, options?.constrainedSize)});
    }

    /**
     * Return the cursor that points specified tenant's blockchained transactions. Several functions that use blockchain depend on it.
     * @param core - set ccDirectIoType instance
     * @param options - set options that is listed in getBlockCursorOptions
     * @param __t - in open source version, it must be undefined or equal to DEFAULT_PARSEL_IDENTIFIER
     * @returns returns with gResult, that is wrapped by a Promise, that contains corresponding transactions if it's success, and gError if it's failure.
     */
    public async getBlockCursor(core: ccDirectIoType, options?: getBlockCursorOptions, __t?: string): Promise<gResult<blockCursor, gError>> {
        const LOG = core.log.lib.LogFunc(core.log);
        LOG("Info", 0, "DirectIoSubModule:getBlockCursor");

        let filter_key: string
        if (__t === undefined) {
            filter_key = this.common_parsel;
        } else {
            filter_key = __t;
        }
        if (core.db.obj !== undefined) {
            const ret1 = await core.db.lib.blockGetFromDbToCursor(core, core.db.obj, core.conf, filter_key, options?.sortOrder, options?.constrainedSize);
            if (ret1.isFailure()) return ret1;
            return this.ioOK<blockCursor>(ret1.value);
        } else {
            return this.ioError("getBlockCursor", "blockGetFromDbToCursor", "DB connection may be lost");
        }
    }

    /**
     * Close the cursor's session
     * @param core - set ccDirectIoType instance
     * @param cursorSession - set the dbCursor instance to close
     * @returns returns with gResult, that is wrapped by a Promise, that contains void if it's success, and gError if it's failure.
     * So there is no need to check the value of success.
     */
    public async closeCursor(core: ccDirectIoType, cursorSession: poolCursor | blockCursor): Promise<gResult<void, gError>> {
        const LOG = core.log.lib.LogFunc(core.log);
        LOG("Info", 0, "DirectIoSubModule:closeCursor");

        if ((core.db.obj !== undefined) && (cursorSession.session !== undefined)) {
            await core.db.lib.closeCursor(core, cursorSession.session);
        }
        return this.ioOK<void>(undefined);
    }

    /**
     * Add new data into pool
     * @param core  - set ccDirectIoType instance
     * @param wObj  - set a object to register
     * @param __t - in open source version, it must be equal to DEFAULT_PARSEL_IDENTIFIER
     * @returns returns with gResult, that contains void if it's success, and gError if it's failure.
     * So there is no need to check the value of success.
     */
    public async setPoolNewData(core: ccDirectIoType, wObj: objTx | undefined, __t: string): Promise<gResult<poolResultObject, gError>> {
        const LOG = core.log.lib.LogFunc(core.log);
        LOG("Info", 0, "DirectIoSubModule:setPoolNewData");

        if (wObj === undefined) return this.ioOK<poolResultObject>({id: "", status: 0, cache: []});

        if (__t !== this.master_key) {
            if (wObj.tenant !== __t) {
                return this.ioError("setPoolNewData", "Check tenant ID", "Transaction tenant ID does not match authorization ID to write")
            }
        }

        core.queue.push(wObj);
        const ret3: poolResultObject = {
            id: "",
            status: 0,
            cache: [wObj]
        }
        return this.ioOK<poolResultObject>(ret3);
    }

    /**
     * Add new data into block
     * @param core  - set ccDirectIoType instance
     * @param wObj  - set a object to register
     * @param __t - in open source version, it must be equal to DEFAULT_PARSEL_IDENTIFIER
     * @returns returns with gResult, that contains void if it's success, and gError if it's failure.
     * So there is no need to check the value of success.
     */
    public async setBlockNewData(core: ccDirectIoType, wObj: objBlock | undefined, __t: string): Promise<gResult<blockResultObject, gError>> {
        const LOG = core.log.lib.LogFunc(core.log);
        LOG("Info", 0, "DirectIoSubModule:setBlockNewData");

        if (wObj === undefined) return this.ioOK<blockResultObject>({id: "", status: 0, cache: []});

        if (core.db.obj !== undefined) {
            const ret1 = await core.db.lib.blockAppendToDb(core, core.db.obj, core.conf, [wObj], __t);
            if (ret1.isFailure()) return ret1;
            const ret2: blockResultObject = {
                id: "",
                status: ret1.value.insertedCount -1,
                cache: [wObj]
            }
            return this.ioOK<blockResultObject>(ret2);
        } else {
            return this.ioError("setBlockNewData", "blockAppendToDb", "DB connection may be lost");
        }
    }

}

export {DirectIoSubModule as IoSubModule}




