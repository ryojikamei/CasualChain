/**
 * Copyright (c) 2024 Ryoji Kamei
 * Released under the MIT license
 * https://opensource.org/licenses/mit-license.php
 */

import clone from "clone"
import { createHash } from "crypto"

import { gResult, gSuccess, gFailure, gError } from "../../utils.js";

import { objTx } from "../../datastore/index.js"
import { createBlockOptions, ccBlockType } from "../index.js"
import { rpcReturnFormat } from "../../internode/index.js"

import * as systemrpc from '../../../grpc/systemrpc_pb.js';
import { randomOid } from "../../utils.js"
import { nodeProperty } from "../../config/index.js"
import { DEFAULT_PARSEL_IDENTIFIER } from "../../system/index.js";
import { Ca2BlockFormat } from "../index.js";

/**
 * Ca3BlockFormat is just a extension of Ca2BlockFormat.
 * Differences in handling of existing tags with CA2(version: undefined) are:
 * - version: 2.
 * - miner?: Not used. Because the first node signed is a miner
 * - data?: genesis block doesn't have it, however parcel blocks have it
 * - type: genesis block is "genesis", parcel blocks are "parcel_open"/"parcel_close"
 */
export type Ca3BlockFormat = Ca2BlockFormat & {
    _id: string,
    version: number, // 2
    tenant: string,
    height: number,
    size: number,
    data?: objTx[], // genesis block doesn't have it
    type?: string,  // genesis block doesn't have it
    settime: string,
    timestamp: string,
    prev_hash: string,
    signedby: SignedBy,
    signcounter: number,
    hash: string
}

/**
 * The signature format
 */
export type SignedBy = {
    [node_name: string]: string
}

/**
 * The general return format for some CA3 functions
 */
export type Ca3ReturnFormat = {
    status: number,
    detail: string,
    block?: Ca3BlockFormat
}

/**
 * Minimum tracing format, mainly used in rpc
 */
export type Ca3TravelingFormat = {
    trackingId: string,
    block: Ca3BlockFormat
}
/**
 * General tracing format
 */
export type Ca3TravelingIdFormat = {
    [trackingId: string]: {
        finished: boolean,
        stored: boolean,
        timeoutMs: number,
        txOids: string[] | undefined,
        block: Ca3BlockFormat | undefined
    }
}
/**
 * Alternative tracing format
 */
export type Ca3TravelingIdFormat2 = {
    trackingId: string,
    finished: boolean,
    stored: boolean,
    timeoutMs: number,
    txOids: string[] | undefined,
    block: Ca3BlockFormat | undefined
}

/**
 * Stub values for features not supported in the open source version
 */
let common_parsel: string = DEFAULT_PARSEL_IDENTIFIER;

/**
 * List of blocks that started the trip. 
 * Clean up as appropriate, as there is no reliable time to erase.
 */
export let travelingIds: Ca3TravelingIdFormat = {};

/**
 * Normal return method
 * @param response - response contents
 * @returns returns gSuccess instance contains response
 */
function ca3OK<T>(response: T): gResult<T, never> {
    return new gSuccess(response)
}
/**
 * Abnormal return method
 * @param func - set the function/method name
 * @param pos - set the position in the func
 * @param message - set the error message
 * @returns returns gFailure instance contains gError instance
 */
function ca3Error(func: string, pos?: string, message?: string): gResult<never, gError> {
    return new gFailure(new gError("ca3", func, pos, message));
}

/**
 * Clear the list of transactions in traveling. Only for testing.
 */
export function cleanup() {
    travelingIds = {};
}

/**
 * Declare to all nodes that the target transactions are to be blocked.
 * It's under the influence of the timers.
 * @param core - set ccBlockType instance
 * @param trackingId - set the tracking ID to trace
 * @returns returns with gResult, that is wrapped by a Promise, that contains ccBlockType if it's success, and gError if it's failure.
 */
