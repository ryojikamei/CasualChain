/**
 * Copyright (c) 2024 Ryoji Kamei
 * Released under the MIT license
 * https://opensource.org/licenses/mit-license.php
 */

import { randomUUID } from "crypto";

import { dsConfigType } from "../../config";
import { IoSubModule, ccDirectIoType } from "../directio";
import { BackendDbSubModuleMock } from "../../__mocks__/mock_mongodb";

import { logMock } from "../../__mocks__/mock_logger";
import clone from "clone";
import { getBlockResult } from "../../system";
import { dataSet, generateSamples } from "../../__testdata__/generator";

const confMock: dsConfigType = { // example
    password_encryption: false,
    mongo_blockcollection: "block_" + randomUUID(),
    mongo_dbname: "bcdb",
    mongo_dbuser: "bcuser",
    mongo_host: "192.168.1.50",
    mongo_password: "rablock-pass-20230123",
    mongo_poolcollection: "pool_" + randomUUID(),
    mongo_port: 27017,
    mongo_authdb: "admin",
}
const wrongConfMock = {
    password_encryption: false,
    mongo_blockcollection: "",
    mongo_dbname: "",
    mongo_dbuser: "",
    mongo_host: "",
    mongo_password: "",
    mongo_poolcollection: "",
    mongo_port: -1,
    mongo_authdb: ""
};

