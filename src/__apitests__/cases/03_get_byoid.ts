/**
 * Copyright (c) 2024 Ryoji Kamei
 * Released under the MIT license
 * https://opensource.org/licenses/mit-license.php
 */

import { runAxios, responseType } from "../axios.js";
import { authTokens } from "../server.js";

export const name = "_get_byoid";

export async function run(conf: any, tokens: authTokens): Promise<number> {

    // Failed
    // axios validator returns 404
    const ret1: responseType = await runAxios("/get/byoid/" + "wrong", "get", conf.bcapi, tokens);
    if (ret1.code !== 404) {
        return -1;
    }

    const payload2 = JSON.stringify({ tenant: "a24e797d-84d1-4012-ba78-8882f2711f6c" });
    const ret2: responseType = await runAxios("/get/byoid/" + "012345678901234567890123", "get", conf.bcapi, tokens, payload2);
    if (ret2.data._id !== undefined) {
        return -2;
    }

    const ret3: responseType = await runAxios("/get/byoid/" + "012345678901234567890123", "get", conf.bcapi, tokens);
    if (ret3.data._id !== undefined) {
        return -3;
    }

    // Successful
    const payload4 = JSON.stringify({ tenant: "a24e797d-84d1-4012-ba78-8882f2711f6c", type: "new", data: { desc: "test" }});
    const ret4: responseType = await runAxios("/post/byjson", "post", conf.bcapi, tokens, payload4);
    const payload4_1 = JSON.stringify({ tenant: "a24e797d-84d1-4012-ba78-8882f2711f6c" });
    const ret4_1: responseType = await runAxios("/get/byoid/" + ret4.data, "get", conf.bcapi, tokens, payload4_1);
    if (ret4.data !== ret4_1.data._id) {
        return -4;
    }


    return 0;
}