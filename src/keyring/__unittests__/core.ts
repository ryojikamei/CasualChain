/**
 * Copyright (c) 2024 Ryoji Kamei
 * Released under the MIT license
 * https://opensource.org/licenses/mit-license.php
 */

import { randomUUID, createHash } from "crypto";
import clone from "clone";

import { gFailure, gError, gSuccess } from "../../utils";

import { randomOid } from "../../utils";
import { Ca3BlockFormat } from "../../block/algorithm/ca3";
import { KeyringModule, ccKeyringType } from ".."
import { keyringConfigType } from "../../config";
import { logMock } from "../../__mocks__/mock_logger";
import { SystemModuleMock } from "../../__mocks__/mock_system";
import { MainModuleMock } from "../../__mocks__/mock_main";
import { InModuleMock } from "../../__mocks__/mock_in";

const default_tenant_id = randomUUID();

const confMock: keyringConfigType = {
    create_keys_if_no_sign_key_exists: true,
    sign_key_file: "demo_node1.key",
    verify_key_file: "demo_node1.pub",
    tls_crt_file: "demo_node1.crt",
    tls_csr_file: "demo_node1.csr",
    tls_ca_key_file: "example_ca.key",
    tls_ca_crt_file: "example_ca.crt",
    default_tenant_id: default_tenant_id
}

