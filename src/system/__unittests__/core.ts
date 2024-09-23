/**
 * Copyright (c) 2024 Ryoji Kamei
 * Released under the MIT license
 * https://opensource.org/licenses/mit-license.php
 */

import { SystemModule, examineHash } from "..";
import { systemConfigType } from "../../config";

import { gFailure, gError } from "../../utils";

import { DsModuleMock } from "../../__mocks__/mock_ds";
import { InModuleMock } from "../../__mocks__/mock_in";
import { logMock } from "../../__mocks__/mock_logger";
import { BlockModuleMock } from "../../__mocks__/mock_block";
import { MainModuleMock } from "../../__mocks__/mock_main";
import { EventModuleMock } from "../../__mocks__/mock_event";
import { randomOid } from "../../utils";
import { randomUUID } from "crypto";
import { objTx } from "../../datastore";

const administration_id = randomUUID();
const default_tenant_id = randomUUID()

let confMock: systemConfigType = {
    node_mode: "testing",
    events_internal: {
        postScanAndFixBlockMinInterval: 300,
        postScanAndFixPoolMinInterval: 300,
        postDeliveryPoolMinInterval: 300,
        postAppendBlocksMinInterval: 300
    },
    enable_default_tenant: true,
    administration_id: administration_id,
    default_tenant_id: default_tenant_id
}

const tx3: objTx = {
    "_id": "303148434b3354394d364b37",
    "type":"new",
    "tenant": default_tenant_id,
    "settime":"2023/10/13 08:33:43",
    "deliveryF":false,
    "data": { "desc":"tx3", }
}

