/**
 * Copyright (c) 2024 Ryoji Kamei
 * Released under the MIT license
 * https://opensource.org/licenses/mit-license.php
 */

import { ccInType, inConnection } from "..";
import { ccSystemType } from "../../system";
import { ccBlockType } from "../../block";
import { ccKeyringType } from "../../keyring";
import { InModule } from "..";
import * as ic_grpc from "../../__mocks__/mock_ic_grpc";
import { SystemModuleMock } from "../../__mocks__/mock_system";
import { BlockModuleMock } from "../../__mocks__/mock_block";
import { KeyringModuleMock } from "../../__mocks__/mock_keyring";
import { logMock } from "../../__mocks__/mock_logger";
import { nodeProperty, inConfigType } from "../../config";

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

const clientSuccess = ic_grpc.interconnectClient_Success;
const clientFailure = ic_grpc.interconnectClient_Failure;
const Server = ic_grpc.ServerMock;

describe("Test of InModule", () => {
    let core: ccInType;
    let coreW1: ccInType;
    let coreW2: ccInType;
    let coreW3: ccInType;
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
        const lib = new InModule(confMock, new logMock(), score, bcore, kcore, new Server(0, 0, 0));
        // right core
        const ret4 = await lib.init(confMock, new logMock(), score, bcore, kcore, new Server(0, 0, 0));
        if (ret4.isFailure()) { throw new Error("FAIL"); }
        core = ret4.value;
        // wrong server 1, addService error
        const ret5 = await lib.init(confMock, new logMock(), score, bcore, kcore, new Server(1, 0, 0));
        if (ret5.isFailure()) { throw new Error("FAIL"); }
        coreW1 = ret5.value;
        // wrong server 2, bindAsync error
        const ret6 = await lib.init(confMock, new logMock(), score, bcore, kcore, new Server(0, 1, 0));
        if (ret6.isFailure()) { throw new Error("FAIL"); }
        coreW2 = ret6.value;
        // wrong server 3, tryShutdown error
        const ret7 = await lib.init(confMock, new logMock(), score, bcore, kcore, new Server(0, 0, 1));
        if (ret7.isFailure()) { throw new Error("FAIL"); }
        coreW3 = ret7.value;
    });

    describe("Method restart()", () => { // including stop
        test("Success1", async () => {
            const ret = await core.lib.restart(core, core.log, score, bcore, kcore, new Server(0, 0, 0));
            expect(ret.type).toBe("success");
            if (ret.isFailure()) { throw new Error("FAIL"); }
            expect(ret.value.lib.getCondition()).toBe("active");
        });
        //test("Failure1", async () => {
        //    const ret = await core.lib.restart(core, core.log, score, bcore, kcore, new Server(1, 0, 0));
        //    expect(ret.type).toBe("failure");
        //    if (ret.isSuccess()) { throw new Error("FAIL"); }
        //    expect(core.lib.getCondition()).toBe("initialized");
        //});
        test("Failure2", async () => {
            const ret = await core.lib.restart(core, core.log, score, bcore, kcore, new Server(0, 1, 0));
            expect(ret.type).toBe("failure");
            if (ret.isSuccess()) { throw new Error("FAIL"); }
            expect(core.lib.getCondition()).toBe("initialized");
        });
        test("Success2", async () => {
            const ret = await coreW3.lib.restart(core, core.log, score, bcore, kcore, new Server(0, 0, 0));
            expect(ret.type).toBe("success");
            if (ret.isFailure()) { throw new Error("FAIL"); }
            expect(ret.value.lib.getCondition()).toBe("active");
        });
    });

    describe("Method waitForRPCisOK()", () => {
        test("Success", async () => {
            const ret = await core.lib.waitForRPCisOK(core, 0, clientSuccess, true);
            expect(ret.type).toBe("success");
        });
        test("Failure", async () => {
            const ret = await core.lib.waitForRPCisOK(core, 0, clientFailure, true);
            expect(ret.type).toBe("failure");
        });
    });

    describe("Method runRpcs()", () => {
        test("Success", async () => {
            const ret = await core.lib.runRpcs(core, [anotherNode], "Ping", "Ping", undefined, "channel", clientSuccess);
            expect(ret.type).toBe("success");
            if (ret.isFailure()) { throw new Error("FAIL"); }
            expect(ret.value[0].result.type).toBe("success");
        });
        test("Failure1", async () => {
            const ret = await core.lib.runRpcs(core, [], "Ping", "Ping", undefined, "channel", clientSuccess);
            expect(ret.type).toBe("failure");
            if (ret.isSuccess()) { throw new Error("FAIL"); }
            expect(ret.value.message).toBe("No nodes are allowed to communicate");
        });
        test("Failure2", async () => {
            const ret = await core.lib.runRpcs(core, [anotherNode], "Ping", "Ping", undefined, "channel", clientFailure);
            expect(ret.type).toBe("success");
            if (ret.isFailure()) { throw new Error("FAIL"); }
            expect(ret.value[0].result.type).toBe("failure");
        });


    });
})