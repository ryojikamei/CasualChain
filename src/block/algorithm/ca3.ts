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
import { inAddBlockDataFormat, rpcResultFormat } from "../../internode/index.js";

import { randomOid } from "../../utils.js"
import { nodeProperty } from "../../config/index.js"
import { Ca2BlockFormat } from "../index.js";
import ic from "../../../grpc/interconnect_pb.js";

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
 * The state of the packet being traveled
 * preparation: Still only registered
 * underway: Processing in progress
 * arrived: Either way, the process is finished
 */
export type travelingState = "preparation" | "underway" | "arrived"
/**
 * General tracing format
 */
export type Ca3TravelingIdFormat = {
    [trackingId: string]: {
        state: travelingState,
        stored: boolean,
        timeoutMs: number,
        type: string,
        tenant: string,
        txOids: string[],
        block: Ca3BlockFormat | undefined
    }
}
/**
 * Alternative tracing format
 */
export type Ca3TravelingIdFormat2 = {
    trackingId: string,
    state: travelingState,
    stored: boolean,
    timeoutMs: number,
    type: string,
    tenant: string,
    txOids: string[],
    block: Ca3BlockFormat | undefined
}

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
    const LOG = core.log.lib.LogFunc(core.log, "CA3", "declareCreation");
    LOG("Info", "start:" + trackingId);

    // Time out checking
    const currentTimeMs = new Date().valueOf();
    if (travelingIds[trackingId] === undefined) {
        return ca3Error("declareCreation", "Timeout", trackingId + " had been timeouted already");
    }
    if (travelingIds[trackingId].timeoutMs <= currentTimeMs) {
        return ca3Error("declareCreation", "Timeout", trackingId + " is timeouted");
    }

    // check whether they have been already started by another node or not
    const oids = travelingIds[trackingId].txOids;
    const travelings = Object.keys(travelingIds);
    for (const travelingId of travelings) {
        if (travelingId === trackingId) continue; // self
        for (const oid of oids) {
            if (travelingIds[travelingId].txOids.includes(oid)) {
                return ca3Error("declareCreation", "checkDeclaration", "Already started"); // NOTE: This string is referenced in the upper layers
            }
        }

    }

    if (core.i === undefined) { return ca3Error("declareCreation", "runRpcs", "The internode module is down"); }

    const request = "DeclareBlockCreation";
    const data: Ca3TravelingIdFormat2 = { ...{trackingId}, ...travelingIds[trackingId] };
    let results: rpcResultFormat[] = [];
    const ret = await core.i.lib.runRpcs(core.i, core.i.conf.nodes, request, JSON.stringify(data));
    if (ret.isFailure()) { return ret }
    results = ret.value;

    LOG("Debug", "results:" + JSON.stringify(results));
    let errorNodes: string[] = [];
    let returnError: gResult<never, gError> | undefined;
    for (const result of results) {
        try {
            if (result.result.isFailure()) {
                errorNodes.push(result.node.nodename);
            } else {
                const payload = result.result.value.getPayload()?.toObject();
                if (payload === undefined) {
                    errorNodes.push(result.node.nodename);
                } else {
                    switch (payload.payloadType) {
                        case ic.payload_type.RESULT_SUCCESS:
                            if (payload.dataAsString !== undefined) {
                                const data = Number(payload.dataAsString);
                                if (data < 0) {
                                    returnError = ca3Error("declareCreation", "runRpcs", "Already started"); // NOTE: This detail string is referenced in the upper layers
                                }
                            } else {
                                errorNodes.push(result.node.nodename);
                            }
                            break;
                        case ic.payload_type.RESULT_FAILURE:
                            // It will be occured when the other node cannot interpret a packets sent by this node or a node impersonating this node.
                            // It should be ignored.
                            LOG("Info", "an unknown packet is delivered to " + result.node.nodename + " or this node.");
                            break;
                        default:
                            errorNodes.push(result.node.nodename);
                            break;
                    }
                }
            }
        } catch (error) {
            errorNodes.push(result.node.nodename);
        }
    }

    // Something error => need attension
    core.i.lib.disableAbnormalNodes(core.i, errorNodes);
    
    if (returnError !== undefined) { return returnError; }
    return ca3OK<ccBlockType>(core);
}

