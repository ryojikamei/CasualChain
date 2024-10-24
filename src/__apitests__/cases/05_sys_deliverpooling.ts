/**
 * Copyright (c) 2024 Ryoji Kamei
 * Released under the MIT license
 * https://opensource.org/licenses/mit-license.php
 */

import { runAxios, responseType } from "../axios.js";
import { authTokens } from "../server.js";

export const name = "_sys_deliverpooling";

export async function run(conf: any, tokens: authTokens): Promise<number> {


    // Success
    const ret1: responseType = await runAxios("/sys/deliverpooling", "post", conf.bcapi, tokens);
    if (ret1.code !== 200) {
        return -1;
    }

    const payload2 = JSON.stringify({ tenant: "a24e797d-84d1-4012-ba78-8882f2711f6c", type: "new", data: { desc: "test" }});
    const ret2: responseType = await runAxios("/post/byjson", "post", conf.bcapi, tokens, payload2);
    const ret2_1: responseType = await runAxios("/sys/deliverpooling", "post", conf.bcapi, tokens);
    if (ret2_1.code !== 200) {
        return -2;
    }
    const payload2_2 = JSON.stringify({ tenant: "a24e797d-84d1-4012-ba78-8882f2711f6c", key: "desc", value: "test" });
    const ret2_2: responseType = await runAxios("/get/byjson", "get", conf.bcapi, tokens, payload2_2, 2);
    if (ret2_2.data.length !== 1) {
        return -3;
    }

    return 0;
}