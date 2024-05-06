/**
 * Copyright (c) 2024 Ryoji Kamei
 * Released under the MIT license
 * https://opensource.org/licenses/mit-license.php
 */

import { dsConfigType } from "../config/index.js";
import { objTx, objBlock, ccDsType, poolResultObject, blockResultObject, blockCursor, poolCursor, getBlockCursorOptions, getPoolCursorOptions } from "./index.js";
import { ccLogType } from "../logger/index.js";
import { gResult, gSuccess, gFailure, gError } from "../utils.js";
import { getBlockResult } from "../system/index.js";

/**
 * The datastore module, input and output data to/from the datastore
 */
export class DsModule {
    /**
     * Normal return method
     * @param response - response contents
     * @returns returns gSuccess instance contains response
     */
    protected dOK<T>(response: T): gResult<T, never> {
        return new gSuccess(response)
    }
    /**
     * Abnormal return method
     * @param func - set the function/method name
     * @param pos - set the position in the func
     * @param message - set the error message
     * @returns returns gFailure instance contains gError instance
     */
    protected dError(func: string, pos?: string, message?: string): gResult<never, gError> {
        return new gFailure(new gError("ds", func, pos, message));
    }

    /**
     * Initialize the datastore module.
     * @param conf - set dsConfigType instance
     * @param log - set ccLogType instance
     * @param IoSubModule - can set an IoSubModule instance
     * @returns returns with gResult, that is wrapped by a Promise, that contains ccDsType if it's success, and gError if it's failure.
     */
    public async init(conf: dsConfigType, log: ccLogType, IoSubModule?: any): Promise<gResult<ccDsType, gError>> {

        let core: ccDsType = {
            lib: new DsModule(),
            conf: conf,
            io: undefined,
            log: log
        }
        const LOG = core.log.lib.LogFunc(core.log);
        LOG("Info", 0, "DsModule:init");

        let iolib;
        if (IoSubModule !== undefined) {
           iolib = IoSubModule;
        } else {
            const jsfile = "../../dist/datastore/directio.js";
            try {
                await import(jsfile)
                .then(module => {
                    iolib = new module.IoSubModule();
                })    
            } catch (error: any) {
                return this.dError("init", "importIoSubModule", error.toString());    
            }
        }
        if (iolib !== undefined) {
            const ret = await iolib.init(conf, log);
            if (ret.isFailure()) return ret;
            core.io = ret.value;
        } else {
            return this.dError("init", "initIoSubModule", "The io sub module is down");
        }
        return this.dOK<ccDsType>(core);
    }

    /**
     * Force to reset DB and sync cache.
     * @param core - set ccCachedIoType instance
     * @returns returns with gResult, that is wrapped by a Promise, that contains void if it's success, and gError if it's failure.
     * So there is no need to check the value of success.
     */
    public async cleanup(core: ccDsType): Promise<gResult<void, gError>> {
        const LOG = core.log.lib.LogFunc(core.log);
        LOG("Info", 0, "DsModule:cleanup");

        if (core.io !== undefined) {
            return await core.io.lib.cleanup(core.io);
        } else {
            return this.dError("cleanup", "return", "The io sub module is down");
        }
    }

    /**
     * Return the cursor that points specified tenant's pooling transactions. Several functions that use pool depend on it.
     * @param core - set ccCachedIoType instance
     * @param options - set options with getPoolCursorOptions format
     * @param __t - in open source version, it must be undefined or equal to DEFAULT_PARSEL_IDENTIFIER
     * @returns returns with gResult, that is wrapped by a Promise, that contains the itertor of corresponding transactions if it's success, and gError if it's failure.
     */
    public async getPoolCursor(core: ccDsType, options: getPoolCursorOptions, __t?: string): Promise<gResult<poolCursor, gError>> {
        const LOG = core.log.lib.LogFunc(core.log);
        LOG("Info", 0, "DsModule:getPoolCursor");

        if (core.io !== undefined) {
            return await core.io.lib.getPoolCursor(core.io, options, __t);
        } else {
            return this.dError("getPoolCursor", "return", "The io sub module is down");
        }
    }

    /**
     * Return the cursor that points specified tenant's blockchained transactions. Several functions that use blockchain depend on it.
     * @param core - set ccCachedIoType instance
     * @param options - set options with getBlockCursorOptions format
     * @param __t - in open source version, it must be undefined or equal to DEFAULT_PARSEL_IDENTIFIER
     * @returns returns with gResult, that is wrapped by a Promise, that contains the itertor of corresponding transactions if it's success, and gError if it's failure.
     */
    public async getBlockCursor(core: ccDsType, options: getBlockCursorOptions, __t?: string): Promise<gResult<blockCursor, gError>> {
        const LOG = core.log.lib.LogFunc(core.log);
        LOG("Info", 0, "DsModule:getBlockCursor");
        
        if (core.io !== undefined) {
            return await core.io.lib.getBlockCursor(core.io, options, __t);
        } else {
            return this.dError("getBlockCursor", "return", "The io sub module is down");
        }
    }

    /**
     * Close the cursor's session if needed
     * @param core - set ccDirectIoType instance
     * @param cursorSession - set the dbCursor instance to close
     * @returns returns with gResult, that is wrapped by a Promise, that contains void if it's success, and gError if it's failure.
     * So there is no need to check the value of success.
     */
    public async closeCursor(core: ccDsType, cursorSession: poolCursor | blockCursor): Promise<gResult<void, gError>> {
        const LOG = core.log.lib.LogFunc(core.log);
        LOG("Info", 0, "DsModule:closeCursor");

        if (core.io !== undefined) {
            return await core.io.lib.closeCursor(core.io, cursorSession);
        } else {
            return this.dError("getBlockCursor", "return", "The io sub module is down");
        }
    }

