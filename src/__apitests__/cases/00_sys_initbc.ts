/**
 * Copyright (c) 2024 Ryoji Kamei
 * Released under a non-free license.
 * Check its terms and conditions in LICENSE.txt
 */

import { runAxios, responseType } from "../axios.js";
import { authTokens } from "../server.js";

export const name = "_sys_initbc";

export async function run(conf: any, tokens: authTokens): Promise<number> {

    const ret: responseType = await runAxios("/sys/initbc", "post", conf.bcapi, tokens, JSON.stringify({ trytoreset: true }));
    if (ret.code === 200) {
        return 0;
    } else {
        return -1;
    }
}