let dlib: IoSubModule;
let dblib: any;
let d: ccDirectIoType;
let dWrong: any;
let ds: dataSet;
describe("Test of IoSubModule()", () => {
    beforeAll(async () => {
        // inject mock
        dblib = new BackendDbSubModuleMock();
        dlib = new IoSubModule();
        const ret = await dlib.init(confMock, new logMock(), dblib);
        if (ret.isSuccess()) d = ret.value;
        const ret2 = await dlib.init(confMock, new logMock(), dblib);
        if (ret2.isSuccess()) dWrong = ret2.value;
        dWrong.db.obj = undefined;
        ds = await generateSamples();
    });
    afterAll(() => {
    });

    describe("Method init()", () => {
        test("Success initialization", (async () => {
            const ret = await dlib.init(confMock, new logMock(), dblib);
            expect(ret.type).toBe("success");
        }));
        test("Failed initialization", (async () => {
            const ret = await dlib.init(wrongConfMock, new logMock(), dblib);
            expect(ret.type).toBe("failure");
        }));
    });

    describe("Method cleanup()", () => {
        test("Success", async () => {
            d.conf.mongo_host = "returnOK";
            const ret = await dlib.cleanup(d);
            expect(ret.type).toBe("success");
        });
        test("Failure1", async () => {
            d.conf.mongo_host = "returnError1";
            const ret = await dlib.cleanup(d);
            expect(ret.type).toBe("failure");
        });
        test("Failure2", async () => {
            d.conf.mongo_host = "returnError2";
            const ret = await dlib.cleanup(d);
            expect(ret.type).toBe("failure");
        });
    })

    describe("Method poolModifyReadsFlag", () => {
        test("Success to modify flags", async () => {
            // prepare two data and insert
            const tx3: any = ds.txs.get("tx3");
            const tx4: any = ds.txs.get("tx4");
            await d.lib.setPoolNewData(d, tx3, tx3.tenant);
            await d.lib.setPoolNewData(d, tx4, tx4.tenant);
            const ret1 = await d.lib.getPoolCursor(d);
            let pObj: any;
            let oids: string[] = [];
            if (ret1.isSuccess()) {
                if (ret1.value.cursor !== undefined) {
                    for await (pObj of ret1.value.cursor) {
                        oids.push(pObj._id);
                    }
                }
            }
            const ret2 = await d.lib.poolModifyReadsFlag(d, oids, tx3.tenant);

            expect(ret2.type).toBe("success");
        });
        test("Success to modify wrong target (it returns true anyway)", async () => {

            let oids: string[] = ["fake"];
            const ret = await d.lib.poolModifyReadsFlag(d, oids, "fake");
            
            expect(ret.type).toBe("success");
        });
    });

    describe("Method poolDeleteTransactions", () => {
        test("Success to delete", async () => {
            // prepare two data and insert
            const tx3: any = ds.txs.get("tx3");
            const tx4: any = ds.txs.get("tx4");
            await d.lib.setPoolNewData(d, tx3, tx3.tenant);
            await d.lib.setPoolNewData(d, tx4, tx4.tenant);
            const ret1 = await d.lib.getPoolCursor(d);
            let pObj: any;
            let oids: string[] = [];
            if (ret1.isSuccess()) {
                if (ret1.value.cursor !== undefined) {
                    for await (pObj of ret1.value.cursor) {
                        oids.push(pObj._id);
                    }
                }
            }
            const ret2 = await d.lib.poolDeleteTransactions(d, oids, tx3.tenant);

            expect(ret2.type).toBe("success");

            // restart
            const dblib: any = new BackendDbSubModuleMock();
            const ret3 = await dlib.init(confMock, new logMock(), dblib);
            if (ret3.isSuccess()) d = ret3.value;

            const ret4 = await d.lib.getPoolCursor(d);
            expect(ret4.type).toBe("success");
        },10000);
        test("Success to delete wrong target (it returns true anyway)", async () => {
            let oids: string[] = ["fake"];
            const ret5 = await d.lib.poolDeleteTransactions(d, oids, "fake");
            
            expect(ret5.type).toBe("success");
        });
    });

    describe("Method blockDeleteBlocks", () => {
        test("Success to delete", async () => {
            d.conf.mongo_host = "returnOK"; // BackendDbSubModuleMock control
            // prepare a data and insert
            // genesis block
            const blk2: any = ds.blks.get("blk2");
            await d.lib.setBlockNewData(d, blk2, blk2.tenant);
            const ret7 = await d.lib.getBlockCursor(d);
            if (ret7.isSuccess()) {
                const oids: string[] = [blk2._id];
                d.conf.mongo_host = "returnOK"; // BackendDbSubModuleMock control for blockDeleteByOid()
                const ret8 = await d.lib.blockDeleteBlocks(d, oids, blk2.tenant);

                expect(ret8.type).toBe("success");
            } else {
                throw new Error("FAIL");
            }
        },10000);
        test("Success to delete wrong target (it returns true anyway)", async () => {
            let oids: string[] = ["fake"];
            d.conf.mongo_host = "returnOK";
            const ret9 = await d.lib.blockDeleteBlocks(d, oids, "fake");
            expect(ret9.type).toBe("success");
        });
        test("Failure1", async () => {
            let oids: string[] = ["fake"];
            d.conf.mongo_host = "returnOK"
            const ret10 = await d.lib.blockDeleteBlocks(dWrong, oids, "fake");
            expect(ret10.type).toBe("failure");
        });
        test("Failure2", async () => {
            let oids: string[] = ["fake"];
            d.conf.mongo_host = "returnError1";
            const ret9 = await d.lib.blockDeleteBlocks(d, oids, "fake");
            expect(ret9.type).toBe("failure");
        });
        test("Failure3", async () => {
            let oids: string[] = ["fake"];
            d.conf.mongo_host = "returnError2";
            const ret9 = await d.lib.blockDeleteBlocks(d, oids, "fake");
            expect(ret9.type).toBe("failure");
        });
    });

    describe("Method blockUpdateBlocks", () => {
        test("Success1", async () => {
            d.conf.mongo_host = "returnOK"; // BackendDbSubModuleMock control
            // prepare two data and insert one
            const blk2: any = ds.blks.get("blk2");
            let block3 = clone(blk2);
            block3.hash = "fake";
            await d.lib.setBlockNewData(d, block3, blk2.tenant);
            const ret11 = await d.lib.getBlockCursor(d);
            if (ret11.isSuccess()) {
                const targets: getBlockResult[] = [{ oid: block3._id, block: blk2  }];
                d.conf.mongo_host = "returnOK"; // BackendDbSubModuleMock control for blockReplaceByBlocks()
                const ret12 = await d.lib.blockUpdateBlocks(d, targets, block3.tenant);

                expect(ret12.type).toBe("success");
            } else {
                throw new Error("FAIL");
            }
        });
        test("Success2", async () => {
            // prepare a data
            const blk2: any = ds.blks.get("blk2");
            let targets: getBlockResult[] = [{ oid: "fake", block: blk2 }];
            d.conf.mongo_host = "returnOK";
            const ret12 = await d.lib.blockUpdateBlocks(d, targets, blk2.tenant);
            expect(ret12.type).toBe("success");
        });
        test("Failure1", async () => {
            const blk2: any = ds.blks.get("blk2");
            let targets: getBlockResult[] = [{ oid: "fake", block: blk2 }];
            d.conf.mongo_host = "returnError1";
            const ret12 = await d.lib.blockUpdateBlocks(d, targets, blk2.tenant);
            expect(ret12.type).toBe("failure");
        });
        test("Failure2", async () => {
            const blk2: any = ds.blks.get("blk2");
            let targets: getBlockResult[] = [{ oid: "fake", block: blk2 }];
            d.conf.mongo_host = "returnError2";
            const ret12 = await d.lib.blockUpdateBlocks(d, targets, blk2.tenant);
            expect(ret12.type).toBe("failure");
        });
        test("Failure3", async () => {
            const blk2: any = ds.blks.get("blk2");
            let targets: getBlockResult[] = [{ oid: "fake", block: blk2 }];
            d.conf.mongo_host = "returnOK";
            const ret12 = await d.lib.blockUpdateBlocks(dWrong, targets, blk2.tenant);
            expect(ret12.type).toBe("failure");
        });
    });

    describe("Method getPoolCursor", () => {
        test("Success", async () => {
            const ret = await d.lib.getPoolCursor(d);
            expect(ret.type).toBe("success");
        });
    });

    describe("Method getBlockCursor", () => {
        test("Success", async () => {
            d.conf.mongo_host = "returnOK"; // BackendDbSubModuleMock control for blockGetFromDbToCursor()
            const ret = await d.lib.getBlockCursor(d);
            expect(ret.type).toBe("success");
        });
        test("Failure1", async () => {
            d.conf.mongo_host = "returnOK";
            const ret = await d.lib.getBlockCursor(dWrong);
            expect(ret.type).toBe("failure");
        });
        test("Failure2", async () => {
            d.conf.mongo_host = "returnError1";
            const ret = await d.lib.getBlockCursor(d);
            expect(ret.type).toBe("failure");
        });
        test("Failure3", async () => {
            d.conf.mongo_host = "returnError2";
            const ret = await d.lib.getBlockCursor(d);
            expect(ret.type).toBe("failure");
        });
        test("Failure4", async () => {
            d.conf.mongo_host = "returnError3";
            const ret = await d.lib.getBlockCursor(d);
            expect(ret.type).toBe("failure");
        });
        test("Failure5", async () => {
            d.conf.mongo_host = "returnError4";
            const ret = await d.lib.getBlockCursor(d);
            expect(ret.type).toBe("failure");
        });
    });

    describe("Method closeCursor", () => {
        test("Success1", async () => {
            d.conf.mongo_host = "returnOK"; // BackendDbSubModuleMock control
            const ret1 = await d.lib.getPoolCursor(d);
            if (ret1.isFailure()) throw new Error("FAIL");
            const ret2 = await d.lib.closeCursor(d, ret1.value);
            expect(ret2.type).toBe("success");
        });
        test("Success2", async () => {
            const ret1 = await d.lib.getBlockCursor(d);
            if (ret1.isFailure()) throw new Error("FAIL");
            const ret2 = await d.lib.closeCursor(d, ret1.value);
            expect(ret2.type).toBe("success");
        });
    });

    describe("Method setPoolNewData", () => {
        test("Success1", async () => {
            const tx3: any = ds.txs.get("tx3");
            const ret = await d.lib.setPoolNewData(d, tx3, tx3.tenant);
            expect(ret.type).toBe("success");
        });
        test("Success2", async () => {
            const ret = await d.lib.setPoolNewData(d, undefined, "");
            expect(ret.type).toBe("success");
        });
        test("Failure", async () => {
            const tx3: any = ds.txs.get("tx3");
            const ret = await d.lib.setPoolNewData(d, tx3, "wrong");
            expect(ret.type).toBe("failure");
        });
    });

    describe("Method setBlockNewData", () => {
        test("Success1", async () => {
            d.conf.mongo_host = "returnOK"; // BackendDbSubModuleMock control for blockAppendToDb()
            const blk2: any = ds.blks.get("blk2");
            const ret = await d.lib.setBlockNewData(d, blk2, blk2.tenant);
            expect(ret.type).toBe("success");
        });
        test("Success2", async () => {
            d.conf.mongo_host = "returnOK"; // BackendDbSubModuleMock control for blockAppendToDb()
            const ret = await d.lib.setBlockNewData(d, undefined, "");
            expect(ret.type).toBe("success");
        });
        test("Failure1", async () => {
            d.conf.mongo_host = "returnError1"; // BackendDbSubModuleMock control for blockAppendToDb()
            const blk2: any = ds.blks.get("blk2");
            const ret = await d.lib.setBlockNewData(d, blk2, blk2.tenant);
            expect(ret.type).toBe("failure");
        });
        test("Failure2", async () => {
            d.conf.mongo_host = "returnError2"; // BackendDbSubModuleMock control for blockAppendToDb()
            const blk2: any = ds.blks.get("blk2");
            const ret = await d.lib.setBlockNewData(d, blk2, blk2.tenant);
            expect(ret.type).toBe("failure");
        });
        test("Failure3", async () => {
            d.conf.mongo_host = "returnError3"; // BackendDbSubModuleMock control for blockAppendToDb()
            const blk2: any = ds.blks.get("blk2");
            const ret = await d.lib.setBlockNewData(d, blk2, blk2.tenant);
            expect(ret.type).toBe("failure");
        });
    });

});