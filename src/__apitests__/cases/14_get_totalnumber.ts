/**
 * Copyright (c) 2024 Ryoji Kamei
 * Released under a non-free license.
 * Check its terms and conditions in LICENSE.txt
 */

import { runAxios, responseType } from "../axios.js";
import { authTokens } from "../server.js";

export const name = "_get_totalnumber";

export async function run(conf: any, tokens: authTokens): Promise<number> {

    const payload0 = JSON.stringify({ tenant: "a24e797d-84d1-4012-ba78-8882f2711f6c" });

    // Failed
    const ret1: responseType = await runAxios("/get/totalnumber", "get", conf.bcapi, tokens);
    if (ret1.code !== 503) {
        return -1;
    }

    const ret2: responseType = await runAxios("/get/totalnumber", "get", conf.bcapi, tokens, payload0);
    if (ret2.data !== 4) {
        return -2;
    }

    // Successful
    const payload3 = JSON.stringify({ tenant: "a24e797d-84d1-4012-ba78-8882f2711f6c", type: "new", data: { desc: "test" }});
    const ret3: responseType = await runAxios("/post/byjson", "post", conf.bcapi, tokens, payload3);
    const ret3_1: responseType = await runAxios("/sys/deliverpooling", "post", conf.bcapi, tokens);
    const ret3_2: responseType = await runAxios("/sys/blocking", "post", conf.bcapi, tokens);
    const ret3_3: responseType = await runAxios("/get/totalnumber", "get", conf.bcapi, tokens, payload0);
    if (ret3_3.data !== 5) {
        return -5;
    }

    return 0;
}