async function declareCreation(core: ccBlockType, trackingId: string): Promise<gResult<ccBlockType, gError>> {
    const LOG = core.log.lib.LogFunc(core.log);
    LOG("Info", 0, "CA3:declareCreation:" + trackingId);

    // Time out checking
    const currentTimeMs = new Date().valueOf();
    if (travelingIds[trackingId] === undefined) {
        return ca3Error("declareCreation", "Timeout", trackingId + " had been timeouted already");
    }
    if (travelingIds[trackingId].timeoutMs <= currentTimeMs) {
        return ca3Error("declareCreation", "Timeout", trackingId + " is timeouted");
    }

    const target: Ca3TravelingIdFormat2 = { ...{trackingId}, ...travelingIds[trackingId] };
    const sObj: systemrpc.ccSystemRpcFormat.AsObject = {
        version: 3,
        request: "DeclareBlockCreation",
        param: undefined,
        dataasstring: JSON.stringify(target)
    }
    let rets: rpcReturnFormat[] = [];

    if (core.i !== undefined) {
        const ret = await core.i.lib.sendRpcAll(core.i, sObj);
        if (ret.isSuccess()) rets = ret.value;
    } else {
        throw new Error("The internode module is down");   
    }
    LOG("Debug", 0, "CA3:declareCreation:result:" + JSON.stringify(rets));
    for (const ret of rets) {
        if (ret.status === 0) {
            if (ret.data === "1") {// Already started
                return ca3Error("declareCreation", "sendRpcAll", "Already started");
            }
        } else {
             // Something error => immediately exclude it
             for (const node of core.i.conf.nodes) {
                if (ret.targetHost === node.host) {
                    node.allow_outgoing = false;
                    node.abnormal_count = core.conf.ca3.abnormalCountForJudging;
                }
            }
        }
    }

    return ca3OK<ccBlockType>(core);
}

/**
 * Add oids to the list of under generation to suppress the generation of blocks at this node.
 * @param core - set ccBlockType instance
 * @param packet - set traveled block and its properties with Ca3TravelingIdFormat2
 * @returns returns with gResult type that contains ccSystemType if it's success, and unknown if it's failure.
 * So there is no need to be concerned about the failure status.
 * On success, if some or all of the sent oids appear to be becoming blocked, it returns negative value.
 * Otherwise, including if it has the same tracking ID, it returns positive value.
 * 
 */
export async function requestToDeclareBlockCreation(core: ccBlockType, packet: Ca3TravelingIdFormat2): Promise<gResult<number, unknown>> {
    const LOG = core.log.lib.LogFunc(core.log);
    LOG("Info", 0, "CA3:requestToDeclareBlockCreation:" + packet.trackingId);

    // Except new (first time) and timeout
    // Checks to see if the sent oid does not exist in the list of oids (idList) that has already been started.
    if (travelingIds[packet.trackingId] === undefined) {
        if ((packet.txOids !== undefined) && (packet.txOids.length !== 0)) {
            const travelings = Object.keys(travelingIds);
            let idList: string[] = [];
            for (const traveling of travelings) {
                const id = travelingIds[traveling].txOids;
                if (id !== undefined) {
                    idList = idList.concat(id);
                }
            }
            for (const id of idList) {
                if ((packet.txOids !== undefined) && (packet.txOids.includes(id))) {
                    LOG("Debug", 0, "CA3:requestToDeclareBlockCreation:duplicate");
                    LOG("Debug", 0, "CA3:requestToDeclareBlockCreation:duplicate:txOids:" + JSON.stringify(packet.txOids));
                    LOG("Debug", 0, "CA3:requestToDeclareBlockCreation:duplicate:idList:" + JSON.stringify(idList));
                    return ca3OK<number>(packet.timeoutMs * -1);
                }
            }
        }
        // register
        travelingIds[packet.trackingId] = {
            finished: packet.finished,
            stored: packet.stored,
            timeoutMs: packet.timeoutMs,
            txOids: packet.txOids,
            block: packet.block
        }
        LOG("Debug", 0, "CA3:requestToDeclareBlockCreation:register:" + JSON.stringify(travelingIds[packet.trackingId]));
        return ca3OK<number>(travelingIds[packet.trackingId].timeoutMs);
    } else { // For retry request, from same node with same trackingId, update the timeout
        LOG("Debug", 0, "CA3:requestToDeclareBlockCreation:retry");
        travelingIds[packet.trackingId].timeoutMs = packet.timeoutMs;
        return ca3OK<number>(travelingIds[packet.trackingId].timeoutMs);
    }
}

