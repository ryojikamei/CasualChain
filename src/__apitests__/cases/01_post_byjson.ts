/**
 * Copyright (c) 2024 Ryoji Kamei
 * Released under the MIT license
 * https://opensource.org/licenses/mit-license.php
 */

import { runAxios, responseType } from "../axios.js";
import { generateData } from "../../__testdata__/generator.js";
import { authTokens } from "../server.js";

export const name = "_post_byjson";

export async function run(conf: any, tokens: authTokens): Promise<number> {

    // Failed
    const payload1 = JSON.stringify({ type: "new", data: { desc: "test" }});
    const ret1: responseType = await runAxios("/post/byjson", "post", conf.bcapi, tokens, payload1);
    if (ret1.data.length === 24) {
        return -1;
    }

    const payload2 = JSON.stringify({ wrong: "new", tenant: "a24e797d-84d1-4012-ba78-8882f2711f6c", data: { desc: "test" }});
    const ret2: responseType = await runAxios("/post/byjson", "post", conf.bcapi, tokens, payload2);
    if (ret2.code !== 400) {
        return -2;
    }
    const desc = await generateData("01-1");
    if (desc === undefined) return -4;
    const payload3 = JSON.stringify({ type: "new", tenant: "a24e797d-84d1-4012-ba78-8882f2711f6c", data: { desc: desc }});
    const ret3: responseType = await runAxios("/post/byjson", "post", conf.bcapi, tokens, payload3);
    if (ret3.code !== 503) {
        return -3;
    }

    
    // Successful
    const payload5 = JSON.stringify({ type: "new", tenant: "a24e797d-84d1-4012-ba78-8882f2711f6c", data: { desc: "test" }});
    const ret5: responseType = await runAxios("/post/byjson", "post", conf.bcapi, tokens, payload5);
    if (ret5.data.length !== 24) {
        return -5;
    }
    const payload5_1 = JSON.stringify({ tenant: "a24e797d-84d1-4012-ba78-8882f2711f6c", key: "desc", value: "test" });
    const ret5_1: responseType = await runAxios("/get/byjson", "get", conf.bcapi, tokens, payload5_1);
    if (ret5_1.data === "[]") {
        return -501;
    }

    // It's acceptable, however it is stored in the default parcel
    const payload6 = JSON.stringify({ type: "new", tenant: "8e921d59-00b4-48c2-9ed2-b9f2a90030d6", data: { desc: "test" }});
    const ret6: responseType = await runAxios("/post/byjson", "post", conf.bcapi, tokens, payload6);
    if (ret6.data.length !== 24) {
        return -6;
    }
    const payload6_1 = JSON.stringify({ tenant: "8e921d59-00b4-48c2-9ed2-b9f2a90030d6", key: "desc", value: "test" });
    const ret6_1: responseType = await runAxios("/get/byjson", "get", conf.bcapi, tokens, payload6_1);
    if (ret6_1.data === "[]") {
        return -601;
    }
    const payload6_2 = JSON.stringify({ tenant: "a24e797d-84d1-4012-ba78-8882f2711f6c", key: "desc", value: "test" });
    const ret6_2: responseType = await runAxios("/get/byjson", "get", conf.bcapi, tokens, payload6_2);
    if (ret6_2.data === "[]") {
        return -602;
    }


    return 0;
}
