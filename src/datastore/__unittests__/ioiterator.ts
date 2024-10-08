/**
 * Copyright (c) 2024 Ryoji Kamei
 * Released under the MIT license
 * https://opensource.org/licenses/mit-license.php
 */

import { MongoMemoryServer } from "mongodb-memory-server";
import { randomUUID } from "crypto";
const rand = randomUUID();

import { objBlock, objTx } from "..";
import { generateSamples, dataSet } from "../../__testdata__/generator";
import { cachedIoIterator, directIoIterator } from "../ioiterator";
import { BackendDbSubModule } from "../mongodb";
import { dsConfigType } from "../../config";
import { MongoClient, FindCursor, WithId, Document } from "mongodb";
import { installResult, installSamples } from "../../__testdata__/installer";

let dbLib: BackendDbSubModule = new BackendDbSubModule();

let confMock: dsConfigType = {
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


describe("Test of CachedIoIterator()", () => {
    let ds: dataSet;
    let iterTx: cachedIoIterator<objTx>;
    let iterTxS: cachedIoIterator<objTx>;
    let iterBlk: cachedIoIterator<objBlock>;
    let iterBlkS: cachedIoIterator<objBlock>;
    let arrTxs: objTx[];
    let arrBlks: objBlock[];
    beforeEach(async () => {
        ds = await generateSamples(confMock.default_tenant_id);
        arrTxs = [];
        for (const entry of ds.txs.entries()) {
            arrTxs.push(entry[1]);
        }
        iterTx = new cachedIoIterator(arrTxs);
        iterTxS = new cachedIoIterator(arrTxs, confMock.default_tenant_id, 0);
        arrBlks = [];
        for (const entry of ds.blks.entries()) {
            arrBlks.push(entry[1]);
        }
        iterBlk = new cachedIoIterator(arrBlks);
        iterBlkS = new cachedIoIterator(arrBlks, confMock.default_tenant_id, 0);
    });
    describe("Method next()", () => {
        test("Success1", async() => {
            const next1 = await iterTx.next();
            expect(next1.value).toEqual(ds.txs.get("tx1"));
            expect(next1.done).toBe(false);
            const next2 = await iterTx.next();
            expect(next2.value).toEqual(ds.txs.get("tx2"));
            expect(next2.done).toBe(false);
            const next3 = await iterTx.next();
            expect(next3.value).toEqual(ds.txs.get("tx3"));
            expect(next3.done).toBe(false);
            const next4 = await iterTx.next();
            expect(next4.value).toEqual(ds.txs.get("tx4"));
            expect(next4.done).toBe(false);
            const next5 = await iterTx.next();
            expect(next5.value).toEqual(ds.txs.get("tx5"));
            expect(next5.done).toBe(false);
            const next6 = await iterTx.next();
            expect(next6.value).toEqual(ds.txs.get("tx6"));
            expect(next6.done).toBe(false);
            const next7 = await iterTx.next();
            expect(next7.value).toEqual(ds.txs.get("tx7"));
            expect(next7.done).toBe(false);
            const next8 = await iterTx.next();
            expect(next8.value).toEqual(ds.txs.get("tx8"));
            expect(next8.done).toBe(false);
            const next9 = await iterTx.next();
            expect(next9.value).toEqual(ds.txs.get("tx9"));
            expect(next9.done).toBe(true);
            const next10 = await iterTx.next();
            expect(next10.value).toEqual(undefined);
            expect(next10.done).toBe(true);
        });
        test("Success2", async() => {
            const next11 = await iterTxS.next();
            expect(next11.value).toEqual(undefined);
            expect(next11.done).toBe(true);
        });
        test("Success3", async() => {
            const next21 = await iterBlkS.next();
            expect(next21.value).toEqual(ds.blks.get("blk0"));
            expect(next21.done).toBe(false);
            const next22 = await iterBlkS.next();
            expect(next22.value).toEqual(ds.blks.get("blk0B"));
            expect(next22.done).toBe(false);
            const next23 = await iterBlkS.next();
            expect(next23.value).toEqual(undefined);
            expect(next23.done).toBe(true);
        });
    });
    describe("Method toArray()", () => {
        test("Success", async() => {
            const arr = await iterBlk.toArray();
            expect(arr).toEqual(arrBlks);
        });
    });
    describe("Method *[Symbol.asyncIterator]()", () => {
        test("Success", async() => {
            let arrTxs2 = [];
            for await (const entry of iterTx) {
                arrTxs2.push(entry.value);
            };
            expect(arrTxs2).toEqual(arrTxs);
        });
    });
});

describe("Test of DirectIoIterator()", () => {
    let server: MongoMemoryServer;
    let client: MongoClient;
    let iterBlk: directIoIterator<objBlock>;
    let iterBlk2: directIoIterator<objBlock>;
    let cur: FindCursor<WithId<Document>> | undefined;
    let installed: installResult | undefined;
    beforeAll(async () => {
        server = await MongoMemoryServer.create(dbServerOpts);
        confMock.mongo_port = Number(server.getUri().split(":")[2].split("/")[0]);
        const ret = await dbLib.init(confMock);
        if (ret.isFailure()) throw new Error("FAIL");
        client = ret.value;
    });
    afterAll(async () => {
        await client.close();
        await server.stop();
    });
    beforeEach(async () => {
        installed = await installSamples(client, "directio1");
        if (installed === undefined) throw new Error("FAIL");
        cur = client.db().collection("block_node1").find({});
        iterBlk = new directIoIterator<objBlock>(cur);
        iterBlk2 = new directIoIterator<objBlock>(cur, 0);
    });
    afterEach(async () => {
        cur?.close();
    });
    describe("Method next()", () => {
        test("Success1", async() => {
            const next1 = await iterBlk.next();
            let blk1 = next1.value;
            blk1._id = blk1._id.toHexString();
            expect(blk1).toEqual(installed?.block_node1[0]);
            expect(next1.done).toBe(false);
            const next2 = await iterBlk.next();
            let blk2 = next2.value;
            blk2._id = blk2._id.toHexString();
            expect(blk2).toEqual(installed?.block_node1[1]);
            expect(next2.done).toBe(true);
            const next3 = await iterBlk.next();
            expect(next3.value).toEqual(undefined);
            expect(next3.done).toBe(true);
        });
        test("Success2", async() => {
            const next10 = await iterBlk2.next();
            let blk1 = next10.value;
            blk1._id = blk1._id.toHexString();
            expect(blk1).toEqual(installed?.block_node1[0]);
            expect(next10.done).toBe(false);
            const next11 = await iterBlk2.next();
            let blk2 = next11.value;
            expect(blk2).toEqual(undefined);
            expect(next11.done).toBe(true);
        })
    });
    describe("Method toArray()", () => {
        test("Success", async() => {
            const arrBlk1 = await iterBlk.toArray();
            let arrBlk2 = [];
            for (const entry of arrBlk1) {
                let blk: any = entry;
                blk._id = blk._id.toHexString();
                arrBlk2.push(blk);
            }
            expect(arrBlk2).toEqual(installed?.block_node1);
        });
    });
    describe("Method *[Symbol.asyncIterator]()", () => {
        test("Success", async() => {
            let arrBlk = [];
            for await (const entry of iterBlk) {
                let blk = entry.value;
                blk._id = blk._id.toHexString();
                arrBlk.push(blk);
            };
            expect(arrBlk).toEqual(installed?.block_node1);
        });
    });
});
