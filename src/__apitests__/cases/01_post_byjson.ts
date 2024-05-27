/**
 * Copyright (c) 2024 Ryoji Kamei
 * Released under the MIT license
 * https://opensource.org/licenses/mit-license.php
 */

import { runAxios, responseType } from "../axios";
import { generateData } from "../../__testdata__/generator";

export const name = "_post_byjson";

export async function run(conf: any): Promise<number> {

    // Successful
    const payload2 = JSON.stringify({ type: "new", data: { desc: "test" }});
    const ret2: responseType = await runAxios("/post/byjson", "post", conf.bcapi, payload2);
    if (typeof(ret2.data) !== "string") {
        return -4;
    }
    const payload2_1 = JSON.stringify({ type: "new", data: { desc: "test" }});
    const ret2_1: responseType = await runAxios("/get/byjson", "get", conf.bcapi, payload2_1);
    if (ret2_1.data === "[]") {
        return -5;
    }

    // Failed
    const payload3 = JSON.stringify({ wrong: "new", data: { desc: "test" }});
    const ret3: responseType = await runAxios("/post/byjson", "post", conf.bcapi, payload3);
    if (ret3.code !== 503) {
        return -6;
    }
    const desc = await generateData("01-1");
    if (desc === undefined) return -7;
    const payload4 = JSON.stringify({ type: "new", data: { desc }});
    const ret4: responseType = await runAxios("/post/byjson", "post", conf.bcapi, payload4);
    if (ret4.code !== 503) {
        return -8;
    }

    return 0;
}