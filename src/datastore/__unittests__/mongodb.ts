/**
 * Copyright (c) 2024 Ryoji Kamei
 * Released under the MIT license
 * https://opensource.org/licenses/mit-license.php
 */

import { MongoMemoryServer } from "mongodb-memory-server"
import { InsertManyResult, MongoClient, ObjectId } from "mongodb";
import { BackendDbSubModule } from "../mongodb";
import clone from "clone";
import { randomUUID } from "crypto";
const rand = randomUUID();

import { objTx, objBlock } from "..";
import { dsConfigType } from "../../config";
import { randomOid } from "../../utils";

let dbLib: BackendDbSubModule = new BackendDbSubModule();

let confMock: dsConfigType = {
    password_encryption: false,
    mongo_blockcollection: "block_" + rand,
    mongo_dbname: "bcdb_" + rand,
    mongo_dbuser: "bcuser_" + rand,
    mongo_host: "127.0.0.1",
    mongo_password: "bcpass_" + rand,
    mongo_poolcollection: "pool_" + rand,
    mongo_port: -1, // get later
    mongo_authdb: "admin",
    queue_ondisk: false,
    administration_id: randomUUID(),
    default_tenant_id: randomUUID(),
    enable_default_tenant: true
};
const masterKey = "46f06284-6d1b-460a-b0cc-fc6d6d45fe6e" // admin
const testId = "d1c24145-b7b5-452e-b197-4a2388698788"

const userData1 = {"desc": "user data1"};
const userData2 = {"desc": "user data2"};

function makeTx(data: object): objTx {
    return {
        _id: randomOid().byStr(),
        tenant: testId,
        type: "new",
        settime: "1970/1/1 0:00:00",
        deliveryF: false,
        data: data
    }
};

function convIdStrToObjectId(objs: any[]): any {

    const convObjs: any = clone(objs);
    for (const convObj of convObjs) {
        convObj._id = new ObjectId(convObj._id);
    }
    return convObjs;
}

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

const dsMock: any = {
    lib: {},
    conf: {},
    status: 0,
    log: { lib: { LogFunc() { return function() { return 0 } } }}
}

const coreMock: any = {
    lib: {},
    conf: {},
    status: 0,
    log: { lib: { LogFunc() { return function() { return 0 } } }}
}

