/**
 * Copyright (c) 2024 Ryoji Kamei
 * Released under the MIT license
 * https://opensource.org/licenses/mit-license.php
 */

import { jest } from "@jest/globals";
import express from "express";
import request from "supertest";

import { ListnerV3UserApi } from "../user";

import { ApiModuleMock } from "../../../__mocks__/mock_api";
import { ccApiType } from "../..";
import { SystemModuleMock } from "../../../__mocks__/mock_system";
import { MainModuleMock } from "../../../__mocks__/mock_main";
import { ccSystemType } from "../../../system";
import { ccMainType } from "../../../main";

describe("Test of ListerV3UserApi", () => {

    let alib: ApiModuleMock;
    let acore: ccApiType;
    let lib: ListnerV3UserApi;
    let score: ccSystemType;
    let mcore: ccMainType;
    let api: express.Express;
    beforeAll(async () => {
        alib = new ApiModuleMock();
        const ret1 = await alib.init();
        if (ret1.isSuccess()) acore = ret1.value;
        lib = new ListnerV3UserApi();
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
            expect(acore.log.msg.last_status).toBe(0);
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

    describe("API /get/byjson", () => {
        test("Success in getting", async () => {
            acore.m = mcore;
            const body = { type : "new" }
            const res = await request(api).get("/get/byjson").send(body).auth(acore.conf.rest.userapi_user, acore.conf.rest.userapi_password);
            expect(res.status).toBe(200);
            expect(res.body).toBeDefined();
        })
        test("Success in getting nothing", async () => {
            acore.m = mcore;
            const body = { key: "notFoundSample", value: "" }
            const res = await request(api).get("/get/byjson").send(body).auth(acore.conf.rest.userapi_user, acore.conf.rest.userapi_password);
            expect(res.status).toBe(200);
            expect(res.body).toEqual([]);
        })
        test("Failed to get", async () => {
            acore.m = undefined;
            const body = { type : "new" }
            const res = await request(api).get("/get/byjson").send(body).auth(acore.conf.rest.userapi_user, acore.conf.rest.userapi_password);
            expect(res.status).toBe(503);
            expect(res.body).toBeDefined();
        })
    })


    describe("API /get/byoid", () => {
        test("Success in getting", async () => {
            acore.m = mcore;
            const body = { type : "new" }
            const res = await request(api).get("/get/byoid/303148434b3354394d364b37").auth(acore.conf.rest.userapi_user, acore.conf.rest.userapi_password);
            expect(res.status).toBe(200);
            expect(res.body).toBeDefined();
        })
        test("Success in getting nothing", async () => {
            acore.m = mcore;
            const body = { notFoundSample : "" }
            const res = await request(api).get("/get/byoid/notFoundSample0000000000").auth(acore.conf.rest.userapi_user, acore.conf.rest.userapi_password);
            expect(res.status).toBe(200);
            expect(res.body).toEqual([]);
        })
        test("Failed to get", async () => {
            acore.m = undefined;
            const body = { type : "new" }
            const res = await request(api).get("/get/byoid/303148434b3354394d364b37").auth(acore.conf.rest.userapi_user, acore.conf.rest.userapi_password);
            expect(res.status).toBe(503);
            expect(res.body).toBeDefined();
        })
    })

    describe("API /get/alltxs", () => {
        test("Success in getting", async () => {
            acore.m = mcore;
            const res = await request(api).get("/get/alltxs").auth(acore.conf.rest.userapi_user, acore.conf.rest.userapi_password);
            expect(res.status).toBe(200);
            expect(res.body).toBeDefined();
        })
        test("Failed to get", async () => {
            acore.m = undefined;
            const res = await request(api).get("/get/alltxs").auth(acore.conf.rest.userapi_user, acore.conf.rest.userapi_password);
            expect(res.status).toBe(503);
            expect(res.body).toBeDefined();
        })
    })

    describe("API /get/blocked", () => {
        test("Success in getting", async () => {
            acore.m = mcore;
            const res = await request(api).get("/get/blocked").auth(acore.conf.rest.userapi_user, acore.conf.rest.userapi_password);
            expect(res.status).toBe(200);
            expect(res.body).toBeDefined();
        })
        test("Failed to get", async () => {
            acore.m = undefined;
            const res = await request(api).get("/get/blocked").auth(acore.conf.rest.userapi_user, acore.conf.rest.userapi_password);
            expect(res.status).toBe(503);
            expect(res.body).toBeDefined();
        })
    })

    describe("API /get/pooling", () => {
        test("Success in getting", async () => {
            acore.m = mcore;
            const res = await request(api).get("/get/pooling").auth(acore.conf.rest.userapi_user, acore.conf.rest.userapi_password);
            expect(res.status).toBe(200);
            expect(res.body).toBeDefined();
        })
        test("Failed to get", async () => {
            acore.m = undefined;
            const res = await request(api).get("/get/pooling").auth(acore.conf.rest.userapi_user, acore.conf.rest.userapi_password);
            expect(res.status).toBe(503);
            expect(res.body).toBeDefined();
        })
    })

    describe("API /get/history", () => {
        test("Success in getting", async () => {
            acore.m = mcore;
            const res = await request(api).get("/get/history/303148434b3354394d364b37").auth(acore.conf.rest.userapi_user, acore.conf.rest.userapi_password);
            expect(res.status).toBe(200);
            expect(res.body).toBeDefined();
        })
        test("Success in getting nothing", async () => {
            acore.m = mcore;
            const res = await request(api).get("/get/history/notFoundSample0000000000").auth(acore.conf.rest.userapi_user, acore.conf.rest.userapi_password);
            expect(res.status).toBe(200);
            expect(res.body).toBeDefined();
        })
        test("Failed to get", async () => {
            acore.m = undefined;
            const res = await request(api).get("/get/history/303148434b3354394d364b37").auth(acore.conf.rest.userapi_user, acore.conf.rest.userapi_password);
            expect(res.status).toBe(503);
            expect(res.body).toBeDefined();
        })
    })

    describe("API /post/byjson", () => {
        test("Success in posting", async () => {
            acore.m = mcore;
            const body = { type : "new" }
            const res = await request(api).post("/post/byjson").send(body).auth(acore.conf.rest.userapi_user, acore.conf.rest.userapi_password);
            expect(res.status).toBe(200);
            expect(res.body).toBeDefined();
        })
        test("Failed to post", async () => {
            acore.m = undefined;
            const body = { type : "new" }
            const res = await request(api).post("/post/byjson").send(body).auth(acore.conf.rest.userapi_user, acore.conf.rest.userapi_password);
            expect(res.status).toBe(503);
            expect(res.body).toBeDefined();
        })
    })
})