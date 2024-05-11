/**
 * Copyright (c) 2024 Ryoji Kamei
 * Released under the MIT license
 * https://opensource.org/licenses/mit-license.php
 */

import { gResult, gSuccess, gFailure, gError } from "./utils.js";

import { ccType } from "./index.js";
import { ConfigModule, ccConfigType } from "./config/index.js";
import { LogModule, ccLogType } from "./logger/index.js";
import { SystemModule, ccSystemType } from "./system/index.js";
import { MainModule, ccMainType } from "./main/index.js";
import { DsModule, ccDsType } from "./datastore/index.js";
import { ApiModule, ccApiType } from "./api/index.js";
import { InModule, ccInType } from "./internode/index.js";
import { BlockModule, ccBlockType } from "./block/index.js";
import { KeyringModule, ccKeyringType } from "./keyring/index.js";
import { EventModule, internalEventFormat, ccEventType } from "./event/index.js";

/**
 * The master class of CasualChain
 */
export class CC {
    /**
     * Normal return method
     * @param response - response contents
     * @returns returns gSuccess instance contains response
     */
    protected wOK<T>(response: T): gResult<T, never> {
        return new gSuccess(response)
    }
    /**
     * Abnormal return method
     * @param func - set the function/method name
     * @param pos - set the position in the func
     * @param message - set the error message
     * @returns returns gFailure instance contains gError instance
     */
    protected wError(func: string, pos?: string, message?: string): gResult<never, gError> {
        return new gFailure(new gError("cc", func, pos, message));
    }

