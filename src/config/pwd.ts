/**
 * Copyright (c) 2024 Ryoji Kamei
 * Released under the MIT license
 * https://opensource.org/licenses/mit-license.php
 */

console.log("=====================");
import { ConfigModule } from ".";

const mod = new ConfigModule();
const ret = await mod.init();

console.log("==> " + process.env.NODE_CONFIG_ENV);

if (ret.isFailure()) {
    console.log("ConfigModule initialization failed. It cannot continue:" + ret.value);
    process.exit(-1);
}
const core = ret.value;

if (core.d.password_encryption === false) {
    const ret1 = await mod.getEncryptedPassword(core.d.mongo_password);
    if (ret1.isFailure()) {
        console.log(JSON.stringify(ret1.value));
    } else {
        const ret2 = await mod.getDecryptedPassword(ret1.value);
        if (ret2.isFailure()) {
            console.log(JSON.stringify(ret2.value));
        } else {
            console.log("datastore.mongo_password(" + ret2.value + "):" + ret1.value);
        }
    }
}
if (core.a.rest.password_encryption === false) {
    const ret3 = await mod.getEncryptedPassword(core.a.rest.userapi_password);
    if (ret3.isFailure()) {
        console.log(JSON.stringify(ret3.value));
    } else {
        const ret4 = await mod.getDecryptedPassword(ret3.value);
        if (ret4.isFailure()) {
            console.log(JSON.stringify(ret4.value));
        } else {
            console.log("api.rest.userapi_password(" + ret4.value + "):" + ret3.value);
        }
    }
    const ret5 = await mod.getEncryptedPassword(core.a.rest.adminapi_password);
    if (ret5.isFailure()) {
        console.log(JSON.stringify(ret5.value));
    } else {
        const ret6 = await mod.getDecryptedPassword(ret5.value);
        if (ret6.isFailure()) {
            console.log(JSON.stringify(ret6.value));
        } else {
            console.log("api.rest.userapi_password(" + ret6.value + "):" + ret5.value);
        }
    }
}

process.exit(0);