/**
 * Add oids to the list of under generation to suppress the generation of blocks at this node.
 * @param core - set ccBlockType instance
 * @param packet - set traveled block and its properties with Ca3TravelingIdFormat2
 * @returns returns with gResult type that contains ccSystemType if it's success, and gError if it's failure.
 * On success, if some or all of the sent oids appear to be becoming blocked, it returns negative value.
 * Otherwise, including if it has the same tracking ID, it returns positive value.
 * 
 */
export async function requestToDeclareBlockCreation(core: ccBlockType, packet: Ca3TravelingIdFormat2): Promise<gResult<number, gError>> {
    const LOG = core.log.lib.LogFunc(core.log, "CA3", "requestToDeclareBlockCreation");
    LOG("Info", "start:" + packet.trackingId);

    // Except new (first time) and timeout
    // Checks to see if the sent oid does not exist in the list of oids (idList) that has already been started.
    if (travelingIds[packet.trackingId] === undefined) {
        const travelings = Object.keys(travelingIds);
        switch (packet.type) {
            case "data":
                let idList: string[] = [];
                for (const traveling of travelings) {
                    if (travelingIds[traveling].type !== "data") { continue };
                    if (travelingIds[traveling].state !== "preparation") {
                        idList = idList.concat(travelingIds[traveling].txOids);
                    }
                }
                for (const id of idList) {
                    if (packet.txOids.includes(id)) {
                        LOG("Info", "Cancelled due to duplication of some oids");
                        LOG("Debug", "duplicate:txOids:" + JSON.stringify(packet.txOids));
                        LOG("Debug", "duplicate:idList:" + JSON.stringify(idList));
                        return ca3OK<number>(-101);
                    }
                }
                break;
            case "genesis":
            case "parcel_open":
            case "parcel_close":
                for (const traveling of travelings) {
                    if (travelingIds[traveling].type !== packet.type) { continue };
                    if ((travelingIds[traveling].state !== "preparation") && (travelingIds[traveling].tenant === packet.tenant)) {
                        LOG("Info", "Cancelled due to collision of " + packet.type +  " block creation");
                        return ca3OK<number>(-102);
                    }
                }
                break;
            default:
                LOG("Info", "Unknown packet type " + packet.type);
                return ca3Error("requestToDeclareBlockCreation", "packetType", "Unknown packet type " + packet.type);
        }
        // register
        travelingIds[packet.trackingId] = {
            state: "underway",
            stored: packet.stored,
            timeoutMs: packet.timeoutMs,
            type: packet.type,
            tenant: packet.tenant,
            txOids: packet.txOids,
            block: packet.block
        }
        LOG("Debug", "register:" + JSON.stringify(travelingIds[packet.trackingId]));
        return ca3OK<number>(101);
    } else { // For retry request, from same node with same trackingId, update the timeout
        LOG("Debug", "retry");
        travelingIds[packet.trackingId].timeoutMs = packet.timeoutMs;
        return ca3OK<number>(102);
    }
}

/**
 * Create one block.
 * It's under the influence of the timers.
 * @param core - set ccBlockType instance
 * @param pObj - set previous block
 * @param data - set transaction data to block 
 * @param trackingId - set the tracking ID to trace
 * @param tenantId -  in open source version, it must be equal to DEFAULT_parcel_IDENTIFIER
 * @param blockOptions - can set options by createBlockOptions
 * @returns returns with gResult, that is wrapped by a Promise, that contains the result with Ca3BlockFormat if it's success, and gError if it's failure.
 */
