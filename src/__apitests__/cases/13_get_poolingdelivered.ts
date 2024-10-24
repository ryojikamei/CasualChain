/**
 * Copyright (c) 2024 Ryoji Kamei
 * Released under a non-free license.
 * Check its terms and conditions in LICENSE.txt
 */

import { runAxios, responseType } from "../axios.js";
import { authTokens } from "../server.js";

export const name = "_get_poolingdelivered";

export async function run(conf: any, tokens: authTokens): Promise<number> {

    const payload0 = JSON.stringify({ tenant: "a24e797d-84d1-4012-ba78-8882f2711f6c" });

    const ret1: responseType = await runAxios("/get/poolingdelivered", "get", conf.bcapi, tokens);
    if (ret1.code !== 503) {
        return -1;
    }

    // Successful
    const payload2 = JSON.stringify({ tenant: "a24e797d-84d1-4012-ba78-8882f2711f6c", type: "new", data: { desc: "test" }});
    const ret2: responseType = await runAxios("/post/byjson", "post", conf.bcapi, tokens, payload2);
    const ret2_1: responseType = await runAxios("/sys/deliverpooling", "post", conf.bcapi, tokens, payload0);
    if (ret2_1.code !== 200) {
        return -2;
    }
    const ret2_2: responseType = await runAxios("/post/byjson", "post", conf.bcapi, tokens, payload2);
    const ret2_3: responseType = await runAxios("/get/poolingdelivered", "get", conf.bcapi, tokens, payload0);
    if (ret2_3.data.length !== 1) {
        return -3;
    }

    return 0;
}