/**
 * Create one block.
 * It's under the influence of the timers.
 * @param core - set ccBlockType instance
 * @param pObj - set previous block
 * @param data - set transaction data to block 
 * @param trackingId - set the tracking ID to trace
 * @param __t -  in open source version, it must be equal to DEFAULT_PARSEL_IDENTIFIER
 * @param blockOptions - can set options by createBlockOptions
 * @returns returns with gResult, that is wrapped by a Promise, that contains the result with Ca3BlockFormat if it's success, and gError if it's failure.
 */
function packTxsToANewBlockObject(core: ccBlockType, pObj: Ca3BlockFormat | undefined, data: any, 
    trackingId: string, __t: string, blockOptions?: createBlockOptions): gResult<Ca3ReturnFormat, gError> {
    const LOG = core.log.lib.LogFunc(core.log);
    LOG("Info", 0, "CA3:packTxsToANewBlockObject:" + trackingId);

    // Time out checking
    const currentTimeMs = new Date().valueOf();
    if (travelingIds[trackingId] === undefined) {
        return ca3Error("packTxsToANewBlockObject", "Timeout", trackingId + " had been timeouted already");
    }
    if (travelingIds[trackingId].timeoutMs <= currentTimeMs) {
        return ca3Error("packTxsToANewBlockObject", "Timeout", trackingId + " is timeouted");
    }

    if (blockOptions === undefined) {
        blockOptions = { type: "data" }
    }

    let ret: Ca3ReturnFormat = {
        status: 0,
        detail: "",
        block: undefined
    }

    const dateTime = new Date();
    const stringDateTime: string = dateTime.toLocaleString();
    const timestamp: string = dateTime.valueOf().toString();

    let bObj: Ca3BlockFormat;
    let hObj: any;
    const oidVal = { _id: randomOid().byStr() };

    switch (blockOptions.type) {
        case "genesis":
            hObj = {
                version: 2,
                tenant: common_parsel,
                height: 0,
                size: 0,
                type: "genesis",
                settime: stringDateTime,
                timestamp: timestamp,
                prev_hash: "0",
                signedby: {},
                signcounter: core.conf.ca3.maxSignNodes
            }
            break;
        case "parsel_open":
            if (pObj === undefined) {
                return ca3Error("packTxsToANewBlockObject", "createBlock", "Creating parsel_open block must requires previous block information");
            }
            hObj = {
                version: 2,
                tenant: __t,
                height: pObj.height + 1,
                size: 1,
                data: data,
                type: "parsel_open",
                settime: stringDateTime,
                timestamp: timestamp,
                prev_hash: pObj.hash,
                signedby: {},
                signcounter: core.conf.ca3.maxSignNodes
            }
            break;
        case "parsel_close":
            if (pObj === undefined) {
                return ca3Error("packTxsToANewBlockObject", "createBlock", "Creating parsel_close block must requires previous block information");
            }
            hObj = {
                version: 2,
                tenant: __t,
                height: pObj.height + 1,
                size: 0,
                type: "parsel_close",
                settime: stringDateTime,
                timestamp: timestamp,
                prev_hash: pObj.hash,
                signedby: {},
                signcounter: core.conf.ca3.maxSignNodes
            }
            break;
        default: // data(normal) block
            if (pObj === undefined) {
                return ca3Error("packTxsToANewBlockObject", "createBlock", "Creating data block must requires previous block information");
            }
            hObj = {
                version: 2,
                tenant: __t,
                height: pObj.height + 1,
                size: data.length,
                data: data,
                type: "data",
                settime: stringDateTime,
                timestamp: timestamp,
                prev_hash: pObj.hash,
                signedby: {},
                signcounter: core.conf.ca3.maxSignNodes
            }
            break;
    }

    const hashVal: string = createHash('sha256').update(JSON.stringify(hObj)).digest('hex');
    const hashObj = { hash: hashVal };
    bObj = {...oidVal, ...hObj, ...hashObj};

    ret.block = bObj;
    return ca3OK<Ca3ReturnFormat>(ret);
}

/**
 * Sign for the entire object and insert the result.
 * It's under the influence of the timers.
 * @param core - set ccBlockType instance
 * @param bObj - set target object to sign
 * @param trackingId - set tracking ID to trace
 * @returns returns with gResult, that is wrapped by a Promise, that contains the object and its status as Ca3ReturnFormat if it's success, and gError if it's failure.
 */
