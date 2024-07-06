/**
 * Copyright (c) 2024 Ryoji Kamei
 * Released under the MIT license
 * https://opensource.org/licenses/mit-license.php
 */

import { runAxios, responseType } from "../axios.js";

export const name = "_get_blocked";

export async function run(conf: any): Promise<number> {

    const payload3 = JSON.stringify({ type: "new", data: { desc: "test" }});
    const ret3: responseType = await runAxios("/post/byjson", "post", conf.bcapi, payload3);
    const ret3_1: responseType = await runAxios("/sys/deliverpooling", "post", conf.bcapi);
    const ret3_2: responseType = await runAxios("/sys/blocking", "post", conf.bcapi);
    const ret3_3: responseType = await runAxios("/get/blocked", "get", conf.bcapi);
    if (ret3_3.data.length <= 2) {
        return -5;
    }

    return 0;
}