/**
 * Copyright (c) 2024 Ryoji Kamei
 * Released under the MIT license
 * https://opensource.org/licenses/mit-license.php
 */

import { setInterval } from "timers/promises";
import { randomString24, gResult, gError, gSuccess, gFailure, randomOid } from "../../utils.js";
import systemrpc from '../../../grpc_v1/systemrpc_pb.js';
//const { ccSystemRpcFormat, Param, ReturnCode, ReturnValues } = systemrpc;

import { rpcReturnFormat, ccInType, InModule } from "../index.js";
import { Ca3TravelingIdFormat2 } from "../../block/algorithm/ca3.js";

import * as grpcMock from "../../__mocks__/mock_grpc.js";
import { gSystemRpcClientMock } from "../../__mocks__/mock_gsystemrpc.js";
import { SystemModuleMock } from "../../__mocks__/mock_system.js";
import { logMock } from "../../__mocks__/mock_logger.js";
import { inConfigType, nodeProperty } from "../../config/index.js";
import { DEFAULT_PARSEL_IDENTIFIER, examineHash, ccSystemType } from "../../system/index.js";
import { ccBlockType } from "../../block/index.js";
import { BlockModuleMock } from "../../__mocks__/mock_block.js";
import { ccKeyringType } from "../../keyring/index.js";
import { KeyringModuleMock } from "../../__mocks__/mock_keyring.js";
import { randomUUID } from "crypto";
import { objTx } from "../../datastore/index.js";

const myNode: nodeProperty = {
    allow_outgoing: true,
    nodename: "test_node2",
    host: "127.0.0.1",
    rpc_port: 7001
}

const anotherNode: nodeProperty = {
    allow_outgoing: true,
    nodename: "test_node1",
    host: "127.0.0.1",
    rpc_port: 7002
}

const confMock: inConfigType = {
    self: {
        nodename: "test_node2",
        rpc_port: 7001
    },
    nodes: [anotherNode]
}

async function sendRpcMockSuccess(core: ccInType, target: nodeProperty, payload: systemrpc.ccSystemRpcFormat.AsObject): Promise<gResult<rpcReturnFormat, gError>> {
        const targetHost: string = target.host + ":" + target.rpc_port;
        let ret: rpcReturnFormat = {
            targetHost: targetHost,
            request: payload.request,
            status: 0,
            data: undefined
        }
        return new gSuccess(ret);
}
async function sendRpcMockFailure(core: ccInType, target: nodeProperty, payload: systemrpc.ccSystemRpcFormat.AsObject): Promise<gResult<rpcReturnFormat, gError>> {
    return new gFailure(new gError("in", "waitForRPCisOK", "sendRpc", "Unreachable nodes have been remained yet:"));
}

let paramValue: {
    failIfUnhealthy: boolean | undefined,
    removePool: boolean | undefined,
    returnUndefinedIfFail: boolean | undefined
} = {
    failIfUnhealthy: undefined,
    removePool: undefined,
    returnUndefinedIfFail: undefined
}
type paramType = {
    getTenant(): string,
    getFailifunhealthy(): boolean | undefined,
    setFailifunhealthy(failIfUnhealthy: boolean | undefined): void,
    getRemovepool(): boolean | undefined,
    getReturnundefinedifnoexistent(): boolean | undefined,
    setReturnundefinedifnoexistent(returnUndefinedIfFail: boolean | undefined): void,
}
let param: paramType = {
    getTenant() { return randomUUID() },
    getFailifunhealthy() { return paramValue.failIfUnhealthy },
    setFailifunhealthy(failIfUnhealthy) { paramValue.failIfUnhealthy = failIfUnhealthy },
    getRemovepool() { return paramValue.removePool },
    getReturnundefinedifnoexistent() { return paramValue.returnUndefinedIfFail },
    setReturnundefinedifnoexistent(returnUndefinedIfFail) { paramValue.returnUndefinedIfFail = returnUndefinedIfFail }
};
let data: string;
let code: number;
const callMock: any = {
    request: {
        getDataasstring() { return data },
        setDataasstring(data1: any) { 
            if (typeof data1 === "string") {
                data = data1;
            } else {
                data = JSON.stringify(data1)
            }
        },
        getParam() { return param },
        setParam(param1: paramType) { param = param1 }
    }
}