async function signTheBlockObject(core: ccBlockType, bObj: Ca3BlockFormat, trackingId: string): Promise<gResult<Ca3ReturnFormat, gError>> {
    const LOG = core.log.lib.LogFunc(core.log);
    LOG("Info", 0, "CA3:signTheBlockObject:" + trackingId);

    // Time out checking
    const currentTimeMs = new Date().valueOf();
    if (travelingIds[trackingId] === undefined) {
        return ca3Error("signTheBlockObject", "Timeout", trackingId + " had been timeouted already");
    }
    if (travelingIds[trackingId].timeoutMs <= currentTimeMs) {
        return ca3Error("signTheBlockObject", "Timeout", trackingId + " is timeouted");
    }

    if ((core.i !== undefined) && (core.k !== undefined)) {
        // Calculate with whole object
        const ret1 = await core.k.lib.signByPrivateKey(core.k, bObj, trackingId);
        if (ret1.isFailure()) return ret1;

        bObj.signcounter--;
        bObj.signedby[core.i.conf.self.nodename] = ret1.value;
    } else {
        return ca3Error("signTheBlockObject", "signByPrivateKey", "The internode module or keyring module is down");
    }

    let ret: Ca3ReturnFormat = {
        status: 0,
        detail: "",
        block: bObj
    }

    return ca3OK<Ca3ReturnFormat>(ret);
}

/**
 * Send blocks to other nodes for signing.
 * It's under the influence of the timers of this node or sent node.
 * @param core - set ccBlockType instance
 * @param bObj - set the target object with Ca3BlockFormat
 * @param trackingId - set trackingId to trace
 * @returns returns with gResult, that is wrapped by a Promise, that contains the object and its status as Ca3ReturnFormat if it's success, and gError if it's failure.
 */
async function sendTheBlockObjectToANode(core: ccBlockType, bObj: Ca3BlockFormat, trackingId: string): Promise<gResult<Ca3ReturnFormat, gError>> {
    const LOG = core.log.lib.LogFunc(core.log);
    LOG("Info", 0, "CA3:sendTheBlockObjectToANode:" + trackingId);

    // Time out checking
    const currentTimeMs = new Date().valueOf();
    if (travelingIds[trackingId] === undefined) {
        return ca3Error("sendTheBlockObjectToANode", "Timeout", trackingId + " had been timeouted already");
    }
    if (travelingIds[trackingId].timeoutMs <= currentTimeMs) {
        return ca3Error("sendTheBlockObjectToANode", "Timeout", trackingId + " is timeouted");
    }

    const tObj: Ca3TravelingFormat = {
        trackingId: trackingId,
        block: bObj
    }

    if (core.i !== undefined) {
        const ret1 = await tryToSendToSign(core, tObj, core.i.conf.nodes, trackingId);
        if (ret1.isFailure()) return ret1;
    }

    let ret2: Ca3ReturnFormat = {
        status: 0,
        detail: "",
        block: undefined
    }

    if (travelingIds[trackingId].stored === true) {
        LOG("Debug", 0, "CA3:sendTheBlockObjectToANode:stored:" + trackingId);
        ret2.block = travelingIds[trackingId].block;
    } else {
        if (travelingIds[trackingId].finished === true) {
            LOG("Debug", 0, "CA3:sendTheBlockObjectToANode:finishedWithFail:" + trackingId);
        }
    }

    return ca3OK<Ca3ReturnFormat>(ret2);
}

/**
 * Random transmission for signatures. 
 * In case of failure, increase the destination error value and perform random transmission again. 
 * It's under the influence of the timers of this node or sent node. 
 * @param core - set ccBlockType instance
 * @param tObj - set the target object with Ca3BlockFormat
 * @param nodes - set target nodes for random transmission
 * @param trackingId - set trackingId to trace
 * @returns returns with gResult, that is wrapped by a Promise, that contains boolean if it's success, and gError if it's failure.
 * On success, the value means whether or not the block should be prompted to save. But at the source node it does not save always, so it doesn't make sense.
 */
