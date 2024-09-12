/**
 * Copyright (c) 2024 Ryoji Kamei
 * Released under the MIT license
 * https://opensource.org/licenses/mit-license.php
 */

import { ApiModule, ccApiType } from "..";
import { apiConfigType } from "../../config";
import { logMock } from "../../__mocks__/mock_logger";
import { gFailure, gSuccess } from "../../utils";

class ListnerV3UserApiMock {
    public init() { return new gSuccess("OK") }
    public listen() { return new gSuccess("OK") }
}
class ListnerV3UserApiWrongMock {
    public init() { return new gSuccess("OK") }
    public listen() { throw new Error("ListnerV3UserApiWrongMock"); }
}

class ListnerV3AdminApiMock {
    public init() { return new gSuccess("OK") }
    public listen() { return new gSuccess("OK") }
}
class ListnerV3AdminApiWrongMock {
    public init() { return new gSuccess("OK") }
    public listen() { throw new Error("ListnerV3AdminApiWrongMock"); }
}

const confMock: apiConfigType = {
    rest: {
        password_encryption: false,
        userapi_port: 9000,
        adminapi_port: 8000,
        userapi_user: "userapi",
        userapi_password: "userapi@password",
        adminapi_user: "adminapi",
        adminapi_password: "adminapi@password",
        use_tls: false
    }
}


let alib: ApiModule;
let a: ccApiType;
describe("Test of ApiModule", () => {
    beforeAll(() => {
        // inject mock
        alib = new ApiModule(new ListnerV3UserApiMock(), new ListnerV3AdminApiMock());
        const ret = alib.init(confMock, new logMock(), new ListnerV3UserApiMock(), new ListnerV3AdminApiMock());
        if (ret.isSuccess()) a = ret.value;
    });
    afterAll(() => {});

    describe("Method init()", () => {
        test("Succeed", () => {
            const ret = alib.init(confMock, new logMock(), new ListnerV3UserApiMock(), new ListnerV3AdminApiMock());
            expect(ret.type).toBe("success");
        })
    })

    describe("Method activateApi()", () => {
        test("Succeed", async () => {
            const ret = await alib.activateApi(a, new logMock());
            expect(ret.type).toBe("success");
        });
        test("Failed 1", async () => {
            const lib = new ApiModule(new ListnerV3UserApiWrongMock(), new ListnerV3AdminApiMock());
            const ret1 = lib.init(confMock, new logMock(), new ListnerV3UserApiWrongMock(), new ListnerV3AdminApiMock());
            if (ret1.isFailure()) return -1; // unknown error
            const ret2 = await ret1.value.lib.activateApi(ret1.value, new logMock());
            expect(ret2.type).toBe("failure");
        });
        test("Failed 2", async () => {
            const lib = new ApiModule(new ListnerV3UserApiMock(), new ListnerV3AdminApiWrongMock());
            const ret1 = lib.init(confMock, new logMock(), new ListnerV3UserApiMock(), new ListnerV3AdminApiWrongMock());
            if (ret1.isFailure()) return -1; // unknown error
            const ret2 = await ret1.value.lib.activateApi(ret1.value, new logMock());
            expect(ret2.type).toBe("failure");
        });
    })


})