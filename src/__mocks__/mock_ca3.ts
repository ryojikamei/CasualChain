/**
 * Copyright (c) 2024 Ryoji Kamei
 * Released under the MIT license
 * https://opensource.org/licenses/mit-license.php
 */

import { gResult, gSuccess, gFailure, gError } from "../utils";
import { ccBlockType, createBlockOptions } from "../block";
import { Ca3BlockFormat, Ca3ReturnFormat, Ca3TravelingFormat, Ca3TravelingIdFormat, Ca3TravelingIdFormat2 } from "../block/algorithm/ca3";
import { objTx } from "../datastore";

import { generateSamples } from "../__testdata__/generator";

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

export function cleanup() {
    travelingIds = {};
}

export async function requestToDeclareBlockCreation(core: ccBlockType, packet: Ca3TravelingIdFormat2): Promise<gResult<number, unknown>> {
    if ((packet.txOids !== undefined) && (packet.txOids[0] === "duplicateSample")) {
        return ca3OK<number>(packet.timeoutMs * -1);
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
    return ca3OK<number>(packet.timeoutMs);
}

export async function requestToSignAndResendOrStore(core: ccBlockType, tObj: Ca3TravelingFormat): Promise<gResult<number, gError>> {
    switch (tObj.trackingId) {
        case "confErrorSample":
            return ca3Error("requestToSignAndResendOrStore", "Configuration", "CA3 setting is undefined");
        case "verifyErrorSample":
            return ca3OK<number>(1003);
        case "signErrorSample":
            return ca3OK<number>(2000);
        case "sendErrorSample1":
            return ca3OK<number>(3000);
        case "sendErrorSample2":
            return ca3Error("requestToSignAndResendOrStore", "tryToSendToSign", "The internode module is down");
        case "saveErrorSample1":
            return ca3Error("requestToSignAndResendOrStore", "requestToAddBlock", "The system module is down");
        case "saveErrorSample2":
            return ca3Error("requestToSignAndResendOrStore", "requestToAddBlock", "The internode module is down");
        case "saveConditionalOKSample":
            return ca3OK<number>(-1);
        default:
            return ca3OK<number>(0);
    }
}

export async function verifyABlock(core: ccBlockType, bObj: Ca3BlockFormat, trackingId?: string): Promise<gResult<Ca3ReturnFormat, gError>> {
    let ret1: Ca3ReturnFormat = {
        status: 0,
        detail: "",
        block: undefined
    }
    switch (trackingId) {
        case "timeOutSample":
            return ca3Error("verifyABlock", "timeOut", "Time out occured on " + trackingId);
        case "illegalBlockSample":
            return ca3Error("verifyABlock", "illegalBlock", "illegal block or empty block");
        case "illegalDataSample":
            return ca3Error("verifyABlock", "illegalData", "illegal block or empty block");
        case "verifyErrorSample1":
            return ca3Error("verifyByPublicKey", "refreshPublicKeyCache", "The public key is not found or nodename is malformed");
        case "verifyErrorSample2":
            ret1.status = 30;
            ret1.detail = "CA3:verifyAllSignatures:localhost:ResultFailed";
            return ca3OK<Ca3ReturnFormat>(ret1);
        case "verifyErrorSample3":
            ret1.status = 3;
            ret1.detail = "CA3:verifyAllSignatures:sha256:ResultFailed";
            return ca3OK<Ca3ReturnFormat>(ret1);
        default:
            ret1.status = 0
            ret1.detail = "CA3:verifyAllSignatures:sha256:OK"
            ret1.block = bObj;
            return ca3OK<Ca3ReturnFormat>(ret1);
    }
}

export function setupCreator(core: ccBlockType, type: string, data: objTx[], __t: string, startTimeMs: number, lifeTimeMs: number, trackingId: string, commonId?: string): gResult<string, unknown> {    
    const timeoutMs = startTimeMs + lifeTimeMs;
    if (travelingIds[trackingId] === undefined) {
        // The target oids
        let oidList: string[] = [];
        if (data.length !== 0) {
            let tx: any;
            for (tx of data) {
                oidList.push(tx._id.toString());
            }
        } else {
            oidList = [];
        }
        // generate new tracking ID and register
        travelingIds[trackingId] = {
            state: "preparation",
            stored: false,
            timeoutMs: timeoutMs,
            type: type,
            tenant: __t,
            txOids: oidList,
            block: undefined
        }
    }
    return ca3OK(trackingId);
}

export async function proceedCreator(core: ccBlockType, pObj: Ca3BlockFormat | undefined, 
    data: any, trackingId: string, __t: string, blockOptions: createBlockOptions): Promise<gResult<Ca3ReturnFormat, gError>> {

    /* block sample */
    const ret = await generateSamples();

    let ret1: Ca3ReturnFormat = {
        status: 0,
        detail: ""
    };
    switch (__t) {
        case "TimeoutSample":
            travelingIds[trackingId].state = "arrived";
            travelingIds[trackingId].block = undefined;
            return ca3Error("declareCreation", "Timeout", "Time out occured on " + trackingId);
        case "GeneralErrorSample":
            travelingIds[trackingId].state = "arrived";
            travelingIds[trackingId].block = undefined;
            return ca3Error("packTxsToANewBlockObject", "createBlock", "Creating data block must requires previous block information");
        case "AlreadyStartSample":
            travelingIds[trackingId].state = "arrived";
            travelingIds[trackingId].block = undefined;
            return ca3Error("declareCreation", "sendRpcAll", "Already started");
        default:
            travelingIds[trackingId].state = "arrived";
            travelingIds[trackingId].stored = true;
            travelingIds[trackingId].block = ret.blks.get("blk0");
            return ca3OK<Ca3ReturnFormat>(ret1);
    }
}

export function stopCreator(core: ccBlockType, trackingId: string): gResult<void, unknown>  {
    return ca3OK<void>(undefined);
}

export function closeATransaction(trackingId: string) {
    try {
        travelingIds[trackingId].stored = true;
    } catch (error) {
        // do nothing
    }
}