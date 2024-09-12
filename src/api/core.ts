/**
 * Copyright (c) 2024 Ryoji Kamei
 * Released under the MIT license
 * https://opensource.org/licenses/mit-license.php
 */

import { setInterval } from "timers/promises";
import * as https from "https";

import { gResult, gSuccess, gFailure, gError } from "../utils.js";

import { ccApiType } from "./index.js";
import { apiConfigType, ccConfigType } from "../config/index.js";
import { ccLogType } from "../logger/index.js";

import { ListnerV3UserApi } from "./rest/user.js";
import { ListnerV3AdminApi } from "./rest/admin.js";
import { moduleCondition } from "../index.js";
import { ccMainType } from "../main/index.js";
import { ccSystemType } from "../system/index.js";
import { ccKeyringType } from "../keyring/index.js";

/**
 * Provided APIs
 */
type ListnerApis = {
    firstApi: ListnerV3UserApi,
    secondApi: ListnerV3AdminApi
}

/**
 * ApiModule, for providing APIs.
 */
export class ApiModule {
    /**
     * Normal return method
     * @param response - response contents
     * @returns returns gSuccess instance contains response
     */
    protected aOK<T>(response: T): gResult<T, never> {
        return new gSuccess(response)
    }
    /**
     * Abnormal return method
     * @param func - set the function/method name
     * @param pos - set the position in the func
     * @param message - set the error message
     * @returns returns gFailure instance contains gError instance
     */
    protected aError(func: string, pos?: string, message?: string): gResult<never, gError> {
        return new gFailure(new gError("api", func, pos, message));
    }

    /**
     * Variable common to each class for setting the module condition
     */
    protected coreCondition: moduleCondition = "unloaded";
    /**
     * Return current condition of the module
     * @returns returns a word that represent the condition of the module
     */
    public getCondition(): moduleCondition {
        return this.coreCondition;
    }
    /**
     * Overwrite the condition of the module
     * @param condition - set a word that represent the condition of the module
     */
    public setCondition(condition: moduleCondition): void {
        this.coreCondition = condition;
    }

    protected restApi: ListnerApis;

    constructor(firstInstance?: any , secondInstance?: any) {
        if(firstInstance === undefined) {
            this.restApi = {
                firstApi: new ListnerV3UserApi(),
                secondApi: new ListnerV3AdminApi()
            }
        } else {
            this.restApi = {
                firstApi: firstInstance,
                secondApi: secondInstance
            }
        }
    }

    /**
     * ApiModule initialization method.
     * @param conf - set apiConfigType
     * @param log - set ccLogType
     * @param firstInstance - injection point of APIs for general user
     * @param secondInstance - injection point of APIs for administrators
     * @returns returns with gResult type that contains ccApiType if it's success, and unknown if it's failure.
     * So there is no need to be concerned about the failure status.
     */
    public init(conf: apiConfigType, log: ccLogType, firstInstance?: any , secondInstance?: any): gResult<ccApiType, unknown> {
        let status = 0;

        this.coreCondition = "loading";
        const core: ccApiType = {
            lib: new ApiModule(firstInstance, secondInstance),
            conf: conf,
            status: status,
            log: log,
            m: undefined,
            s: undefined,
            c: undefined,
            k: undefined
        }
        this.coreCondition = "initialized";

        core.lib.coreCondition = this.coreCondition;
        return this.aOK<ccApiType>(core);
    }

    /**
     * Restart this module
     * @param core - set ccApiType instance
     * @param log - set ccLogType instance
     * @param m - set ccMainType instance
     * @param s - set ccSystemType instance
     * @param c - set ccConfigType instance
     * @returns returns with gResult type that contains ccApiType if it's success, and gError if it's failure.
     */
    public async restart(core: ccApiType, log: ccLogType, m: ccMainType, s: ccSystemType, c: ccConfigType, k: ccKeyringType): Promise<gResult<ccApiType, gError>> {
        const LOG = log.lib.LogFunc(log);
        LOG("Info", 0, "ApiModule:restart");

        const ret1 = await this.deactivateApi(core, log, true);
        if (ret1.isFailure()) return ret1;
        this.coreCondition = "unloaded";

        const ret2 = this.init(core.conf, log);
        if (ret2.isFailure()) return this.aError("restart", "init", "unknown error");
        const newCore: ccApiType = ret2.value;
        // reconnect
        newCore.m = m;
        newCore.s = s;
        newCore.c = c;
        newCore.k = k;

        const ret3 = await newCore.lib.activateApi(newCore, log);
        if (ret3.isFailure()) return ret3;

        return this.aOK(newCore);
    }

