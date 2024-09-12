/**
 * Copyright (c) 2024 Ryoji Kamei
 * Released under the MIT license
 * https://opensource.org/licenses/mit-license.php
 */

import clone from "clone";
import { MongoMemoryServer } from "mongodb-memory-server";
import { randomUUID } from "crypto";

import { gFailure, gError } from "../../utils";

import { MainModule } from "..";
import { dsConfigType, mainConfigType } from "../../config";
import { randomString24 } from "../../utils";
import { DsModuleMock } from "../../__mocks__/mock_ds";
import { logMock } from "../../__mocks__/mock_logger";
import { blockFormat } from "../../block";
import { objTx } from "../../datastore";
import { dataSet, generateSamples } from "../../__testdata__/generator";
import { BackendDbSubModule } from "../../datastore/mongodb";
import { MongoClient } from "mongodb";
import { installSamples } from "../../__testdata__/installer";

const rand = randomUUID()

const dbLib = new BackendDbSubModule()
let confMockDs: dsConfigType = {
    password_encryption: false,
    mongo_blockcollection: "block_node1",
    mongo_dbname: "bcdb_" + rand,
    mongo_dbuser: "bcuser_" + rand,
    mongo_host: "127.0.0.1",
    mongo_password: "bcpass_" + rand,
    mongo_poolcollection: "pool_node1",
    mongo_port: -1, // get later
    mongo_authdb: "admin",
    queue_ondisk: false,
    administration_id: randomUUID(),
    default_tenant_id: randomUUID(),
    enable_default_tenant: true
};
type StorageEngine = "ephemeralForTest" | "wiredTiger";
const engine: StorageEngine = "wiredTiger";
const dbServerOpts = {
    binary: {
        version: "6.0.15",
        skipMD5: true
    },
    auth: {
        enable: true,
        customRootName: "bcuser_" + rand,
        customRootPwd: "bcpass_" + rand
    },
    instance: { auth: true, storageEngine: engine },
    autoStart: true
}
const server = await MongoMemoryServer.create(dbServerOpts);
confMockDs.mongo_port = Number(server.getUri().split(":")[2].split("/")[0]);
const ret = await dbLib.init(confMockDs);
if (ret.isFailure()) throw new Error("FAIL");
const client: MongoClient = ret.value;
const ds: dataSet = await generateSamples();

let confMock: mainConfigType = {
    default_tenant_id: rand
}


