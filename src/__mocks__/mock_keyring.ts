/**
 * Copyright (c) 2024 Ryoji Kamei
 * Released under the MIT license
 * https://opensource.org/licenses/mit-license.php
 */

import { LogModule } from "../logger";
import { gResult, gSuccess, gFailure, gError, randomString64 } from "../utils";

import { ccKeyringType } from "../keyring";

function kOK<T>(response: T): gResult<T, never> {
    return new gSuccess(response)
}

function kError(func: string, pos?: string, message?: string): gResult<never, gError> {
    return new gFailure(new gError("keyring", func, pos, message));
}

const keyringConf = {}

export class KeyringModuleMock {
    constructor() {}

    public async init(): Promise<gResult<any, gError>> {
        return kOK({
            lib: {
                async postSelfPublicKeys(core: ccKeyringType): Promise<gResult<void, gError>> {
                    return kOK(undefined);
                },
                async refreshPublicKeyCache(core: ccKeyringType, waitOnStartUp?: boolean): Promise<gResult<void, gError>> {
                    return kOK(undefined);
                },
                async signByPrivateKey(core: ccKeyringType, target: object, trackingId: string): Promise<gResult<string, gError>> {
                    return kOK(randomString64());
                },
                async verifyByPublicKey(core: ccKeyringType, signature: string, target: object, nodename: string, trackingId?: string): Promise<gResult<boolean, gError>> {
                    switch (signature) {
                        case "failSample1":
                            return kError("verifyByPublicKey", "refreshPublicKeyCache");
                        case "failSample2":
                            return kError("verifyByPublicKey", "verify");
                        case "failSample3":
                            return kOK(false);
                        default:
                            return kOK(true);
                    }
                }
            },
            conf: keyringConf,
            status: 0,
            log: new LogModule(),
            m: undefined,
            s: undefined
        })
    }
}
