/**
 * Copyright (c) 2024 Ryoji Kamei
 * Released under the MIT license
 * https://opensource.org/licenses/mit-license.php
 */

import { gResult, gSuccess, gFailure, gError } from "../utils";

import { blockConfigType } from "../config";
import { objTx } from "../datastore";
import { ccBlockType, createBlockOptions } from "../block";
import { blockFormat } from "../block";
import { LogModule } from "../logger";

import { generateSamples } from "../__testdata__/generator";

import * as ca3 from "./mock_ca3";

const blockConf: blockConfigType = {
    ca3: {
        minLifeTime: 40,
        maxLifeTime: 360,
        minSignNodes: 2,
        maxSignNodes: 2
    }
}

function bOK<T>(response: T): gResult<T, never> {
    return new gSuccess(response)
}
function bError(func: string, pos?: string, message?: string): gResult<never, gError> {
    return new gFailure(new gError("block", func, pos, message));
}

export class BlockModuleMock {

    constructor() {}

    public async init(): Promise<gResult<any, gError>> {
        return bOK({
            lib: {
                async createBlock(core: ccBlockType, txArr: objTx[], tenantId: string, blockOptions?: createBlockOptions, commonId?: string): Promise<gResult<blockFormat, gError>> {
                    const ret = (await generateSamples()).blks.get("blk0");
                    if (ret === undefined) return bError("createBlock", "get", "unknown error");
                    return bOK(ret);
                },
                async verifyBlock(core: ccBlockType, bObj: blockFormat, trackingId?: string): Promise<gResult<number, gError>> {
                    let ret = 0;
                    if (bObj.size === -2) ret = -2;
                    if (bObj.size === -1) ret = -1;
                    if (bObj.size === 3) ret = 3;
                    return bOK(ret);
                }
            },
            algorithm: ca3,
            conf: blockConf,
            status: 0,
            log: new LogModule(),
            d: undefined
        })
    }
}
