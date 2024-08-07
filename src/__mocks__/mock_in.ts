/**
 * Copyright (c) 2024 Ryoji Kamei
 * Released under the MIT license
 * https://opensource.org/licenses/mit-license.php
 */

import { gResult, gSuccess, gFailure, gError } from "../utils";

import { ccInType, inDigestReturnDataFormat, rpcResultFormat } from "../internode";
import { inConnectionResetLevel } from "../internode/index.js";
import { randomString64 } from "../utils";
import { SystemModuleMock } from "./mock_system";
import { KeyringModuleMock } from "./mock_keyring";
import { BlockModuleMock } from "./mock_block";
import { LogModule } from "../logger";
import { inConfigType, nodeProperty } from "../config";
import { randomUUID } from "crypto";
import { icGeneralPacket } from "../../grpc/interconnect_pb";

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
                async init(conf: inConfigType, log: any, systemInstance: any, 
                    blockInstance: any, keyringInstance: any, ServerInstance?: any): Promise<gResult<any, unknown>> {
                    let core: any = {
                        lib: new InModuleMock(),
                        conf: conf,
                        log: log,
                        receiver: undefined,
                        s: systemInstance ?? undefined,
                        b: blockInstance ?? undefined,
                        k: keyringInstance ?? undefined
                    }
                    return iOK(core);
                },
                async start(core: any, services?: any, serverInstance?: any): Promise<gResult<void, gError>> {
                    if ((serverInstance === undefined) && ((services === undefined))) {
                        return iError("start", "createInsecure", "");
                    }
                    if (serverInstance === undefined) {
                        return iError("start", "startServer", "server instance is not defined");
                    }
                    if (services === undefined) {
                        return iError("start", "startServer", "serviceImplementation is not defined");
                    }
                    return iOK(undefined);
                },
                async restart(core: any, log: any, systemInstance: any, blockInstance: any, 
                    keyringInstance: any): Promise<gResult<any, gError>> {
                    if (systemInstance === undefined) {
                        return iError("stop", "stopServer", "");
                    }
                    const ret2 = await this.init(core.conf, log, systemInstance, blockInstance, keyringInstance);
                    if (ret2.isFailure()) { return iError("restart", "init", "unknown error") };
                    const newCore: any = ret2.value;
                    return iOK(newCore);
                },
                async stop(core: any): Promise<gResult<void, gError>> {
                    return iOK<void>(undefined);
                },
                async waitForRPCisOK(core: ccInType, waitSec: number, rpcInstance?: any): Promise<gResult<void, gError>> {
                    if (rpcInstance !== undefined) {
                        return iError("runRpcs", "runRpcs", "");
                    }
                    if (waitSec > 1000) {
                        return iError("waitForRPCisOK", "runRpcs", "Unreachable nodes have been remained yet");
                    }
                    return iOK<void>(undefined);
                },
                async runRpcs(core: ccInType, targets: nodeProperty[], request: string, dataAsString: string, maxRetryCount?: number, resetLevel?: inConnectionResetLevel): Promise<gResult<rpcResultFormat[], gError>> {
                    if (targets.length === 0) {
                        return iError("runRpcs", "runRpcs", "No nodes are allowed to communicate");
                    }
                    // getConnection errors
                    if (targets[0].nodename === "wrong") {
                        return iError("getConnection", "nodeConfiguration", "nodename " + targets[0].nodename + " is not found in the node list");
                    }
                    if (targets[0].allow_outgoing === false) {
                        return iError("getConnection", "nodeConfiguration", "nodename " + targets[0].nodename + " is not allowed in the node list");
                    }

                    // errors at makeNewCallWithListener
                    const fakeResult_OK: rpcResultFormat = {
                        id: randomUUID(),
                        node: targets[0],
                        result: iOK(new icGeneralPacket())
                    }
                    const fakeResult_NG: rpcResultFormat = {
                        id: randomUUID(),
                        node: targets[0],
                        result: iError("", "", "")
                    }
                    if (request === "wrong") { return iOK([fakeResult_NG]); }
                    return iOK([fakeResult_OK]);
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