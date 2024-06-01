/**
 * Copyright (c) 2024 Ryoji Kamei
 * Released under the MIT license
 * https://opensource.org/licenses/mit-license.php
 */

import { gResult, gSuccess, gFailure, gError } from "../utils";

import { digestDataFormat, rpcReturnFormat, ccInType } from "../internode";
import * as systemrpc from "../../grpc/systemrpc_pb"
import { randomString64 } from "../utils";
import { SystemModuleMock } from "./mock_system";
import { KeyringModuleMock } from "./mock_keyring";
import { BlockModuleMock } from "./mock_block";
import { LogModule } from "../logger";
import { inConfigType } from "../config";

const InConf: inConfigType = {
    "self": {
        "nodename": "node1",
        "rpc_port": 7000
    },
    "nodes": [
        {
            "allow_outgoing": true,
            "nodename": "node2",
            "host": "192.168.1.51",
            "rpc_port": 7000
        },
        {
            "allow_outgoing": true,
            "nodename": "node3",
            "host": "192.168.1.52",
            "rpc_port": 7000
        }
    ]
}

function iOK<T>(response: T): gResult<T, never> {
    return new gSuccess(response)
}

function iError(func: string, pos?: string, message?: string): gResult<never, gError> {
    return new gFailure(new gError("in", func, pos, message));
}

export class InModuleMock {
    protected score: undefined;
    protected sconf: undefined;

 
    constructor() {}

    public async init(): Promise<gResult<any, unknown>> {
        return iOK({
            lib: {
                addPoolCallback() {},
                addBlockCallback() {},
                getPoolHeightCallback() {},
                getBlockHeightCallback() {},
                getBlockDigestCallback() {},
                getBlockCallback() {},
                examineBlockDifferenceCallback() {},
                examinePoolDifferenceCallback() {},
                async sendRpcAll(core: ccInType, payload: systemrpc.ccSystemRpcFormat.AsObject, timeoutMs?: number,
                    clientInstance?: any): Promise<gResult<rpcReturnFormat[], unknown>> {
                    const ret = await this.sendRpc(core, "", payload, timeoutMs, clientInstance);
                    if (ret.isSuccess()) return iOK([ret.value]);
                    return iError("Error");
                },
                async sendRpc(core: ccInType, target: any, payload: systemrpc.ccSystemRpcFormat.AsObject, 
                    timeoutMs?: number, clientInstance?: any, retry?: number): Promise<gResult<rpcReturnFormat, gError>>  {
                    let ret: rpcReturnFormat = {
                        targetHost: "",
                        request: payload.request,
                        status: 0,
                        data: undefined
                    }
                    if (payload.request === "GetBlockDigest") {
                        const retData: digestDataFormat = {
                            hash: randomString64(),
                            height: 0
                        }
                        ret.data = JSON.stringify(retData);
                        return iOK(ret);
                    }
                    if (payload.request === "ExaminePoolDifference") {
                        return iOK(ret);
                    }
                    if (payload.request === "SignAndResendOrStore") {
                        if ((timeoutMs === undefined) || (timeoutMs > 0)) {
                            const obj = JSON.parse(payload.dataasstring);
                            ret.data = JSON.stringify(obj.block);
                            return iOK(ret);

                        } else {
                            return iError("sendRpc", "createRpcConnection", "")
                        }
                    }
                    // default
                    if ((timeoutMs === undefined) || (timeoutMs > 0)) {
                        return iOK(ret);
                    } else {
                        return iError("sendRpc", "rpcReturnFormat", "")
                    }
                }
            },

            conf: InConf,
            status: 0,
            log: new LogModule(),
            s: new SystemModuleMock().init(),
            b: new BlockModuleMock().init(),
            k: new KeyringModuleMock().init()
        })
    }
}