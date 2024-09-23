/**
 * Copyright (c) 2024 Ryoji Kamei
 * Released under the MIT license
 * https://opensource.org/licenses/mit-license.php
 */

import { runAxios, responseType } from "../axios.js";

export const name = "_sys_opentenant";

export async function run(conf: any): Promise<number> {

    // Failure
    const payload1 = JSON.stringify({});
    const ret1: responseType = await runAxios("/sys/opentenant", "post", conf.bcapi, payload1);
    if (ret1.code !== 503) {
        return -1;
    }
    
    const payload2 = JSON.stringify({ "adminId": "8e921d59-00b4-48c2-9ed2-b9f2a90030d6"});
    const ret2: responseType = await runAxios("/sys/opentenant", "post", conf.bcapi, payload2);
    if (ret2.code !== 503) {
        return -2;
    }
    const payload3 = JSON.stringify({ "adminId": "wrong", "recallPhrase": "apittest" });
    const ret3: responseType = await runAxios("/sys/opentenant", "post", conf.bcapi, payload3);
    if (ret3.code !== 503) {
        return -3;
    }

    // Success
    const payload4 = JSON.stringify({ "adminId": "8e921d59-00b4-48c2-9ed2-b9f2a90030d6", "recallPhrase": "apitest" });
    const ret4: responseType = await runAxios("/sys/opentenant", "post", conf.bcapi, payload4);
    if (ret4.code !== 200) {
        return -4;
    }

    return 0;
}