/**
 * Copyright (c) 2024 Ryoji Kamei
 * Released under the MIT license
 * https://opensource.org/licenses/mit-license.php
 */
import { runAxios, responseType } from "../axios.js";

export const name = "_get_history";

export async function run(conf: any): Promise<number> {

    const payload0 = JSON.stringify({ tenant: "a24e797d-84d1-4012-ba78-8882f2711f6c" });

    // Successful
    const payload1 = JSON.stringify({ tenant: "a24e797d-84d1-4012-ba78-8882f2711f6c", type: "new", data: { desc: "test" }});
    const ret1: responseType = await runAxios("/post/byjson", "post", conf.bcapi, payload1);
    if (typeof(ret1.data) !== "string") {
        return -1;
    }
    const ret1_1: responseType = await runAxios("/get/history/" + ret1.data, "get", conf.bcapi, payload0);
    if (ret1_1.data.length !== 1) {
        return -2;
    }

    // Failed
    const ret2: responseType = await runAxios("/get/history/" + ret1.data, "get", conf.bcapi);
    if (ret2.code !== 503) {
        return -3;
    }


    // axios validator returns 404
    const ret3: responseType = await runAxios("/get/history/" + "wrong", "get", conf.bcapi, payload0);
    if (ret3.code !== 404) {
        return -4;
    }
    const ret3_1: responseType = await runAxios("/get/history/" + "012345678901234567890123", "get", conf.bcapi, payload0);
    if (ret3_1.data.length !== 0) {
        return -5;
    }

    // Multiple transactions
    const payload4_1 = JSON.stringify({ tenant: "a24e797d-84d1-4012-ba78-8882f2711f6c", type: "update", prev_id: ret1.data, data: { desc: "test2" }});
    const ret4_1: responseType = await runAxios("/post/byjson", "post", conf.bcapi, payload4_1);
    if (typeof(ret4_1.data) !== "string") {
        return -6;
    }
    const payload4_2 = JSON.stringify({ tenant: "a24e797d-84d1-4012-ba78-8882f2711f6c", type: "update", prev_id: ret4_1.data, data: { desc: "test3" } });
    const ret4_2: responseType = await runAxios("/post/byjson", "post", conf.bcapi, payload4_2);
    if (typeof(ret4_2.data) !== "string") {
        return -7;
    }

    const ret4_3: responseType = await runAxios("/get/history/" + ret4_2.data, "get", conf.bcapi, payload0);
    if (ret4_3.data.length !== 3) {
        return -8;
    }

    return 0;
}