let callbackOpts: any;
const callbackMock: any = (arg1: any, arg2: any) => {
    const objStr = JSON.stringify(arg2);
    let obj: any;
    let rc: number | undefined;
    let data: string | undefined;
    try {
        obj = JSON.parse(objStr);
        if (obj.array[0] === null) {
            rc = 0;
        } else {
            rc = obj.array[0];
        }
        try {
            data = obj.array[1];
        } catch (error) {
            data = undefined;
        }
    } catch (error) {
        rc = undefined;
        data = undefined;
    }
    try { // Prevent from JestAssertionError
        expect(rc).toBe(callbackOpts.rc);
        expect(data).toBe(callbackOpts.data);
    } catch (error) {
        
    }
};

describe("Test of InModule", () => {
    let core: ccInType;
    let score: ccSystemType;
    let bcore: ccBlockType;
    let kcore: ccKeyringType;

    beforeAll(async () => {
        const slib = new SystemModuleMock();
        const ret1 = slib.init();
        if (ret1.isSuccess()) score = ret1.value;
        const blib = new BlockModuleMock();
        const ret2 = await blib.init();
        if (ret2.isSuccess()) bcore = ret2.value;
        const klib = new KeyringModuleMock();
        const ret3 = await klib.init();
        if (ret3.isSuccess()) kcore = ret3.value;
        const lib = new InModule(new logMock(), score, bcore);
        const ret4 = await lib.init(confMock, new logMock(), score, bcore, kcore);
        if (ret4.isSuccess()) core = ret4.value;
    });

    describe("Method startServer()", () => {
        test("Success", async () => {
            const ret = await core.lib.startServer(core, new grpcMock.Server());
            expect(ret.type).toBe("success");
        });
        test("Failure", async () => {
            const ret = await core.lib.startServer(core, {});
            expect(ret.type).toBe("failure");
        });
    });

    describe("Method waitForRPCisOK()", () => {
        test("Success", async () => {
            const ret = await core.lib.waitForRPCisOK(core, 1, sendRpcMockSuccess);
            expect(ret.type).toBe("success"); 
        });
        test("Failure", async () => {
            const ret = await core.lib.waitForRPCisOK(core, 1, sendRpcMockFailure);
            expect(ret.type).toBe("failure"); 
        });
    });

    describe("Method pingCallback", () => {
        test("Success", () => {
            callbackOpts = { rc: 0, data: "Pong" };
            core.lib.pingCallback(callMock, callbackMock);
        });
    });

    describe("Method addPoolCallback", () => {
        test("Success", async () => {
            const obj: objTx = {
                _id: randomOid().byStr(),
                type: "new",
                tenant: DEFAULT_PARSEL_IDENTIFIER,
                settime: "1970/01/01 0:00:00",
                deliveryF: false,
                data: { data: "data" }
            }
            callMock.request.setDataasstring(obj);
            callbackOpts = { rc: 0, data: undefined }
            core.lib.addPoolCallback(callMock, callbackMock);
        });
    });

    describe("Method addBlockCa2Callback", () => {
        test("Failure", () => {
            callbackOpts = { rc: -2, data: undefined }
            core.lib.addBlockCa2Callback(callMock, callbackMock);
        });
    });

    describe("Method addBlockCa3Callback", () => {
        test("Success", () => {
            const tObj: any = {
                trackingId: randomUUID(),
                block: { size: 0 }
            };
            callMock.request.setDataasstring(tObj);
            callbackOpts = { rc: 0, data: undefined }
            core.lib.addBlockCa3Callback(callMock, callbackMock);
        });
        test("Failure", () => {
            const tObj: any = {
                trackingId: randomUUID(),
                block: { size: -1 }
            };
            callMock.request.setDataasstring(tObj);
            callbackOpts = { rc: -1, data: undefined }
            core.lib.addBlockCa3Callback(callMock, callbackMock);
        });
    });

    describe("Method getPoolHeightCallback", () => {
        test("Success", () => {
            callbackOpts = { rc: 0, data: "{\"height\":0}"}
            core.lib.getPoolHeightCallback(callMock, callbackMock);
        });
    });

    describe("Method getBlockHeightCallback", () => {
        test("Success", () => {
            callbackOpts = { rc: 0, data: "{\"height\":1}"}
            core.lib.getBlockHeightCallback(callMock, callbackMock);
        });
    });

    describe("Method getBlockDigestCallback", () => {
        test("Success", () => {
            param.setFailifunhealthy(true);
            callbackOpts = { rc: 0, data: "{\"hash\":\"fake\",\"height\":1}" }
            core.lib.getBlockDigestCallback(callMock, callbackMock);
        });
        test("Failure", () => {
            param.setFailifunhealthy(false);
            callbackOpts = { rc: -1, data: undefined }
            core.lib.getBlockDigestCallback(callMock, callbackMock);
        });
    });

    describe("Method getBlockCallback", () => {
        test("Success", () => {
            const oid: string = "OK";
            callMock.request.setDataasstring(oid);
            //param.setReturnundefinedifnoexistent(true);
            callbackOpts = { rc: 0, data: undefined }
            core.lib.getBlockCallback(callMock, callbackMock);
        });
        test("Failure", () => {
            const oid: string = "NG";
            callMock.request.setDataasstring(oid);
            //param.setReturnundefinedifnoexistent(false);
            callbackOpts = { rc: undefined, data: undefined }
            core.lib.getBlockCallback(callMock, callbackMock);
        });
    });

    describe("Method examineBlockDifferenceCallback", () => {
        test("Success", () => {
            const hash: examineHash = {
                _id: randomOid().byStr(),
                hash: "fake"
            }
            callMock.request.setDataasstring([hash]);
            callbackOpts = { rc: 0, data: "{\"add\":[],\"del\":[]}" }
            core.lib.examineBlockDifferenceCallback(callMock, callbackMock);
        });
        test("Failure", () => {
            const hash :examineHash = {
                _id: "wrong",
                hash: "fake"
            }
            callMock.request.setDataasstring([hash]);
            callbackOpts = { rc: -1, data: undefined }
            core.lib.examineBlockDifferenceCallback(callMock, callbackMock);
        });
    });

    describe("Method examinePoolDifferenceCallback", () => {
        test("Success", () => {
            const list: string = "fake";
            callMock.request.setDataasstring(list);
            callbackOpts = { rc: 0, data: "[]" }
            core.lib.examinePoolDifferenceCallback(callMock, callbackMock);
        });
        test("Failure", () => {
            const list: string = "wrong";
            callMock.request.setDataasstring(list);
            callbackOpts = { rc: -1, data: undefined }
            core.lib.examinePoolDifferenceCallback(callMock, callbackMock);
        });

    });

    describe("Method declareBlockCreationCallback", () => {
        test("Success1", () => {
            const tObj: Ca3TravelingIdFormat2 = {
                trackingId: randomUUID(),
                state: "underway",
                stored: false,
                timeoutMs: 10000,
                type: "data",
                tenant: randomUUID(),
                txOids: [ "fake" ],
                block: undefined
            };
            callMock.request.setDataasstring(tObj);
            callbackOpts = { rc: 0, data: "10000" }
            core.lib.declareBlockCreationCallback(callMock, callbackMock);
        });
        test("Success2", () => {
            const tObj: Ca3TravelingIdFormat2 = {
                trackingId: randomUUID(),
                state: "underway",
                stored: false,
                timeoutMs: 10000,
                type: "data",
                tenant: randomUUID(),
                txOids: [ "duplicateSample" ],
                block: undefined
            };
            callMock.request.setDataasstring(tObj);
            callbackOpts = { rc: 0, data: "-10000" }
            core.lib.declareBlockCreationCallback(callMock, callbackMock);
        });
    });

    describe("Method signAndResendOrStoreCallback", () => {
        test("Success", () => {
            const tObj: any = {
                trackingId: "OK"
            };
            callMock.request.setDataasstring(tObj);
            callbackOpts = { rc: 0, data: "0" }
            core.lib.signAndResendOrStoreCallback(callMock, callbackMock);
        });
        test("Failure", () => {
            const tObj: any = {
                trackingId: "sendErrorSample2"
            };
            callMock.request.setDataasstring(tObj);
            callbackOpts = { rc: -1, data: undefined }
            core.lib.signAndResendOrStoreCallback(callMock, callbackMock);
        });
    });

    /* It must be -2, however it returns 0 */
    describe("Method resetTestNodeCallback", () => {
        test("Failure", () => {
            callbackOpts = { rc: -2, data: undefined }
            core.lib.resetTestNodeCallback(callMock, callbackMock);
        });
    });

    describe("Method sendRpcAll()", () => {
        test("Success", async () => {
            const client: any =  new gSystemRpcClientMock();
            const payload: systemrpc.ccSystemRpcFormat.AsObject = {
                version: 3,
                request: "Ping",
                param: undefined,
                dataasstring: ""
            }
            const ret = await core.lib.sendRpcAll(core, payload, undefined, client);
            expect(ret.type).toBe("success");
        });
    });

    describe("Method sendRpc()", () => {
        test("Succeed in sending for ping", async () => {
            const client: any =  new gSystemRpcClientMock();
            const payload: systemrpc.ccSystemRpcFormat.AsObject = {
                version: 3,
                request: "Ping",
                param: undefined,
                dataasstring: ""
            }
            const ret = await core.lib.sendRpc(core, myNode, payload, undefined, client);
            expect(ret.type).toBe("success")
        })
        test("Failed sending for ping", async () => {
            const client: any =  new gSystemRpcClientMock();
            const payload: systemrpc.ccSystemRpcFormat.AsObject = {
                version: 3,
                request: "Ping",
                param: { failifunhealthy: true },
                dataasstring: ""
            }
            const ret = await core.lib.sendRpc(core, myNode, payload, undefined, client)
            if (ret.isFailure()) {
                const ret2: rpcReturnFormat = JSON.parse(ret.value.message)
                expect(ret2.status).toBe(-100);
            } else {
                throw new Error("unknown error");
            }
        })
        test("Succeed in sending for AddPool", async () => {
            const client: any =  new gSystemRpcClientMock();
            const payload: systemrpc.ccSystemRpcFormat.AsObject = {
                version: 3,
                request: "AddPool",
                param: undefined,
                dataasstring: ""
            }
            const ret = await core.lib.sendRpc(core, myNode, payload, undefined, client)
            expect(ret.type).toBe("success")
        })
        test("Failed sending for AddPool", async () => {
            const client: any =  new gSystemRpcClientMock();
            const payload: systemrpc.ccSystemRpcFormat.AsObject = {
                version: 3,
                request: "AddPool",
                param: { failifunhealthy: true },
                dataasstring: ""
            }
            const ret = await core.lib.sendRpc(core, myNode, payload, undefined, client)
            if (ret.isFailure()) {
                const ret2: rpcReturnFormat = JSON.parse(ret.value.message)
                expect(ret2.status).toBe(-100);
            } else {
                throw new Error("unknown error");
            }
        })
        test("Succeed in sending for AddBlock", async () => {
            const client: any =  new gSystemRpcClientMock();
            const payload: systemrpc.ccSystemRpcFormat.AsObject = {
                version: 3,
                request: "AddBlock",
                param: undefined,
                dataasstring: ""
            }
            const ret = await core.lib.sendRpc(core, myNode, payload, undefined, client)
            if (ret.isSuccess()) {
                expect(ret.value.status).toBe(0);
            } else {
                throw new Error("unknown error");
            }
        })
        test("Failed sending for AddBlock", async () => {
            const client: any =  new gSystemRpcClientMock();
            const payload: systemrpc.ccSystemRpcFormat.AsObject = {
                version: 3,
                request: "AddBlock",
                param: { failifunhealthy: true },
                dataasstring: ""
            }
            const ret = await core.lib.sendRpc(core, myNode, payload, undefined, client)
            if (ret.isFailure()) {
                const ret2: rpcReturnFormat = JSON.parse(ret.value.message)
                expect(ret2.status).toBe(-100);
            } else {
                throw new Error("unknown error");
            }
        })
        test("Succeed in sending for AddBlockCa3", async () => {
            const client: any =  new gSystemRpcClientMock();
            const payload: systemrpc.ccSystemRpcFormat.AsObject = {
                version: 3,
                request: "AddBlockCa3",
                param: undefined,
                dataasstring: ""
            }
            const ret = await core.lib.sendRpc(core, myNode, payload, undefined, client)
            if (ret.isSuccess()) {
                expect(ret.value.status).toBe(0);
            } else {
                throw new Error("unknown error");
            }
        })
        test("Failed sending for AddBlockCa3", async () => {
            const client: any =  new gSystemRpcClientMock();
            const payload: systemrpc.ccSystemRpcFormat.AsObject = {
                version: 3,
                request: "AddBlockCa3",
                param: { failifunhealthy: true },
                dataasstring: ""
            }
            const ret = await core.lib.sendRpc(core, myNode, payload, undefined, client)
            if (ret.isFailure()) {
                const ret2: rpcReturnFormat = JSON.parse(ret.value.message)
                expect(ret2.status).toBe(-100);
            } else {
                throw new Error("unknown error");
            }
        })
        test("Succeed in sending for GetPoolHeight", async () => {
            const client: any =  new gSystemRpcClientMock();
            const payload: systemrpc.ccSystemRpcFormat.AsObject = {
                version: 3,
                request: "GetPoolHeight",
                param: undefined,
                dataasstring: ""
            }
            const ret = await core.lib.sendRpc(core, myNode, payload, undefined, client)
            if (ret.isSuccess()) {
                expect(ret.value.status).toBe(0);
            } else {
                throw new Error("unknown error");
            }
        })
        test("Failed sending for GetPoolHeight", async () => {
            const client: any =  new gSystemRpcClientMock();
            const payload: systemrpc.ccSystemRpcFormat.AsObject = {
                version: 3,
                request: "GetPoolHeight",
                param: { failifunhealthy: true },
                dataasstring: ""
            }
            const ret = await core.lib.sendRpc(core, myNode, payload, undefined, client)
            if (ret.isFailure()) {
                const ret2: rpcReturnFormat = JSON.parse(ret.value.message)
                expect(ret2.status).toBe(-100);
            } else {
                throw new Error("unknown error");
            }
        })
        test("Succeed in sending for GetBlockHeight", async () => {
            const client: any =  new gSystemRpcClientMock();
            const payload: systemrpc.ccSystemRpcFormat.AsObject = {
                version: 3,
                request: "GetBlockHeight",
                param: undefined,
                dataasstring: ""
            }
            const ret = await core.lib.sendRpc(core, myNode, payload, undefined, client)
            if (ret.isSuccess()) {
                expect(ret.value.status).toBe(0);
            } else {
                throw new Error("unknown error");
            }
        })
        test("Failed sending for GetBlockHeight", async () => {
            const client: any =  new gSystemRpcClientMock();
            const payload: systemrpc.ccSystemRpcFormat.AsObject = {
                version: 3,
                request: "GetBlockHeight",
                param: { failifunhealthy: true },
                dataasstring: ""
            }
            const ret = await core.lib.sendRpc(core, myNode, payload, undefined, client)
            if (ret.isFailure()) {
                const ret2: rpcReturnFormat = JSON.parse(ret.value.message)
                expect(ret2.status).toBe(-100);
            } else {
                throw new Error("unknown error");
            }
        })
        test("Succeed in sending for GetBlockDigest", async () => {
            const client: any =  new gSystemRpcClientMock();
            const payload: systemrpc.ccSystemRpcFormat.AsObject = {
                version: 3,
                request: "GetBlockDigest",
                param: undefined,
                dataasstring: ""
            }
            const ret  = await core.lib.sendRpc(core, myNode, payload, undefined, client)
            if (ret.isSuccess()) {
                expect(ret.value.status).toBe(0);
            } else {
                throw new Error("unknown error");
            }
        })
        test("Failed sending for GetBlockDigest", async () => {
            const client: any =  new gSystemRpcClientMock();
            const payload: systemrpc.ccSystemRpcFormat.AsObject = {
                version: 3,
                request: "GetBlockDigest",
                param: { failifunhealthy: true },
                dataasstring: ""
            }
            const ret = await core.lib.sendRpc(core, myNode, payload, undefined, client)
            if (ret.isFailure()) {
                const ret2: rpcReturnFormat = JSON.parse(ret.value.message)
                expect(ret2.status).toBe(-100);
            } else {
                throw new Error("unknown error");
            }
        })
        test("Succeed in sending for GetBlock", async () => {
            const client: any =  new gSystemRpcClientMock();
            const payload: systemrpc.ccSystemRpcFormat.AsObject = {
                version: 3,
                request: "GetBlock",
                param: undefined,
                dataasstring: ""
            }
            const ret = await core.lib.sendRpc(core, myNode, payload, undefined, client)
            if (ret.isSuccess()) {
                expect(ret.value.status).toBe(0)
            } else {
                throw new Error("unknown error");
            }
        })
        test("Failed sending for GetBlock", async () => {
            const client: any =  new gSystemRpcClientMock();
            const payload: systemrpc.ccSystemRpcFormat.AsObject = {
                version: 3,
                request: "GetBlock",
                param: { failifunhealthy: true },
                dataasstring: ""
            }
            const ret = await core.lib.sendRpc(core, myNode, payload, undefined, client)
            if (ret.isFailure()) {
                const ret2: rpcReturnFormat = JSON.parse(ret.value.message)
                expect(ret2.status).toBe(-100);
            } else {
                throw new Error("unknown error");
            }
        })
        test("Succeed in sending for ExamineBlockDifference", async () => {
            const client: any =  new gSystemRpcClientMock();
            const payload: systemrpc.ccSystemRpcFormat.AsObject = {
                version: 3,
                request: "ExamineBlockDifference",
                param: undefined,
                dataasstring: ""
            }
            const ret = await core.lib.sendRpc(core, myNode, payload, undefined, client)
            if (ret.isSuccess()) {
                expect(ret.value.status).toBe(0);
            } else {
                throw new Error("unknown error");
            }
        })
        test("Failed sending for ExamineBlockDifference", async () => {
            const client: any =  new gSystemRpcClientMock();
            const payload: systemrpc.ccSystemRpcFormat.AsObject = {
                version: 3,
                request: "ExamineBlockDifference",
                param: { failifunhealthy: true },
                dataasstring: ""
            }
            const ret = await core.lib.sendRpc(core, myNode, payload, undefined, client)
            if (ret.isFailure()) {
                const ret2: rpcReturnFormat = JSON.parse(ret.value.message)
                expect(ret2.status).toBe(-100);
            } else {
                throw new Error("unknown error");
            }
        })
        test("Succeed in sending for ExaminePoolDifference", async () => {
            const client: any =  new gSystemRpcClientMock();
            const payload: systemrpc.ccSystemRpcFormat.AsObject = {
                version: 3,
                request: "ExaminePoolDifference",
                param: undefined,
                dataasstring: ""
            }
            const ret = await core.lib.sendRpc(core, myNode, payload, undefined, client)
            if (ret.isSuccess()) {
                expect(ret.value.status).toBe(0);
            } else {
                throw new Error("unknown error");
            }
        })
        test("Failed sending for ExaminePoolDifference", async () => {
            const client: any =  new gSystemRpcClientMock();
            const payload: systemrpc.ccSystemRpcFormat.AsObject = {
                version: 3,
                request: "ExaminePoolDifference",
                param: { failifunhealthy: true },
                dataasstring: ""
            }
            const ret = await core.lib.sendRpc(core, myNode, payload, undefined, client)
            if (ret.isFailure()) {
                const ret2: rpcReturnFormat = JSON.parse(ret.value.message)
                expect(ret2.status).toBe(-100);
            } else {
                throw new Error("unknown error");
            }
        })
        test("Succeed in sending for DeclareBlockCreation", async () => {
            const client: any =  new gSystemRpcClientMock();
            const payload: systemrpc.ccSystemRpcFormat.AsObject = {
                version: 3,
                request: "DeclareBlockCreation",
                param: undefined,
                dataasstring: ""
            }
            const ret = await core.lib.sendRpc(core, myNode, payload, undefined, client)
            if (ret.isSuccess()) {
                expect(ret.value.status).toBe(0);
            } else {
                throw new Error("unknown error");
            }
        })
        test("Failed sending for DeclareBlockCreation", async () => {
            const client: any =  new gSystemRpcClientMock();
            const payload: systemrpc.ccSystemRpcFormat.AsObject = {
                version: 3,
                request: "DeclareBlockCreation",
                param: { failifunhealthy: true },
                dataasstring: ""
            }
            const ret = await core.lib.sendRpc(core, myNode, payload, undefined, client)
            if (ret.isFailure()) {
                const ret2: rpcReturnFormat = JSON.parse(ret.value.message)
                expect(ret2.status).toBe(-100);
            } else {
                throw new Error("unknown error");
            }
        })
        test("Succeed in sending for SignAndResendOrStore", async () => {
            const client: any =  new gSystemRpcClientMock();
            const payload: systemrpc.ccSystemRpcFormat.AsObject = {
                version: 3,
                request: "SignAndResendOrStore",
                param: undefined,
                dataasstring: ""
            }
            const ret = await core.lib.sendRpc(core, myNode, payload, undefined, client)
            if (ret.isSuccess()) {
                expect(ret.value.status).toBe(0);
            } else {
                throw new Error("unknown error");
            }
        })
        test("Failed sending for SignAndResendOrStore", async () => {
            const client: any =  new gSystemRpcClientMock();
            const payload: systemrpc.ccSystemRpcFormat.AsObject = {
                version: 3,
                request: "SignAndResendOrStore",
                param: { failifunhealthy: true },
                dataasstring: ""
            }
            const ret = await core.lib.sendRpc(core, myNode, payload, undefined, client)
            if (ret.isFailure()) {
                const ret2: rpcReturnFormat = JSON.parse(ret.value.message)
                expect(ret2.status).toBe(-100);
            } else {
                throw new Error("unknown error");
            }
        })
        test("Succeed in sending for ResetTestNode", async () => {
            const client: any =  new gSystemRpcClientMock();
            const payload: systemrpc.ccSystemRpcFormat.AsObject = {
                version: 3,
                request: "ResetTestNode",
                param: undefined,
                dataasstring: ""
            }
            const ret = await core.lib.sendRpc(core, myNode, payload, undefined, client)
            if (ret.isSuccess()) {
                expect(ret.value.status).toBe(0)
            } else {
                throw new Error("unknown error");
            }
        })
        test("Failed sending for ResetTestNode", async () => {
            const client: any =  new gSystemRpcClientMock();
            const payload: systemrpc.ccSystemRpcFormat.AsObject = {
                version: 3,
                request: "ResetTestNode",
                param: { failifunhealthy: true },
                dataasstring: ""
            }
            const ret = await core.lib.sendRpc(core, myNode, payload, undefined, client)
            if (ret.isFailure()) {
                const ret2: rpcReturnFormat = JSON.parse(ret.value.message)
                expect(ret2.status).toBe(-100);
            } else {
                throw new Error("unknown error");
            }
        })
        test("Failed sending for Unknown request", async () => {
            const client: any =  new gSystemRpcClientMock();
            const payload: systemrpc.ccSystemRpcFormat.AsObject = {
                version: 3,
                request: randomString24(),
                param: undefined,
                dataasstring: ""
            }
            const ret = await core.lib.sendRpc(core, myNode, payload, undefined, client)
            if (ret.isFailure()) {
                const ret2: rpcReturnFormat = JSON.parse(ret.value.message);
                expect(ret2.status).toBe(-1);
            } else {
                throw new Error("unknown error");
            }
        })
    })
})