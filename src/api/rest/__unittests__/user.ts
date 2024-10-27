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
import { KeyringModuleMock } from "../../../__mocks__/mock_keyring";
import { ccSystemType } from "../../../system";
import { ccMainType } from "../../../main";
import { ccKeyringType } from "../../../keyring";

describe("Test of ListerV3UserApi", () => {

    let alib: ApiModuleMock;
    let acore: ccApiType;
    let lib: ListnerV3UserApi;
    let score: ccSystemType;
    let mcore: ccMainType;
    let kcore: ccKeyringType;
    let api: express.Express;
    let authHeader: any;
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
        const klib = new KeyringModuleMock();
        const ret4 = await klib.init();
        if (ret4.isSuccess()) kcore = ret4.value;
        const ret5 = await lib.init(acore)
        if (ret5.isSuccess()) api = ret5.value;

        acore.k = kcore;
        const data = JSON.stringify({ user: acore.conf.rest.userapi_user, password: acore.conf.rest.userapi_password});
        const res = await request(api).post("/post/login").set("Content-Type", "application/JSON").send(data);
        authHeader = { "Authorization" : "Bearer " + res.body }
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

    describe("API /get/byjson", () => {
        test("Success in getting", async () => {
            acore.m = mcore;
            const body = { key: "type", value: "new" }
            const res = await request(api).get("/get/byjson").set(authHeader).send(body);
            expect(res.status).toBe(200);
            expect(res.body).toBeDefined();
        })
        test("Success in getting nothing", async () => {
            acore.m = mcore;
            const body = { key: "notFoundSample", value: "" }
            const res = await request(api).get("/get/byjson").set(authHeader).send(body);
            expect(res.status).toBe(200);
            expect(res.body).toEqual([]);
        })
        test("Failed to get", async () => {
            acore.m = undefined;
            const body = { key: "type", value: "new" }
            const res = await request(api).get("/get/byjson").set(authHeader).send(body);
            expect(res.status).toBe(503);
            expect(res.body).toBeDefined();
        })
    })


    describe("API /get/byoid", () => {
        test("Success in getting", async () => {
            acore.m = mcore;
            const body = { type : "new" }
            const res = await request(api).get("/get/byoid/303148434b3354394d364b37").set(authHeader);
            expect(res.status).toBe(200);
            expect(res.body).toBeDefined();
        })
        test("Success in getting nothing", async () => {
            acore.m = mcore;
            const body = { notFoundSample : "" }
            const res = await request(api).get("/get/byoid/notFoundSample0000000000").set(authHeader);
            expect(res.status).toBe(200);
            expect(res.body).toEqual([]);
        })
        test("Failed to get", async () => {
            acore.m = undefined;
            const body = { type : "new" }
            const res = await request(api).get("/get/byoid/303148434b3354394d364b37").set(authHeader);
            expect(res.status).toBe(503);
            expect(res.body).toBeDefined();
        })
    })

    describe("API /get/alltxs", () => {
        test("Success in getting", async () => {
            acore.m = mcore;
            const res = await request(api).get("/get/alltxs").set(authHeader);
            expect(res.status).toBe(200);
            expect(res.body).toBeDefined();
        })
        test("Failed to get", async () => {
            acore.m = undefined;
            const res = await request(api).get("/get/alltxs").set(authHeader);
            expect(res.status).toBe(503);
            expect(res.body).toBeDefined();
        })
    })

    describe("API /get/blocked", () => {
        test("Success in getting", async () => {
            acore.m = mcore;
            const res = await request(api).get("/get/blocked").set(authHeader);
            expect(res.status).toBe(200);
            expect(res.body).toBeDefined();
        })
        test("Failed to get", async () => {
            acore.m = undefined;
            const res = await request(api).get("/get/blocked").set(authHeader);
            expect(res.status).toBe(503);
            expect(res.body).toBeDefined();
        })
    })

    describe("API /get/pooling", () => {
        test("Success in getting", async () => {
            acore.m = mcore;
            const res = await request(api).get("/get/pooling").set(authHeader);
            expect(res.status).toBe(200);
            expect(res.body).toBeDefined();
        })
        test("Failed to get", async () => {
            acore.m = undefined;
            const res = await request(api).get("/get/pooling").set(authHeader);
            expect(res.status).toBe(503);
            expect(res.body).toBeDefined();
        })
    })

    describe("API /get/lastblock", () => {
        test("Success in getting", async () => {
            acore.m = mcore;
            const res = await request(api).get("/get/lastblock").set(authHeader);
            expect(res.status).toBe(200);
            expect(res.body).toBeDefined();
        })
        test("Failed to get", async () => {
            acore.m = undefined;
            const res = await request(api).get("/get/lastblock").set(authHeader);
            expect(res.status).toBe(503);
            expect(res.body).toBeDefined();
        })
    })

    describe("API /get/poolingdelivered", () => {
        test("Success in getting", async () => {
            acore.m = mcore;
            const res = await request(api).get("/get/poolingdelivered").set(authHeader);
            expect(res.status).toBe(200);
            expect(res.body).toBeDefined();
        })
        test("Failed to get", async () => {
            acore.m = undefined;
            const res = await request(api).get("/get/poolingdelivered").set(authHeader);
            expect(res.status).toBe(503);
            expect(res.body).toBeDefined();
        })
    })

    describe("API /get/totalnumber", () => {
        test("Success in getting", async () => {
            acore.m = mcore;
            const res = await request(api).get("/get/totalnumber").set(authHeader);
            expect(res.status).toBe(200);
            expect(res.body).toBeDefined();
        })
        test("Failed to get", async () => {
            acore.m = undefined;
            const res = await request(api).get("/get/totalnumber").set(authHeader);
            expect(res.status).toBe(503);
            expect(res.body).toBeDefined();
        })
    })

    describe("API /get/history", () => {
        test("Success in getting", async () => {
            acore.m = mcore;
            const res = await request(api).get("/get/history/303148434b3354394d364b37").set(authHeader);
            expect(res.status).toBe(200);
            expect(res.body).toBeDefined();
        })
        test("Success in getting nothing", async () => {
            acore.m = mcore;
            const res = await request(api).get("/get/history/notFoundSample0000000000").set(authHeader);
            expect(res.status).toBe(200);
            expect(res.body).toBeDefined();
        })
        test("Failed to get", async () => {
            acore.m = undefined;
            const res = await request(api).get("/get/history/303148434b3354394d364b37").set(authHeader);
            expect(res.status).toBe(503);
            expect(res.body).toBeDefined();
        })
    })

    describe("API /post/byjson", () => {
        test("Success in posting", async () => {
            acore.m = mcore;
            const body = { type : "new" }
            const res = await request(api).post("/post/byjson").set(authHeader).send(body);
            expect(res.status).toBe(200);
            expect(res.body).toBeDefined();
        })
        test("Failed to post", async () => {
            acore.m = undefined;
            const body = { type : "new" }
            const res = await request(api).post("/post/byjson").set(authHeader).send(body);
            expect(res.status).toBe(503);
            expect(res.body).toBeDefined();
        })
    })
})