    /**
     * Add new data into pool
     * @param core  - set ccCachedIoType instance
     * @param wObj  - set a object to register
     * @param __t - in open source version, it must be equal to DEFAULT_PARSEL_IDENTIFIER
     * @returns returns with gResult, that contains void if it's success, and gError if it's failure.
     * So there is no need to check the value of success.
     */
    public async setPoolNewData(core: ccDsType, wObj: objTx | undefined, __t: string): Promise<gResult<poolResultObject, gError>> {
        const LOG = core.log.lib.LogFunc(core.log);
        LOG("Info", 0, "DsModule:setPoolNewData");

        if (core.io !== undefined) {
            return await core.io.lib.setPoolNewData(core.io, wObj, __t);
        } else {
            return this.dError("setPoolNewData", "return", "The io sub module is down");
        }
    }

    /**
     * Add new data into block
     * @param core  - set ccCachedIoType instance
     * @param wObj  - set a object to register
     * @param __t - in open source version, it must be equal to DEFAULT_PARSEL_IDENTIFIER
     * @returns returns with gResult, that contains void if it's success, and gError if it's failure.
     * So there is no need to check the value of success.
     */
    public async setBlockNewData(core: ccDsType, wObj: objBlock | undefined, __t: string): Promise<gResult<blockResultObject, gError>> {
        const LOG = core.log.lib.LogFunc(core.log);
        LOG("Info", 0, "DsModule:setBlockNewData");

        if (core.io !== undefined) {
            return await core.io.lib.setBlockNewData(core.io, wObj, __t);
        } else {
            return this.dError("setBlockNewData", "return", "The io sub module is down");
        }
    }

    /**
     * Turn some the delivery flags true on both the read cache and the db.
     * @param core - set ccCachedIoType instance
     * @param oids - set target oids
     * @param __t - in open source version, it must be equal to DEFAULT_PARSEL_IDENTIFIER
     * @returns returns with gResult, that is wrapped by a Promise, that contains void if it's success, and gError if it's failure.
     * So there is no need to check the value of success.
     */
    public async poolModifyReadsFlag(core: ccDsType, oids: string[], __t: string): Promise<gResult<void, gError>> {
        const LOG = core.log.lib.LogFunc(core.log);
        LOG("Info", 0, "DsModule:poolModifyReadsFlag");

        if (core.io !== undefined) {
            return await core.io.lib.poolModifyReadsFlag(core.io, oids, __t);
        } else {
            return this.dError("poolModifyReadsFlag", "return", "The io sub module is down");
        }
    }

    /**
     * Danger: delete some transactions of pool on both the read cache and the db.
     * @param core - set ccCachedIoType instance
     * @param oids - set target oids
     * @param __t - in open source version, it must be equal to DEFAULT_PARSEL_IDENTIFIER
     * @returns returns with gResult, that is wrapped by a Promise, that contains void if it's success, and gError if it's failure.
     * So there is no need to check the value of success.
     */
    public async poolDeleteTransactions(core: ccDsType, oids: string[], __t: string): Promise<gResult<void, gError>> {
        const LOG = core.log.lib.LogFunc(core.log);
        LOG("Info", 0, "DsModule:poolDeleteTransactions");

        if (core.io !== undefined) {
            return await core.io.lib.poolDeleteTransactions(core.io, oids, __t);
        } else {
            return this.dError("poolModifyReadsFlag", "return", "The io sub module is down");
        }
    }

    /**
     * Update blocks with specified blocks.
     * @param core - set ccCachedIoType instance
     * @param blocks - a legitimate block of blocks.
     * @param __t - in open source version, it must be equal to DEFAULT_PARSEL_IDENTIFIER
     * @returns returns with gResult, that is wrapped by a Promise, that contains void if it's success, and gError if it's failure.
     * So there is no need to check the value of success.
     */
    public async blockUpdateBlocks(core: ccDsType, blocks: getBlockResult[], __t: string): Promise<gResult<void, gError>> {
        const LOG = core.log.lib.LogFunc(core.log);
        LOG("Info", 0, "DsModule:blockUpdateBlocks");

        if (core.io !== undefined) {
            return await core.io.lib.blockUpdateBlocks(core.io, blocks, __t);
        } else {
            return this.dError("blockUpdateBlocks", "return", "The io sub module is down");
        }
    }

    /**
     * Danger: delete some blocks on both the read cache and the db.
     * @param core - set ccCachedIoType instance
     * @param oids - set target oids
     * @param __t - in open source version, it must be equal to DEFAULT_PARSEL_IDENTIFIER
     * @returns returns with gResult, that is wrapped by a Promise, that contains void if it's success, and gError if it's failure.
     * So there is no need to check the value of success.
     */
    public async blockDeleteBlocks(core: ccDsType, oids: string[], __t: string): Promise<gResult<void, gError>> {
        const LOG = core.log.lib.LogFunc(core.log);
        LOG("Info", 0, "DsModule:blockDeleteBlocks");

        if (core.io !== undefined) {
            return await core.io.lib.blockDeleteBlocks(core.io, oids, __t);
        } else {
            return this.dError("blockDeleteBlocks", "return", "The io sub module is down");
        }
    }
}