/**
 * Copyright (c) 2024 Ryoji Kamei
 * Released under the MIT license
 * https://opensource.org/licenses/mit-license.php
 */

import { randomUUID, createHash } from "crypto";
import clone from "clone";

import { blockConfigType, Ca3Property, keyringConfigType } from "../../../config"
import { ccBlockType, BlockModule } from "../.."
import { logMock } from "../../../__mocks__/mock_logger"
import { SystemModuleMock } from "../../../__mocks__/mock_system"
import { InModuleMock } from "../../../__mocks__/mock_in"
import { KeyringModuleMock } from "../../../__mocks__/mock_keyring"

import { KeyringModule } from "../../../keyring"

import * as CA3 from "../ca3"
import { randomOid } from "../../../utils"
import { objTx } from "../../../datastore";
import { MainModuleMock } from "../../../__mocks__/mock_main";
import { existsSync } from "fs";

const default_tenant_id = randomUUID();
const administration_id = randomUUID();

const ca3ConfMock: Ca3Property = {
    minLifeTime: 40,
    maxLifeTime: 60,
    minSignNodes: 1,
    maxSignNodes: 1
}
const confMock: blockConfigType = {
    ca3: ca3ConfMock,
    administration_id: administration_id,
    default_tenant_id: default_tenant_id
}


