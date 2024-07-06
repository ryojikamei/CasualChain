/**
 * Copyright (c) 2024 Ryoji Kamei
 * Released under the MIT license
 * https://opensource.org/licenses/mit-license.php
 */

import { runAxios, responseType } from "../axios.js";

export const name = "_get_byjson";

export async function run(conf: any): Promise<number> {

    // Successful
    const payload2 = JSON.stringify({ type: "new", data: { desc: "test" }});
    const ret2: responseType = await runAxios("/post/byjson", "post", conf.bcapi, payload2);
    const payload2_1 = JSON.stringify({ type: "new", data: { desc: "test" }});
    const ret2_1: responseType = await runAxios("/get/byjson", "get", conf.bcapi, payload2_1);
    if (ret2_1.data === "[]") {
        return -4;
    }

    return 0;
}