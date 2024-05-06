/**
 * Copyright (c) 2024 Ryoji Kamei
 * Released under the MIT license
 * https://opensource.org/licenses/mit-license.php
 */

import { execa } from "execa"
import { randomUUID, createHash } from "crypto";

import { keyringConfigType } from "../config";
import { KeyringModule } from "../keyring";
import * as CA3 from "../block/algorithm/ca3";
import { objBlock, objTx } from "../datastore";
import { randomOid } from "../utils";

import { logMock } from "../__mocks__/mock_logger";

export type dataSet = {
    txs: Map<string, objTx>,
    blks: Map<string, CA3.Ca3BlockFormat>
}

export async function generateSamples(__t?: string, hostname?: string): Promise<dataSet> {
    let kconf: keyringConfigType;
    let kcore: any;
    let block0_0: CA3.Ca3BlockFormat;
    let block0_1: CA3.Ca3BlockFormat;
    let block2: CA3.Ca3BlockFormat;
    let block3: CA3.Ca3BlockFormat;
    let block4: CA3.Ca3BlockFormat;

    let tenantId: string;
    if (__t === undefined) { 
        tenantId = randomUUID();
    } else {
        tenantId = __t;
    }
    let host: string;
    if (hostname === undefined) {
        host = "localhost"
    } else {
        host = hostname;
    }


    const tx1: objTx = {
        "_id": randomOid().byStr(),
        "tenant": tenantId,
        "type":"new",
        "data": {
            "cc_tx":"system.v3.keyring.config.pubkey",
            "nodename":"demo_node1",
            "verify_key":"-----BEGIN PUBLIC KEY-----\nMCowBQYDK2VwAyEAmzK+0lkqSy5Rv5Y12Cyy0wC4aQLZQ/iTqS4r0ROdcEc=\n-----END PUBLIC KEY-----\n",
            "verify_key_hex":"9cdff1431331c304bfc3947a7886abc665bc17179e7aae077083e1f57a7cdda0",
        },
        "settime":"2023/10/13 8:21:34",
        "deliveryF":true
    }
    
    const tx2: objTx = {
        "_id": randomOid().byStr(),
        "tenant": tenantId,
        "type":"new",
        "data": {
            "cc_tx":"system.v3.keyring.config.tlscrt",
            "nodename":"demo_node1",
            "payload":"-----BEGIN CERTIFICATE-----\nMIIBRDCB96ADAgECAgEBMAUGAytlcDANMQswCQYDVQQDDAJjYTAeFw0yMzA4MjQx\nNDUwNTBaFw0zMzA4MjMxNDUwNTBaMBQxEjAQBgNVBAMMCWxvY2FsaG9zdDAqMAUG\nAytlcAMhAJsyvtJZKksuUb+WNdgsstMAuGkC2UP4k6kuK9ETnXBHo3UwczAmBgNV\nHREEHzAdgglsb2NhbGhvc3SHBMCoATKHBMCoATOHBMCoATQwCQYDVR0TBAIwADAd\nBgNVHQ4EFgQU3iEWgZo/tnYbILcjkMWaOgTe/kowHwYDVR0jBBgwFoAUDva8tcbD\nAW74+++4oG8Iop4BY54wBQYDK2VwA0EAjwdjYLVdMhGG+hFNdmtRleMy/QseuBp8\naNbCWoyZAoGoEO4pI7GRN6D+QMiaYiI93Pr+B98NlSNIL+IqkA65BA==\n-----END CERTIFICATE-----\n",
        },
        "settime":"2023/10/13 8:21:35",
        "deliveryF":true
    }
    
    const tx3: objTx = {
        "_id": randomOid().byStr(),
        "tenant": tenantId,
        "type": "new",
        "data": {
            "desc": "tx3",
        },
        "settime": "2023/10/13 8:33:43",
        "deliveryF": false
    }

    const tx4: objTx = {
        "_id": randomOid().byStr(),
        "tenant": tenantId,
        "type": "new",
        "data": {
            "desc": "tx4",
        },
        "settime": "2023/10/13 8:33:44",
        "deliveryF": false
    }

    const tx5: objTx = {
        "_id": randomOid().byStr(),
        "tenant": tenantId,
        "type": "new",
        "data": {
            "desc": "tx5",
        },
        "settime": "1970/01/01 00:00:00",
        "deliveryF": true
    }

    const tx6: objTx = {
        "_id": randomOid().byStr(),
        "tenant": tenantId,
        "type": "new",
        "data": {
            "desc": "tx6",
        },
        "settime": "2039/01/01 00:00:00",
        "deliveryF": true
    }

    const tx7: objTx = {
        "_id": randomOid().byStr(),
        "tenant": tenantId,
        "type": "update",
        "data": {
            "desc": "tx7",
        },
        "settime": "1970/01/01 01:00:00",
        "prev_id": tx5._id,
        "deliveryF": true
    }

    const tx8: objTx = {
        "_id": randomOid().byStr(),
        "tenant": tenantId,
        "type": "delete",
        "data": {},
        "settime": "1970/01/01 01:00:00",
        "prev_id": tx7._id,
        "deliveryF": true
    }

    const tx9: objTx = {
        "_id": randomOid().byStr(),
        "tenant": tenantId,
        "type": "custom",
        "data": {
            "desc": "tx9",
        },
        "settime": "2039/01/01 00:00:00",
        "deliveryF": true
    }

    const txmap = new Map<string, objTx>();
    txmap.set("tx1", tx1);
    txmap.set("tx2", tx2);
    txmap.set("tx3", tx3);
    txmap.set("tx4", tx4);
    txmap.set("tx5", tx5);
    txmap.set("tx6", tx6);
    txmap.set("tx7", tx7);
    txmap.set("tx8", tx8);
    txmap.set("tx9", tx9);

    kconf = {
        "create_keys_if_no_sign_key_exists": false,
        "sign_key_file": "apitest_node1.key",
        "verify_key_file": "apitest_node1.pub"
    }
    const ret0 = await(new KeyringModule().init(kconf, new logMock()));
    if (ret0.isFailure()) { throw new Error("beforeAll failed in init of KeyringModule"); };
    kcore = ret0.value;

    // block0 case0
    const oidVal0 = { _id: randomOid().byStr() };
    const hObj0 = {
        version: 2,
        tenant: tenantId,
        height: 0,
        size: 0,
        type: "genesis",
        settime: "2023/10/12 15:47:15",
        timestamp: "1697093235478",
        prev_hash: "0",
        signedby: {},
        signcounter: 1
    }
    const hashVal0: string = createHash('sha256').update(JSON.stringify(hObj0)).digest('hex');
    const hashObj0 = { hash: hashVal0 };
    block0_0 = {...oidVal0, ...hObj0, ...hashObj0};
    const ret1 = await kcore.lib.signByPrivateKey(kcore, block0_0, randomUUID());
    if (ret1.isFailure()) { throw new Error("beforeAll failed in creation of block0_0"); };
    block0_0.signcounter--;
    block0_0.signedby[host] =  ret1.value;

    // block0 case1
    const oidVal1 = { _id: randomOid().byStr() };
    const hObj1 = {
        version: 2,
        tenant: tenantId,
        height: 0,
        size: 0,
        type: "genesis",
        settime: "2023/10/12 15:47:15",
        timestamp: "1697093235478",
        prev_hash: "0",
        signedby: {},
        signcounter: 2
    }
    const hashVal1: string = createHash('sha256').update(JSON.stringify(hObj1)).digest('hex');
    const hashObj1 = { hash: hashVal1 };
    block0_1 = {...oidVal1, ...hObj1, ...hashObj1};
    const ret2 = await kcore.lib.signByPrivateKey(kcore, block0_1, randomUUID());
    if (ret2.isFailure()) { throw new Error("beforeAll failed in creation of block0_1"); };
    block0_1.signcounter--;
    block0_1.signedby[host] = ret2.value;

    // block2
    const oidVal2 = { _id: randomOid().byStr() };
    const hObj2 = {
        version: 2,
        tenant: tenantId,
        height: 1,
        size: 1,
        data: [tx3],
        type: "data",
        settime: "2023/10/12 15:47:15",
        timestamp: "1697093235478",
        prev_hash: hashVal0,
        signedby: {},
        signcounter: 1
    }
    const hashVal2: string = createHash('sha256').update(JSON.stringify(hObj2)).digest('hex');
    const hashObj2 = { hash: hashVal2 };
    block2 = {...oidVal2, ...hObj2, ...hashObj2};
    const ret3 = await kcore.lib.signByPrivateKey(kcore, block2, randomUUID());
    if (ret3.isFailure()) { throw new Error("beforeAll failed in creation of block2"); };
    block2.signcounter--;
    block2.signedby[host] =  ret3.value;

    // block3
    const oidVal3 = { _id: randomOid().byStr() };
    const hObj3 = {
        version: 2,
        tenant: tenantId,
        height: 2,
        size: 3,
        data: [tx5, tx6, tx7],
        type: "data",
        settime: "2023/10/12 15:47:15",
        timestamp: "1697093235478",
        prev_hash: hashVal2,
        signedby: {},
        signcounter: 1
    }
    const hashVal3: string = createHash('sha256').update(JSON.stringify(hObj3)).digest('hex');
    const hashObj3 = { hash: hashVal3 };
    block3 = {...oidVal3, ...hObj3, ...hashObj3};
    const ret4 = await kcore.lib.signByPrivateKey(kcore, block3, randomUUID());
    if (ret4.isFailure()) { throw new Error("beforeAll failed in creation of block3"); };
    block3.signcounter--;
    block3.signedby[host] =  ret4.value;

    // block4
    const oidVal4 = { _id: randomOid().byStr() };
    const hObj4 = {
        version: 2,
        tenant: tenantId,
        height: 3,
        size: 2,
        data: [tx8, tx9],
        type: "data",
        settime: "2023/10/12 15:47:15",
        timestamp: "1697093235478",
        prev_hash: hashVal3,
        signedby: {},
        signcounter: 1
    }
    const hashVal4: string = createHash('sha256').update(JSON.stringify(hObj4)).digest('hex');
    const hashObj4 = { hash: hashVal4 };
    block4 = {...oidVal4, ...hObj4, ...hashObj4};
    const ret5 = await kcore.lib.signByPrivateKey(kcore, block4, randomUUID());
    if (ret5.isFailure()) { throw new Error("beforeAll failed in creation of block4"); };
    block4.signcounter--;
    block4.signedby[host] =  ret5.value;
    
    const blkmap = new Map<string, CA3.Ca3BlockFormat>();
    blkmap.set("blk0", block0_0);
    blkmap.set("blk0B", block0_1);
    blkmap.set("blk2", block2);
    blkmap.set("blk3", block3);
    blkmap.set("blk4", block4);

    const ret = { txs: txmap, blks: blkmap };
    return ret;
}

export async function generateData(datanumber: string): Promise<string | undefined> {
    const datadir = process.cwd() + "/enterprise/src/__apitests__/data/"

    switch (datanumber) {
        case "01-1":
            const data = await generateRandomTextData("01-1.data", 15364);
            return data;
        default:
            console.log("Unknown case " + datanumber);
            return undefined;
    }

}

async function generateRandomTextData(filename: string, sizeInKiB: number): Promise<string | undefined> {
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