describe("Test of CA3 functions", () => {

    let core: ccBlockType;
    let kconf: keyringConfigType;
    let kcore: any;
    let block0_0: CA3.Ca3BlockFormat;
    let block0_1: CA3.Ca3BlockFormat;
    let block2: CA3.Ca3BlockFormat;
    let block2b: CA3.Ca3BlockFormat;
    let tx3: objTx;
    beforeAll(async () => {
        kconf = {
            create_keys_if_no_sign_key_exists: true,
            sign_key_file: "demo_node1.key",
            verify_key_file: "demo_node1.pub",
            tls_crt_file: "demo_node1.crt",
            tls_csr_file: "demo_node1.csr",
            tls_ca_key_file: "example_ca.key",
            tls_ca_crt_file: "example_ca.crt",
            default_tenant_id: default_tenant_id
        }
        const ret0 = await(new KeyringModule().init(kconf, new logMock()));
        if (ret0.isFailure()) { throw new Error("beforeAll failed in init of KeyringModule"); };
        kcore = ret0.value;

        // block0 case0
        const oidVal0 = { _id: randomOid().byStr() };
        const hObj0 = {
            tenant: default_tenant_id,
            version: 1,
            height: 0,
            size: 0,
            type: "genesis",
            settime: "2023/10/12 15:47:15",
            timestamp: "1697093235478",
            signedby: {},
            signcounter: 1,
            prev_hash: "0"
        }
        const hashVal0: string = createHash('sha256').update(JSON.stringify(hObj0)).digest('hex');
        const hashObj0 = { hash: hashVal0 };
        block0_0 = {...oidVal0, ...hObj0, ...hashObj0};
        const ret1 = await kcore.lib.signByPrivateKey(kcore, block0_0, randomUUID());
        if (ret1.isFailure()) { throw new Error("beforeAll failed in creation of block0_0"); };
        block0_0.signcounter--;
        block0_0.signedby["localhost"] =  ret1.value;

        // block0 case1
        const oidVal1 = { _id: randomOid().byStr() };
        const hObj1 = {
            tenant: default_tenant_id,
            version: 1,
            height: 0,
            size: 0,
            type: "genesis",
            settime: "2023/10/12 15:47:15",
            timestamp: "1697093235478",
            signedby: {},
            signcounter: 2,
            prev_hash: "0"
        }
        const hashVal1: string = createHash('sha256').update(JSON.stringify(hObj1)).digest('hex');
        const hashObj1 = { hash: hashVal1 };
        block0_1 = {...oidVal1, ...hObj1, ...hashObj1};
        const ret2 = await kcore.lib.signByPrivateKey(kcore, block0_1, randomUUID());
        if (ret2.isFailure()) { throw new Error("beforeAll failed in creation of block0_1"); };
        block0_1.signcounter--;
        block0_1.signedby["localhost"] = ret2.value;

        tx3 = {
            "_id": "303148434b3354394d364b37",
            "type":"new",
            "tenant": default_tenant_id,
            "settime":"2023/10/13 08:33:43",
            "deliveryF":false,
            "data": { "desc":"tx3", }
        }

        // block2
        const oidVal2 = { _id: randomOid().byStr() };
        const hObj2 = {
            tenant: default_tenant_id,
            version: 1,
            height: 1,
            size: 1,
            data: [tx3],
            type: "new",
            settime: "2023/10/12 15:47:15",
            timestamp: "1697093235478",
            signedby: {},
            signcounter: 1,
            prev_hash: hashVal0
        }
        const hashVal2: string = createHash('sha256').update(JSON.stringify(hObj2)).digest('hex');
        const hashObj2 = { hash: hashVal2 };
        block2 = {...oidVal2, ...hObj2, ...hashObj2};
        const ret3 = await kcore.lib.signByPrivateKey(kcore, block2, randomUUID());
        if (ret3.isFailure()) { throw new Error("beforeAll failed in creation of block2"); };
        block2.signcounter--;
        block2.signedby["localhost"] =  ret3.value;

        // block2b
        const oidVal2b = { _id: randomOid().byStr() };
        const hObj2b = {
            tenant: default_tenant_id,
            version: 1,
            height: 1,
            size: 1,
            data: [tx3],
            type: "new",
            settime: "2023/10/12 15:47:15",
            timestamp: "1697093235478",
            signedby: {},
            signcounter: 100,
            prev_hash: hashVal0
        }
        const hashVal2b: string = createHash('sha256').update(JSON.stringify(hObj2b)).digest('hex');
        const hashObj2b = { hash: hashVal2b };
        block2b = {...oidVal2b, ...hObj2b, ...hashObj2b};
        const ret3b = await kcore.lib.signByPrivateKey(kcore, block2b, randomUUID());
        if (ret3b.isFailure()) { throw new Error("beforeAll failed in creation of block2"); };
        block2b.signcounter--;
        block2b.signedby["localhost"] =  ret3b.value;

        const lib = new BlockModule();
        const ret4 = new SystemModuleMock().init();
        if (ret4.isFailure()) { throw new Error("beforeAll failed in init of SystemModule"); };
        const ret5 = await (new InModuleMock().init());
        if (ret5.isFailure()) { throw new Error("beforeAll failed in init of InModule"); };
        const ret6 = await (new KeyringModuleMock().init());
        if (ret6.isFailure()) { throw new Error("beforeAll failed in init of KeyringModule"); };
        const ret7 = await (new MainModuleMock().init());
        if (ret7.isFailure()) { throw new Error("beforeAll failed in init of MainModule"); };
        let algorithmFile: string;
        if (existsSync("./dist/block/algorithm/ca3.js") === true) {
            algorithmFile = "./algorithm/ca3.js";
        } else {
            algorithmFile = "../../../../dist/enterprise/src/block/algorithm/ca3.js";
        }
        const ret9 = await lib.init(confMock, new logMock(), ret4.value, ret5.value, ret6.value, ret7.value, algorithmFile);
        if (ret9.isFailure()) { throw new Error("beforeAll failed in init of BlockModule:" + ret9.value); };
        core = ret9.value;
    })


    describe("Function requestToDeclareBlockCreation", () => {
        let packet: CA3.Ca3TravelingIdFormat2;
        beforeEach(() => {
            packet = {
                trackingId: randomUUID(),
                state: "preparation",
                stored: false,
                timeoutMs: 100,
                type: "data",
                tenant: randomUUID(),
                txOids: [randomOid().byStr()],
                block: undefined
            }
        })

        test("succeed in register", async () => {
            const ret = await CA3.requestToDeclareBlockCreation(core, packet);
            if (ret.isSuccess()) {
                expect(ret.value).toBe(101);
            } else {
                throw new Error("FAIL");
            }
        })

        test("succeed in retry", async () => {
            let packetResend = clone(packet);
            packetResend.timeoutMs = 200;
            await CA3.requestToDeclareBlockCreation(core, packet);
            const ret = await CA3.requestToDeclareBlockCreation(core, packetResend);
            if (ret.isSuccess()) {
                expect(ret.value).toBe(102);
            } else {
                throw new Error("FAIL");
            }
        })

        test("succeed when some of oid have started already", async () => {
            await CA3.requestToDeclareBlockCreation(core, packet);
            let packetClone = clone(packet);
            packetClone.trackingId = randomUUID();
            const ret = await CA3.requestToDeclareBlockCreation(core, packetClone);
            if (ret.isSuccess()) {
                expect(ret.value).toBe(-101);
            } else {
                throw new Error("FAIL");
            }
        })

        test("succeed when genesis/parcel have started already", async () => {
            const genesis: CA3.Ca3TravelingIdFormat2 = {
                trackingId: randomUUID(),
                state: "preparation",
                stored: false,
                timeoutMs: 100,
                type: "genesis",
                tenant: randomUUID(),
                txOids: [],
                block: undefined
            }
            await CA3.requestToDeclareBlockCreation(core, genesis);
            let packetClone = clone(genesis);
            packetClone.trackingId = randomUUID();
            const ret = await CA3.requestToDeclareBlockCreation(core, packetClone);
            if (ret.isSuccess()) {
                expect(ret.value).toBe(-102);
            } else {
                throw new Error("FAIL");
            }
        })
    })

    describe("Function verifyABlock", () => {
        let packet: CA3.Ca3TravelingIdFormat2;
        beforeAll(() => {
            packet = {
                trackingId: randomUUID(),
                state: "underway",
                stored: false,
                timeoutMs: 10000,
                type: "data",
                tenant: randomUUID(),
                txOids: [randomOid().byStr()],
                block: block0_0
            }
        })

        test("succeed in verifying", async () => {
            const ret = await CA3.verifyABlock(core, block0_0, undefined);
            if (ret.isSuccess()) {
                expect(ret.type).toBe("success");
                expect(ret.value.status).toBe(0);
            } else {
                throw new Error("FAIL");
            }
        })

        test("failed due to timeout", async () => {
            const trackingId = randomUUID();
            CA3.setupCreator(core, "genesis", [], randomUUID(), new Date().valueOf(), 0, trackingId);
            const ret = await CA3.verifyABlock(core, block0_0, trackingId);
            if (ret.isFailure()) {
                expect(ret.value.origin.pos).toBe("Timeout");
            } else {
                throw new Error("FAIL");
            }
        })

        test("failed due to illegal block", async () => {
            let blockWrong: any = clone(block0_0);
            blockWrong.hash = undefined;
            const ret = await CA3.verifyABlock(core, blockWrong, undefined);
            if (ret.isFailure()) {
                expect(ret.value.origin.pos).toBe("illegalBlock");
            } else {
                throw new Error("FAIL");
            }
        })

        test("failed due to illegal data", async () => {
            const blockWrong: any = undefined;
            const ret = await CA3.verifyABlock(core, blockWrong, undefined);
            if (ret.isFailure()) {
                expect(ret.value.origin.pos).toBe("illegalData");
            } else {
                throw new Error("FAIL");
            }
        })

        test("failed to verify signatures: ed25519 1", async () => {
            let blockWrong = clone(block0_0);
            blockWrong.signedby["localhost"] = "failSample1";
            const ret = await CA3.verifyABlock(core, blockWrong, undefined);
            if (ret.isFailure()) {
                expect(ret.value.origin.func).toBe("verifyByPublicKey");
                expect(ret.value.origin.pos).toBe("refreshPublicKeyCache")
            } else {
                throw new Error("FAIL");
            }
        })

        test("failed to verify signatures: ed25519 2", async () => {
            let blockWrong = clone(block0_0);
            blockWrong.signedby["localhost"] = "failSample2";
            const ret = await CA3.verifyABlock(core, blockWrong, undefined);
            if (ret.isFailure()) {
                expect(ret.value.origin.func).toBe("verifyByPublicKey");
                expect(ret.value.origin.pos).toBe("verify")
            } else {
                throw new Error("FAIL");
            }
        })

        test("failed to verify signatures: ed25519 3", async () => {
            let blockWrong = clone(block0_0);
            blockWrong.signedby["localhost"] = "failSample3";
            const ret = await CA3.verifyABlock(core, blockWrong, undefined);
            if (ret.isSuccess()) {
                expect(ret.value.status).toBe(30);
            } else {
                throw new Error("FAIL");
            }
        })

        test("failed to verify signatures: sha256", async () => {
            let blockWrong = clone(block0_0);
            blockWrong.hash = "wrong";
            const ret = await CA3.verifyABlock(core, blockWrong, undefined);
            if (ret.isSuccess()) {
                expect(ret.value.status).toBe(3);
            } else {
                throw new Error("FAIL");
            }
        })
    })

    describe("Function requestToSignAndResendOrStore", () => {
        const trackingId = randomUUID();
        beforeAll(async () => {
            const packet: CA3.Ca3TravelingIdFormat2 = {
                trackingId: trackingId,
                state: "underway",
                stored: false,
                timeoutMs: Number.MAX_SAFE_INTEGER,
                type: "data",
                tenant: block0_0.tenant,
                txOids: [],
                block: block0_0
            }
            await CA3.requestToDeclareBlockCreation(core, packet);
        })

        test("succeed in resending", async () => {
            const tObj: CA3.Ca3TravelingFormat = {
                trackingId: trackingId,
                block: block0_1
            }
            const ret = await CA3.requestToSignAndResendOrStore(core, tObj);
            expect(ret.type).toBe("success");
        })

        test("succeed in storing", async () => {
            const tObj: CA3.Ca3TravelingFormat = {
                trackingId: trackingId,
                block: block0_0
            }
            const ret = await CA3.requestToSignAndResendOrStore(core, tObj);
            expect(ret.type).toBe("success");
        })

        test("succeed in stopping procedure in verification", async () => {
            let blockWrong = clone(block0_0);
            blockWrong.settime = "1970/01/01 00:00:00"
            const tObj: CA3.Ca3TravelingFormat = {
                trackingId: trackingId,
                block: blockWrong
            }
            const ret = await CA3.requestToSignAndResendOrStore(core, tObj);
            if (ret.isSuccess()) {
                expect(ret.value).toBe(1003);
            } else {
                throw new Error("FAIL"); 
            }
        })

        test("failed to sign", async () => {
            core.k = undefined;
            const tObj: CA3.Ca3TravelingFormat = {
                trackingId: trackingId,
                block: block0_0
            }
            const ret = await CA3.requestToSignAndResendOrStore(core, tObj);
            const ret3 = await (new KeyringModuleMock().init());
            if (ret3.isSuccess()) core.k = ret3.value;
            if (ret.isFailure()) {
                expect(ret.value.origin.func).toBe("signTheBlockObject");
                expect(ret.value.origin.pos).toBe("signByPrivateKey");
            } else {
                throw new Error("FAIL");
            }
        })

        // Pending: need to make sendRpc mock to fail
        /* test("succeed in stopping procedure in resending", async () => {
            if (core.conf.ca3 !== undefined) core.conf.ca3.minSignNodes = 1000;
            const tObj: CA3.Ca3TravelingFormat = {
                trackingId: trackingId,
                block: block0_0
            }
            const ret = await CA3.requestToSignAndResendOrStore(core, tObj);
            if (core.conf.ca3 !== undefined) core.conf.ca3.minSignNodes = 1;
            if (ret.isSuccess()) {
                expect(ret.value).toBe(3000);
            } else {
                throw new Error("FAIL"); 
            }
        }) */

        test("failed to store", async() => {
            core.s = undefined;
            const tObj: CA3.Ca3TravelingFormat = {
                trackingId: trackingId,
                block: block0_0
            }
            const ret = await CA3.requestToSignAndResendOrStore(core, tObj)
            const ret1 = new SystemModuleMock().init();
            if (ret1.isSuccess()) core.s = ret1.value;
            if (ret.isFailure()) {
                expect(ret.value.origin.func).toBe("requestToSignAndResendOrStore");
                expect(ret.value.origin.pos).toBe("requestToAddBlock");
            } else {
                throw new Error("FAIL");
            }
        })
    })

    describe("Function setupCreator", () => {
        test("succeed in setup", () => {
            const startTimeMs = new Date().valueOf();
            const lifeTimeMs = ca3ConfMock.minLifeTime * 1000;
            const trackingId = randomUUID();
            CA3.setupCreator(core, "data", [tx3], tx3.tenant, startTimeMs, lifeTimeMs, trackingId);
            expect(CA3.travelingIds[trackingId]).toBeDefined()
        })
    })

    /* update runRpcs to fix
    describe("Function proceedCreator", () => {
        let startTimeMs: number;
        let lifeTimeMs: number;
        let trackingId: string;
        beforeEach(() => {
            startTimeMs = new Date().valueOf();
            lifeTimeMs = ca3ConfMock.minLifeTime * 1000;
            trackingId = randomUUID();
            CA3.setupCreator(core, "genesis", [], randomUUID(), startTimeMs, lifeTimeMs, trackingId);
        })

        test("succeed in creating genesis block", async () => {
            const ret1 = await CA3.proceedCreator(core, undefined, [], trackingId, default_tenant_id, { type: "genesis" });
            let ret2: CA3.Ca3ReturnFormat;
            if (ret1.isSuccess()) {
                ret2 = ret1.value;
                expect(ret2.status).toBe(0);
                expect(ret2.block).toBeUndefined();
            } else {
                throw new Error("FAIL");
            }
        })
    })
    */

    describe("Function closeATransaction", () => {
        test("succeed in closing", () => {
            try {
                CA3.closeATransaction(randomUUID());
            } catch (error) {
                
            }
        })
    })
})