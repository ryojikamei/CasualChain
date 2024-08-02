/**
 * Copyright (c) 2024 Ryoji Kamei
 * Released under the MIT license
 * https://opensource.org/licenses/mit-license.php
 */

import { MongoClient } from "mongodb";
import { execa } from "execa"
import nodeConfig from "config"; // read apitest_worker.json

import { setInterval } from "timers/promises";
import { readFile, readdir } from "fs/promises";

import { ConfigModule } from "../config/index.js";

import { responseType, runAxios } from "./axios.js";


let conf: any;
if (process.env.MONGO_MS_PORT === undefined) {
    console.log("It must be run via apitest statement in package.json!")
    process.exit(-1);
} else {
    const mod = new ConfigModule();
    conf = {
        mongoms: {
            password_encryption: nodeConfig.get("mongoms.password_encryption"),
            host: nodeConfig.get("mongoms.mongo_host"),
            port: process.env.MONGO_MS_PORT, // string
            password: nodeConfig.get("mongoms.mongo_password"),
            dbname: nodeConfig.get("mongoms.mongo_dbname"),
            dbuser: nodeConfig.get("mongoms.mongo_dbuser"),
            authdb: nodeConfig.get("mongoms.mongo_authdb"),
            blockcollection: {
                node1: nodeConfig.get("mongoms.mongo_blockcollection_node1"),
                node2: nodeConfig.get("mongoms.mongo_blockcollection_node2")
            },
            poolcollection: {
                node1: nodeConfig.get("mongoms.mongo_poolcollection_node1"),
                node2: nodeConfig.get("mongoms.mongo_poolcollection_node2")
            }
        },
        bcapi: {
            password_encryption: nodeConfig.get("bcapi.password_encryption"),
            node1: {
                host: nodeConfig.get("bcapi.node1.host"),
                userapi_port: nodeConfig.get("bcapi.node1.userapi_port"),
                userapi_user: nodeConfig.get("bcapi.node1.userapi_user"),
                userapi_password: nodeConfig.get("bcapi.node1.userapi_password"),
                adminapi_port: nodeConfig.get("bcapi.node1.adminapi_port"),
                adminapi_user: nodeConfig.get("bcapi.node1.adminapi_user"),
                adminapi_password: nodeConfig.get("bcapi.node1.adminapi_password")
            },
            node2: {
                host: nodeConfig.get("bcapi.node2.host"),
                userapi_port: nodeConfig.get("bcapi.node2.userapi_port"),
                userapi_user: nodeConfig.get("bcapi.node2.userapi_user"),
                userapi_password: nodeConfig.get("bcapi.node2.userapi_password"),
                adminapi_port: nodeConfig.get("bcapi.node2.adminapi_port"),
                adminapi_user: nodeConfig.get("bcapi.node2.adminapi_user"),
                adminapi_password: nodeConfig.get("bcapi.node2.adminapi_password")
            }
        },
        tool: {
            mongoimport: nodeConfig.get("tool.mongoimport"),
            mongoexport: nodeConfig.get("tool.mongoexport")
        },
        default_tenant_id: nodeConfig.get("default_tenant_id")
    }
    if (conf.mongoms.password_encryption === true) {
        const ret1 = await mod.getDecryptedPassword(conf.mongoms.mongo_password);
        if (ret1.isFailure()) {
            console.log(JSON.stringify(ret1.value));
        } else {
            conf.mongoms.mongo_password = ret1.value;
        }
    }
    if (conf.bcapi.password_encryption === true) {
        const ret2 = await mod.getDecryptedPassword(conf.bcapi.node1.userapi_password);
        if (ret2.isFailure()) {
            console.log(JSON.stringify(ret2.value));
        } else {
            conf.bcapi.node1.userapi_password = ret2.value;
        }
        const ret3 = await mod.getDecryptedPassword(conf.bcapi.node1.adminapi_password);
        if (ret3.isFailure()) {
            console.log(JSON.stringify(ret3.value));
        } else {
            conf.bcapi.node1.adminapi_password = ret3.value;
        }
        const ret4 = await mod.getDecryptedPassword(conf.bcapi.node2.userapi_password);
        if (ret4.isFailure()) {
            console.log(JSON.stringify(ret4.value));
        } else {
            conf.bcapi.node2.userapi_password = ret4.value;
        }
        const ret5 = await mod.getDecryptedPassword(conf.bcapi.node2.adminapi_password);
        if (ret5.isFailure()) {
            console.log(JSON.stringify(ret5.value));
        } else {
            conf.bcapi.node2.adminapi_password = ret5.value;
        }
    }
}

export async function getDbClient(): Promise<MongoClient> {

    const uri =
    "mongodb://" + conf.mongoms.dbuser + ":" + conf.mongoms.password + "@" 
    + conf.mongoms.host + ":" + conf.mongoms.port + "/" + conf.mongoms.dbname;
    
    return await MongoClient.connect(uri, {authSource : conf.mongoms.authdb});
}

