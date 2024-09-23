/**
 * Copyright (c) 2024 Ryoji Kamei
 * Released under the MIT license
 * https://opensource.org/licenses/mit-license.php
 */

import { runAxios, responseType } from "../axios.js";

export const name = "_get_alltxs";

export async function run(conf: any): Promise<number> {

    // Failure
    const ret1: responseType = await runAxios("/get/alltxs", "get", conf.bcapi);
    if (ret1.code !== 503) {
        return -1
    }

    const payload0 = JSON.stringify({ tenant: "a24e797d-84d1-4012-ba78-8882f2711f6c" });

    const ret2: responseType = await runAxios("/get/alltxs", "get", conf.bcapi, payload0);
    const ret2_1: responseType = await runAxios("/get/pooling", "get", conf.bcapi, payload0);
    if (ret2.data.length - ret2_1.data.length !== 4) {
        return -2;
    }

    const payload3 = JSON.stringify({ tenant: "a24e797d-84d1-4012-ba78-8882f2711f6c", type: "new", data: { desc: "test" }});
    const ret3: responseType = await runAxios("/post/byjson", "post", conf.bcapi, payload3);
    const ret3_1: responseType = await runAxios("/sys/deliverpooling", "post", conf.bcapi);
    const ret3_2: responseType = await runAxios("/sys/blocking", "post", conf.bcapi);
    const ret3_3: responseType = await runAxios("/post/byjson", "post", conf.bcapi, payload3);
    const ret3_4: responseType = await runAxios("/get/alltxs", "get", conf.bcapi, payload0);
    const ret3_5: responseType = await runAxios("/get/pooling", "get", conf.bcapi, payload0);
    if (ret3_4.data.length - ret3_5.data.length !== 5) {
        return -3;
    }

    return 0;
}