function packTxsToANewBlockObject(core: ccBlockType, pObj: Ca3BlockFormat | undefined, data: any, 
    trackingId: string, tenantId: string, blockOptions?: createBlockOptions): gResult<Ca3ReturnFormat, gError> {
    const LOG = core.log.lib.LogFunc(core.log, "Block", "packTxsToANewBlockObject");
    LOG("Info", "start:" + trackingId);

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
                tenant: core.conf.default_tenant_id,
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
        case "parcel_open":
            if (pObj === undefined) {
                return ca3Error("packTxsToANewBlockObject", "createBlock", "Creating parcel_open block must requires previous block information");
            }
            hObj = {
                version: 2,
                tenant: tenantId,
                height: pObj.height + 1,
                size: 1,
                data: data,
                type: "parcel_open",
                settime: stringDateTime,
                timestamp: timestamp,
                prev_hash: pObj.hash,
                signedby: {},
                signcounter: core.conf.ca3.maxSignNodes
            }
            break;
        case "parcel_close":
            if (pObj === undefined) {
                return ca3Error("packTxsToANewBlockObject", "createBlock", "Creating parcel_close block must requires previous block information");
            }
            hObj = {
                version: 2,
                tenant: tenantId,
                height: pObj.height + 1,
                size: 0,
                type: "parcel_close",
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
                tenant: tenantId,
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
    const LOG = core.log.lib.LogFunc(core.log, "CA3", "signTheBlockObject");
    LOG("Info", "start:" + trackingId);

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
    const LOG = core.log.lib.LogFunc(core.log, "CA3", "sendTheBlockObjectToANode");
    LOG("Info", "start:" + trackingId);

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
        LOG("Debug", "stored:" + trackingId);
        ret2.block = travelingIds[trackingId].block;
    } else {
        if (travelingIds[trackingId].state === "arrived") {
            LOG("Debug", "finishedWithFail:" + trackingId);
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
    const LOG = core.log.lib.LogFunc(core.log, "CA3", "tryToSendToSign");
    LOG("Info", "start:" + trackingId);
    LOG("Debug", "object:" + JSON.stringify(tObj));


    // Time out checking
    const currentTimeMs = new Date().valueOf();
    if (travelingIds[trackingId] === undefined) {
        return ca3Error("tryToSendToSign", "Timeout", trackingId + " had been timeouted already");
    }
    if (travelingIds[trackingId].timeoutMs <= currentTimeMs) {
        return ca3Error("tryToSendToSign", "Timeout", trackingId + " is timeouted");
    }

    if (core.i === undefined) { return ca3Error("tryToSendToSign", "runRpcs", "The internode module is down"); }

    const request = "SignAndResendOrStore";
    const data: Ca3TravelingFormat = tObj;
    let results: rpcResultFormat[] = [];

    let nodes2 = clone(nodes);
    let errorNodes: string[] = [];
    let breakLoop: boolean = false;
    while (true) {
        const index = Math.floor(Math.random() * nodes2.length);
        let node = nodes2[index];
        if ((node.abnormal_count !== undefined) && (node.abnormal_count >= core.i.conf.abnormalCountForJudging)) {
            nodes2.splice(index, 1);
        } else {
            const ret = await core.i.lib.runRpcs(core.i, [node], request, JSON.stringify(data));
            if (ret.isFailure()) {
                errorNodes.push(node.nodename);
            } else {
                results = ret.value;
            }
            try {
                if (results[0].result.isFailure()) {
                    errorNodes.push(node.nodename);
                } else {
                    const payload = results[0].result.value.getPayload()?.toObject();
                    if (payload === undefined) {
                        errorNodes.push(node.nodename);
                    } else {
                        switch (payload.payloadType) {
                            case ic.payload_type.RESULT_SUCCESS:
                                if (payload.dataAsString !== undefined) {
                                    const data = Number(payload.dataAsString);
                                    if (data <= 0) { // The other node saved the block anyway
                                        breakLoop = true;
                                    } else { // The other node discarded the block
                                        errorNodes.push(node.nodename);
                                    }
                                } else {
                                    errorNodes.push(node.nodename);
                                }
                                break;
                            case ic.payload_type.RESULT_FAILURE:
                                errorNodes.push(node.nodename);
                                break;
                            default:
                                errorNodes.push(node.nodename);
                                break;
                        }
                    }
                }
            } catch (error) {
                errorNodes.push(node.nodename);
            }
        }
        if ((breakLoop === true) || (nodes2.length === 0)) { break; }
    }

    // Something error => need attension
    core.i.lib.disableAbnormalNodes(core.i, errorNodes);

    if (nodes2.length  > 0) {
        // Unprompted save
        LOG("Info", trackingId + ":SentSucceeded");
        return ca3OK<boolean>(false);
    } else { // Prompted save
        LOG("Info", trackingId + ":SentFailed");
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
    const LOG = core.log.lib.LogFunc(core.log, "CA3", "requestToSignAndResendOrStore");
    LOG("Info", "start:" + tObj.trackingId);

    const ret1 = await verifyABlock(core, tObj.block, tObj.trackingId);
    if (ret1.isFailure()) return ret1;
    if (ret1.value.status !== 0) {
        LOG("Notice", "Discard the block " + tObj.trackingId + " that the verification was failed");
        return ca3OK<number>(1000 + ret1.value.status);
    }

    const ret2 = await signTheBlockObject(core, tObj.block, tObj.trackingId);
    if (ret2.isFailure()) return ret2;
    if ((ret2.value.status !== 0) || (ret2.value.block === undefined)) {
        //LOG("Notice", "Discard the block " + tObj.trackingId + " that the signature was failed");
        LOG("Warning", "Unknwon status:" + (2000 + ret2.value.status).toString());
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
                LOG("Notice", "Discard the block " + tObj.trackingId + " that it has insufficient number of signature and sending to other node was failed");
                return ca3OK<number>(3000);
            }
        } else {
            if (nameList.length >= core.conf.ca3.minSignNodes) {
                storeBlock = true;
                LOG("Warning", "The internode module is down. Try to save the block " + tObj.trackingId);
            } else {
                storeBlock = false;
                LOG("Notice", "Discard the block " + tObj.trackingId + " that it has insufficient number of signature and the internode module is down");
                return ca3Error("requestToSignAndResendOrStore", "tryToSendToSign", "The internode module is down");
            }
        }
    } else {
        storeBlock = true;
    }
    if (storeBlock === true) { // It's the final destination
        // Save the block on this node
        if (core.s !== undefined) {
            const ret5 = await core.s.lib.requestToAddBlock(core.s, tObj.block, true, tObj.trackingId);
            if (ret5.isFailure()) return ret5;
        } else {
            return ca3Error("requestToSignAndResendOrStore", "requestToAddBlock", "The system module is down");
        }
        if ((core.i !== undefined) && (core.i.conf.nodes.length > 0)) {
            // Save the block on all remote node
            const request = "AddBlockCa3"
            const data: inAddBlockDataFormat = {
                traveling: tObj,
                removeFromPool: true
            }
            let results: rpcResultFormat[] = [];
            if (core.i !== undefined) {
                const ret6 = await core.i.lib.runRpcs(core.i, core.i.conf.nodes, request, JSON.stringify(data))
                if (ret6.isFailure()) { return ret6; }
                results = ret6.value;
            } else {
                return ca3Error("requestToSignAndResendOrStore", "runRpcs", "The internode module is down");
            }
    
            let errorNodes: string[] = [];
            for (const result of results) {
                try {
                    if (result.result.isFailure()) {
                        errorNodes.push(result.node.nodename);
                    } else {
                        const payload = result.result.value.getPayload()?.toObject();
                        if (payload === undefined) {
                            errorNodes.push(result.node.nodename);
                        } else {
                            switch (payload.payloadType) {
                                case ic.payload_type.RESULT_SUCCESS:
                                    // Noting needed
                                    break;
                                case ic.payload_type.RESULT_FAILURE:
                                    LOG("Notice", "Node " + result.node.nodename + " has failed to save the block:" + payload.gErrorAsString);
                                    errorNodes.push(result.node.nodename);
                                    break;
                                default:
                                    errorNodes.push(result.node.nodename);
                                    break;
                            }
                        }
                    }
                } catch (error) {
                    errorNodes.push(result.node.nodename);
                }
            }

            // Something error => need attension
            core.i.lib.disableAbnormalNodes(core.i, errorNodes);

            return ca3OK<number>(errorNodes.length * -1); // If non-zero, conditional OK
        } else {
            return ca3Error("requestToSignAndResendOrStore", "runRpcs", "The internode module is down");
        }
    }
    return ca3OK<number>(0);
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
    const LOG = core.log.lib.LogFunc(core.log, "CA3", "verifyABlock");
    if (trackingId === undefined) {
        LOG("Info", "start");
    } else {
        LOG("Info", "start:" + trackingId);

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
            LOG("Warning", "verifyBlock verified a illegal block or empty block");
            return ca3Error("verifyABlock", "illegalBlock", "illegal block or empty block");
        }
    } catch (error) {
        LOG("Warning", "verifyBlock verified a illegal block or empty block");
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
        travelingIds[trackingId].state = "arrived";
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
    const LOG = core.log.lib.LogFunc(core.log, "CA3", "verifyAllSignatures");
    if (trackingId === undefined) {
        LOG("Info", "start");
    } else {
        LOG("Info", "start:" + trackingId);
    }

    let statusshift = 0;
    let ret1: Ca3ReturnFormat = {
        status: 0,
        detail: "",
        block: undefined
    }

    LOG("Debug", "signcount:" + bObj.signcounter);

    // ed25519 by each node
    const nameList = clone(Object.keys(bObj.signedby));
    LOG("Debug", "block:" + JSON.stringify(bObj));
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
            LOG("Warning", ret1.detail);
            return ca3OK<Ca3ReturnFormat>(ret1);
        } else {
            ret1.status = 0;
            ret1.detail = "CA3:verifyAllSignatures:" + name + ":OK";
            LOG("Info", ret1.detail);
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
        LOG("Info", ret1.detail);
    } else {
        ret1.status = 3;
        ret1.detail = "CA3:verifyAllSignatures:sha256:ResultFailed";
        ret1.block = undefined;
        LOG("Warning", ret1.detail);
    }
    return ca3OK<Ca3ReturnFormat>(ret1);
}

