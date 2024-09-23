/**
 * Copyright (c) 2024 Ryoji Kamei
 * Released under the MIT license
 * https://opensource.org/licenses/mit-license.php
 */

import { jest } from "@jest/globals"

import { gResult, gSuccess, gFailure, gError } from "../../utils";

function lOK<T>(response: T): gResult<T, never> {
    return new gSuccess(response)
}
function lError(func: string, pos?: string, message?: string): gResult<never, gError> {
    return new gFailure(new gError("logger", func, pos, message));
}
import { ccLogType, logOptions } from "../index.js";
import { logConfigType } from "../../config/index.js";
import { winston_mock } from "../../__mocks__/mock_winston";

import { LogModule } from "../core";

const confMock: logConfigType = {
    console_level: 7,
    console_output: true,
    console_color: "None",
    console_color_code: "",
    file_level: 7,
    file_output: true,
    file_level_text: "",
    file_path: "/tmp/test.log",
    file_rotation: true
}

let llib: LogModule;
describe("Test of LogModule()", () => {
    beforeAll(() => {
        llib = new LogModule();
    });
    afterAll(() => {
        jest.clearAllMocks();
    });

    describe("Method init()", () => {
        test("Failed initialization", () => {
            expect(() => {
                llib.init(confMock, winston_mock("errorSample"));
            }).toThrow(Error)
        });
        test("Success initialization", () => {
            const ret = llib.init(confMock,  winston_mock());
            expect(ret.type).toBe("success");
        });

    });

    let l: ccLogType;
    describe("Method LogFunc()", () => {
        beforeAll(() => {
            const ret = llib.init(confMock,  winston_mock());
            if (ret.isSuccess()) l = ret.value;
        });
        test("Success1", () => {
            const LOG = l.lib.LogFunc(l);
            LOG("Error", 3, "", { lf: false });
            LOG("Error", 3, "Test1");
            expect(l.msg.last_status).toBe(3);
        });
        test("Success2", () => {
            const LOG = l.lib.LogFunc(l);
            LOG("Warning", 4, "", { lf: false });
            LOG("Warning", 4, "Test2");
            expect(l.msg.last_status).toBe(4);
        });
        test("Success3", () => {
            const LOG = l.lib.LogFunc(l);
            LOG("Notice", 5, "", { lf: false });
            LOG("Notice", 5, "Test3");
            expect(l.msg.last_status).toBe(5);
        });
        test("Success4", () => {
            const LOG = l.lib.LogFunc(l);
            LOG("Info", 6, "", { lf: false });
            LOG("Info", 6, "Test4");
            expect(l.msg.last_status).toBe(6);
        });
        test("Success5", () => {
            const LOG = l.lib.LogFunc(l);
            LOG("Debug", 7, "", { lf: false });
            LOG("Debug", 7, "Test5");
            expect(l.msg.last_status).toBe(7);
        });
    });
});