let slib: SystemModule;
let score: any;
let dcore: any;
let mcore: any;
let icore: any;
let bcore: any;
let ecore: any;
let dcoreFail: any;
let mcoreFail: any;
let icoreFail: any;
let bcoreFail: any;
describe("Test of SystemModule", () => {
    beforeAll(async () => {
        slib = new SystemModule();
        const ret = slib.init(confMock, new logMock());
        if (ret.isSuccess()) score = ret.value;
        const ret0 = await(new DsModuleMock().init());
        if (ret0.isSuccess()) dcore = ret0.value;
        const ret1 = await (new MainModuleMock().init());
        if (ret1.isSuccess()) mcore = ret1.value;
        const ret2 = await (new InModuleMock().init());
        if (ret2.isSuccess()) icore = ret2.value; 
        const ret3 = await (new BlockModuleMock().init())
        if (ret3.isSuccess()) bcore = ret3.value;
        const ret4 = new EventModuleMock().init();
        if (ret4.isSuccess()) ecore = ret4.value;

        const ret01 = await(new DsModuleMock().init());
        if (ret01.isSuccess()) dcoreFail = ret01.value;
        dcoreFail.lib.poolModifyReadsFlag = () => { return new gFailure(new gError("ds", "poolModifyReadsFlag", "", "")); }
        dcoreFail.lib.setPoolNewData = () => { return new gFailure(new gError("ds", "setPoolNewData", "", "")); }
        dcoreFail.lib.setBlockNewData = () => { return new gFailure(new gError("ds", "setBlockNewData", "", "")); }
        dcoreFail.lib.cleanup = () => { return new gFailure(new gError("ds", "cleanup", "", "")); }
        dcoreFail.lib.blockDeleteBlocks = () => { return new gFailure(new gError("ds", "blockDeleteBlocks", "", "")); }
        dcoreFail.lib.poolDeleteTransactions = () => { return new gFailure(new gError("ds", "poolDeleteTransactions", "", "")); }
        const ret11 = await (new MainModuleMock().init());
        if (ret11.isSuccess()) mcoreFail = ret11.value;
        mcoreFail.lib.getAllUndeliveredPool = () => { return new gFailure(new gError("main", "getAllUndeliveredPool", "", "")); };
        mcoreFail.lib.getAllDeliveredPool = () => { return new gFailure(new gError("main", "getAllDeliveredPool", "", "")); };
        mcoreFail.lib.getAllPool = () => { return new gFailure(new gError("main", "getAllPool", "", "")); };
        mcoreFail.lib.getAllBlock = () => { return new gFailure(new gError("main", "getAllBlock", "", "")); };
        mcoreFail.lib.getSearchByOid = () => { return new gFailure(new gError("main", "getSearchByOid", "", "")); };
        mcoreFail.lib.getLastBlock = () => { return new gFailure(new gError("main", "getLastBlock", "", "")); };
        const ret21 =  await (new InModuleMock().init());
        if (ret21.isSuccess()) icoreFail = ret21.value;
        icoreFail.lib.runRpcs = () => { return new gFailure(new gError("in", "runRpcs", "", "")); }
        const ret31 = await (new BlockModuleMock().init())
        if (ret31.isSuccess()) bcoreFail = ret31.value;
        bcoreFail.lib.createBlock = () => { return new gFailure(new gError("block", "createBlock", "", "")); }
        bcoreFail.lib.verifyBlock = () => { return new gFailure(new gError("block", "verifyBlock", "", "")); }
    });

    describe("Method registerAutoTasks()", () => {
        test("Success", () => {
            score.e = ecore;
            const ret = slib.registerAutoTasks(score);
            expect(ret.type).toBe("success");
        });
        test("Failure", () => {
            score.e = undefined;
            const ret = slib.registerAutoTasks(score);
            expect(ret.type).toBe("failure");
        });
    });

    describe("Method unregisterAutoTasks()", () => {
        test("Success", () => {
            score.e = ecore;
            const ret = slib.unregisterAutoTasks(score);
            expect(ret.type).toBe("success");
        });
        test("Failure", () => {
            score.e = undefined;
            const ret = slib.unregisterAutoTasks(score);
            expect(ret.type).toBe("failure");
        });
    });

    describe("Method postDeliveryPool()", () => {
        test("succeed in delivering", async () => {
            score.d = dcore;
            score.m = mcore;
            score.i = icore;
            const ret3 = await slib.postDeliveryPool(score);
            expect(ret3.type).toBe("success");
        });
        test("Failed to deliver due to down of datastore module", async() => {
            score.d = undefined;
            score.m = mcore;
            score.i = icore; 
            const ret3 = await slib.postDeliveryPool(score);
            expect(ret3.type).toBe("failure");
        });
        test("Failed to deliver due to down of main module", async() => {
            score.d = dcore;
            score.m = undefined;
            score.i = icore;
            const ret3 = await slib.postDeliveryPool(score);
            expect(ret3.type).toBe("failure");
        });
        test("Failed to deliver due to down of internode module", async() => {
            score.d = dcore;
            score.m = mcore;
            score.i = undefined;
            const ret3 = await slib.postDeliveryPool(score);
            expect(ret3.type).toBe("failure");
        });
        test("Failure4", async () => {
            score.d = dcore;
            score.m = mcore;
            score.i = icore;
            score.serializationLocks.postDeliveryPool = true;
            const ret3 = await slib.postDeliveryPool(score);
            score.serializationLocks.postDeliveryPool = false;
            expect(ret3.type).toBe("failure");
        });
        test("Failure5", async () => {
            score.d = dcore;
            score.m = mcoreFail;
            score.i = icore;
            const ret3 = await slib.postDeliveryPool(score);
            expect(ret3.type).toBe("failure");
        });
        test("Failure6", async () => {
            score.d = dcore;
            score.m = mcore;
            score.i = icoreFail;
            const ret3 = await slib.postDeliveryPool(score);
            expect(ret3.type).toBe("failure");
        }); 
    }); 

    describe("Method requestToAddPool()", () => {
        test("succeed in adding", async () => {
            score.d = dcore;
            const ret = await slib.requestToAddPool(score, [tx3]);
            expect(ret.type).toBe("success");
        });
        test("Failed to deliver due to down of datastore module", async() => {
            score.d = undefined;
            const ret = await slib.requestToAddPool(score, [tx3]);
            expect(ret.type).toBe("failure");
        });
        test("Failure2", async () => {
            score.d = dcoreFail;
            const ret = await slib.requestToAddPool(score, [tx3]);
            expect(ret.type).toBe("failure");
        });
    });

    describe("Method postAppendBlocks()", () => {
        test("succeed in appending", async () => {
            score.m = mcore;
            score.b = bcore;
            const ret4 = await slib.postAppendBlocks(score);
            expect(ret4.type).toBe("success");
        });
        test("Failed to append due to down of main module", async() => {
            score.m = undefined;
            score.b = bcore;
            const ret4 = await slib.postAppendBlocks(score);
            expect(ret4.type).toBe("failure");
        });
        test("Failed to append due to down of block module", async() => {
            score.m = mcore;
            score.b = undefined;
            const ret4 = await slib.postAppendBlocks(score);
            expect(ret4.type).toBe("failure");
        });
        test("Failure3", async () => {
            score.m = mcore;
            score.b = bcore;
            score.serializationLocks.postAppendBlocks = true;
            const ret4 = await slib.postAppendBlocks(score);
            score.serializationLocks.postAppendBlocks = false;
            expect(ret4.type).toBe("failure");
        });
        test("Failure4", async () => {
            score.m = mcoreFail;
            score.b = bcore;
            const ret4 = await slib.postAppendBlocks(score);
            expect(ret4.type).toBe("failure");
        });
        test("Failure5", async () => {
            score.m = mcore;
            score.b = bcoreFail;
            const ret4 = await slib.postAppendBlocks(score);
            expect(ret4.type).toBe("failure");
        });
    });

    describe("Method requestToAddBlock()", () => {
        const bObj: any = {}
        test("succeed in adding", async () => {
            score.d = dcore;
            score.b = bcore;
            const ret4 = await slib.requestToAddBlock(score, bObj, false);
            if (ret4.isSuccess()) {
                expect(ret4.value).toBe(undefined);
            } else {
                throw new Error("unknown error");
            }
        });
        test("Failed to add due to down of datastore module", async() => {
            score.d = undefined;
            score.b = bcore;
            const ret4 = await slib.requestToAddBlock(score, bObj, false);
            if (ret4.isFailure()) {
                expect(ret4.value.message).toBe("The datastore module is down");
            } else {
                throw new Error("unknown error");
            }
        });
        test("Failed to add due to down of block module", async() => {
            score.d = dcore;
            score.b = undefined;
            const ret4 = await slib.requestToAddBlock(score, bObj, false);
            if (ret4.isFailure()) {
                expect(ret4.value.message).toBe("The block module is down");
            } else {
                throw new Error("unknown error");
            }
        });
        test("succeed in add with removeFromPool", async () => {
            score.d = dcore;
            score.b = bcore;
            const ret4 = await slib.requestToAddBlock(score, bObj, true);
            if (ret4.isSuccess()) {
                expect(ret4.value).toBe(undefined);
            } else {
                throw new Error("unknown error");
            }
        });
        test("Failure3", async () => {
            score.d = dcore;
            score.b = bcore;
            bObj.size = -2;
            const ret4 = await slib.requestToAddBlock(score, bObj, false);
            if (ret4.isFailure()) {
                expect(ret4.value.origin.detail).toBe("The object that was sent is not a block.");
            } else {
                throw new Error("unknown error");
            }
        });
        test("Failure4", async () => {
            score.d = dcore;
            score.b = bcore;
            bObj.size = -1;
            const ret4 = await slib.requestToAddBlock(score, bObj, false);
            if (ret4.isFailure()) {
                expect(ret4.value.origin.detail).toBe("The block that was sent is broken.");
            } else {
                throw new Error("unknown error");
            }
        });
        test("Failure5", async () => {
            score.d = dcore;
            score.b = bcore;
            bObj.size = 3;
            const ret4 = await slib.requestToAddBlock(score, bObj, false);
            bObj.size = 1;
            if (ret4.isFailure()) {
                expect(ret4.value.origin.detail).toBe("The block that was sent is malformed.");
            } else {
                throw new Error("unknown error");
            }
        });
        test("Failure6", async () => {
            score.d = dcoreFail;
            score.b = bcore;
            const ret4 = await slib.requestToAddBlock(score, bObj, false);
            if (ret4.isFailure()) {
                expect(ret4.value.origin.detail).toBe("");
            } else {
                throw new Error("unknown error");
            }
        });
    });

    describe("Method postGenesisBlock()", () => {
        test("Succeed in initializing", async () => {
            score.d = dcore;
            score.b = bcore;
            score.i = icore;
            score.m = mcore;
            const ret4 = await slib.postGenesisBlock(score, {trytoreset: true});
            expect(ret4.type).toBe("success");
        });
        test("Failed to initialize due to existence of data", async () => {
            score.d = dcore;
            score.b = bcore;
            score.i = icore;
            score.m = mcore;
            const ret4 = await slib.postGenesisBlock(score);
            expect(ret4.type).toBe("failure");
        });
        test("Failed to initialize due to down of datastore module", async () => {
            score.d = undefined;
            score.b = bcore;
            score.i = icore;
            score.m = mcore;
            const ret4 = await slib.postGenesisBlock(score, {trytoreset: true});
            expect(ret4.type).toBe("failure");
        });
        test("Failed to initialize due to down of block module", async () => {
            score.d = dcore;
            score.b = undefined;
            score.i = icore;
            score.m = mcore;
            const ret4 = await slib.postGenesisBlock(score, {trytoreset: true});
            expect(ret4.type).toBe("failure");
        });
        test("Failed to initialize due to down of internode module", async () => {
            score.d = dcore;
            score.b = bcore;
            score.i = undefined; 
            score.m = mcore;
            const ret4 = await slib.postGenesisBlock(score);
            expect(ret4.type).toBe("failure");
        });
        test("Failed to initialize due to down of main module", async () => {
            score.d = dcore;
            score.b = bcore;
            score.i = icore; 
            score.m = undefined;
            const ret4 = await slib.postGenesisBlock(score);
            expect(ret4.type).toBe("failure");
        });
        test("Failure6", async () => {
            score.d = dcore;
            score.b = bcore;
            score.i = icore;
            score.m = mcore;
            score.serializationLocks.postGenesisBlock = true;
            const ret4 = await slib.postGenesisBlock(score, {trytoreset: true});
            score.serializationLocks.postGenesisBlock = false;
            expect(ret4.type).toBe("failure");
        });
        test("Failure7", async () => {
            score.d = dcore;
            score.b = bcore;
            score.i = icore;
            score.m = mcoreFail;
            const ret4 = await slib.postGenesisBlock(score);
            expect(ret4.type).toBe("failure");
        });
        test("Failure8", async () => {
            score.d = dcoreFail;
            score.b = bcore;
            score.i = icore;
            score.m = mcore;;
            const ret4 = await slib.postGenesisBlock(score, {trytoreset: true});
            expect(ret4.type).toBe("failure");
        });
        test("Failure9", async () => {
            score.d = dcore;
            score.b = bcoreFail;
            score.i = icore;
            score.m = mcore;;
            const ret4 = await slib.postGenesisBlock(score, {trytoreset: true});
            expect(ret4.type).toBe("failure");
        });
    });

    describe("Method requestToGetPoolHeight()", () => {
        test("succeed in getting count", async () => {
            score.m = mcore;
            const ret4 = await slib.requestToGetPoolHeight(score); 
            expect(ret4.type).toBe("success");
        });
        test("Failed to get count due to down of main module", async () => {
            score.m = undefined;
            const ret4 = await slib.requestToGetPoolHeight(score); 
            expect(ret4.type).toBe("failure");
        });
        test("Failure2", async () => {
            score.m = mcoreFail;
            const ret4 = await slib.requestToGetPoolHeight(score); 
            expect(ret4.type).toBe("failure");
        });
    });

    describe("Method requestToGetBlockHeight()", () => {
        test("succeed in getting count", async () => {
            score.m = mcore;
            const ret4 = await slib.requestToGetBlockHeight(score); 
            expect(ret4.type).toBe("success");
        });
        test("Failed to get count due to down of main module", async () => {
            score.m = undefined;
            const ret4 = await slib.requestToGetBlockHeight(score); 
            expect(ret4.type).toBe("failure");
        });
        test("Failure2", async () => {
            score.m = mcoreFail;
            const ret4 = await slib.requestToGetBlockHeight(score); 
            expect(ret4.type).toBe("failure");
        });
    });

    describe("Method requestToGetBlock()", () => {
        test("succeed in getting a block", async () => {
            const blockHint = randomOid().byStr();
            score.m = mcore;
            const ret = await slib.requestToGetBlock(score, blockHint, undefined); 
            expect(ret.type).toBe("success");
        });
        test("Failed to get a block due to down of main module", async () => {
            const blockHint = randomOid().byStr();
            score.m = undefined;
            const ret = await slib.requestToGetBlock(score, blockHint, true);
            expect(ret.type).toBe("failure");
        });
        test("Failed to get a block due to wrong oid", async () => {
            score.m = mcore;
            const ret = await slib.requestToGetBlock(score, "notFoundSample0000000000", true);
            if (ret.isSuccess()) {
                if (ret.value !== undefined) {
                    throw new Error("FAIL");
                }
            } else {
                throw new Error("FAIL");
            }
        });
        test("Failure2", async () => {
            const blockHint = randomOid().byStr();
            score.m = mcoreFail;
            const ret = await slib.requestToGetBlock(score, blockHint, undefined); 
            expect(ret.type).toBe("failure");
        });
    });

    // It's difficult to generate exhaustive test data. Use apitest for check properly.
    describe("Method postScanAndFixBlock()", () => {
        test("succeed in passing the test", async () => {
            score.m = mcore;
            score.i = icore;
            score.d = dcore;
            score.b = bcore;
            const ret = await slib.postScanAndFixBlock(score);
            console.log(JSON.stringify(ret.value));
            expect(ret.type).toBe("success");
        });
        test("Failed to pass the test due to down of main module", async() => {
            score.m = undefined;
            score.i = icore;
            score.d = dcore;
            score.b = bcore;
            const ret = await slib.postScanAndFixBlock(score);
            expect(ret.type).toBe("failure");
        });
        test("Failed to pass the test due to down of internode module", async() => {
            score.m = mcore;
            score.i = undefined;
            score.d = dcore;
            score.b = bcore;
            const ret = await slib.postScanAndFixBlock(score);
            expect(ret.type).toBe("failure");
        });
        test("Failure3", async () => {
            score.m = mcore;
            score.i = icore;
            score.d = dcore;
            score.b = bcore;
            score.serializationLocks.postScanAndFixBlock = true;
            const ret = await slib.postScanAndFixBlock(score);
            score.serializationLocks.postScanAndFixBlock = false;
            expect(ret.type).toBe("failure");
        });
        test("Failure4", async () => {
            score.m = mcore;
            score.i = icoreFail;
            score.d = dcore;
            score.b = bcore;
            const ret = await slib.postScanAndFixBlock(score);
            expect(ret.type).toBe("failure");
        });
        /*
        test("Failure5", async() => {
            score.m = mcore;
            score.i = icore;
            score.d = dcore;
            score.b = bcoreFail;
            const ret = await slib.postScanAndFixBlock(score);
            expect(ret.type).toBe("failure");
        });
        test("Failure6", async () => {
            score.m = mcore;
            score.i = icore;
            score.d = dcoreFail;
            score.b = bcore;
            const ret = await slib.postScanAndFixBlock(score);
            expect(ret.type).toBe("failure");
        });
        */
        test("Failure7", async () => {
            score.m = mcoreFail;
            score.i = icore;
            score.d = dcore;
            score.b = bcore;
            const ret = await slib.postScanAndFixBlock(score);
            expect(ret.type).toBe("failure");
        });
    });

    describe("Method requestToGetLastHash()", () => {
        test("succeed in getting hash", async () => {
            score.m = mcore;
            score.b = bcore;
            const ret = await slib.requestToGetLastHash(score, default_tenant_id, true);
            expect(ret.type).toBe("success");
        });
        test("Failed to get hash due to down of main module", async () => {
            score.m = undefined;
            score.b = bcore;
            const ret = await slib.requestToGetLastHash(score, default_tenant_id, true);
            expect(ret.type).toBe("failure");
        });
        test("Failed to get hash due to down of block module", async () => {
            score.m = mcore;
            score.b = undefined;
            const ret = await slib.requestToGetLastHash(score, default_tenant_id, true);
            expect(ret.type).toBe("failure");
        });
        test("Failure3", async () => {
            score.m = mcoreFail;
            score.b = bcore;
            const ret = await slib.requestToGetLastHash(score, default_tenant_id, true);
            expect(ret.type).toBe("failure");
        });
        test("Failure4", async () => {
            score.m = mcore;
            score.b = bcoreFail;
            const ret = await slib.requestToGetLastHash(score, default_tenant_id, true);
            expect(ret.type).toBe("failure");
        });
    });

    describe("Method requestToExamineBlockDifference()", () => {
        let data: examineHash;
        beforeAll(() => {
            data = {
                _id: randomOid().byStr(),
                hash: "fakeHash"
            }
        });
        test("succeed in examination", async () => {
            score.m = mcore;
            const ret = await slib.requestToExamineBlockDifference(score, [data]);
            expect(ret.type).toBe("success");
        });
        test("Failed examination due to down of main module", async () => {
            score.m = undefined;
            const ret = await slib.requestToExamineBlockDifference(score, [data]);
            expect(ret.type).toBe("failure");
        });
        test("Failure2", async () => {
            score.m = mcoreFail;
            const ret = await slib.requestToExamineBlockDifference(score, [data]);
            expect(ret.type).toBe("failure");
        });
    });

    // It's difficult to generate exhaustive test data. Use apitest for check properly.
    describe("Method postScanAndFixPool()", () => {
        test("succeed in scanning", async () => {
            score.d = dcore;
            score.m = mcore;
            score.i = icore;
            const ret = await slib.postScanAndFixPool(score);
            expect(ret.type).toBe("success");
        });
        /*
        test("Failed scanning due to down of datastore module", async () => {
            score.d = undefined;
            score.m = mcore;
            score.i = icore;
            const ret = await slib.postScanAndFixPool(score);
            expect(ret.type).toBe("failure");
        });
        */
        test("Failed scanning due to down of main module", async () => {
            score.d = dcore;
            score.m = undefined;
            score.i = icore;
            const ret = await slib.postScanAndFixPool(score);
            expect(ret.type).toBe("failure");
        });
        test("Failed scanning due to down of internode module", async () => {
            score.d = dcore;
            score.m = mcore;
            score.i = undefined;
            const ret = await slib.postScanAndFixPool(score);
            expect(ret.type).toBe("failure");
        });
        test("Failure4", async () => {
            score.d = dcore;
            score.m = mcore;
            score.i = icore;
            score.serializationLocks.postScanAndFixPool = true;
            const ret = await slib.postScanAndFixPool(score);
            score.serializationLocks.postScanAndFixPool = false;
            expect(ret.type).toBe("failure");
        });
        test("Failure5", async () => {
            score.d = dcore;
            score.m = mcoreFail;
            score.i = icore;
            const ret = await slib.postScanAndFixPool(score);
            expect(ret.type).toBe("failure");
        });
    });

    describe("Method requestToExaminePoolDifference()", () => {
        test("succeed in examination", async () => {
            score.m = mcore;
            const ret = await slib.requestToExaminePoolDifference(score, [randomOid().byStr()]);
            expect(ret.type).toBe("success");
        });
        test("Failed examination due to down of main module", async () => {
            score.m = undefined;
            const ret = await slib.requestToExaminePoolDifference(score, [randomOid().byStr()]);
            expect(ret.type).toBe("failure");
        });
        test("Failure2", async () => {
            score.m = mcoreFail;
            const ret = await slib.requestToExaminePoolDifference(score, [randomOid().byStr()]);
            expect(ret.type).toBe("failure");
        });
    });

    describe("Method examinePoolDifference()", () => {
        test("succeed in examination", async () => {
            score.m = mcore;
            const ret = await slib.examinePoolDifference(score, [randomOid().byStr()]);
            expect(ret.type).toBe("success");
        });
        test("Failed examination due to down of main module", async () => {
            score.m = undefined;
            const ret = await slib.examinePoolDifference(score, [randomOid().byStr()]);
            expect(ret.type).toBe("failure");
        });
        test("Failure2", async () => {
            score.m = mcoreFail;
            const ret = await slib.examinePoolDifference(score, [randomOid().byStr()]);
            expect(ret.type).toBe("failure");
        });
    });

    describe("Method postSyncCaches()", () => {
        test("succeed in syncing", async () => {
            score.d = dcore;
            const ret = await slib.postSyncCaches(score);
            expect(ret.type).toBe("success");
        });
        test("Failed syncing", async () => {
            score.d = undefined;
            const ret = await slib.postSyncCaches(score);
            expect(ret.type).toBe("failure");
        });
        test("Failure2", async () => {
            score.d = dcoreFail;
            const ret = await slib.postSyncCaches(score);
            expect(ret.type).toBe("failure");
        });
    });
});