/**
 * Copyright (c) 2024 Ryoji Kamei
 * Released under the MIT license
 * https://opensource.org/licenses/mit-license.php
 */

import { gResult, gSuccess, gFailure, gError } from "../utils";

import { ccInType, InModule, rpcResultFormat, inRequestType } from "../internode";
import { inConnectionResetLevel } from "../internode/index.js";
import { SystemModuleMock } from "./mock_system";
import { ccLogType, LogModule } from "../logger";
import { inConfigType, logConfigType, nodeProperty } from "../config";
import { randomUUID } from "crypto";
import { InReceiverSubModuleMock } from "./mock_in_receiver";

const InConf: inConfigType = {
    self: {
        nodename: "node1",
        rpc_port: 7000,
        use_tls_internode: false
    },
    abnormalCountForJudging: 2,
    nodes: [
        {
            allow_outgoing: true,
            nodename: "node2",
            host: "192.168.1.51",
            rpc_port: 7000,
            use_tls_internode: false,
            administration_id: randomUUID()
        },
        {
            allow_outgoing: true,
            nodename: "node3",
            host: "192.168.1.52",
            rpc_port: 7000,
            use_tls_internode: false,
            administration_id: randomUUID()
        }
    ],
    administration_id: randomUUID(),
    default_tenant_id: randomUUID()
}

function iOK<T>(response: T): gResult<T, never> {
    return new gSuccess(response)
}

function iError(func: string, pos?: string, message?: string): gResult<never, gError> {
    return new gFailure(new gError("in", func, pos, message));
}

export class InModuleMock {
    public score: any;

 
    constructor() {
        const ret1 = new SystemModuleMock().init();
        if (ret1.isSuccess()) this.score = ret1.value;
    }

    public async init(): Promise<gResult<any, unknown>> {
        return iOK({
            lib: {
                async init(conf: inConfigType, log: any, systemInstance: any, blockInstance: any, 
                    keyringInstance: any, configInstance: any, ServerInstance?: any): Promise<gResult<any, unknown>> {
                    let core: any = {
                        lib: new InModuleMock(),
                        conf: conf,
                        log: log,
                        s: systemInstance ?? undefined,
                        b: blockInstance ?? undefined,
                        k: keyringInstance ?? undefined,
                        c: configInstance ?? undefined
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
                    keyringInstance: any, configInstance: any): Promise<gResult<any, gError>> {
                    if (systemInstance === undefined) {
                        return iError("stop", "stopServer", "");
                    }
                    const ret2 = await this.init(core.conf, log, systemInstance, blockInstance, keyringInstance, configInstance);
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
                async disableAbnormalNodes(core: ccInType, abnormalNodes: string[]): Promise<gResult<void, unknown>> {
                    return iOK<void>(undefined)
                },
                async runRpcs(core: ccInType, targets: nodeProperty[], request: inRequestType, dataAsString: string, maxRetryCount?: number, resetLevel?: inConnectionResetLevel, clientImpl?: any): Promise<gResult<rpcResultFormat[], gError>> {
                    console.log("Using half-mocked runRpcs for " + request)
                    const ic_grpc = await import("./mock_ic_grpc.js");
                    const originalLib = new InModule(InConf, core.log, core.s, core.b, new ic_grpc.ServerMock(0, 0, 0), new InReceiverSubModuleMock());
                    const logConf: logConfigType = {
                        console_output: false,
                        console_level: 6,
                        console_color: "None",
                        console_color_code: "\u001b[0m",
                        file_output: false,
                        file_path: "",
                        file_rotation: false,
                        file_level: 6,
                        file_level_text: ""
                    }
                    const ret = new LogModule().init(logConf);
                    let logType: ccLogType | undefined;
                    if (ret.isSuccess()) logType = ret.value;
                    let originalCore: ccInType | undefined;
                    const ret2 = await originalLib.init(InConf, logType!, core.s, core.b, core.k, core.c, new ic_grpc.ServerMock(0, 0, 0), undefined, new InReceiverSubModuleMock());
                    if (ret2.isFailure()) { throw new Error(JSON.stringify(ret2.value)); }
                    originalCore = ret2.value;
                    if (request === "TestMode") {
                        return await originalLib.runRpcs(originalCore, targets, request, dataAsString, 0, "channel", ic_grpc.interconnectClient_Failure);
                    } else {
                        return await originalLib.runRpcs(originalCore, targets, request, dataAsString, 0, "channel", ic_grpc.interconnectClient_Success);
                    }
                },
            },

            conf: InConf,
            status: 0,
            log: new LogModule(),
            s: undefined,
            b: undefined,
            k: undefined
        })
    }
}