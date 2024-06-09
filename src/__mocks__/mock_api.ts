/**
 * Copyright (c) 2024 Ryoji Kamei
 * Released under the MIT license
 * https://opensource.org/licenses/mit-license.php
 */

import { gResult, gSuccess, gFailure, gError } from "../utils";

import { ApiModule, ccApiType } from "../api";
import { apiConfigType } from "../config";
import { logMock } from "./mock_logger";

export const confMock: apiConfigType = {
    rest: {
        password_encryption: false,
        userapi_port: 9000,
        adminapi_port: 8000,
        userapi_user: "test1",
        userapi_password: "test1password",
        adminapi_user: "test2",
        adminapi_password: "test2password"
    }
}

export class ApiModuleMock {
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

    public async init(): Promise<gResult<ccApiType, gError>> {
        const acore: ccApiType = {
            lib: new ApiModule(),
            conf: confMock,
            status: 0,
            log: new logMock(),
            m: undefined,
            s: undefined,
            c: undefined
        }
        return this.aOK<ccApiType>(acore);
    }
}