/**
 * Copyright (c) 2024 Ryoji Kamei
 * Released under the MIT license
 * https://opensource.org/licenses/mit-license.php
 */

import { jest } from "@jest/globals";
import express from "express";
import request from "supertest";

import { ListnerV3AdminApi } from "../admin";

import { ApiModuleMock } from "../../../__mocks__/mock_api";
import { ccApiType } from "../..";
import { SystemModuleMock } from "../../../__mocks__/mock_system";
import { MainModuleMock } from "../../../__mocks__/mock_main";
import { ccSystemType } from "../../../system";
import { ccMainType } from "../../../main";

describe("Test of ListerV3AdminApi", () => {

    let alib: ApiModuleMock;
    let acore: ccApiType;
    let lib: ListnerV3AdminApi;
    let score: ccSystemType;
    let mcore: ccMainType;
    let api: express.Express;
    beforeAll(async () => {
        alib = new ApiModuleMock();
        const ret1 = await alib.init();
        if (ret1.isSuccess()) acore = ret1.value;
        lib = new ListnerV3AdminApi();
        const slib = new SystemModuleMock();
        const ret2 = slib.init();
        if (ret2.isSuccess()) score = ret2.value;
        const mlib = new MainModuleMock();
        const ret3 = await mlib.init();
        if (ret3.isSuccess()) mcore = ret3.value;
        const ret4 = await lib.init(acore)
        if (ret4.isSuccess()) api = ret4.value;
    })

    describe("Method init()", () => {
        test("Success in initialization", async () => {
            acore.s = score;
            const ret = await lib.init(acore)
            expect(ret.type).toBe("success");
        })
    })

    describe("Method listen()", () => {
        test("Success in listening", async () => {
            const listenMock = jest.spyOn(lib, "listen")
            listenMock.mockImplementation(async () => {})
            await lib.listen(acore, api);
            expect(listenMock).toHaveBeenCalled();
        })
    })

    describe("Method shutdown()", () => {
        test("Success", async () => {
            const ret = await lib.shutdown(acore);
            expect(ret.type).toBe("success");
        })
    })

    describe("API /sys/deliverpooling", () => {
        test("Success in posting", async () => {
            acore.s = score;
            const res = await request(api).post("/sys/deliverpooling").auth(acore.conf.rest.adminapi_user, acore.conf.rest.adminapi_password);
            expect(res.status).toBe(200);
            expect(res.body).toBeDefined();
        })
        test("Failed to post", async () => {
            acore.s = undefined;
            const res = await request(api).post("/sys/deliverpooling").auth(acore.conf.rest.adminapi_user, acore.conf.rest.adminapi_password);
            expect(res.status).toBe(503);
            expect(res.body).toBeDefined();
        })
    })

    describe("API /sys/blocking", () => {
        test("Success in posting", async () => {
            acore.s = score;
            const res = await request(api).post("/sys/blocking").auth(acore.conf.rest.adminapi_user, acore.conf.rest.adminapi_password);
            expect(res.status).toBe(200);
            expect(res.body).toBeDefined();
        })
        test("Failed to post", async () => {
            acore.s = undefined;
            const res = await request(api).post("/sys/blocking").auth(acore.conf.rest.adminapi_user, acore.conf.rest.adminapi_password);
            expect(res.status).toBe(503);
            expect(res.body).toBeDefined();
        })
    })

    describe("API /sys/initbc", () => {
        test("Success in posting", async () => {
            acore.s = score;
            const res = await request(api).post("/sys/initbc").auth(acore.conf.rest.adminapi_user, acore.conf.rest.adminapi_password);
            expect(res.status).toBe(200);
            expect(res.body).toBeDefined();
        })
        test("Failed to post", async () => {
            acore.s = undefined;
            const res = await request(api).post("/sys/initbc").auth(acore.conf.rest.adminapi_user, acore.conf.rest.adminapi_password);
            expect(res.status).toBe(503);
            expect(res.body).toBeDefined();
        })
    })

    describe("API /sys/syncblocked", () => {
        test("Success in posting", async () => {
            acore.s = score;
            const res = await request(api).post("/sys/syncblocked").auth(acore.conf.rest.adminapi_user, acore.conf.rest.adminapi_password);
            expect(res.status).toBe(200);
            expect(res.body).toBeDefined();
        })
        test("Failed to post", async () => {
            acore.s = undefined;
            const res = await request(api).post("/sys/syncblocked").auth(acore.conf.rest.adminapi_user, acore.conf.rest.adminapi_password);
            expect(res.status).toBe(503);
            expect(res.body).toBeDefined();
        })
    })

    describe("API /sys/syncpooling", () => {
        test("Success in posting", async () => {
            acore.s = score;
            const res = await request(api).post("/sys/syncpooling").auth(acore.conf.rest.adminapi_user, acore.conf.rest.adminapi_password);
            expect(res.status).toBe(200);
            expect(res.body).toBeDefined();
        })
        test("Failed to post", async () => {
            acore.s = undefined;
            const res = await request(api).post("/sys/syncpooling").auth(acore.conf.rest.adminapi_user, acore.conf.rest.adminapi_password);
            expect(res.status).toBe(503);
            expect(res.body).toBeDefined();
        })
    })

    describe("API /sys/opentenant", () => {
        test("Success in posting", async () => {
            acore.s = score;
            const data: string = '{ "adminId": "8e921d59-00b4-48c2-9ed2-b9f2a90030d6", "recallPhrase": "unittest" }' 
            const res = await request(api).post("/sys/opentenant").set("Content-Type", "application/JSON").send(data).auth(acore.conf.rest.adminapi_user, acore.conf.rest.adminapi_password);
            expect(res.status).toBe(200);
            expect(res.body).toBeDefined();
        })
        test("Failed to post", async () => {
            acore.s = score;
            const res = await request(api).post("/sys/opentenant").auth(acore.conf.rest.adminapi_user, acore.conf.rest.adminapi_password);
            expect(res.status).toBe(503);
            expect(res.body).toBeDefined();
        })
    })

    describe("API /sys/closetenant", () => {
        test("Success in posting", async () => {
            acore.s = score;
            const data: string = '{ "adminId": "8e921d59-00b4-48c2-9ed2-b9f2a90030d6", "tenantId": "fake" }'
            const res = await request(api).post("/sys/closetenant").set("Content-Type", "application/JSON").send(data).auth(acore.conf.rest.adminapi_user, acore.conf.rest.adminapi_password);
            expect(res.status).toBe(200);
            expect(res.body).toBeDefined();
        })
        test("Failed to post", async () => {
            acore.s = score;
            const res = await request(api).post("/sys/closetenant").auth(acore.conf.rest.adminapi_user, acore.conf.rest.adminapi_password);
            expect(res.status).toBe(503);
            expect(res.body).toBeDefined();
        })
    })
    
    describe("API /sys/synccache", () => {
        test("Success in posting", async () => {
            acore.s = score;
            const res = await request(api).post("/sys/synccache").auth(acore.conf.rest.adminapi_user, acore.conf.rest.adminapi_password);
            expect(res.status).toBe(200);
            expect(res.body).toBeDefined();
        })
        test("Failed to post", async () => {
            acore.s = undefined;
            const res = await request(api).post("/sys/synccache").auth(acore.conf.rest.adminapi_user, acore.conf.rest.adminapi_password);
            expect(res.status).toBe(503);
            expect(res.body).toBeDefined();
        })
        test("Failed to authorize", async () => {
            acore.s = undefined;
            const res = await request(api).post("/sys/synccache");
            expect(res.status).toBe(401);
            expect(res.body).toBeDefined();
        })
    })

    describe("API /unknown", () => {
        test("Failed to get", async () => {
            acore.s = score;
            const res = await request(api).get("/unknown").auth(acore.conf.rest.adminapi_user, acore.conf.rest.adminapi_password);
            expect(res.status).toBe(404);
            expect(res.body).toBeDefined();
        })
        test("Failed to post", async () => {
            acore.s = score;
            const res = await request(api).post("/unknown").auth(acore.conf.rest.adminapi_user, acore.conf.rest.adminapi_password);
            expect(res.status).toBe(404);
            expect(res.body).toBeDefined();
        })
    })
})