describe("Test of BackendDbSubModule()", () => {
    let server: MongoMemoryServer;

    beforeAll(async () => {
        server = await MongoMemoryServer.create(dbServerOpts);
        confMock.mongo_port = Number(server.getUri().split(":")[2].split("/")[0]);
    });
    afterAll(async () => {
        await server.stop();
    });

    describe("Method init()", () => {
        // All setting keys are present. Setting values may be wrong.
        test("Success", async () => {
            const ret = await dbLib.init(confMock);
            expect(ret.type).toBe("success");
            if (ret.isSuccess()) ret.value.close();
        });
        test("Failure", async () => {
            let confWrong = clone(confMock);
            confWrong.mongo_dbuser = "wrong";
            const ret = await dbLib.init(confWrong);
            expect(ret.type).toBe("failure");
            if (ret.isSuccess()) ret.value.close();
        });
    });

    describe("Method cleanup()", () => {
        let client: MongoClient;
        beforeAll(async () => {
            const ret = await dbLib.init(confMock);
            if (ret.isFailure()) {
                throw new Error("FAIL");
            }
            client = ret.value;
        });
        afterAll(async () => {
            await client.close();
        });

        test("Success", async () => {
            const ret = await dbLib.cleanup(coreMock, client);
            expect(ret.type).toBe("success");
        });

        test("Failure", async() => {
            const clientWrong: any = undefined;
            const ret = await dbLib.cleanup(coreMock, clientWrong);
            expect(ret.type).toBe("failure");

        })
    });

    describe("Method poolGetFromDbToCursor", () => {
        let client: MongoClient;
        beforeAll(async () => {
            const ret = await dbLib.init(confMock);
            if (ret.isFailure()) {
                throw new Error("FAIL");
            }
            client = ret.value;
        });
        afterAll(async () => {
            await client.close();
        });
        beforeEach(async () => {
            confMock.mongo_poolcollection = "pool_" + randomUUID();
        });
        afterEach(async () => {
            try {
                await client.db().dropCollection(confMock.mongo_poolcollection);
            } catch (error) {
                
            }
        });

        test("Success", async () => {
            const ret = await dbLib.poolGetFromDbToCursor(coreMock, client, confMock, testId);
            expect(ret.type).toBe("success");
        });

        test("Failure1", async () => {
            const ret = await dbLib.poolGetFromDbToCursor(coreMock, client, confMock, testId, 100);
            expect(ret.type).toBe("failure");
        });

        test("Failure2", async () => {
            const client: any = undefined;
            const ret = await dbLib.poolGetFromDbToCursor(coreMock, client, confMock, testId);
            expect(ret.type).toBe("failure");
        });

    });

    describe("Method blockGetFromDbToCursor", () => {
        let client: MongoClient;
        beforeAll(async () => {
            const ret = await dbLib.init(confMock);
            if (ret.isFailure()) {
                throw new Error("FAIL");
            }
            client = ret.value;
        });
        afterAll(async () => {
            await client.close();
        });
        beforeEach(async () => {
            confMock.mongo_blockcollection = "block_" + randomUUID();
        });
        afterEach(async () => {
            try {
                await client.db().dropCollection(confMock.mongo_blockcollection);
            } catch (error) {
                
            }
        });

        test("Success", async () => {
            const ret = await dbLib.blockGetFromDbToCursor(coreMock, client, confMock, testId);
            expect(ret.type).toBe("success");
        });

        test("Failure1", async () => {
            const ret = await dbLib.blockGetFromDbToCursor(coreMock, client, confMock, testId, 100);
            expect(ret.type).toBe("failure");
        });

        test("Failure2", async () => {
            const client: any = undefined;
            const ret = await dbLib.blockGetFromDbToCursor(coreMock, client, confMock, testId);
            expect(ret.type).toBe("failure");
        });

    });

    describe("Method closeCursor()", () => {
        let client: MongoClient;
        beforeAll(async () => {
            const ret = await dbLib.init(confMock);
            if (ret.isFailure()) {
                throw new Error("FAIL");
            }
            client = ret.value;
        });
        afterAll(async () => {
            await client.close();
        });

        test("Success", async () => {
            const session = client.startSession();
            const ret = await dbLib.closeCursor(coreMock, session);
            expect(ret.type).toBe("success");
        });
    });
    
    describe("Method poolAppendToDb()", () => {
        let client: MongoClient;
        beforeAll(async () => {
            const ret = await dbLib.init(confMock);
            if (ret.isSuccess()) client = ret.value;
        });
        afterAll(async () => {
            await client.close();
        });
        beforeEach(async () => {
            confMock.mongo_poolcollection = "pool_" + randomUUID();
        });
        afterEach(async () => {
            try {
                await client.db().dropCollection(confMock.mongo_poolcollection);
            } catch (error) {
                
            }
        });

        test("Failure", async () => {
            // prepare cache
            const wcache: objTx[] = [];

            const ret = await dbLib.poolAppendToDb(coreMock, client, confMock, wcache, testId);

            expect(ret.type).toBe("failure");
        }, 10000)

        test("Success", async () => {
            // prepare cache
            const wcache: objTx[] = [ makeTx(userData1) ];

            const ret = await dbLib.poolAppendToDb(coreMock, client, confMock, wcache, testId);

            expect(ret.type).toBe("success");
        }, 10000)

        // ToDo: retry case

    });

    describe("Method blockAppendToDb()", () => {
        let client: MongoClient;
        beforeAll(async () => {
            const ret = await dbLib.init(confMock);
            if (ret.isSuccess()) client = ret.value;
        });
        afterAll(async () => {
            await client.close();
        });
        beforeEach(async () => {
            confMock.mongo_blockcollection = "block_" + randomUUID();
        });
        afterEach(async () => {
            try {
                await client.db().dropCollection(confMock.mongo_blockcollection);
            } catch (error) {
                
            }
        });

        test("Success1", async () => {
            // prepare cache
            const wcache: objBlock[] = [];

            const ret = await dbLib.blockAppendToDb(coreMock, client, confMock, wcache, testId);

            expect(ret.type).toBe("success");
        }, 10000)

        test("Success2", async () => {
            // prepare cache
            // genesis block
            const wdata: objBlock = {
                _id: randomOid().byStr(),
                version: 1,
                tenant: testId,
                height: 0,
                size: 0,
                settime: "1970/01/01 00:00:00",
                timestamp: "0",
                prev_hash: "0",
                hash: "fake"
            }
            const wcache: objBlock[] = [wdata];

            const ret = await dbLib.blockAppendToDb(coreMock, client, confMock, wcache, testId);

            expect(ret.type).toBe("success");
        }, 10000)

    });

    describe("Method poolUpdateFlagsByOid()", () => {
        let client: MongoClient;
        beforeAll(async () => {
            const ret = await dbLib.init(confMock);
            if (ret.isSuccess()) client = ret.value;
        });
        afterAll(async () => {
            await client.close();
        });
        beforeEach(async () => {
            confMock.mongo_poolcollection = "pool_" + randomUUID();
        });
        afterEach(async () => {
            try {
                await client.db().dropCollection(confMock.mongo_poolcollection);
            } catch (error) {
                
            }
        });

        test("Success", async () => {
            // add two data
            const wdata = [makeTx(userData1), makeTx(userData2)];
            const pool = client.db().collection(confMock.mongo_poolcollection);
            const res: InsertManyResult = await pool.insertMany(convIdStrToObjectId(wdata));
            let oids = [];
            for(const result of Object.entries(res.insertedIds)) {
                oids.push(result[1].toString())
            }

            const ret = await dbLib.poolUpdateFlagsByOid(coreMock, client, confMock, oids, testId);
            expect(ret.type).toBe("success");

            //check two data
            const res2 = pool.find(res.insertedIds);
            if (res2 !== null) {
                for(const doc of await res2.toArray()) {
                    expect(doc.deliveryF).toEqual(true);
                }
            } else {
                throw new Error("TestError:poolUpdateFlagsByOid()");
            }
        },10000);

        test("Failure", async () => {
            // add two data
            const wdata = [makeTx(userData1), makeTx(userData2)];
            const pool = client.db().collection(confMock.mongo_poolcollection);
            const res: InsertManyResult = await pool.insertMany(convIdStrToObjectId(wdata));

            const ret = await dbLib.poolUpdateFlagsByOid(coreMock, client, confMock, ["wrong1", "wrong2"], testId);
            expect(ret.type).toBe("failure");

            //check two data
            const res2 = pool.find(res.insertedIds);
            if (res2 !== null) {
                for(const doc of await res2.toArray()) {
                    expect(doc.deliveryF).toEqual(false);
                }
            } else {
                throw new Error("TestError:poolUpdateFlagsByOid()");
            }
        },10000)

    });

    describe("Method poolDeleteByOid()", () => {
        let client: MongoClient;
        beforeAll(async () => {
            const ret = await dbLib.init(confMock);
            if (ret.isSuccess()) client = ret.value;
        });
        afterAll(async () => {
            await client.close();
        });
        beforeEach(async () => {
            confMock.mongo_poolcollection = "pool_" + randomUUID();
        });
        afterEach(async () => {
            try {
                await client.db().dropCollection(confMock.mongo_poolcollection);
            } catch (error) {
                
            }
        });

        test("Success1", async () => {
            // add two data
            const wdata = [makeTx(userData1), makeTx(userData2)];
            const pool = client.db().collection(confMock.mongo_poolcollection);
            const res: InsertManyResult = await pool.insertMany(convIdStrToObjectId(wdata));
            let oids = [];
            for(const result of Object.entries(res.insertedIds)) {
                oids.push(result[1].toString())
            }

            const ret = await dbLib.poolDeleteByOid(coreMock, client, confMock, oids, testId);
            expect(ret.type).toBe("success");

            //check two data
            const res2 = pool.find({});
            expect((await res2.toArray()).length).toBe(0);
        },10000);

        test("Failure", async () => {
            // add two data
            const wdata = [{"type": "new", "desc": "data1"}, {"type": "new", "desc": "data2"}];
            const pool = client.db().collection(confMock.mongo_poolcollection);
            const res: InsertManyResult = await pool.insertMany(wdata);

            const ret = await dbLib.poolDeleteByOid(coreMock, client, confMock, ["wrong1", "wrong2"], testId);
            expect(ret.type).toBe("failure");

            //check two data
            const res2 = pool.find({});
            expect((await res2.toArray()).length).toBe(2);
        },10000);

        test("Success2", async () => {
            // add no data

            const ret = await dbLib.poolDeleteByOid(coreMock, client, confMock, [randomOid().byStr(), randomOid().byStr()], testId);
            expect(ret.type).toBe("success");
        },10000);

    });

    describe("Method blockDeleteByOid()", () => {
        let client: MongoClient;
        beforeAll(async () => {
            const ret = await dbLib.init(confMock);
            if (ret.isSuccess()) client = ret.value;
        });
        afterAll(async () => {
            await client.close();
        });
        beforeEach(async () => {
            confMock.mongo_blockcollection = "block_" + randomUUID();
        });
        afterEach(async () => {
            try {
                await client.db().dropCollection(confMock.mongo_blockcollection);
            } catch (error) {
                
            }
        });

        test("Success1", async () => {
            // add two data
            const wObj1: objBlock = {
                _id: randomOid().byStr(),
                version: 1,
                tenant: testId,
                height: 0,
                size: 0,
                settime: "1970/01/01 00:00:00",
                timestamp: "0",
                prev_hash: "0",
                hash: "fake"
            }
            const wObj2: objBlock = {
                _id: randomOid().byStr(),
                version: 1,
                tenant: testId,
                height: 1,
                size: 1,
                data: [{
                    _id: randomOid().byStr(),
                    tenant: testId,
                    type: "new",
                    settime: "2039/01/01 00:00:00",
                    deliveryF: true,
                    data: { "desc": "test1" }
                }],
                settime: "2039/01/01 00:00:00",
                timestamp: "10000000",
                prev_hash: "fake",
                hash: "fake"
            }
            const wdata = [wObj1, wObj2];
            const block = client.db().collection(confMock.mongo_blockcollection);
            const res: InsertManyResult = await block.insertMany(convIdStrToObjectId(wdata));
            let oids = [];
            for(const result of Object.entries(res.insertedIds)) {
                oids.push(result[1].toString())
            }

            const ret = await dbLib.blockDeleteByOid(coreMock, client, confMock, oids, testId);
            expect(ret.type).toBe("success");

            //check two data
            const res2 = block.find({});
            expect((await res2.toArray()).length).toBe(0);
        },10000);

        test("Failure", async () => {
            // add two data
            const wObj1: objBlock = {
                _id: randomOid().byStr(),
                version: 1,
                tenant: testId,
                height: 0,
                size: 0,
                settime: "1970/01/01 00:00:00",
                timestamp: "0",
                prev_hash: "0",
                hash: "fake"
            }
            const wObj2: objBlock = {
                _id: randomOid().byStr(),
                version: 1,
                tenant: testId,
                height: 1,
                size: 1,
                data: [{
                    _id: randomOid().byStr(),
                    tenant: testId,
                    type: "new",
                    settime: "2039/01/01 00:00:00",
                    deliveryF: true,
                    data: { "desc": "test1" }
                }],
                settime: "2039/01/01 00:00:00",
                timestamp: "10000000",
                prev_hash: "fake",
                hash: "fake"
            }
            const wdata = [wObj1, wObj2];
            const block = client.db().collection(confMock.mongo_blockcollection);
            const res: InsertManyResult = await block.insertMany(convIdStrToObjectId(wdata));

            const ret = await dbLib.blockDeleteByOid(coreMock, client, confMock, ["wrong1", "wrong2"], testId);
            expect(ret.type).toBe("failure");

            //check two data
            const res2 = block.find({});
            expect((await res2.toArray()).length).toBe(2);
        },10000);

        test("Success2", async () => {
            // add no data

            const ret = await dbLib.blockDeleteByOid(coreMock, client, confMock, [randomOid().byStr(), randomOid().byStr()], testId);

            expect(ret.type).toBe("success");
        },10000);

    });
    
    describe("Method blockReplaceByBlocks()", () => {
        let client: MongoClient;
        beforeAll(async () => {
            const ret = await dbLib.init(confMock);
            if (ret.isSuccess()) client = ret.value;
        });
        afterAll(async () => {
            await client.close();
        });
        beforeEach(async () => {
            confMock.mongo_blockcollection = "block_" + randomUUID();
        });
        afterEach(async () => {
            try {
                await client.db().dropCollection(confMock.mongo_blockcollection);
            } catch (error) {
                
            }
        });

        test("Succeed replacement with some data", async () => {
            // add two data
            const wObj1: objBlock = {
                _id: randomOid().byStr(),
                version: 1,
                tenant: testId,
                height: 0,
                size: 0,
                settime: "1970/01/01 00:00:00",
                timestamp: "0",
                prev_hash: "0",
                hash: "fake"
            }
            const wObj2: objBlock = {
                _id: randomOid().byStr(),
                version: 1,
                tenant: testId,
                height: 1,
                size: 1,
                data: [{
                    _id: randomOid().byStr(),
                    tenant: testId,
                    type: "new",
                    settime: "2039/01/01 00:00:00",
                    deliveryF: true,
                    data: { "desc": "test1" }
                }],
                settime: "2039/01/01 00:00:00",
                timestamp: "10000000",
                prev_hash: "fake",
                hash: "fake"
            }
            const wdata = [wObj1, wObj2];
            const block = client.db().collection(confMock.mongo_blockcollection);
            const res: InsertManyResult = await block.insertMany(convIdStrToObjectId(wdata));

            // replace data
            const rObj2: objBlock = {
                _id: wObj2._id,
                version: 1,
                tenant: testId,
                height: 0,
                size: 0,
                settime: "1999/01/01 00:00:00",
                timestamp: "10000",
                prev_hash: "0",
                hash: "fake"
            }
            const bRes = [{
                oid: rObj2._id,
                block: rObj2
            }]

            const ret = await dbLib.blockReplaceByBlocks(coreMock, client, confMock, bRes, testId);
            expect(ret.type).toBe("success");

            const res2 = await block.findOne({ _id: new ObjectId(rObj2._id) });
            expect(res2).not.toBeNull();
            if (res2 !== null) {
                expect(res2.timestamp).toBe("10000");
                expect(res2.data).toBeNull();
            }
        });

        test("Succeed with no replacement", async () => {
            const ret = await dbLib.blockReplaceByBlocks(coreMock, client, confMock, [], testId);

            expect(ret.type).toBe("success");
        });

        test("Failed with invalid replacement", async () => {
            // add two data
            const wObj3: objBlock = {
                _id: randomOid().byStr(),
                version: 1,
                tenant: testId,
                height: 0,
                size: 0,
                settime: "1970/01/01 00:00:00",
                timestamp: "0",
                prev_hash: "0",
                hash: "fake"
            }
            const wObj4: objBlock = {
                _id: randomOid().byStr(),
                version: 1,
                tenant: testId,
                height: 1,
                size: 1,
                data: [{
                    _id: randomOid().byStr(),
                    tenant: testId,
                    type: "new",
                    settime: "2039/01/01 00:00:00",
                    deliveryF: true,
                    data: { "desc": "test1" }
                }],
                settime: "2039/01/01 00:00:00",
                timestamp: "10000000",
                prev_hash: "fake",
                hash: "fake"
            }
            const wdata = [wObj3, wObj4];
            const block = client.db().collection(confMock.mongo_blockcollection);
            const res: InsertManyResult = await block.insertMany(convIdStrToObjectId(wdata));

            // replace data
            const rObj: objBlock = {
                _id: "wrong",
                version: 1,
                tenant: testId,
                height: 0,
                size: 0,
                settime: "1999/01/01 00:00:00",
                timestamp: "10000",
                prev_hash: "0",
                hash: "fake"
            }
            const bRes = [{
                oid: rObj._id,
                block: rObj
            }]

            const ret = await dbLib.blockReplaceByBlocks(coreMock, client, confMock, bRes, testId);

            expect(ret).not.toBe("failure");

        })
    });
});