async function tryToSendToSign(core: ccBlockType, tObj: Ca3TravelingFormat, 
    nodes: nodeProperty[], trackingId: string): Promise<gResult<boolean, gError>> {
    const LOG = core.log.lib.LogFunc(core.log);
    LOG("Info", 0, "CA3:tryToSendToSign:" + trackingId);
    LOG("Debug", 0, "CA3:tryToSendToSign:object:" + JSON.stringify(tObj));


    // Time out checking
    const currentTimeMs = new Date().valueOf();
    if (travelingIds[trackingId] === undefined) {
        return ca3Error("tryToSendToSign", "Timeout", trackingId + " had been timeouted already");
    }
    if (travelingIds[trackingId].timeoutMs <= currentTimeMs) {
        return ca3Error("tryToSendToSign", "Timeout", trackingId + " is timeouted");
    }

    const sObj: systemrpc.ccSystemRpcFormat.AsObject = {
        version: 3,
        request: "SignAndResendOrStore",
        param: undefined,
        dataasstring: JSON.stringify(tObj)
    };
    let ret1: rpcReturnFormat = {
        targetHost: "",
        request: "",
        status: -1,
        data: undefined
    };

    let nodes2 = clone(nodes);
    while (nodes2.length > 0) {
        const index = Math.floor(Math.random() * nodes2.length);
        let node = nodes2[index];
        if ((node.abnormal_count !== undefined) && (node.abnormal_count >= core.conf.ca3.abnormalCountForJudging)) {
            nodes2.splice(index, 1);
        } else {
            if (core.i !== undefined) {
                const ret2 = await core.i.lib.sendRpc(core.i, node, sObj, travelingIds[trackingId].timeoutMs);
                if (ret2.isFailure()) return ret2;
                ret1 = ret2.value;
            }
            if (ret1.status === 0) {
                break; // It's normal
            } else {
                if (node.abnormal_count !== undefined) {
                    node.abnormal_count++;
                } else {
                    node.abnormal_count = 1;
                }
                if (ret1.status === 4) { // timeout
                    return ca3Error("tryToSendToSign", "sendRpc", "Time out occured on " + trackingId);
                }
            }
        }
    }
    if (nodes2.length  > 0) {
        // Unprompted save
        LOG("Info", 0, "CA3:tryToSendToSign:" + trackingId + ":SentSucceeded");
        return ca3OK<boolean>(false);
    } else { // Prompted save
        LOG("Info", 0, "CA3:tryToSendToSign:" + trackingId + ":SentFailed");
        return ca3OK<boolean>(true);
    }
}

/**
 * Sign the block sent to this node and send them to another node or store it in the blockchain.
 * It's under the influence of the timers of sent node.
 * @param core - set ccBlockType instance
 * @param tObj - set target object with Ca3TravelingFormat
 * @returns returns with gResult, that is wrapped by a Promise, that contains number if it's success, and gError if it's failure.
 * On success, the return value has the following meaning:
 * - 1000s: Discard the block since the verification was failed
 * - 2000s: Discard the block since the signature was failed
 * - 3000s: Discard the block since it has insufficient number of signature and sending to other node was failed
 * - negative: Save the block successfully, however sending for some of nodes are failed
 * - 0: Save the block successfully, and sending for all of nodes are succeeded
 */
