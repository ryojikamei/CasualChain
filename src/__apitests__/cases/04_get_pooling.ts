/**
 * Copyright (c) 2024 Ryoji Kamei
 * Released under the MIT license
 * https://opensource.org/licenses/mit-license.php
 */

import { runAxios, responseType } from "../axios";

export const name = "_get_pooling";

export async function run(conf: any): Promise<number> {

    // Failed
    const ret2: responseType = await runAxios("/get/pooling", "get", conf.bcapi);
    if (ret2.data.length !== 0) {
        return -4; 
    }

    // Successful
    const payload3 = JSON.stringify({ type: "new", data: { desc: "test" }});
    const ret3: responseType = await runAxios("/post/byjson", "post", conf.bcapi, payload3);
    const ret3_1: responseType = await runAxios("/get/pooling", "get", conf.bcapi);
    if (ret3_1.data.length !== 1) {
        return -5;
    }

    return 0;
}