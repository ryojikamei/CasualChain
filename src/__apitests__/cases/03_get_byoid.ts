/**
 * Copyright (c) 2024 Ryoji Kamei
 * Released under the MIT license
 * https://opensource.org/licenses/mit-license.php
 */

import { runAxios, responseType } from "../axios";

export const name = "_get_byoid";

export async function run(conf: any): Promise<number> {

    // Successful
    const payload2 = JSON.stringify({ type: "new", data: { desc: "test" }});
    const ret2: responseType = await runAxios("/post/byjson", "post", conf.bcapi, payload2);
    const ret2_1: responseType = await runAxios("/get/byoid/" + ret2.data, "get", conf.bcapi);
    if (ret2.data !== ret2_1.data._id) {
        return -4;
    }

    // Failed
    // axios validator returns 404
    const ret3: responseType = await runAxios("/get/byoid/" + "wrong", "get", conf.bcapi);
    if (ret3.code !== 404) {
        return -5;
    }
    const ret3_1: responseType = await runAxios("/get/byoid/" + "012345678901234567890123", "get", conf.bcapi);
    if (ret3_1.data._id !== undefined) {
        return -6;
    }

    return 0;
}