/**
 * Set up the block generator
 * @param core - set ccBlockType instance
 * @param type - set block type
 * @param data - set target transactions
 * @param tenantId - in open source version, it must be equal to DEFAULT_parcel_IDENTIFIER
 * @param startTimeMs - set starting time in ms
 * @param lifeTimeMs - set life time against starting time in ms
 * @param trackingId - set trackingId to trace
 * @param commonId - in open source version, it must be undefined or equal to DEFAULT_parcel_IDENTIFIER
 * @returns returns with gResult type that contains the trackingId of the starting process if it's success, and gError if it's failure.
 */
export function setupCreator(core: ccBlockType, type: string, data: objTx[], tenantId: string, startTimeMs: number, lifeTimeMs: number, trackingId: string): gResult<string, gError> {
    const LOG = core.log.lib.LogFunc(core.log, "CA3", "setupCreator");
    LOG("Info", "start");
    
    // Delete timeouted travelingIds (Usually stopCreator unlocks)
    for (const traveling_id of Object.keys(travelingIds)) {
        if (travelingIds[traveling_id].timeoutMs < startTimeMs) {
            delete travelingIds[traveling_id];
        }
    }

    const timeoutMs = startTimeMs + lifeTimeMs;
    if (travelingIds[trackingId] === undefined) {
        // The target oids
        let oidList: string[] = [];
        let tenant: string = tenantId;
        switch (type) {
            case "data":
                for (const tx of data) {
                    oidList.push(tx._id.toString());
                }
                LOG("Debug", "creating data block for:" + JSON.stringify(oidList));
                break;
            case "genesis":
                LOG("Debug",  "creating genesis block for:" + core.conf.default_tenant_id);
                tenant = core.conf.default_tenant_id;
                break;
            case "parcel_open":
                LOG("Debug", "creating parcel_open block for:" + tenantId);
                break;
            case "parcel_close":
                LOG("Debug", "creating parcel_close block for:" + tenantId);
                break;
            default:
                return ca3Error("setupCreator", "prepareDeclareCreation", "unknown block type:" + type);
        }
        // generate new tracking ID and register
        travelingIds[trackingId] = {
            state: "preparation",
            stored: false,
            timeoutMs: timeoutMs,
            type: type,
            tenant: tenant,
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
 * Release the lock of blocking immediately
 * @param core - set ccBlockType instance
 * @param trackingId - set trackingId to unregister
 * @returns returns no useful values
 */
export function stopCreator(core: ccBlockType, trackingId: string): gResult<void, unknown>  {
    const LOG = core.log.lib.LogFunc(core.log, "CA3", "stopCreator");
    LOG("Info", "start");

    try {
        delete travelingIds[trackingId];
    } catch (error) {
        
    }
    return ca3OK<void>(undefined);
}

/**
 * The main routine that generates the block.
 * It's under the influence of the timers.
 * @param core - set ccBlockType instance
 * @param pObj - set the provous block to get some information
 * @param data - set the target transactions for blocking
 * @param trackingId - set trackingId to trace
 * @param tenantId - in open source version, it must be equal to DEFAULT_parcel_IDENTIFIER
 * @param blockOptions - can set blocking options with createBlockOptions
 * @returns returns with gResult, that is wrapped by a Promise, that contains the object and its status as Ca3ReturnFormat if it's success, and gError if it's failure.
 */
export async function proceedCreator(core: ccBlockType, pObj: Ca3BlockFormat | undefined, data: objTx[], 
    trackingId: string, tenantId: string, blockOptions: createBlockOptions): Promise<gResult<Ca3ReturnFormat, gError>> {
    const LOG = core.log.lib.LogFunc(core.log, "CA3", "proceedCreator");
    LOG("Info", "start");

    if (travelingIds[trackingId] === undefined) {
        return ca3Error("proceedCreator", "Invalid", trackingId + " is invalid or has been stopped already");
    }
    
    let ret1: Ca3ReturnFormat = {
        status: 0,
        detail: ""
    };

    // suppression request => have the parameter adjusted according to the result
    const ret2 = await declareCreation(core, trackingId);
    if (ret2.isFailure()) {
        travelingIds[trackingId].state = "arrived";
        travelingIds[trackingId].block = undefined;
        return ret2;
    }
    travelingIds[trackingId].state = "underway";
    if ((core.i !== undefined) && (ret2.value.i !== undefined)) core.i.conf = ret2.value.i.conf;

    // block creation
    const ret3 = packTxsToANewBlockObject(core, pObj, data, trackingId, tenantId, blockOptions);
    if (ret3.isFailure()) {
        travelingIds[trackingId].state = "arrived";
        travelingIds[trackingId].block = undefined;
        return ret3;
    }
    ret1 = ret3.value;
    
    if (ret1.block === undefined) return ca3Error("proceedCreator", "packTxsToANewBlockObject", "unknown error");

    // signed by this node
    const ret4 = await signTheBlockObject(core, ret1.block, trackingId);
    if (ret4.isFailure()) {
        travelingIds[trackingId].state = "arrived";
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
        travelingIds[trackingId].state = "arrived";
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
