/**
 * Copyright (c) 2024 Ryoji Kamei
 * Released under a non-free license.
 * Check its terms and conditions in LICENSE.txt
 */

import { runAxios, responseType } from "../axios.js";

export const name = "_get_poolingdelivered";

export async function run(conf: any): Promise<number> {

    // Successful
    const payload2 = JSON.stringify({ type: "new", data: { desc: "test" }});
    const ret2: responseType = await runAxios("/post/byjson", "post", conf.bcapi, payload2);
    const ret2_1: responseType = await runAxios("/sys/deliverpooling", "post", conf.bcapi);
    if (ret2_1.code !== 200) {
        return -4;
    }
    const ret2_2: responseType = await runAxios("/post/byjson", "post", conf.bcapi, payload2);
    const ret2_3: responseType = await runAxios("/get/poolingdelivered", "get", conf.bcapi, undefined);
    if (ret2_3.data.length !== 5) {
        return -5;
    }

    return 0;
}