export async function importTestData(collection: string, dumpfile: string, keepdata?: boolean): Promise<number> {
    const dumppath = process.cwd() + "/src/__testdata__/" + dumpfile
    const bin: string = conf.tool.mongoimport;
    let args: string[] = [];
    if (keepdata !== true) {
        args = ["--drop"];
    }
    const args2: string[] = 
        ["--quiet", "--host=" + conf.mongoms.host, "--port=" + conf.mongoms.port, 
        "--username=" + conf.mongoms.dbuser, "--password=" + conf.mongoms.password,
        "--authenticationDatabase=" + conf.mongoms.authdb, "--db=" + conf.mongoms.dbname,
        "--collection=" + collection, dumppath];
    args = args.concat(args2);
    const ret = await execa(bin, args, { shell: false });
    if (ret.stdout.length !== 0) console.log(ret.stdout);
    if (ret.stderr.length !== 0) console.error(ret.stderr);

    if (ret.exitCode === undefined) return -100;
    return ret.exitCode;
}

export async function exportTestData(collection: string, dumpfile: string): Promise<number> {
    const dumppath = process.cwd() + "/src/__testdata__/" + dumpfile
    const bin: string = conf.tool.mongoexport;
    const args: string[] = 
        ["--quiet", "--host=" + conf.mongoms.host, "--port=" + conf.mongoms.port, 
        "--username=" + conf.mongoms.dbuser, "--password=" + conf.mongoms.password,
        "--authenticationDatabase=" + conf.mongoms.authdb, "--db=" + conf.mongoms.dbname,
        "--collection=" + collection, "--out=" + dumppath];
    const ret = await execa(bin, args, { shell: false });
    if (ret.stdout.length !== 0) console.log(ret.stdout);
    if (ret.stderr.length !== 0) console.error(ret.stderr);

    if (ret.exitCode === undefined) return -100;
    return ret.exitCode;
}

export async function waitForNode() {
    console.log("Waiting for test nodes are ready.");
    for await (const _ of setInterval(500)) {
        // Kicking data out of pool
        const ret200: responseType = await runAxios("/sys/deliverpooling", "post", conf.bcapi);
        if (ret200.code !== 200) {
            continue;
        }
        const ret201: responseType = await runAxios("/sys/deliverpooling", "post", conf.bcapi, undefined, 2);
        if (ret201.code !== 200) {
            continue;
        }
        const ret202: responseType = await runAxios("/sys/blocking", "post", conf.bcapi);
        if (ret202.code !== 200) {
            continue;
        }
        await exportTestData(conf.mongoms.blockcollection.node2, "initial.blocks");
        try {
            const keys = await readFile(process.cwd() + "/src/__testdata__/initial.blocks", "utf-8");
            let lines = 0;
            let i = -1;
            while ((i = keys.indexOf("\n", i + 1)) >= 0) { lines++; }
            if (lines >= 2) { 
                console.log("==== Nodes are now ready ====");
                break;
            }
        } catch (error: any) {
            console.log("waitForNode:" + error.toString());
        }
    }
}

async function apiTestMain() {
    let succeed: number = 0;
    let fail: number = 0;
    const pathcases = process.cwd() + "/dist/__apitests__/cases/"
    const testcases = await readdir(pathcases);

    await waitForNode();
    
    console.log("====== Start API tests ======");
    
    for (const testcase of testcases) {

        if (testcase.endsWith(".js")) {

            // Kicking data out of pool
            const ret200: responseType = await runAxios("/sys/deliverpooling", "post", conf.bcapi);
            if (ret200.code !== 200) {
                console.log(JSON.stringify(ret200));
                return -200;
            }
            const ret201: responseType = await runAxios("/sys/deliverpooling", "post", conf.bcapi, undefined, 2);
            if (ret201.code !== 200) {
                console.log(JSON.stringify(ret201));
                return -201;
            }
            const ret202: responseType = await runAxios("/sys/blocking", "post", conf.bcapi);
            if (ret202.code !== 200) {
                console.log(JSON.stringify(ret202));
                return -202;
            }
            // Initialize block
            const ret100 = await importTestData("block_node1", "initial.blocks", false);
            const ret101 = await importTestData("block_node2", "initial.blocks", false);
            if ((ret100 !== 0) || (ret101 !== 0)) {
                return -100;
            }

            const test = await import(pathcases + testcase);
            process.stdout.write("APITest => " + test.name + ": ");
            const ret = await test.run(conf);
            if (ret == 0) {
                console.log("[ OK ]");
                succeed++;
            } else {
                console.log("[FAIL] with return code " + ret.toString());
                fail++;
            }
        }
    }
    console.log("API Tests are finished with result [OK:" + succeed.toString() + "/FAIL:" + fail.toString() + "] Use Ctrl-C to shutdown.")
}

apiTestMain();
