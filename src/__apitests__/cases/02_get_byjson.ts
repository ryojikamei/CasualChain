/**
 * Copyright (c) 2024 Ryoji Kamei
 * Released under the MIT license
 * https://opensource.org/licenses/mit-license.php
 */

import { runAxios, responseType } from "../axios.js";

export const name = "_get_byjson";

export async function run(conf: any): Promise<number> {

    // Sample data
    const payload1 = JSON.stringify({ type: "new", tenant: "a24e797d-84d1-4012-ba78-8882f2711f6c", data: { desc: "test" }});
    const ret1: responseType = await runAxios("/post/byjson", "post", conf.bcapi, payload1);
    if ((ret1.code !== 200) || (ret1.data.length !== 24)) {
        return -1;
    }

    // Failure
    const payload2 = JSON.stringify({ tenant: "", key: "desc", value: "test" });
    const ret2: responseType = await runAxios("/get/byjson", "get", conf.bcapi, payload2);
    if (ret2.code !== 503) {
        return -2;
    }

    const payload3 = JSON.stringify({ key: "desc", value: "test" });
    const ret3: responseType = await runAxios("/get/byjson", "get", conf.bcapi, payload3);
    if (ret3.code !== 503) {
        return -3;
    }

    const payload4 = JSON.stringify({ tenant: "a24e797d-84d1-4012-ba78-8882f2711f6c", key: "", value: "test" });
    const ret4: responseType = await runAxios("/get/byjson", "get", conf.bcapi, payload4);
    if (ret4.data.length !== 0) {
        return -4;
    }

    const payload5 = JSON.stringify({ tenant: "a24e797d-84d1-4012-ba78-8882f2711f6c", value: "test" });
    const ret5: responseType = await runAxios("/get/byjson", "get", conf.bcapi, payload5);
    if (ret5.code !== 400) {
        return -5;
    }

    const payload6 = JSON.stringify({ tenant: "a24e797d-84d1-4012-ba78-8882f2711f6c", key: "desc", value: "" });
    const ret6: responseType = await runAxios("/get/byjson", "get", conf.bcapi, payload6);
    if (ret6.data.length !== 0) {
        return -6;
    }

    const payload7 = JSON.stringify({ tenant: "a24e797d-84d1-4012-ba78-8882f2711f6c", key: "desc" });
    const ret7: responseType = await runAxios("/get/byjson", "get", conf.bcapi, payload7);
    if (ret7.data.length !== 0) {
        return -7;
    }


    // Success
    const payload10 = JSON.stringify({ tenant: "a24e797d-84d1-4012-ba78-8882f2711f6c", key: "desc", value: "test" });
    const ret10: responseType = await runAxios("/get/byjson", "get", conf.bcapi, payload10);
    if (ret10.data.length === 0) {
        return -10;
    }

    return 0;
}