let mlib: MainModule;
let mcore: any;
let mcoreWrong: any;
let mcoreFailure: any;
describe("Test of MainModule", () => {
    beforeEach(async () => {
        mlib = new MainModule();
        const ret1 = mlib.init(confMock, new logMock());
        if (ret1.isSuccess()) mcore = ret1.value
        const ret2 = await(new DsModuleMock().init());
        if (ret2.isSuccess()) mcore.d = ret2.value;
        mcoreWrong = clone(mcore);
        mcoreWrong.d = undefined;
        
        const ret3 = mlib.init(confMock, new logMock());
        if (ret3.isSuccess()) mcoreFailure = ret3.value
        const ret4 = await(new DsModuleMock().init());
        if (ret4.isSuccess()) mcoreFailure.d = ret4.value;
        mcoreFailure.d.lib.getPoolCursor = () => { return new gFailure(new gError("ds", "getPoolCursor", "", "")) };
        mcoreFailure.d.lib.getBlockCursor = () => { return new gFailure(new gError("ds", "getBlockCursor", "", "")) };
        mcoreFailure.d.lib.setPoolNewData = () => { return new gFailure(new gError("ds", "setPoolNewData", "", "")) };
        mcoreFailure.d.lib.setBlockNewData = () => { return new gFailure(new gError("ds", "setBlockNewData", "", "")) };
    })
/*
    describe("Method init()", () => {
        test("Succeed to initialize", async () => {
            const ret = await mlib.init(confMock, new logMock());
            expect(ret.type).toBe("success"); */
            /*
            let mcore2: any;
            if (ret.isSuccess()) mcore2 = ret.value
            const ret0 = await(new DsModuleMock().init());
            if (ret0.isSuccess()) mcore.d = ret0.value;
            expect(mcore2).toEqual(mcore);
            */
/*        })
    })*/

    describe("Method getAllDeliveredPool()", () => {
        test("Success to get data", async () => {
            const ret = await mlib.getAllDeliveredPool(mcore);
            expect(ret.type).toBe("success");
        })

        test("Failed to get data", async () => {
            const ret = await mlib.getAllDeliveredPool(mcoreWrong);
            expect(ret.type).toBe("failure");
        })

        test("Failure2", async () => {
            const ret = await mlib.getAllDeliveredPool(mcoreFailure);
            expect(ret.type).toBe("failure");
        })
    })


    describe("Method getAllUndeliveredPool()", () => {
        test("Success to get data", async () => {
            const ret = await mlib.getAllUndeliveredPool(mcore);
            expect(ret.type).toBe("success");
        })

        test("Failed to get data", async () => {
            const ret = await mlib.getAllUndeliveredPool(mcoreWrong);
            expect(ret.type).toBe("failure");
        })

        test("Failure2", async () => {
            const ret = await mlib.getAllUndeliveredPool(mcoreFailure);
            expect(ret.type).toBe("failure");
        })
    })

    describe("Method getAllPool()", () => {
        test("Success to get data", async () => {
            const ret = await mlib.getAllPool(mcore);
            expect(ret.type).toBe("success");
        })
        test("Failed to get data", async () => {
            const ret = await mlib.getAllPool(mcoreWrong);
            expect(ret.type).toBe("failure");
        })

        test("Failure2", async () => {
            const ret = await mlib.getAllPool(mcoreFailure);
            expect(ret.type).toBe("failure");
        })
    })

    describe("Method getAllBlock()", () => {
        test("Success to get data", async () => {
            const ret = await mlib.getAllBlock(mcore, { ignoreGenesisBlockIsNotFound: true });
            expect(ret.type).toBe("success");
        })

        test("Success2", async () => {
            await installSamples(client, "genesis");
            const ret = await mlib.getAllBlock(mcore);
            expect(ret.type).toBe("success");
        })

        test("Success to get bared data", async () => {
            const ret = await mlib.getAllBlock(mcore, { bareTransaction: true });
            expect(ret.type).toBe("success");
        })

        test("Failed to get data", async () => {
            const ret = await mlib.getAllBlock(mcoreWrong);
            expect(ret.type).toBe("failure");
        })

        test("Failure2", async () => {
            const ret = await mlib.getAllBlock(mcoreFailure);
            expect(ret.type).toBe("failure");
        })
    })

    describe("Method getAll()", () => {
        test("Success to get data", async () => {
            const ret = await mlib.getAll(mcore);
            expect(ret.type).toBe("success");
        })

        test("Success to get data with options", async () => {
            const ret = await mlib.getAll(mcore, { sortOrder: -1});
            expect(ret.type).toBe("success");
        })

        test("Failed to get data", async () => {
            const ret = await mlib.getAll(mcoreWrong);
            expect(ret.type).toBe("failure");
        })

        test("Failure2", async () => {
            const ret = await mlib.getAll(mcoreFailure);
            expect(ret.type).toBe("failure");
        })
    })

    describe("Method getLastBlock()", () => {
        test("Success to get data", async () => {
            const ret = await mlib.getLastBlock(mcore);
            expect(ret.type).toBe("success");
        })

        test("Failed to get data", async () => {
            const ret = await mlib.getLastBlock(mcoreWrong);
            expect(ret.type).toBe("failure");
        })

        test("Failure2", async () => {
            const ret = await mlib.getLastBlock(mcoreFailure);
            expect(ret.type).toBe("failure");
        })
    })


    describe("Method getSearchByOid()", () => {
        test("Success to get data", async () => {
            const ret = await mlib.getSearchByOid<blockFormat>(mcore, randomString24(), {targetIsBlock: true});
            expect(ret.type).toBe("success");
        })

        test("Failed to get data", async () => {
            const ret = await mlib.getSearchByOid<blockFormat>(mcoreWrong, randomString24(), {targetIsBlock: true});
            expect(ret.type).toBe("failure");
        })

        test("Failure2", async () => {
            const ret = await mlib.getSearchByOid<blockFormat>(mcoreFailure, randomString24(), {targetIsBlock: true});
            expect(ret.type).toBe("failure");
        })

        test("Success to get data", async () => {
            const ret = await mlib.getSearchByOid<objTx>(mcore, randomString24(), {targetIsBlock: false});
            expect(ret.type).toBe("success");
        })

        test("Failed to get data", async () => {
            const ret = await mlib.getSearchByOid<objTx>(mcoreWrong, randomString24(), {targetIsBlock: false});
            expect(ret.type).toBe("failure");
        })

        test("Failure4", async () => {
            const ret = await mlib.getSearchByOid<objTx>(mcoreFailure, randomString24(), {targetIsBlock: false});
            expect(ret.type).toBe("failure");
        })
    })

    describe("Method getSearchByJson()", () => {
        test("Succeed to get data", async () => {
            const ret0 = await(new DsModuleMock().init());
            if (ret0.isSuccess()) mcore.d = ret0.value;
            const ret = await mlib.getSearchByJson<objTx>(mcore, { key: "type", value: "new", whole: true });
            expect(ret.type).toBe("success");
        })

        test("Failed to get data", async () => {
            const ret = await mlib.getSearchByJson<objTx>(mcoreWrong, { key: "type", value: "new", whole: true });
            expect(ret.type).toBe("failure");
        })

        test("Failure2", async () => {
            const ret = await mlib.getSearchByJson<objTx>(mcoreFailure, { key: "type", value: "new", whole: true });
            expect(ret.type).toBe("failure");
        })

        test("Succeed to get data", async () => {
            const ret0 = await(new DsModuleMock().init());
            if (ret0.isSuccess()) mcore.d = ret0.value;
            const ret = await mlib.getSearchByJson<objTx>(mcore, { key: "type", value: "fake", whole: true });
            expect(ret.type).toBe("success");
            expect(ret.value).toEqual([]);
        })

        test("Failed to get data", async () => {
            const ret = await mlib.getSearchByJson<objTx>(mcoreWrong, { key: "type", value: "fake", whole: true });
            expect(ret.type).toBe("failure");
        })

        test("Failure4", async () => {
            const ret = await mlib.getSearchByJson<objTx>(mcoreFailure, { key: "type", value: "fake", whole: true });
            expect(ret.type).toBe("failure");
        })
    })

    describe("Method getHistoryByOid()", () => {
        test("Succeed to get data", async () => {
            const ret0 = await(new DsModuleMock().init());
            if (ret0.isSuccess()) mcore.d = ret0.value;
            const ret = await mlib.getHistoryByOid(mcore, randomString24());
            expect(ret.type).toBe("success");
        })
        test("Failed to get data", async () => {
            const ret = await mlib.getHistoryByOid(mcoreWrong, randomString24());
            expect(ret.type).toBe("failure");
        })
        test("Failure2", async () => {
            const ret = await mlib.getHistoryByOid(mcoreFailure, randomString24());
            expect(ret.type).toBe("failure");
        })
    })

    describe("Method getTransactionHeight()", () => {
        test("Succeed to get data", async () => {
            const ret1 = await mlib.getTransactionHeight(mcore);
            const ret2 = await mlib.getTransactionHeight(mcore, {excludeBlocked : true});
            const ret3 = await mlib.getTransactionHeight(mcore, {excludePooling : true});
            if ((ret1.isSuccess()) && (ret2.isSuccess()) && (ret3.isSuccess())) {
                expect(ret1.value + ret2.value + ret3.value).toBeGreaterThanOrEqual(2);
            } else {
                throw new Error("unknown error");
            }
        })
        test("Failed to get data", async () => {
            const ret = await mlib.getTransactionHeight(mcoreWrong);
            expect(ret.type).toBe("failure");
        })
        test("Failure2", async () => {
            const ret = await mlib.getTransactionHeight(mcoreFailure);
            expect(ret.type).toBe("failure");
        })
    })

    describe("Method postByJson()", () => {
        test("Succeed to post data", async () => {
            const postData = { "type": "new", "tenant": rand, "data": {"desc": "testdata" }};
            const ret = await mlib.postByJson(mcore, postData);
            if (ret.isSuccess()) {
                expect(typeof(ret.value)).toBe("string");
                expect(ret.value.length).toBe(24);
            } else {
                throw new Error("unknown error");
            }
        })

        test("Failed to post data 1", async() => {
            const postData = { "type": "new", "tenant": rand, "data": {"desc": "testdata" }};
            const ret = await mlib.postByJson(mcoreWrong, postData);
            expect(ret.type).toBe("failure");
        })
        test("Failed to post data 2", async() => {
            const wrongData: any = { "wrong": "new", "tenant": rand, "data": {"desc": "testdata" }};
            const ret = await mlib.postByJson(mcore, wrongData);
            expect(ret.type).toBe("failure");
        })
        test("Failed to post data 3", async() => {
            const wrongData: any = { "wrong": "new", "tenant": rand, "data": {"desc": "testdata" }};
            const ret = await mlib.postByJson(mcoreWrong, wrongData);
            expect(ret.type).toBe("failure");
        })

        test("Failed to post data 4", async() => {
            const postData = { "type": "new", "tenant": rand, "data": {"desc": "testdata" }};
            const ret = await mlib.postByJson(mcoreFailure, postData);
            expect(ret.type).toBe("failure");
        })
    })
})
