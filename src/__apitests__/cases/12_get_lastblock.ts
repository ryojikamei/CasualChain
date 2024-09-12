/**
 * Copyright (c) 2024 Ryoji Kamei
 * Released under a non-free license.
 * Check its terms and conditions in LICENSE.txt
 */

import { runAxios, responseType } from "../axios.js";

export const name = "_get_lastblock";

export async function run(conf: any): Promise<number> {

    // Failed
    const ret2: responseType = await runAxios("/get/lastblock", "get", conf.bcapi);
    if (ret2.data.height !== 0) {
        return -4;
    }

    // Successful
    const payload3 = JSON.stringify({ type: "new", data: { desc: "test" }});
    const ret3: responseType = await runAxios("/post/byjson", "post", conf.bcapi, payload3);
    const ret3_1: responseType = await runAxios("/sys/deliverpooling", "post", conf.bcapi);
    const ret3_2: responseType = await runAxios("/sys/blocking", "post", conf.bcapi);
    const ret3_3: responseType = await runAxios("/get/lastblock", "get", conf.bcapi);
    if (ret3_3.data.height !== 1) {
        return -5;
    }

    return 0;
}