    /**
     * The startup process of Cc.
     * @returns Promise\<ccCoreType\>
     */
    public async init(): Promise<gResult<ccType, gError>> {
        
        process.stdout.write("Initialize Config: ");
        const clib: ConfigModule = new ConfigModule();
        const ret1 = await clib.init();
        if (ret1.isSuccess()) {
            console.log("[ OK ]");
        } else {
            console.log("[FAIL]");
            console.log(ret1.value);
            process.exit(1);
        }
        const c: ccConfigType = ret1.value;

        process.stdout.write("Initialize Logger: ");
        const llib: LogModule = new LogModule();
        const ret2 = llib.init(c.l);
        if (ret2.isSuccess()) {
            console.log("[ OK ]");
        } else {
            console.log("[FAIL]");
            console.log(ret2.value);
            process.exit(1);
        }
        const l: ccLogType = ret2.value;

        const LOG = l.lib.LogFunc(l);

        LOG("Notice", 0, "Initialize System: ", {lf: false});
        const slib: SystemModule = new SystemModule();
        const ret3 = slib.init(c.s, l);
        if (ret3.isSuccess()) {
            LOG("Notice", 0, "[ OK ]");
        } else {
            LOG("Err", 3, "[FAIL]\n" + ret3.value);
            process.exit(3);
        }
        const s: ccSystemType = ret3.value;

        LOG("Notice", 0, "Initialize Main: ", {lf: false});
        const mlib: MainModule = new MainModule();
        const ret4 = mlib.init(c.m, l);
        if (ret4.isSuccess()) {
            LOG("Notice", 0, "[ OK ]");
        } else {
            LOG("Err", 4, "[FAIL]\n" + ret4.value);
            process.exit(4);
        }
        const m: ccMainType = ret4.value;

        LOG("Notice", 0, "Initialize DataStore: ", {lf: false});
        const dlib: DsModule = new DsModule();
        const ret5 = await dlib.init(c.d, l);
        if (ret5.isSuccess()) {
            LOG("Notice", 0, "[ OK ]");
        } else {
            LOG("Err", 5, "[FAIL]\n" + ret5.value);
            process.exit(5);
        }
        const d: ccDsType = ret5.value;

        LOG("Notice", 0, "Initialize Keyring: ", {lf: false});
        const klib: KeyringModule = new KeyringModule();
        const ret6 = await klib.init(c.k, l);
        if (ret6.isSuccess()) {
            LOG("Notice", 0, "[ OK ]");
        } else {
            LOG("Err", 6, "[FAIL]\n" + ret6.value);
            process.exit(6);
        }
        const k: ccKeyringType = ret6.value;

        LOG("Notice", 0, "Initialize Block: ", {lf: false});
        const blib: BlockModule = new BlockModule();
        const ret7 = await blib.init(c.b, l);
        if (ret7.isSuccess()) {
            LOG("Notice", 0, "[ OK ]");
        } else {
            LOG("Err", 7, "[FAIL]\n" + ret7.value);
            process.exit(7);
        }
        const b: ccBlockType = ret7.value;

        LOG("Notice", 0, "Initialize InterNode: ", {lf: false});
        const ilib: InModule = new InModule(l, s, b);
        const ret8 = await ilib.init(c.i, l, s, b, k);
        if (ret8.isSuccess())  {
            LOG("Notice", 0, "[ OK ]");
        } else {
            LOG("Err", 8, "[FAIL]\n" + ret8.value);
            process.exit(8);
        }
        const i: ccInType = ret8.value;

        LOG("Notice", 0, "Initialize Event: ", {lf: false});
        const elib: EventModule = new EventModule();
        const ret9 = await elib.init(c.e, l);
        if (ret9.isSuccess())  {
            LOG("Notice", 0, "[ OK ]");
        } else {
            LOG("Err", 9, "[FAIL]\n" + ret9.value);
            process.exit(9);
        }
        const e: ccEventType = ret9.value;

        LOG("Notice", 0, "Initialize API: ", {lf: false});
        const alib: ApiModule = new ApiModule();
        const ret10 = await alib.init(c.a, l);
        if (ret10.isSuccess()) {
            LOG("Notice", 0, "[ OK ]");
        } else {
            LOG("Err", 10, "[FAIL]\n" + ret10.value);
            process.exit(10);
        }
        const a: ccApiType = ret10.value;

        const core: ccType = {
            lib: new CC(),
            c: c, // ccConfigType
            l: l, // ccLogType
            s: s, // ccSystemType
            m: m, // ccMainType
            d: d, // ccDsType
            a: a, // ccApiType
            i: i, // ccInType
            b: b, // ccBlockType
            k: k, // ccKeyringType
            e: e // ccEventType
        }
        // Add pathes from System
        core.s.b = core.b;
        core.s.d = core.d;
        core.s.i = core.i;
        core.s.m = core.m;
        core.s.e = core.e;
        // Add pathes from Main
        core.m.d = core.d;
        core.m.s = core.s;
        // Add pathes from Api
        core.a.m = core.m;
        core.a.s = core.s;
        // Add pathes from Internode
        core.i.b = core.b;
        core.i.k = core.k;
        core.i.s = core.s;
        // Add pathes from Block
        core.b.i = core.i;
        core.b.k = core.k;
        core.b.m = core.m;
        core.b.s = core.s;
        // Add pathes from Keyring
        core.k.i = core.i;
        core.k.m = core.m;
        core.k.s = core.s;
        // Add pathes from Cc
        core.e.w = core;

        // Early access for debugging/testing only
        if (core.s.conf.node_mode.startsWith("testing") === true) {
            const ret11 = await core.a.lib.activateApi(core.a, core.a.log);
            if (ret11.isFailure()) return ret11;
            LOG("Notice", 0, "Now open the api");
        }

        // Run post scripts after startup
        const ret12 = await core.i.lib.startServer(core.i);
        if (ret12.isFailure()) return ret12;
        const ret13 = await core.i.lib.waitForRPCisOK(core.i, 10);
        if (ret13.isFailure()) return ret13;
        const ret14 = await core.k.lib.postSelfPublicKeys(core.k);
        if (ret14.isFailure()) return ret14;
        const ret15 = await core.k.lib.refreshPublicKeyCache(core.k, true);
        if (ret15.isFailure()) return ret15;
        if (core.s.conf.node_mode === "testing+init") {
            LOG("Notice", 0, "Initializing blockchain on a volatile storage: ", {lf: false});
            const ret16 = await core.s.lib.postGenesisBlock(core.s);
            if (ret16.isSuccess()) {
                LOG("Notice", 0, "[ OK ]");
            } else {
                LOG("Notice", 0, "The IPC have not been activated yet. Run /sync/gen later.");
            }
        }

        // Auto run of internal tasks
        if (core.e.conf.enable_internaltasks === true) {
            LOG("Notice", 0, "Enable internal auto tasks");
            core.s.lib.registerAutoTasks(core.s);
        } else {
            LOG("Notice", 0, "Disable internal auto tasks");
        }

        // Finally open the api
        if (core.s.conf.node_mode.startsWith("testing") === false) {
            const ret17 = await core.a.lib.activateApi(core.a, core.a.log);
            if (ret17.isFailure()) return ret17;
            LOG("Notice", 0, "Now open the api");
        }

        return this.wOK<ccType>(core);
    }

    /**
     * The shutdown process
     * @param core - set ccType instance
     * @returns returns with gResult, that is wrapped by a Promise, that contains void if it's success, and gError if it's failure.
     * So there is no need to check the value of success.
     */
    public async shutdown(core: ccType): Promise<gResult<void, gError>> {
        const LOG = core.l.lib.LogFunc(core.l);

        LOG("Notice", 0, "Close the api");
        const ret1 = await core.a.lib.deactivateApi(core.a, core.a.log);
        if (ret1.isFailure()) return ret1;

        LOG("Notice", 0, "Block incoming requests from other nodes");
        const ret2 = await core.i.lib.stopServer(core.i);
        if (ret2.isFailure()) return ret2;

        LOG("Notice", 0, "Unregister auto tasks");
        const ret3 = core.s.lib.unregisterAutoTasks(core.s);

        LOG("Notice", 0, "Flushing caching transactions to blocks");
        if (core.s.conf.node_mode.startsWith("testing") === false) {
            const ret4 = await core.s.lib.postDeliveryPool(core.s);
            if (ret4.isFailure()) return ret4;
            LOG("Notice", 0, "");
            const ret5 = await core.s.lib.postAppendBlocks(core.s);
            if (ret5.isFailure()) return ret5;
        }
        return this.wOK<void>(undefined);
    }
}