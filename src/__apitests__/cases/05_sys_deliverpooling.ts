/**
 * Copyright (c) 2024 Ryoji Kamei
 * Released under the MIT license
 * https://opensource.org/licenses/mit-license.php
 */

import { runAxios, responseType } from "../axios";

export const name = "_sys_deliverpooling";

export async function run(conf: any): Promise<number> {

    // Successful
    const payload2 = JSON.stringify({ type: "new", data: { desc: "test" }});
    const ret2: responseType = await runAxios("/post/byjson", "post", conf.bcapi, payload2);
    const ret2_1: responseType = await runAxios("/sys/deliverpooling", "post", conf.bcapi);
    if (ret2_1.code !== 200) {
        return -4;
    }
    const payload2_2 = JSON.stringify({ key: "desc", value: "test" });
    const ret2_2: responseType = await runAxios("/get/byjson", "get", conf.bcapi, payload2_2, 2);
    if (ret2_2.data.length !== 1) {
        return -5;
    }

    return 0;
}