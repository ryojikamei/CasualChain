/**
 * Copyright (c) 2024 Ryoji Kamei
 * Released under the MIT license
 * https://opensource.org/licenses/mit-license.php
 */
import { runAxios, responseType } from "../axios.js";
import { authTokens } from "../server.js";

// Due to functional limitations, only normal systems are tested.

export const name = "_get_syncpooling";

export async function run(conf: any, tokens: authTokens): Promise<number> {

    // TEST1
    const ret1: responseType = await runAxios("/sys/syncpooling", "post", conf.bcapi, tokens);
    if (ret1.code !== 200) {
        return -1;
    }

    // TEST2
    const payload2 = JSON.stringify({ tenant: "a24e797d-84d1-4012-ba78-8882f2711f6c", type: "new", data: { desc: "test" }});
    const ret2: responseType = await runAxios("/post/byjson", "post", conf.bcapi, tokens, payload2);
    const ret2_1: responseType = await runAxios("/sys/syncpooling", "post", conf.bcapi, tokens);
    if (ret2_1.code !== 200) {
        return -2;
    }
    const payload2_2 = JSON.stringify({ tenant: "a24e797d-84d1-4012-ba78-8882f2711f6c", key: "desc", value: "test"})
    const ret2_2: responseType = await runAxios("/get/byjson", "get", conf.bcapi, tokens, payload2_2);
    const ret2_3: responseType = await runAxios("/get/byjson", "get", conf.bcapi, tokens, payload2_2, 2);
    if (ret2_2.data.length - ret2_3.data.length !== 1) {
        return -3;
    }

    // TEST3
    const ret3: responseType = await runAxios("/sys/deliverpooling", "post", conf.bcapi, tokens);
    const ret3_1: responseType = await runAxios("/sys/syncpooling", "post", conf.bcapi, tokens);
    const ret3_2: responseType = await runAxios("/get/byjson", "get", conf.bcapi, tokens, payload2_2);
    const ret3_3: responseType = await runAxios("/get/byjson", "get", conf.bcapi, tokens, payload2_2, 2);
    if (ret3_2.data.length - ret3_3.data.length !== 0) {
        return -4;
    }

    return 0;
}