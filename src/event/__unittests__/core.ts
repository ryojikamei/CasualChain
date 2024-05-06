/**
 * Copyright (c) 2024 Ryoji Kamei
 * Released under the MIT license
 * https://opensource.org/licenses/mit-license.php
 */

import { randomUUID } from "crypto";
import { EventModule, internalEventFormat, ccEventType } from "..";
import { logMock } from "../../__mocks__/mock_logger";
import { eventConfigType } from "../../config";
import { SystemModuleMock } from "../../__mocks__/mock_system";

const confMock: eventConfigType = {
    enable_internaltasks: false
}


describe("Test of EventModule", () => {
    let core: ccEventType;

    let s: any;
    let eventSample: internalEventFormat;
    beforeAll(() => {
        const ret = new SystemModuleMock().init();
        if (ret.isFailure()) throw new Error("FAIL");
        s = ret.value;
        eventSample = {
            eventId: randomUUID(),
            methodPath: "w.s.lib.postDeliveryPool",
            methodArgs: ["w.s"],
            status: "queue",
            executionResult: undefined,
            intervalMs: Number.MAX_SAFE_INTEGER,
            nextExecuteTimeMs: 0,
            exitOnError: false
        }
    });

    beforeEach(async () => {
        const lib = new EventModule();
        const ret = lib.init(confMock, new logMock(), true);
        if (ret.isFailure()) throw new Error("FAIL");
        core = ret.value;
        const w: any = { s: s };
        core.w = w;
    });

    describe("Method registerInternalEvent()", () => {
        test("Success", () => {
            const ret = core.lib.registerInternalEvent(core, eventSample, true);
            expect(ret.type).toBe("success");
        });
    });

    describe("Method getResult()", () => {
        test("Failure", async () => {
            const ret2 = await core.lib.getResult(core, randomUUID());
            expect(ret2.type).toBe("failure");
        });
        test("Success1", async () => {
            eventSample.eventId = randomUUID();
            const ret1 = core.lib.registerInternalEvent(core, eventSample, true);
            if (ret1.isFailure()) throw new Error("FAIL");
            const ret2 = await core.lib.getResult(core, ret1.value);
            expect(ret2.type).toBe("success");
        });
        test("Success2", async () => {
            eventSample.eventId = randomUUID();
            eventSample.methodPath = "w.s.lib.postScanAndFixBlock"
            const ret1 = core.lib.registerInternalEvent(core, eventSample, true);
            if (ret1.isFailure()) throw new Error("FAIL");
            const ret2 = await core.lib.getResult(core, ret1.value);
            expect(ret2.type).toBe("success");
        });
        test("Success3", async () => {
            eventSample.eventId = randomUUID();
            eventSample.methodPath = "w.s.lib.postScanAndFixPool"
            const ret1 = core.lib.registerInternalEvent(core, eventSample, true);
            if (ret1.isFailure()) throw new Error("FAIL");
            const ret2 = await core.lib.getResult(core, ret1.value);
            expect(ret2.type).toBe("success");
        });
        test("Success4", async () => {
            eventSample.eventId = randomUUID();
            eventSample.methodPath = "w.s.lib.postAppendBlocks"
            const ret1 = core.lib.registerInternalEvent(core, eventSample, true);
            if (ret1.isFailure()) throw new Error("FAIL");
            const ret2 = await core.lib.getResult(core, ret1.value);
            expect(ret2.type).toBe("success");
        });
        
    });
})