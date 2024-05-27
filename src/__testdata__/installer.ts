/**
 * Copyright (c) 2024 Ryoji Kamei
 * Released under the MIT license
 * https://opensource.org/licenses/mit-license.php
 */

import clone from "clone";
import { execa } from "execa"

import { MongoClient, ObjectId } from "mongodb";
import { generateSamples } from "./generator";
import { Ca3BlockFormat } from "../block/algorithm/ca3";
import { objTx } from "../datastore";

async function insertData(client: MongoClient, collection: string, data: any, keepdata?: boolean): Promise<void> {
    try {
        const dbObj = client.db();
        const txs = dbObj.collection(collection);

        try {
            if (keepdata !== true) await txs.drop();
        } catch (error) {
            // ignore
        }

        if (data !== undefined) {
            let cloneObj = clone(data);
            cloneObj._id = ObjectId.createFromHexString(cloneObj._id);
            await txs.insertOne(cloneObj);
        }
    } catch (error:any) {
        console.log("WARNING:insertData:" + error.toString());
    }
}

export type installResult = {
    block_node1: any[],
    block_node2: any[],
    pool_node1: any[],
    pool_node2: any[]
}

/**
 * (broken) data installer for testing syncpooling and syncblocked
 * @param casenumber 
 * @returns 
 */
export async function installSamples(client: MongoClient, casenumber: string, signhost?: string): Promise<installResult | undefined> {

    const ds = await generateSamples(undefined, signhost);
    const tx3 = ds.txs.get("tx3");
    const tx4 = ds.txs.get("tx4");
    const tx5 = ds.txs.get("tx5");
    const tx6 = ds.txs.get("tx6");
    const tx7 = ds.txs.get("tx7");
    const tx8 = ds.txs.get("tx8");
    const tx9 = ds.txs.get("tx9");
    const blk0 = ds.blks.get("blk0");
    const blk2 = ds.blks.get("blk2");
    const blk3 = ds.blks.get("blk3");
    const blk4 = ds.blks.get("blk4");
    const blk0B = ds.blks.get("blk0B");

    let ret: installResult;
    switch (casenumber) {
        case "genesis":
            await insertData(client, "block_node1", blk0, false);
            await insertData(client, "block_node2", blk0, false);
            ret = {
                block_node1: [blk0],
                block_node2: [blk0],
                pool_node1: [],
                pool_node2: []
            }
            break;
        case "directio1":
            await insertData(client, "block_node1", blk0, false);
            await insertData(client, "block_node1", blk2, true);
            ret = {
                block_node1: [blk0, blk2],
                block_node2: [],
                pool_node1: [],
                pool_node2: []
            }
            break;
        default:
            console.log("Unknown case " + casenumber);
            return undefined;
    }

    return ret;
}

export async function genData(datanumber: string): Promise<string | undefined> {
    const datadir = process.cwd() + "/enterprise/src/__apitests__/data/"

    switch (datanumber) {
        case "01-1":
            const data = await genRandomTextData("01-1.data", 15364);
            return data;
        default:
            console.log("Unknown case " + datanumber);
            return undefined;
    }

}

async function genRandomTextData(filename: string, sizeInKiB: number): Promise<string | undefined> {
    const dumppath = process.cwd() + "/enterprise/src/__apitests__/data/" + filename;

    const binpath = dumppath + ".bin";
    const size = Math.floor(sizeInKiB * 3 / 4); 
    const bin: string = "/usr/bin/dd"
    const args: string[] = ["if=/dev/urandom", "of=" + binpath, "bs=1024", "count=" + size.toString() ];
    const ret = await execa(bin, args, { shell: false });
    console.log(ret.stdout);
    console.error(ret.stderr);
    if (ret.exitCode !== 0) return undefined;

    const bin2: string = "/usr/bin/base64"
    const args2: string[] = [ binpath ];
    const ret2 = await execa(bin2, args2, { shell: false });
    if (ret2.exitCode !== 0) {
        console.error(ret2.stderr);
        return undefined;
    }

    const bin3: string = "/usr/bin/rm"
    const args3: string[] = [ "-f", binpath ];
    const ret3 = await execa(bin3, args3, { shell: false });
    if (ret3.exitCode !== 0) {
        console.error(ret3.stderr);
    }

    return ret2.stdout
}