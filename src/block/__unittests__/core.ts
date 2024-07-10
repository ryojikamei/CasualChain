/**
 * Copyright (c) 2024 Ryoji Kamei
 * Released under the MIT license
 * https://opensource.org/licenses/mit-license.php
 */

import { gResult, gSuccess, gError } from "../../utils"
import { randomUUID } from "crypto"
import { blockFormat } from ".."
import { BlockModule } from "../core"
import { blockConfigType, ConfigModule } from "../../config"
import { ccBlockType } from ".."
import { logMock } from "../../__mocks__/mock_logger";
import { SystemModuleMock } from "../../__mocks__/mock_system"
import { KeyringModuleMock } from "../../__mocks__/mock_keyring"
import { InModuleMock } from "../../__mocks__/mock_in"
import { MainModuleMock } from "../../__mocks__/mock_main"
import { objTx } from "../../datastore"

const default_tenant_id = randomUUID();

const confMock3: blockConfigType = {
    ca3: {
        minLifeTime: 40,
        maxLifeTime: 360,
        abnormalCountForJudging: 2,
        minSignNodes: 0,
        maxSignNodes: 0
    }
}

const tx3: objTx = {
    "_id": "303148434b3354394d364b37",
    "type":"new",
    "tenant": default_tenant_id,
    "settime":"2023/10/13 08:33:43",
    "deliveryF": true,
    "data": { "desc":"tx3", }
}

const data = [tx3];

describe("Test of BlockModule", () => {
    let core: ccBlockType;

    let s: any;
    let i: any;
    let k: any;
    let m: any;
    let c: any;
    beforeAll(async () => {
        const ret1 = new SystemModuleMock().init();
        s = undefined;
        if (ret1.isSuccess()) s = ret1.value;
        i = undefined;
        const ret2 = await (new InModuleMock().init());
        if (ret2.isSuccess()) i = ret2.value;
        k = undefined;
        const ret3 = await (new KeyringModuleMock().init());
        if (ret3.isSuccess()) k = ret3.value;
        m = undefined;
        const ret4 = await (new MainModuleMock().init());
        if (ret4.isSuccess()) m = ret4.value;
        c = undefined;
        const ret5 = await (new ConfigModule().init());
        if (ret5.isSuccess()) c = ret5.value;
    })

    describe("Method createBlock() with CA3", () => {
        beforeAll(async () => {
            const lib = new BlockModule();
            let ret6: gResult<ccBlockType, gError>
            ret6 = await lib.init(confMock3, new logMock(), s, i, k, m, c, "../../dist/__mocks__/mock_ca3.js");
            if (ret6.isFailure()) {
                ret6 = await lib.init(confMock3, new logMock(), s, i, k, m, c, "../../../../dist/enterprise/src/__mocks__/mock_ca3.js");
            }
            if (ret6.isSuccess()) {
                core = ret6.value;
            } else {
                throw new Error("beforeAll failed");
            }
        })

        test("succeed in creating", async () => {
            const ret1 = await core.lib.createBlock(core, data, default_tenant_id);
            let bObj: blockFormat | undefined = undefined;
            if (ret1.isSuccess()) bObj = ret1.value;
            expect(bObj).toBeDefined();
            if (bObj !== undefined) {
                const ret2 = await core.lib.verifyBlock(core, bObj);
                let res = -3;
                if (ret2.isSuccess()) res = ret2.value;
                expect(bObj.hash.length).toBe(64);
                expect(res).toBe(0);
            } else {
                throw new Error("FAIL");
            }
        })

        test("Failure1", async () => {
            const ret1 = await core.lib.createBlock(core, data, "TimeoutSample");
            if (ret1.isSuccess()) { throw new Error("FAIL") };
            expect(ret1.type).toBe("failure");
            expect(ret1.value.origin.detail).toBe("create a block with CA3 failed:unknown reason");
        })

        test("Failure2", async () => {
            const ret1 = await core.lib.createBlock(core, data, "GeneralErrorSample");
            if (ret1.isSuccess()) { throw new Error("FAIL") };
            expect(ret1.type).toBe("failure");
            expect(ret1.value.origin.detail).not.toBe("create a block with CA3 failed:unknown reason");
        })

        test("Success2", async () => {
            const ret1 = await core.lib.createBlock(core, data, "AlreadyStartSample");
            if (ret1.isFailure()) { throw new Error("FAIL") };
            expect(ret1.type).toBe("success");
            expect(ret1.value).toBe(undefined);
        })
    })

    describe("Method verifyBlock() with CA3", () => {
        beforeAll(async () => {
            const lib = new BlockModule();
            let ret5: gResult<ccBlockType, gError>
            ret5 = await lib.init(confMock3, new logMock(), s, i, k, m, c, "../../dist/__mocks__/mock_ca3.js");
            if (ret5.isFailure()) {
                ret5 = await lib.init(confMock3, new logMock(), s, i, k, m, c, "../../../../dist/enterprise/src/__mocks__/mock_ca3.js");
            }
            if (ret5.isSuccess()) {
                core = ret5.value;
            } else {
                throw new Error("beforeAll failed");
            }
        })
        
        test("succeed in verifying", async () => {
            const ret1 = await core.lib.createBlock(core, data, default_tenant_id);
            let bObj: blockFormat | undefined = undefined;
            if (ret1.isSuccess()) bObj = ret1.value;
            expect(bObj).toBeDefined();
            if (bObj !== undefined) {
                const ret2 = await core.lib.verifyBlock(core, bObj);
                let res = -3;
                if (ret2.isSuccess()) res = ret2.value;
                expect(bObj.hash.length).toBe(64);
                expect(res).toBe(0);
            } else {
                throw new Error("FAIL");
            }
        })
        test("succeed in detecting illegal block", async () => {
            const wrongBlock: any = {}
            const ret = await core.lib.verifyBlock(core, wrongBlock, "illegalBlockSample");
            let res = -3;
            if (ret.isSuccess()) res = ret.value;
            expect(res).toBe(-1);
        })
        test("succeed in detecting falsificated block", async () => {
            const ret1 = await core.lib.createBlock(core, data, default_tenant_id);
            let bObj: blockFormat | undefined = undefined;
            if (ret1.isSuccess()) bObj = ret1.value;
            expect(bObj).toBeDefined();
            if (bObj !== undefined) {
                bObj.hash = "wrong";
                const ret2 = await core.lib.verifyBlock(core, bObj, "verifyErrorSample3");
                let res = -3;
                if (ret2.isSuccess()) res = ret2.value;
                expect(res).toBe(3);
            } else {
                throw new Error("FAIL");
            }
        })
    })
})