    /**
     * Activate APIs
     * @param core - set ccApiType
     * @param log - set ccLogType
     * @returns  returns with gResult, that is wrapped by a Promise, that contains void if it's success, and gError if it's failure.
     * So there is no need to check the value of success.
     */
    public async activateApi(core: ccApiType, log: ccLogType): Promise<gResult<void, gError>> {
        const LOG = log.lib.LogFunc(log);
        LOG("Info", 0, "ApiModule:activateApi");

        let firstApi;
        let secondApi;
        const ret1 = await core.lib.restApi.firstApi.init(core);
        if (ret1.isFailure()) return this.aError("activateApi", "firstApi", "unknown error");
        firstApi = ret1.value
        const ret2 = await core.lib.restApi.secondApi.init(core);
        if (ret2.isFailure()) return this.aError("activateApi", "secondApi", "unknown error");
        secondApi = ret2.value

        if (core.conf.rest.use_tls === true) {
            // TLS
            if (core.k === undefined) return this.aError("activateApi", "enableTls", "The keyring module is down");
            let selfcrt: undefined | { key: string, cert: string };
            for (const entry of core.k.cache) {
                if ((entry.nodename === "self") && (entry.sign_key !== undefined) && (entry.tls_crt !== undefined)) {
                    selfcrt = { key: entry.sign_key, cert: entry.tls_crt } ;
                    break
                }
            }
            if (selfcrt === undefined) {
                return this.aError("activateApi", "enableTls", "The cache of private key and certification for this server are not found")
            }
            // Listen
            try {
                https.createServer(selfcrt, firstApi).listen(core.conf.rest.userapi_port);
                https.createServer(selfcrt, secondApi).listen(core.conf.rest.adminapi_port);
            } catch (error: any) {
                return this.aError("activateApi", "ListenHttps", error.toString());
            }
        } else {
            // Listen
            try {
                if (firstApi !== undefined) core.lib.restApi.firstApi.listen(core, firstApi);
                if (secondApi !== undefined) core.lib.restApi.secondApi.listen(core, secondApi);
            } catch (error: any) {
                return this.aError("activateApi", "ListenHttp", error.toString());
            }
        }

        this.coreCondition = "active";
        return this.aOK<void>(undefined);
    }

    /**
     * Deactivate APIs
     * @param core  - set ccApiType
     * @param log - set ccLogType
     * @param waitForClose - set true if it need to wait for closing servers
     * @returns  returns with gResult, that is wrapped by a Promise, that contains void if it's success, and gError if it's failure.
     * So there is no need to check the value of success.
     */
    public async deactivateApi(core: ccApiType, log: ccLogType, waitForClose?: boolean): Promise<gResult<void, gError>> {
        const LOG = log.lib.LogFunc(log);
        LOG("Info", 0, "ApiModule:deactivateApi");

        const ret1 = await core.lib.restApi.firstApi.shutdown(core);
        if (ret1.isFailure()) return this.aError("deactivateApi", "firstApi", "unknown error");
        const ret2 = await core.lib.restApi.secondApi.shutdown(core);
        if (ret2.isFailure()) return this.aError("deactivateApi", "secondApi", "unknown error");

        if (waitForClose === true) {
            LOG("Info", 0, "ApiModule:deactivateApi:Waiting for closing ports");
            for await (const _ of setInterval(1000)) {
                if ((core.lib.restApi.firstApi.getPort() === -1) && (core.lib.restApi.secondApi.getPort() === -1)) break;
            }
            LOG("Info", 0, "ApiModule:deactivateApi:Closing ports are completed");
        }

        return this.aOK<void>(undefined);
    }
}