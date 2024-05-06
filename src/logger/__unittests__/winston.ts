/**
 * Copyright (c) 2024 Ryoji Kamei
 * Released under the MIT license
 * https://opensource.org/licenses/mit-license.php
 */

import { winston_init } from "../winston";
import { randomUUID } from "crypto";
import { unlinkSync } from "fs";

const logpath = "/tmp/log-" + randomUUID()
describe("Test of winston_init()", () => {
    afterAll(() => {
        try {
            unlinkSync(logpath);
        } catch (error) {
            
        }
    });
    test("Success initialization", () => {
        const logger = winston_init("6", logpath, false);
        expect(logger).toBeDefined();
    });

    test("Success initialization with rotation", () => {
        const logger = winston_init("6", logpath, true);
        expect(logger).toBeDefined();
    });
});