describe("Test of KeyringModule", () => {
    let core: ccKeyringType;
    let mcore: any = undefined;
    let score: any = undefined;
    let icore: any = undefined;
    let kcore: any;
    let block0_0: Ca3BlockFormat;
    let signature: string = "";

    beforeAll(async () => {
        const ret0 = await(new KeyringModule().init(confMock, new logMock()));
        if (ret0.isSuccess()) { kcore = ret0.value }

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
        if (ret1.isSuccess()) {
            block0_0.signcounter--;
            block0_0.signedby["node1"] =  ret1.value;
            signature = ret1.value;
        }

        const lib = new KeyringModule();
        const ret2 = new SystemModuleMock().init();
        if (ret2.isSuccess()) score = ret2.value;
        const ret3 = await (new MainModuleMock().init());
        if (ret3.isSuccess()) mcore = ret3.value;
        const ret4 = await (new InModuleMock().init());
        if (ret4.isSuccess()) icore = ret4.value; 
        const ret5 = await lib.init(confMock, new logMock());
        if (ret5.isSuccess()) {
            core = ret5.value;
        } else {
            throw new Error("beforeAll failed");
        }
    })

    describe("Method postSelfPublicKeys", () => {
        test("Succeed in posting", async () => {
            core.m = mcore;
            core.s = score;
            core.i = icore;
            const ret1 = await core.lib.postSelfPublicKeys(core);
            expect(ret1.type).toBe("success");
        });
        test("Failed to post due to down of main module", async () => {
            core.m = undefined;
            core.s = score;
            core.i = icore;
            const ret1 = await core.lib.postSelfPublicKeys(core);
            expect(ret1.type).toBe("failure");
        });
        test("Failed to post due to down of system module", async () => {
            core.m = mcore;
            core.s = undefined;
            core.i = icore;
            const ret1 = await core.lib.postSelfPublicKeys(core);
            expect(ret1.type).toBe("failure");
        });
        test("Failed to post due to down of internode module", async () => {
            core.m = mcore;
            core.s = score;
            core.i = undefined;
            const ret1 = await core.lib.postSelfPublicKeys(core);
            expect(ret1.type).toBe("failure");
        });
        test("Failure4", async () => {
            core.m = mcore;
            core.s = score;
            core.i = icore;
            let coreWrong = clone(core);
            coreWrong.cache[0].nodename = "wrong";
            const ret1 = await core.lib.postSelfPublicKeys(coreWrong);
            expect(ret1.type).toBe("failure");
        });
        test("Failure5", async () => {
            let mcoreWrong: any;
            const ret3 = await (new MainModuleMock().init());
            if (ret3.isSuccess()) mcoreWrong = ret3.value;
            mcoreWrong.lib.getSearchByJson = async () => {
                return new gFailure(new gError("main", "getSearchByJson", "", ""));
            };
            core.m = mcoreWrong;
            core.s = score;
            core.i = icore;
            const ret1 = await core.lib.postSelfPublicKeys(core);
            expect(ret1.type).toBe("failure");
        });
        test("Success2", async () => {
            let mcoreMock: any;
            const ret3 = await (new MainModuleMock().init());
            if (ret3.isSuccess()) mcoreMock = ret3.value;
            const data1 = { data: { nodename: core.cache[0].nodename }};
            mcoreMock.lib.getSearchByJson = async () => {
                return new gSuccess([data1]);
            };
            core.m = mcoreMock;
            core.s = score;
            core.i = icore;
            const ret1 = await core.lib.postSelfPublicKeys(core);
            expect(ret1.type).toBe("success");
        });
        test("Failure6", async () => {
            let mcoreWrong: any;
            const ret3 = await (new MainModuleMock().init());
            if (ret3.isSuccess()) mcoreWrong = ret3.value;
            mcoreWrong.lib.postByJson = async () => {
                return new gFailure(new gError("main", "postByJson", "", ""));
            };
            core.m = mcoreWrong;
            core.s = score;
            core.i = icore;
            const ret1 = await core.lib.postSelfPublicKeys(core);
            expect(ret1.type).toBe("failure");
        });
        test("Failure7", async () => {
            let scoreWrong: any;
            const ret2 = new SystemModuleMock().init();
            if (ret2.isSuccess()) scoreWrong = ret2.value;
            scoreWrong.lib.postDeliveryPool = async () => {
                return new gFailure(new gError("system", "postDeliveryPool", "", ""));
            };
            core.m = mcore;
            core.s = scoreWrong;
            core.i = icore;
            const ret1 = await core.lib.postSelfPublicKeys(core);
            expect(ret1.type).toBe("failure");
        });
    });

    describe("Method refreshPublicKeyCache", () => {
        test("Succeed in refreshing", async () => {
            core.m = mcore;
            core.s = score;
            core.i = icore;
            const ret1 = await core.lib.refreshPublicKeyCache(core);
            expect(ret1.type).toBe("success");
        });
        test("Failed to refresh due to down of main module", async () => {
            core.m = undefined;
            const ret1 = await core.lib.refreshPublicKeyCache(core);
            expect(ret1.type).toBe("failure");
        });
        test("Failure2", async () => {
            let mcoreWrong: any;
            const ret3 = await (new MainModuleMock().init());
            if (ret3.isSuccess()) mcoreWrong = ret3.value;
            mcoreWrong.lib.getSearchByJson = async () => {
                return new gFailure(new gError("main", "getSearchByJson", "", ""));
            };
            core.m = mcoreWrong;
            core.s = score;
            core.i = icore;
            const ret1 = await core.lib.refreshPublicKeyCache(core);
            expect(ret1.type).toBe("failure");
        });
        test("Failure3", async () => {
            let mcoreWrong: any;
            const ret3 = await (new MainModuleMock().init());
            if (ret3.isSuccess()) mcoreWrong = ret3.value;
            mcoreWrong.lib.getSearchByJson = async () => {
                return new gSuccess([]);
            };
            core.m = mcoreWrong;
            core.s = score;
            core.i = icore;
            const ret1 = await core.lib.refreshPublicKeyCache(core);
            expect(ret1.type).toBe("failure");
        });
    });

    describe("Method signByPrivateKey", () => {
        test("Succeed in signing", async () => {
            const ret1 = await core.lib.signByPrivateKey(core, block0_0, "unknown");
            expect(ret1.type).toBe("success");
        });
        test("Failure1", async () => {
            let coreWrong = clone(core);
            coreWrong.cache[0].sign_key_hex = undefined;
            const ret1 = await core.lib.signByPrivateKey(coreWrong, block0_0, "unknown");
            expect(ret1.type).toBe("failure");
        });
        test("Failure2", async () => {
            const lib = new KeyringModule();
            const ret5 = await lib.init(confMock, new logMock());
            if (ret5.isFailure()) throw new Error("FAIL");
            let coreWrong = ret5.value;
            coreWrong.cache[0].sign_key_hex = "wrong";
            const ret1 = await core.lib.signByPrivateKey(coreWrong, block0_0, "unknown");
            expect(ret1.type).toBe("failure");
        });
    });

    describe("Method verifyByPublicKey", () => {
        let clonedB: Ca3BlockFormat
        let coreWrong: ccKeyringType
        beforeAll(async () => {
            clonedB = clone(block0_0);
            clonedB.signcounter++;
            delete clonedB.signedby["node1"];

            const lib = new KeyringModule();
            const ret5 = await lib.init(confMock, new logMock());
            if (ret5.isFailure()) throw new Error("FAIL");
            coreWrong = ret5.value;
        });
        test("Failure1", async () => { // not in bc, not in cache
            coreWrong.cache = [];
            const ret1 = await core.lib.verifyByPublicKey(coreWrong, signature, clonedB, "self");
            expect(ret1.type).toBe("failure");
        });
        test("Failure2", async () => {
            coreWrong.lib.refreshPublicKeyCache = async () => {
                return new gFailure(new gError("keyring", "refreshPublicKeyCache", "", ""));
            }
            coreWrong.cache = [];
            const ret1 = await core.lib.verifyByPublicKey(coreWrong, signature, clonedB, "self");
            expect(ret1.type).toBe("failure");
        });
        test("Succeed in verifing", async () => {
            core.m = mcore;
            core.s = score;
            core.i = icore;
            await core.lib.postSelfPublicKeys(core);
            const ret1 = await core.lib.verifyByPublicKey(core, signature, clonedB, "self");
            expect(ret1.type).toBe("success");
            expect(ret1.value).toBe(true)
        });
        test("Success2", async () => {
            let clonedB2 = clone(clonedB);
            clonedB2.data = [];
            core.m = mcore;
            core.s = score;
            core.i = icore;
            await core.lib.postSelfPublicKeys(core);
            const ret1 = await core.lib.verifyByPublicKey(core, signature, clonedB2, "self");
            expect(ret1.type).toBe("success");
            expect(ret1.value).toBe(false)
        });
        test("Failure3", async () => {
            core.m = mcore;
            core.s = score;
            core.i = icore;
            await core.lib.postSelfPublicKeys(core);
            const ret1 = await core.lib.verifyByPublicKey(core, "fake", clonedB, "self");
            expect(ret1.type).toBe("failure");
        });
    });
});