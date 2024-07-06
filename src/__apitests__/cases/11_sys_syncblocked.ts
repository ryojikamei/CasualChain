/**
 * Copyright (c) 2024 Ryoji Kamei
 * Released under the MIT license
 * https://opensource.org/licenses/mit-license.php
 */

import { runAxios, responseType } from "../axios.js";

// Due to functional limitations, only normal systems are tested.

export const name = "_get_syncblocked";

export async function run(conf: any): Promise<number> {

    // TEST1
    const ret1: responseType = await runAxios("/sys/syncblocked", "post", conf.bcapi);
    if (ret1.code !== 200) {
        return -1;
    }


    return 0;
}