export async function requestToSignAndResendOrStore(core: ccBlockType, tObj: Ca3TravelingFormat): Promise<gResult<number, gError>> {
    const LOG = core.log.lib.LogFunc(core.log);
    LOG("Info", 0, "CA3:requestToSignAndResendOrStore:" + tObj.trackingId);

    const ret1 = await verifyABlock(core, tObj.block, tObj.trackingId);
    if (ret1.isFailure()) return ret1;
    if (ret1.value.status !== 0) {
        LOG("Notice", 0, "Discard the block " + tObj.trackingId + " that the verification was failed");
        return ca3OK<number>(1000 + ret1.value.status);
    }

    const ret2 = await signTheBlockObject(core, tObj.block, tObj.trackingId);
    if (ret2.isFailure()) return ret2;
    if ((ret2.value.status !== 0) || (ret2.value.block === undefined)) {
        LOG("Notice", 0, "Discard the block " + tObj.trackingId + " that the signature was failed");
        return ca3OK<number>(2000 + ret2.value.status);
    }

    let storeBlock: boolean = false;
    if (ret2.value.block.signcounter > 0) {
        const nameList = Object.keys(tObj.block.signedby);
        if (core.i !== undefined) {
            let nodes: nodeProperty[] = [];
            // Exclude nodes that have already passed
            for (const node of core.i.conf.nodes) {
                if (nameList.includes(node.nodename) === false){
                    nodes.push(node);
                }
            }
            const ret3 = await tryToSendToSign(core, tObj, nodes, tObj.trackingId);
            if (ret3.isFailure()) return ret3;
            storeBlock = ret3.value;
            if ((storeBlock === true) && (nameList.length < core.conf.ca3.minSignNodes)) {
                LOG("Notice", 0, "Discard the block " + tObj.trackingId + " that it has insufficient number of signature and sending to other node was failed");
                return ca3OK<number>(3000);
            }
        } else {
            if (nameList.length >= core.conf.ca3.minSignNodes) {
                storeBlock = true;
                LOG("Warning", 0, "The internode module is down. Try to save the block " + tObj.trackingId);
            } else {
                storeBlock = false;
                LOG("Notice", 0, "Discard the block " + tObj.trackingId + " that it has insufficient number of signature and the internode module is down");
                return ca3Error("requestToSignAndResendOrStore", "tryToSendToSign", "The internode module is down");
            }
        }
    } else {
        storeBlock = true;
    }
    if (storeBlock === true) { // It's a final destination
        // Save the block on this node
        if (core.s !== undefined) {
            const ret5 = await core.s.lib.requestToAddBlock(core.s, tObj.block, true, tObj.trackingId);
            if (ret5.isFailure()) return ret5;
        } else {
            return ca3Error("requestToSignAndResendOrStore", "requestToAddBlock", "The system module is down");
        }
        if ((core.i !== undefined) && (core.i.conf.nodes.length > 0)) {
            let failcnt: number = 0; // remote
            // Save the block on all remote node
            const sObj: systemrpc.ccSystemRpcFormat.AsObject = {
                version: 3,
                request: "AddBlockCa3",
                param: { removepool: true },
                dataasstring: JSON.stringify(tObj)
            }
            let rets: rpcReturnFormat[] = [];
            if (core.i !== undefined) {
                const ret6 = await core.i.lib.sendRpcAll(core.i, sObj);
                if (ret6.isSuccess()) rets = ret6.value;
            } else {
                return ca3Error("requestToSignAndResendOrStore", "sendRpcAll", "The internode module is down");
            }
    
            for (const ret of rets) {
                if (ret.status !== 0) failcnt--;
            }
            return ca3OK<number>(failcnt); // If non-zero, conditional OK
        } else {
            return ca3Error("requestToSignAndResendOrStore", "sendRpcAll", "The internode module is down");
        }
    }
    return ca3OK<number>(0); // If non-zero, conditional OK
}

/**
 * Verify the block.
 * It may be affected by the timer.
 * @param core - set ccBlockType instance
 * @param bObj - set the target block with Ca3BlockFormat
 * @param trackingId - set trackingId to trace
 * @returns returns with gResult, that is wrapped by a Promise, that contains the object and its status as Ca3ReturnFormat if it's success, and gError if it's failure.
 */
export async function verifyABlock(core: ccBlockType, bObj: Ca3BlockFormat, trackingId?: string): Promise<gResult<Ca3ReturnFormat, gError>> {
    const LOG = core.log.lib.LogFunc(core.log);
    if (trackingId === undefined) {
        LOG("Info", 0, "CA3:verifyABlock");
    } else {
        LOG("Info", 0, "CA3:verifyABlock:" + trackingId);

        // Time out checking
        const currentTimeMs = new Date().valueOf();
        if (travelingIds[trackingId] === undefined) {
            return ca3Error("verifyABlock", "Timeout", trackingId + " had been timeouted already");
        }
        if (travelingIds[trackingId].timeoutMs <= currentTimeMs) {
            return ca3Error("verifyABlock", "Timeout", trackingId + " is timeouted");
        }
    }

    try {
        if (bObj.hash === undefined) {
            LOG("Warning", 0, "verifyBlock verified a illegal block or empty block");
            return ca3Error("verifyABlock", "illegalBlock", "illegal block or empty block");
        }
    } catch (error) {
        LOG("Warning", 0, "verifyBlock verified a illegal block or empty block");
        return ca3Error("verifyABlock", "illegalData", "illegal block or empty block");
    }

    // verifyAllSignatures modifies the block so that it returns the original
    // NOTE: it returns OK with non zero status when the block verification is failed
    const cObj = clone(bObj);
    const ret1 = await verifyAllSignatures(core, cObj, trackingId);
    if (ret1.isFailure()) return ret1;
    ret1.value.block = bObj;

    // needs special attention
    if (trackingId !== undefined) {
        travelingIds[trackingId].finished = true;
        if (ret1.value.status === 0) {
            travelingIds[trackingId].block = bObj;
        } else {
            travelingIds[trackingId].block = undefined;
        }
    }

    return ca3OK(ret1.value);
}


