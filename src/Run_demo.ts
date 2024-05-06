/**
 * Copyright (c) 2024 Ryoji Kamei
 * Released under the MIT license
 * https://opensource.org/licenses/mit-license.php
 */

process.env.SUPPRESS_NO_CONFIG_WARNING="1"
process.env.NODE_CONFIG_STRICT_MODE="0";
process.env.NODE_CONFIG_ENV="demo_node1";

import nodeConfig from "config";
import { ConfigModule, dsConfigType } from "./config/index.js";
let d: dsConfigType;
try {
    d = {
        password_encryption: nodeConfig.get("datastore.password_encryption"),
        mongo_host: nodeConfig.get("datastore.mongo_host"),
        mongo_port: nodeConfig.get("datastore.mongo_port"),
        mongo_dbname: nodeConfig.get("datastore.mongo_dbname"),
        mongo_dbuser: nodeConfig.get("datastore.mongo_dbuser"),
        mongo_password: nodeConfig.get("datastore.mongo_password"),
        mongo_authdb: nodeConfig.get("datastore.mongo_authdb"),
        mongo_blockcollection: nodeConfig.get("datastore.mongo_blockcollection"),
        mongo_poolcollection: nodeConfig.get("datastore.mongo_poolcollection")
    }
    const mod = new ConfigModule();
    if (d.password_encryption === true) {
        const ret1 = await mod.getDecryptedPassword(d.mongo_password);
        if (ret1.isFailure()) {
            console.log(JSON.stringify(ret1.value));
        } else {
            d.mongo_password = ret1.value;
        }
    }
} catch (error) {
    console.log("Error in reading configuration of datastore");
    throw error;
}

import { MongoMemoryServer } from "mongodb-memory-server";
type StorageEngine = "ephemeralForTest" | "wiredTiger";
const engine: StorageEngine = "wiredTiger";
const dbServerOpts = {
    binary: {
        version: "6.0.14",
        skipMD5: true
    },
    auth: {
        enable: true,
        customRootName: d.mongo_dbuser,
        customRootPwd: d.mongo_password
    },
    instance: { auth: true, storageEngine: engine },
    autoStart: true
}

const server = await MongoMemoryServer.create(dbServerOpts);
process.env.MONGO_MS_PORT=server.getUri().split(":")[2].split("/")[0];

import childProcess from "child_process";

const node1 = childProcess.spawn("node", ["--experimental-specifier-resolution", "node", "dist/server.js"], { detached: true, stdio: "ignore" });
console.log("== PID: " + node1.pid + " is starting with using configuration file demo_node1.json (stdio is ignored) ==")

process.env.NODE_CONFIG_ENV="demo_node2";
const node2 = childProcess.spawn("node", ["--experimental-specifier-resolution", "node", "dist/server.js"], { detached: true, stdio: "inherit" });
console.log("== PID: " + node2.pid + " is starting with using configuration file demo_node2.json ==")


async function cleanup(signal: NodeJS.Signals) {
    try {
        if (node2.pid !== undefined) process.kill(node2.pid, signal);
    } catch (error) {
        // no problem
    }
    try {
        if (node1.pid !== undefined) process.kill(node1.pid, signal);
    } catch (error) {
        // no problem
    }
    try {
        await server.stop();
    } catch (error) {
        // no problem
    }
}

process.on("SIGINT", (signal) => {cleanup(signal)});
process.on("SIGTERM", (signal) => {cleanup(signal)});
process.on("SIGQUIT", (signal) => {cleanup(signal)});