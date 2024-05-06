/**
 * Copyright (c) 2024 Ryoji Kamei
 * Released under the MIT license
 * https://opensource.org/licenses/mit-license.php
 */

import { gResult, gSuccess, gFailure, gError } from "../utils.js";

import { ccApiType } from "./index.js";
import { apiConfigType } from "../config/index.js";
import { ccLogType } from "../logger/index.js";

import { ListnerV3UserApi } from "./rest/user.js";
import { ListnerV3AdminApi } from "./rest/admin.js";

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

        const core: ccApiType = {
            lib: new ApiModule(firstInstance, secondInstance),
            conf: conf,
            status: status,
            log: log,
            m: undefined,
            s: undefined
        }

        return this.aOK<ccApiType>(core);
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
        if (ret1.isFailure()) return this.aError("activateApi", "Init", "unknown error");
        firstApi = ret1.value
        const ret2 = await core.lib.restApi.secondApi.init(core);
        if (ret2.isFailure()) return this.aError("activateApi", "Init", "unknown error");
        secondApi = ret2.value

        // Listen
        try {
            if (firstApi !== undefined) core.lib.restApi.firstApi.listen(core, firstApi);
            if (secondApi !== undefined) core.lib.restApi.secondApi.listen(core, secondApi);
        } catch (error: any) {
            return this.aError("activateApi", "Listen", error.toString());
        }

        return this.aOK<void>(undefined);
    }
}