/**
 * Verify digital signatures in sequence and finally verify the hash.
 * It may be affected by the timer.
 * @param core - set ccBlockType instance
 * @param bObj - set the target block with Ca3BlockFormat
 * @param trackingId - set trackingId to trace
 * @returns returns with gResult, that is wrapped by a Promise, that contains the object and its status as Ca3ReturnFormat if it's success, and gError if it's failure.
 */
async function verifyAllSignatures(core: ccBlockType, bObj: Ca3BlockFormat, trackingId?: string): Promise<gResult<Ca3ReturnFormat, gError>> {
    const LOG = core.log.lib.LogFunc(core.log);
    if (trackingId === undefined) {
        LOG("Info", 0, "CA3:verifyAllSignatures");
    } else {
        LOG("Info", 0, "CA3:verifyAllSignatures:" + trackingId);
    }

    let statusshift = 0;
    let ret1: Ca3ReturnFormat = {
        status: 0,
        detail: "",
        block: undefined
    }

    LOG("Debug", 0, "CA3:verifyAllSignatures:signcount:" + bObj.signcounter);

    // ed25519 by each node
    const nameList = clone(Object.keys(bObj.signedby));
    LOG("Debug", 0, "CA3:verifyAllSignatures:" + JSON.stringify(bObj));
    let ret2: boolean = false;
    while (true) {
        const name = nameList.pop();
        if (name === undefined) {
            break;
        }
        if (core.k !== undefined) {
            statusshift++;
            bObj.signcounter++;
            const signature = clone(bObj.signedby[name]);
            delete bObj.signedby[name];
            const ret3 = await core.k.lib.verifyByPublicKey(core.k, signature, bObj, name, trackingId);
            if (ret3.isFailure()) return ret3;
            ret2 = ret3.value;
        }
        if (ret2 === false) {
            ret1.status = 3 * statusshift * 10;
            ret1.detail = "CA3:verifyAllSignatures:" + name + ":ResultFailed";
            LOG("Warning", ret1.status, ret1.detail);
            return ca3OK<Ca3ReturnFormat>(ret1);
        } else {
            ret1.status = 0;
            ret1.detail = "CA3:verifyAllSignatures:" + name + ":OK";
            LOG("Info", ret1.status, ret1.detail);
        }
    }

    // initial sha256
    const hObj: any = clone(bObj);
    delete hObj._id;
    delete hObj.hash;
    ret1.detail = "CA3:verifyAllSignatures:sha256:" + JSON.stringify(hObj);
    const hashVal: string = createHash('sha256').update(JSON.stringify(hObj)).digest('hex');
    if (hashVal === bObj.hash) {
        ret1.status = 0
        ret1.detail = "CA3:verifyAllSignatures:sha256:OK"
        ret1.block = bObj;
        LOG("Info", ret1.status, ret1.detail);
    } else {
        ret1.status = 3;
        ret1.detail = "CA3:verifyAllSignatures:sha256:ResultFailed";
        ret1.block = undefined;
        LOG("Warning", ret1.status, ret1.detail);
    }
    return ca3OK<Ca3ReturnFormat>(ret1);
}

/**
 * Set up the block generator
 * @param core - set ccBlockType instance
 * @param data - set target transactions
 * @param startTimeMs - set starting time in ms
 * @param lifeTimeMs - set life time against starting time in ms
 * @param trackingId - set trackingId to trace
 * @param commonId - in open source version, it must be undefined or equal to DEFAULT_PARSEL_IDENTIFIER
 * @returns returns with gResult type that contains the trackingId of the starting process if it's success, and unknown if it's failure.
 * So there is no need to be concerned about the failure status.
 */
