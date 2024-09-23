/**
 * Copyright (c) 2024 Ryoji Kamei
 * Released under the MIT license
 * https://opensource.org/licenses/mit-license.php
 */

import { randomUUID } from "crypto";

import { dsConfigType } from "../../config";
import { DsModule } from "../core";
import { ccDsType } from "..";
import { IoSubModuleMock } from "../../__mocks__/mock_io";

import { logMock } from "../../__mocks__/mock_logger";
import { generateSamples } from "../../__testdata__/generator";

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
    queue_ondisk: false,
    administration_id: randomUUID(),
    default_tenant_id: randomUUID(),
    enable_default_tenant: true
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
    mongo_authdb: "",
    queue_ondisk: false,
    administration_id: randomUUID(),
    default_tenant_id: randomUUID(),
    enable_default_tenant: true
};


let dlib: DsModule;
let d: ccDsType;
let dWrong: ccDsType;
let tx3: any;
let block0: any;
describe("Test of DsModule()", () => {
    beforeAll(async () => {
        // inject mock
        const iolib: any = new IoSubModuleMock();
        dlib = new DsModule();
        const ret = await dlib.init(confMock, new logMock(), iolib);
        if (ret.isSuccess()) d = ret.value;
        const ret2 = await dlib.init(confMock, new logMock(), iolib);
        if (ret2.isSuccess()) dWrong = ret2.value;
        dWrong.io = undefined
        const ret3 = await generateSamples();
        tx3 = ret3.txs.get("tx3");
        block0 = ret3.blks.get("block0_0");        
    });
    afterAll(() => {
    });

    describe("Method init()", () => {
        test("Failure", (async () => {
            // inject mock
            const iolib: any = new IoSubModuleMock(true);
            const ret = await dlib.init(confMock, new logMock(), iolib);
            expect(ret.type).toBe("failure");
        }));
        test("Success", (async () => {
            // inject mock
            const iolib: any = new IoSubModuleMock();
            const ret = await dlib.init(confMock, new logMock(), iolib);
            expect(ret.type).toBe("success");
        }));
    });

    describe("Method cleanup()", () => {
        test("Success", async () => {
            if (d.io !== undefined) d.io.conf.mongo_dbname = "returnOK";
            const ret = await dlib.cleanup(d);
            expect(ret.type).toBe("success");
        });
        test("Failure1", async () => {
            if (d.io !== undefined) d.io.conf.mongo_dbname = "returnOK";
            const ret = await dlib.cleanup(dWrong);
            expect(ret.type).toBe("failure");
        });
        test("Failure2", async () => {
            if (d.io !== undefined) d.io.conf.mongo_dbname = "returnError1";
            const ret = await dlib.cleanup(d);
            expect(ret.type).toBe("failure");
        });
    });

    describe("Method getPoolCursor()", () => {
        test("Success", async () => {
            if (d.io !== undefined) d.io.conf.mongo_dbname = "returnOK";
            const ret = await dlib.getPoolCursor(d, {});
            expect(ret.type).toBe("success");
        });
        test("Failure1", async () => {
            if (d.io !== undefined) d.io.conf.mongo_dbname = "returnOK";
            const ret = await dlib.getPoolCursor(dWrong, {});
            expect(ret.type).toBe("failure");
        });
    });

    describe("Method getBlockCursor()", () => {
        test("Success", async () => {
            if (d.io !== undefined) d.io.conf.mongo_dbname = "returnOK";
            const ret = await dlib.getBlockCursor(d, {});
            expect(ret.type).toBe("success");
        });
        test("Failure1", async () => {
            if (d.io !== undefined) d.io.conf.mongo_dbname = "returnOK";
            const ret = await dlib.getBlockCursor(dWrong, {});
            expect(ret.type).toBe("failure");
        });
        test("Failure2", async () => {
            if (d.io !== undefined) d.io.conf.mongo_dbname = "returnError1";
            const ret = await dlib.getBlockCursor(d, {});
            expect(ret.type).toBe("failure");
        });
    });


    describe("Method closeCursor()", () => {
        test("Success", async () => {
            if (d.io !== undefined) d.io.conf.mongo_dbname = "returnOK";
            const ret0 = await dlib.getPoolCursor(d, {});
            if (ret0.isFailure()) { throw new Error("FAIL"); }
            const ret = await dlib.closeCursor(d, ret0.value);
            expect(ret.type).toBe("success");
        });
        test("Failure", async () => {
            if (d.io !== undefined) d.io.conf.mongo_dbname = "returnOK";
            const ret0 = await dlib.getBlockCursor(d, {});
            if (ret0.isFailure()) { throw new Error("FAIL"); }
            const ret = await dlib.closeCursor(dWrong, ret0.value);
            expect(ret.type).toBe("failure");
        });
    });

    describe("Method setPoolNewData()", () => {
        test("Success1", async () => {
            if (d.io !== undefined) d.io.conf.mongo_dbname = "returnOK";
            const ret = await dlib.setPoolNewData(d, tx3, d.conf.default_tenant_id);
            expect(ret.type).toBe("success");
        });
        test("Success2", async () => {
            if (d.io !== undefined) d.io.conf.mongo_dbname = "returnOK";
            const ret = await dlib.setPoolNewData(d, undefined, d.conf.default_tenant_id);
            expect(ret.type).toBe("success");
        });
        test("Success3", async () => {
            if (d.io !== undefined) d.io.conf.mongo_dbname = "returnOK";
            const ret = await dlib.setPoolNewData(d, undefined, "wrong");
            expect(ret.type).toBe("success");
        });
        test("Failure1", async () => {
            if (d.io !== undefined) d.io.conf.mongo_dbname = "returnOK";
            const ret = await dlib.setPoolNewData(dWrong, tx3, d.conf.default_tenant_id);
            expect(ret.type).toBe("failure");
        });
        test("Failure2", async () => {
            if (d.io !== undefined) d.io.conf.mongo_dbname = "returnError1";
            const ret = await dlib.setPoolNewData(d, tx3, d.conf.default_tenant_id);
            expect(ret.type).toBe("failure");
        });
    });
    
    describe("Method setBlockNewData()", () => {
        test("Success1", async () => {
            if (d.io !== undefined) d.io.conf.mongo_dbname = "returnOK";
            const ret = await dlib.setBlockNewData(d, block0, d.conf.default_tenant_id);
            expect(ret.type).toBe("success");
        });
        test("Success2", async () => {
            if (d.io !== undefined) d.io.conf.mongo_dbname = "returnOK";
            const ret = await dlib.setBlockNewData(d, undefined, d.conf.default_tenant_id);
            expect(ret.type).toBe("success");
        });
        test("Success3", async () => {
            if (d.io !== undefined) d.io.conf.mongo_dbname = "returnOK";
            const ret = await dlib.setBlockNewData(d, undefined, "wrong");
            expect(ret.type).toBe("success");
        });
        test("Failure1", async () => {
            if (d.io !== undefined) d.io.conf.mongo_dbname = "returnOK";
            const ret = await dlib.setBlockNewData(dWrong, block0, d.conf.default_tenant_id);
            expect(ret.type).toBe("failure");
        });
        test("Failure2", async () => {
            if (d.io !== undefined) d.io.conf.mongo_dbname = "returnError1";
            const ret = await dlib.setBlockNewData(d, block0, d.conf.default_tenant_id);
            expect(ret.type).toBe("failure");
        });
    });

    describe("Method poolModifyReadsFlag()", () => {
        test("Success1", async () => {
            if (d.io !== undefined) d.io.conf.mongo_dbname = "returnOK";
            const ret = await dlib.poolModifyReadsFlag(d, ["12345678"], d.conf.default_tenant_id);
            expect(ret.type).toBe("success");
        });
        test("Success2", async () => {
            if (d.io !== undefined) d.io.conf.mongo_dbname = "returnOK";
            const ret = await dlib.poolModifyReadsFlag(d, ["12345678"], "wrong");
            expect(ret.type).toBe("success");
        });
        test("Failure", async () => {
            if (d.io !== undefined) d.io.conf.mongo_dbname = "returnOK";
            const ret = await dlib.poolModifyReadsFlag(dWrong, ["12345678"], d.conf.default_tenant_id);
            expect(ret.type).toBe("failure");
        });
    });

    describe("Method poolDeleteTransactions()", () => {
        test("Success1", async () => {
            if (d.io !== undefined) d.io.conf.mongo_dbname = "returnOK";
            const ret = await dlib.poolDeleteTransactions(d, ["12345678"], d.conf.default_tenant_id);
            expect(ret.type).toBe("success");
        });
        test("Success2", async () => {
            if (d.io !== undefined) d.io.conf.mongo_dbname = "returnOK";
            const ret = await dlib.poolDeleteTransactions(d, ["12345678"], "wrong");
            expect(ret.type).toBe("success");
        });
        test("Failure", async () => {
            if (d.io !== undefined) d.io.conf.mongo_dbname = "returnOK";
            const ret = await dlib.poolDeleteTransactions(dWrong, ["12345678"], d.conf.default_tenant_id);
            expect(ret.type).toBe("failure");
        });
    });

    describe("Method blockUpdateBlocks()", () => {
        test("Success1", async () => {
            if (d.io !== undefined) d.io.conf.mongo_dbname = "returnOK";
            const ret = await dlib.blockUpdateBlocks(d, [{oid:"12345678", block: undefined}], d.conf.default_tenant_id);
            expect(ret.type).toBe("success");
        });
        test("Success2", async () => {
            if (d.io !== undefined) d.io.conf.mongo_dbname = "returnOK";
            const ret = await dlib.blockUpdateBlocks(d, [{oid:"12345678", block: undefined}], "wrong");
            expect(ret.type).toBe("success");
        });
        test("Failure1", async () => {
            if (d.io !== undefined) d.io.conf.mongo_dbname = "returnOK";
            const ret = await dlib.blockUpdateBlocks(dWrong, [{oid:"12345678", block: undefined}], d.conf.default_tenant_id);
            expect(ret.type).toBe("failure");
        });
        test("Failure2", async () => {
            if (d.io !== undefined) d.io.conf.mongo_dbname = "returnError1";
            const ret = await dlib.blockUpdateBlocks(d, [{oid:"12345678", block: undefined}], d.conf.default_tenant_id);
            expect(ret.type).toBe("failure");
        });
        test("Failure3", async () => {
            if (d.io !== undefined) d.io.conf.mongo_dbname = "returnError2";
            const ret = await dlib.blockUpdateBlocks(d, [{oid:"12345678", block: undefined}], d.conf.default_tenant_id);
            expect(ret.type).toBe("failure");
        });
        test("Failure4", async () => {
            if (d.io !== undefined) d.io.conf.mongo_dbname = "returnError3";
            const ret = await dlib.blockUpdateBlocks(d, [{oid:"12345678", block: undefined}], d.conf.default_tenant_id);
            expect(ret.type).toBe("failure");
        });
    });

    describe("Method blockDeleteBlocks()", () => {
        test("Success1", async () => {
            if (d.io !== undefined) d.io.conf.mongo_dbname = "returnOK";
            const ret = await dlib.blockDeleteBlocks(d, ["12345678"], d.conf.default_tenant_id);
            expect(ret.type).toBe("success");
        });
        test("Success2", async () => {
            if (d.io !== undefined) d.io.conf.mongo_dbname = "returnOK";
            const ret = await dlib.blockDeleteBlocks(d, ["12345678"], "wrong");
            expect(ret.type).toBe("success");
        });
        test("Failure1", async () => {
            if (d.io !== undefined) d.io.conf.mongo_dbname = "returnOK";
            const ret = await dlib.blockDeleteBlocks(dWrong, ["12345678"], d.conf.default_tenant_id);
            expect(ret.type).toBe("failure");
        });
        test("Failure2", async () => {
            if (d.io !== undefined) d.io.conf.mongo_dbname = "returnError1";
            const ret = await dlib.blockDeleteBlocks(d, ["12345678"], d.conf.default_tenant_id);
            expect(ret.type).toBe("failure");
        });
        test("Failure3", async () => {
            if (d.io !== undefined) d.io.conf.mongo_dbname = "returnError2";
            const ret = await dlib.blockDeleteBlocks(d, ["12345678"], d.conf.default_tenant_id);
            expect(ret.type).toBe("failure");
        });
        test("Failure4", async () => {
            if (d.io !== undefined) d.io.conf.mongo_dbname = "returnError3";
            const ret = await dlib.blockDeleteBlocks(d, ["12345678"], d.conf.default_tenant_id);
            expect(ret.type).toBe("failure");
        });
    });
});