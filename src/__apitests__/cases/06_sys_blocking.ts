/**
 * Copyright (c) 2024 Ryoji Kamei
 * Released under the MIT license
 * https://opensource.org/licenses/mit-license.php
 */

import { runAxios, responseType } from "../axios.js";

export const name = "_sys_blocking";

export async function run(conf: any): Promise<number> {

    // Successful
    const payload3 = JSON.stringify({ tenant: "a24e797d-84d1-4012-ba78-8882f2711f6c", type: "new", data: { desc: "test" }});
    const ret3: responseType = await runAxios("/post/byjson", "post", conf.bcapi, payload3);
    const ret3_1: responseType = await runAxios("/sys/deliverpooling", "post", conf.bcapi);
    const ret3_2: responseType = await runAxios("/sys/blocking", "post", conf.bcapi);
    const payload3_3 = JSON.stringify({ tenant: "a24e797d-84d1-4012-ba78-8882f2711f6c" });
    const ret3_3: responseType = await runAxios("/get/blocked", "get", conf.bcapi, payload3_3);
    if (ret3_3.data.length <= 1) {
        return -5;
    }
    const payload3_4 = JSON.stringify({ tenant: "a24e797d-84d1-4012-ba78-8882f2711f6c" });
    const ret3_4: responseType = await runAxios("/get/pooling", "get", conf.bcapi, payload3_4);
    if (ret3_4.data.length !== 0) {
        return -6;
    }

    return 0;
}