export function setupCreator(core: ccBlockType, data: objTx[] | undefined, startTimeMs: number, lifeTimeMs: number, trackingId: string, commonId?: string): gResult<string, unknown> {
    const LOG = core.log.lib.LogFunc(core.log);
    LOG("Info", 0, "CA3:setupCreator");

    // Overwrite common_parsel value if specified
    if (commonId !== undefined) common_parsel = commonId;
    
    // Delete timeouted travelingIds
    for (const traveling_id of Object.keys(travelingIds)) {
        if (travelingIds[traveling_id].timeoutMs < startTimeMs) {
            delete travelingIds[traveling_id];
        }
    }

    const timeoutMs = startTimeMs + lifeTimeMs;
    if (travelingIds[trackingId] === undefined) {
        // The target oids
        let oidList: string[] | undefined = [];
        if ((data !== undefined) && (data.length !== 0)) {
            let tx: any;
            for (tx of data) {
                oidList.push(tx._id.toString());
            }
        } else {
            oidList = undefined;
        }
        // generate new tracking ID and register
        travelingIds[trackingId] = {
            finished: false,
            stored: false,
            timeoutMs: timeoutMs,
            txOids: oidList,
            block: undefined
        }
    } else {
        // update exiting tracking ID
        travelingIds[trackingId].timeoutMs = timeoutMs;
    }

    return ca3OK<string>(trackingId);
}

/**
 * The main routine that generates the block.
 * It's under the influence of the timers.
 * @param core - set ccBlockType instance
 * @param pObj - set the provous block to get some information
 * @param data - set the target transactions for blocking
 * @param trackingId - set trackingId to trace
 * @param __t - in open source version, it must be equal to DEFAULT_PARSEL_IDENTIFIER
 * @param blockOptions - can set blocking options with createBlockOptions
 * @returns returns with gResult, that is wrapped by a Promise, that contains the object and its status as Ca3ReturnFormat if it's success, and gError if it's failure.
 */
export async function proceedCreator(core: ccBlockType, pObj: Ca3BlockFormat | undefined, data: any, 
    trackingId: string, __t: string, blockOptions?: createBlockOptions): Promise<gResult<Ca3ReturnFormat, gError>> {
    const LOG = core.log.lib.LogFunc(core.log);
    LOG("Info", 0, "CA3:proceedCreator");
    
    if (blockOptions === undefined) {
        blockOptions = { type: "data" }
    }
    let ret1: Ca3ReturnFormat = {
        status: 0,
        detail: ""
    };

    // The target oids
    let oidList: string[] = [];
    if (data !== undefined) {
        for (const tx of data) {
            oidList.push(tx._id.toString());
        }
    }
    // suppression request => have the parameter adjusted according to the result
    const ret2 = await declareCreation(core, trackingId);
    if (ret2.isFailure()) {
        travelingIds[trackingId].finished = true;
        travelingIds[trackingId].block = undefined;
        return ret2;
    }
    core = ret2.value;

    // block creation
    const ret3 = packTxsToANewBlockObject(core, pObj, data, trackingId, __t, blockOptions);
    if (ret3.isFailure()) {
        travelingIds[trackingId].finished = true;
        travelingIds[trackingId].block = undefined;
        return ret3;
    }
    ret1 = ret3.value;
    
    if (ret1.block === undefined) return ca3Error("proceedCreator", "packTxsToANewBlockObject", "unknown error");

    // signed by this node
    const ret4 = await signTheBlockObject(core, ret1.block, trackingId);
    if (ret4.isFailure()) {
        travelingIds[trackingId].finished = true;
        travelingIds[trackingId].block = undefined;
        return ret4;
    }
    ret1 = ret4.value;

    if (ret1.block === undefined) return ca3Error("proceedCreator", "signTheBlockObject", "unknown error");
                
    // send out to get signatures
    // => a request is made at the terminating node to process the registration to the BC
    // => one of the blocks that has been signed comes back to this BC for registration
    // => verify the returned block
    // => if it is OK, it is returned
    const ret5 = await sendTheBlockObjectToANode(core, ret1.block, trackingId);
    if (ret5.isFailure()) {
        travelingIds[trackingId].finished = true;
        travelingIds[trackingId].block = undefined;
        return ret5;
    }
    ret1 = ret5.value;
    
    return ca3OK<Ca3ReturnFormat>(ret1);
}

/**
 * Close the transaction that was being traced since the block was stored
 * @param trackingId - the trackingId to close
 */
export function closeATransaction(trackingId: string) {
    try {
        travelingIds[trackingId].stored = true;
    } catch (error) {
        // do nothing
    }
}
