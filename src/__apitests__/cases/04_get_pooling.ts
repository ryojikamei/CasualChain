/**
 * Copyright (c) 2024 Ryoji Kamei
 * Released under the MIT license
 * https://opensource.org/licenses/mit-license.php
 */

import { runAxios, responseType } from "../axios.js";
import { authTokens } from "../server.js";

export const name = "_get_pooling";

export async function run(conf: any, tokens: authTokens): Promise<number> {

    // Failed
    const ret1: responseType = await runAxios("/get/pooling", "get", conf.bcapi, tokens);
    if (ret1.code !== 503) {
        return -1; 
    }

    // Successful
    const payload2 = JSON.stringify({ tenant: "a24e797d-84d1-4012-ba78-8882f2711f6c" });
    const ret2: responseType = await runAxios("/get/pooling", "get", conf.bcapi, tokens, payload2);
    if (ret2.data.length !== 0) {
        return -2;
    }
    const payload3 = JSON.stringify({ tenant: "a24e797d-84d1-4012-ba78-8882f2711f6c", type: "new", data: { desc: "test" }});
    const ret3: responseType = await runAxios("/post/byjson", "post", conf.bcapi, tokens, payload3);
    const payload3_1 = JSON.stringify({ tenant: "a24e797d-84d1-4012-ba78-8882f2711f6c" });
    const ret3_1: responseType = await runAxios("/get/pooling", "get", conf.bcapi, tokens, payload3_1);
    if (ret3_1.data.length !== 1) {
        return -3;
    }

    return 0;
}