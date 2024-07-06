/**
 * Copyright (c) 2024 Ryoji Kamei
 * Released under the MIT license
 * https://opensource.org/licenses/mit-license.php
 */
import { runAxios, responseType } from "../axios.js";

export const name = "_get_history";

export async function run(conf: any): Promise<number> {

    // Successful
    const payload2 = JSON.stringify({ type: "new", data: { desc: "test" }});
    const ret2: responseType = await runAxios("/post/byjson", "post", conf.bcapi, payload2);
    if (typeof(ret2.data) !== "string") {
        return -4;
    }
    const ret2_1: responseType = await runAxios("/get/history/" + ret2.data, "get", conf.bcapi);
    if (ret2_1.data.length !== 1) {
        return -5;
    }

    // Failed
    // axios validator returns 404
    const ret3: responseType = await runAxios("/get/history/" + "wrong", "get", conf.bcapi);
    if (ret3.code !== 404) {
        return -6;
    }
    const ret3_1: responseType = await runAxios("/get/history/" + "012345678901234567890123", "get", conf.bcapi);
    if (ret3_1.data.length !== 0) {
        return -7;
    }

    // Multiple transactions
    const payload4_1 = JSON.stringify({ type: "update", prev_id: ret2.data, data: { desc: "test2" }});
    const ret4_1: responseType = await runAxios("/post/byjson", "post", conf.bcapi, payload4_1);
    if (typeof(ret4_1.data) !== "string") {
        return -8;
    }
    const payload4_2 = JSON.stringify({ type: "update", prev_id: ret4_1.data, data: { desc: "test3" } });
    const ret4_2: responseType = await runAxios("/post/byjson", "post", conf.bcapi, payload4_2);
    if (typeof(ret4_2.data) !== "string") {
        return -9;
    }

    const ret4_3: responseType = await runAxios("/get/history/" + ret4_2.data, "get", conf.bcapi);
    if (ret4_3.data.length !== 3) {
        return -10;
    }

    return 0;
}