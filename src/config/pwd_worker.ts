/**
 * Copyright (c) 2024 Ryoji Kamei
 * Released under the MIT license
 * https://opensource.org/licenses/mit-license.php
 */

console.log("=====================");

import nodeConfig from "config"; // read apitest_worker.json

import { ConfigModule } from "./index.js";

const mod = new ConfigModule();

console.log("==> " + process.env.NODE_CONFIG_ENV);


if (nodeConfig.get("mongoms.password_encryption") === false) {
    const ret1 = await mod.getEncryptedPassword(nodeConfig.get("mongoms.mongo_password"));
    if (ret1.isFailure()) {
        console.log(JSON.stringify(ret1.value));
    } else {
        const ret2 = await mod.getDecryptedPassword(ret1.value);
        if (ret2.isFailure()) {
            console.log(JSON.stringify(ret2.value));
        } else {
            console.log("mongoms.mongo_password(" + ret2.value + "):" + ret1.value);
        }
    }
}
if (nodeConfig.get("bcapi.password_encryption") === false) {
    const ret3 = await mod.getEncryptedPassword(nodeConfig.get("bcapi.node1.userapi_password"));
    if (ret3.isFailure()) {
        console.log(JSON.stringify(ret3.value));
    } else {
        const ret4 = await mod.getDecryptedPassword(ret3.value);
        if (ret4.isFailure()) {
            console.log(JSON.stringify(ret4.value));
        } else {
            console.log("bcapi.node1.userapi_password(" + ret4.value + "):" + ret3.value);
        }
    }
    const ret5 = await mod.getEncryptedPassword(nodeConfig.get("bcapi.node1.adminapi_password"));
    if (ret5.isFailure()) {
        console.log(JSON.stringify(ret5.value));
    } else {
        const ret6 = await mod.getDecryptedPassword(ret5.value);
        if (ret6.isFailure()) {
            console.log(JSON.stringify(ret6.value));
        } else {
            console.log("bcapi.node1.adminapi_password(" + ret6.value + "):" + ret5.value);
        }
    }
    const ret7 = await mod.getEncryptedPassword(nodeConfig.get("bcapi.node2.userapi_password"));
    if (ret7.isFailure()) {
        console.log(JSON.stringify(ret7.value));
    } else {
        const ret8 = await mod.getDecryptedPassword(ret7.value);
        if (ret8.isFailure()) {
            console.log(JSON.stringify(ret8.value));
        } else {
            console.log("bcapi.node2.userapi_password(" + ret8.value + "):" + ret7.value);
        }
    }
    const ret9 = await mod.getEncryptedPassword(nodeConfig.get("bcapi.node2.adminapi_password"));
    if (ret9.isFailure()) {
        console.log(JSON.stringify(ret9.value));
    } else {
        const ret10 = await mod.getDecryptedPassword(ret9.value);
        if (ret10.isFailure()) {
            console.log(JSON.stringify(ret10.value));
        } else {
            console.log("bcapi.node2.adminapi_password(" + ret10.value + "):" + ret9.value);
        }
    }
}

process.exit(0);