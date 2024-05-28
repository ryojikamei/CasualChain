/**
 * Copyright (c) 2024 Ryoji Kamei
 * Released under the MIT license
 * https://opensource.org/licenses/mit-license.php
 */
import { existsSync } from "fs";

process.env.NODE_NO_WARNINGS="1";
process.env.SUPPRESS_NO_CONFIG_WARNING="1";
process.env.NODE_CONFIG_STRICT_MODE="0";

console.log("Passwords stored in plain text should be hashed and stored as follows.");

import childProcess from "child_process";

const confpath = process.cwd() + "/config/"
let ret1_1: childProcess.SpawnSyncReturns<Buffer>;
if (existsSync(confpath + "prod_node1.json") === true) {
    process.env.NODE_CONFIG_ENV="prod_node1";
    ret1_1 = childProcess.spawnSync("node", ["dist/config/pwd.js"], { stdio: "inherit" });
}
let ret1_2: childProcess.SpawnSyncReturns<Buffer>;
if (existsSync(confpath + "prod_node2.json") === true) {
    process.env.NODE_CONFIG_ENV="prod_node2";
    ret1_2 = childProcess.spawnSync("node", ["dist/config/pwd.js"], { stdio: "inherit" });
}
let ret1_3: childProcess.SpawnSyncReturns<Buffer>;
if (existsSync(confpath + "prod_node3.json") === true) {
    process.env.NODE_CONFIG_ENV="prod_node3";
    ret1_3 = childProcess.spawnSync("node", ["dist/config/pwd.js"], { stdio: "inherit" });
}
process.env.NODE_CONFIG_ENV="apitest_node1";
const ret2 = childProcess.spawnSync("node", ["dist/config/pwd.js"], { stdio: "inherit" });

process.env.NODE_CONFIG_ENV="apitest_node2";
const ret3 = childProcess.spawnSync("node", ["dist/config/pwd.js"], { stdio: "inherit" });

process.env.NODE_CONFIG_ENV="apitest_worker";
const ret4 = childProcess.spawnSync("node", ["dist/config/pwd_worker.js"], { stdio: "inherit" });

process.env.NODE_CONFIG_ENV="demo_node1";
const ret5 = childProcess.spawnSync("node", ["dist/config/pwd.js"], { stdio: "inherit" });

process.env.NODE_CONFIG_ENV="demo_node2";
const ret6 = childProcess.spawnSync("node", ["dist/config/pwd.js"], { stdio: "inherit" });

process.env.NODE_CONFIG_ENV="dev_node1";
const ret7 = childProcess.spawnSync("node", ["dist/config/pwd.js"], { stdio: "inherit" });

process.env.NODE_CONFIG_ENV="dev_node2";
const ret8 = childProcess.spawnSync("node", ["dist/config/pwd.js"], { stdio: "inherit" });

async function cleanup(signal: NodeJS.Signals) {
    try {
        if (ret1_1.pid !== undefined) process.kill(ret1_1.pid, signal);
    } catch (error) {
        // no problem
    }
    try {
        if (ret1_2.pid !== undefined) process.kill(ret1_2.pid, signal);
    } catch (error) {
        // no problem
    }
    try {
        if (ret1_3.pid !== undefined) process.kill(ret1_3.pid, signal);
    } catch (error) {
        // no problem
    }
    try {
        if (ret2.pid !== undefined) process.kill(ret2.pid, signal);
    } catch (error) {
        // no problem
    }
    try {
        if (ret3.pid !== undefined) process.kill(ret3.pid, signal);
    } catch (error) {
        // no problem
    }
    try {
        if (ret4.pid !== undefined) process.kill(ret4.pid, signal);
    } catch (error) {
        // no problem
    }
    try {
        if (ret5.pid !== undefined) process.kill(ret5.pid, signal);
    } catch (error) {
        // no problem
    }
    try {
        if (ret6.pid !== undefined) process.kill(ret6.pid, signal);
    } catch (error) {
        // no problem
    }
    try {
        if (ret7.pid !== undefined) process.kill(ret7.pid, signal);
    } catch (error) {
        // no problem
    }
    try {
        if (ret8.pid !== undefined) process.kill(ret8.pid, signal);
    } catch (error) {
        // no problem
    }
}

console.log("===========================");
console.log("NOTE: After changing to the encrypted string, change password_encryption from false to true.");

process.on("SIGINT", (signal) => {cleanup(signal)});
process.on("SIGTERM", (signal) => {cleanup(signal)});
process.on("SIGQUIT", (signal) => {cleanup(signal)});