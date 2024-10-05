import { randomUUID } from "crypto";

import ic from "../../grpc/interconnect_pb.js";

import { gResult, gSuccess, gFailure, gError } from "../utils.js";

import { Ca3TravelingFormat, Ca3TravelingIdFormat2 } from "../block/algorithm/ca3.js";
import { objTx } from "../datastore/index.js";
import { inAddBlockDataFormat, inExamineBlockDiffernceDataFormat, inExaminePoolDiffernceDataFormat, inGetBlockDataFormat, inGetBlockDigestDataFormat, inGetBlockHeightDataFormat, inGetPoolHeightDataFormat, inHeightReturnDataFormat, inDigestReturnDataFormat } from "./index.js";
import { inConfigType } from "../config/zod.js";
import { ccLogType } from "../logger/index.js";
import { ccSystemType, getBlockResult } from "../system/index.js";
import { ccBlockType } from "../block/index.js";

export class InReceiverSubModule {

    /**
     * Normal return method
     * @param response - response contents
     * @returns returns gSuccess instance contains response
     */
    public irOK<T>(response: T): gResult<T, never> {
        return new gSuccess(response)
    }
    /**
     * Abnormal return method
     * @param func - set the function/method name
     * @param pos - set the position in the func
     * @param message - set the error message
     * @returns returns gFailure instance contains gError instance
     */
    public irError(func: string, pos?: string, message?: string): gResult<never, gError> {
        return new gFailure(new gError("inr", func, pos, message));
    }

    protected log: ccLogType;
    protected conf: inConfigType;
    public score: ccSystemType;
    public bcore: ccBlockType;
    constructor(conf: inConfigType, log: ccLogType, systemInstance: ccSystemType, blockInstance: ccBlockType) {
        this.conf = conf;
        this.log = log;
        this.score = systemInstance;
        this.bcore = blockInstance;
    }

    /**
     * Process received data packets
     * @param req - set the packet with icGeneralPacket format
     * @returns returns with gResult, that is wrapped by a Promise, that contains the result with icGeneralPacket format if it's success, and gError if it's failure.
     */
    public async generalReceiver(req: ic.icGeneralPacket): Promise<gResult<ic.icGeneralPacket, gError>> {
        const LOG = this.log.lib.LogFunc(this.log, "In", "generalReceiver");
        LOG("Info", "Ir:" + this.conf.self.nodename + ":generalReceiver");
        LOG("Debug", "Ir:" + this.conf.self.nodename + ":generalReceiver:" + JSON.stringify(req.toObject()));

        // parse: TODO: should use zod to parse
        let payload: ic.icPacketPayload.AsObject;
        try {
            // Not very meaningful. Consider universal identifier/discovery in the network
            const reqObj: ic.icGeneralPacket.AsObject = req.toObject();
            if (reqObj.version !== 4) {
                LOG("Notice", "Ir:" + this.conf.self.nodename + ":generalReceiver:parse:" + reqObj.packetId);
                LOG("Notice", "Ir:" + this.conf.self.nodename + ":generalReceiver:parse:Version is incorrect, drop");
                return this.irError("generalReceiver", "parse", "Version is incorrect");
            }
            if (reqObj.receiver !== this.conf.self.nodename) {
                LOG("Notice", "Ir:" + this.conf.self.nodename + ":generalReceiver:parse:" + reqObj.packetId);
                LOG("Notice", "Ir:" + this.conf.self.nodename + ":generalReceiver:parse:Receiver is incorrect, drop");
                LOG("Debug", "Ir:" + this.conf.self.nodename + ":generalReceiver:parse:Receiver:got:" + reqObj.receiver);
                LOG("Debug", "Ir:" + this.conf.self.nodename + ":generalReceiver:parse:Receiver:set:" + this.conf.self.nodename);
                return this.irError("generalReceiver", "parse", "Receiver is incorrect");
            }
            // curently static
            let allow_communication: boolean = false;
            for (const node of this.conf.nodes) {
                if (node.nodename === reqObj.sender) {
                    if (node.allow_outgoing === true) {
                        allow_communication = true;
                    }
                    break;
                }
            }
            if (allow_communication !== true) {
                LOG("Notice", "Ir:" + this.conf.self.nodename + ":generalReceiver:parse:" + reqObj.packetId);
                LOG("Notice", "Ir:" + this.conf.self.nodename + ":generalReceiver:parse:Sender is in deny list, drop");
                return this.irError("generalReceiver", "parse", "Sender is in deny list");
            }
            if (reqObj.payload === undefined) {
                LOG("Notice", "Ir:" + this.conf.self.nodename + ":generalReceiver:parse:" + reqObj.packetId);
                LOG("Notice", "Ir:" + this.conf.self.nodename + ":generalReceiver:parse:Payload is undefined, drop");
                return this.irError("generalReceiver", "parse", "Payload is undefined");
            }
            payload = reqObj.payload;
        } catch (error: any) {
            try {
                LOG("Notice", "Ir:" + this.conf.self.nodename + ":generalReceiver:parse:" + req.getPacketId());
                LOG("Notice", "Ir:" + this.conf.self.nodename + ":generalReceiver:parse:Error in parsing the packet, drop: " + error.toString());
            } catch (ignore) {
                LOG("Notice", "Ir:" + this.conf.self.nodename + ":generalReceiver:parse:Error in parsing a packet, drop: " + error.toString());
            }
            return this.irError("generalReceiver", "parse", error.toString());
        }
        LOG("Debug", "Ir:" + this.conf.self.nodename + ":generalReceiver:parse:OK:" + req.getPacketId());


        // ic.payload_type.RESULT_*
        // Receive a result, return As-Is
        if (payload.payloadType !== ic.payload_type.REQUEST) {
            LOG("Debug", "Ir:" + this.conf.self.nodename + ":generalReceiver:isResult:result of msg " + req.getPrevId() + ",by " + req.getPacketId());
            LOG("Info", "Ir:" + this.conf.self.nodename + ":generalReceiver:isResult:" + payload.request);
            return this.irOK(req);
        }


        // ic.payload_type.REQUEST
        // Receive a request, process, and then response, or terminate
        type responseOrTerminate = "response" | "terminate";
        let resultType: responseOrTerminate = "terminate";

        if (payload.request === undefined) {
            resultType = "terminate";
            return this.irError("generalReceiver", "response", "Request is undefined");
        }
        // NOTE: the failure response may be blocked by the upper layer
        LOG("Debug", "Ir:" + this.conf.self.nodename + ":generalReceiver:isRequest:response to msg " + req.getPacketId());
        LOG("Info", "Ir:" + this.conf.self.nodename + ":generalReceiver:isRequest:" + payload.request);
        const result = new ic.icPacketPayload();
        result.setRequest(payload.request);
        switch (payload.request) {
            case "Ping":
                resultType = "response";
                result.setPayloadType(ic.payload_type.RESULT_SUCCESS);
                result.setDataAsString("Pong");
                break;
            case "AddPool":
                resultType = "response";
                if (payload.dataAsString === undefined) {
                    result.setPayloadType(ic.payload_type.RESULT_FAILURE);
                    result.setGErrorAsString(JSON.stringify(this.irError("generalReciever", payload.request, "data is undefined")));
                    break;
                }
                let ret11: objTx[] = [];
                try {
                    ret11 = JSON.parse(payload.dataAsString);
                } catch (error: any) {
                    result.setPayloadType(ic.payload_type.RESULT_FAILURE);
                    result.setGErrorAsString(JSON.stringify(this.irError("generalReciever", payload.request, "data is invalid:" + error.toString())));
                    break;
                }
                const ret12 = await this.score.lib.requestToAddPool(this.score, ret11);
                if (ret12.isSuccess()) {
                    result.setPayloadType(ic.payload_type.RESULT_SUCCESS);
                    result.setDataAsString("OK");
                } else {
                    result.setPayloadType(ic.payload_type.RESULT_FAILURE);
                    result.setGErrorAsString(JSON.stringify(ret12.value));
                }
                break;
            case "AddBlock":
                resultType = "response";
                result.setPayloadType(ic.payload_type.RESULT_FAILURE);
                result.setGErrorAsString(JSON.stringify(this.irError("generalReciever", payload.request, "addBlockCa2 is not supported on this node.")));
                break;
            case "AddBlockCa3":
                resultType = "response";
                if (payload.dataAsString === undefined) {
                    result.setPayloadType(ic.payload_type.RESULT_FAILURE);
                    result.setGErrorAsString(JSON.stringify(this.irError("generalReciever", payload.request, "data is undefined")));
                    break;
                }
                let ret21: inAddBlockDataFormat;
                try {
                    ret21 = JSON.parse(payload.dataAsString);
                } catch (error: any) {
                    result.setPayloadType(ic.payload_type.RESULT_FAILURE);
                    result.setGErrorAsString(JSON.stringify(this.irError("generalReciever", payload.request, "data is invalid:" + error.toString())));
                    break;
                }
                const ret22 = await this.score.lib.requestToAddBlock(this.score, ret21.traveling.block, ret21.removeFromPool, ret21.traveling.trackingId);
                if (ret22.isSuccess()) {
                    result.setPayloadType(ic.payload_type.RESULT_SUCCESS);
                    result.setDataAsString("OK");
                    // TODO: move to anyway
                    this.bcore.algorithm.closeATransaction(ret21.traveling.trackingId);
                } else {
                    result.setPayloadType(ic.payload_type.RESULT_FAILURE);
                    result.setGErrorAsString(JSON.stringify(ret22.value));
                }
                break;
            case "GetPoolHeight":
                resultType = "response";
                if (payload.dataAsString === undefined) {
                    result.setPayloadType(ic.payload_type.RESULT_FAILURE);
                    result.setGErrorAsString(JSON.stringify(this.irError("generalReciever", payload.request, "data is undefined")));
                    break;
                }
                let ret31: inGetPoolHeightDataFormat;
                try {
                    ret31 = JSON.parse(payload.dataAsString);
                } catch (error: any) {
                    result.setPayloadType(ic.payload_type.RESULT_FAILURE);
                    result.setGErrorAsString(JSON.stringify(this.irError("generalReciever", payload.request, "data is invalid:" + error.toString())));
                    break;
                }
                const ret32 = await this.score.lib.requestToGetPoolHeight(this.score, ret31.tenantId);
                if (ret32.isSuccess()) {
                    result.setPayloadType(ic.payload_type.RESULT_SUCCESS);
                    const d: inHeightReturnDataFormat = { height: ret32.value };
                    result.setDataAsString(JSON.stringify(d));
                } else {
                    result.setPayloadType(ic.payload_type.RESULT_FAILURE);
                    result.setGErrorAsString(JSON.stringify(ret32.value));
                }
                break;
            case "GetBlockHeight":
                resultType = "response";
                if (payload.dataAsString === undefined) {
                    result.setPayloadType(ic.payload_type.RESULT_FAILURE);
                    result.setGErrorAsString(JSON.stringify(this.irError("generalReciever", payload.request, "data is undefined")));
                    break;
                }
                let ret41: inGetBlockHeightDataFormat;
                try {
                    ret41 = JSON.parse(payload.dataAsString);
                } catch (error: any) {
                    result.setPayloadType(ic.payload_type.RESULT_FAILURE);
                    result.setGErrorAsString(JSON.stringify(this.irError("generalReciever", payload.request, "data is invalid:" + error.toString())));
                    break;
                }
                const ret42 = await this.score.lib.requestToGetBlockHeight(this.score, ret41.tenantId);
                if (ret42.isSuccess()) {
                    result.setPayloadType(ic.payload_type.RESULT_SUCCESS);
                    const d42: inHeightReturnDataFormat = { height: ret42.value };
                    result.setDataAsString(JSON.stringify(d42));
                } else {
                    result.setPayloadType(ic.payload_type.RESULT_FAILURE);
                    result.setGErrorAsString(JSON.stringify(ret42.value));
                }
                break;
            case "GetBlockDigest":
                resultType = "response";
                if (payload.dataAsString === undefined) {
                    result.setPayloadType(ic.payload_type.RESULT_FAILURE);
                    result.setGErrorAsString(JSON.stringify(this.irError("generalReciever", payload.request, "data is undefined")));
                    break;
                }
                let ret51: inGetBlockDigestDataFormat;
                try {
                    ret51 = JSON.parse(payload.dataAsString);
                } catch (error: any) {
                    result.setPayloadType(ic.payload_type.RESULT_FAILURE);
                    result.setGErrorAsString(JSON.stringify(this.irError("generalReciever", payload.request, "data is invalid:" + error.toString())));
                    break;
                }
                const ret52 = await this.score.lib.requestToGetLastHash(this.score, ret51.tenantId, ret51.failIfUnhealthy);
                if (ret52.isSuccess()) {
                    result.setPayloadType(ic.payload_type.RESULT_SUCCESS);
                    const d52: inDigestReturnDataFormat = {
                        hash: ret52.value.hash,
                        height: ret52.value.height
                    }
                    result.setDataAsString(JSON.stringify(d52));
                } else {
                    result.setPayloadType(ic.payload_type.RESULT_FAILURE);
                    result.setGErrorAsString(JSON.stringify(ret52.value));
                }
                break;
            case "GetBlock":
                resultType = "response";
                if (payload.dataAsString === undefined) {
                    result.setPayloadType(ic.payload_type.RESULT_FAILURE);
                    result.setGErrorAsString(JSON.stringify(this.irError("generalReciever", payload.request, "data is undefined")));
                    break;
                }
                let ret61: inGetBlockDataFormat;
                try {
                    ret61 = JSON.parse(payload.dataAsString);
                } catch (error: any) {
                    result.setPayloadType(ic.payload_type.RESULT_FAILURE);
                    result.setGErrorAsString(JSON.stringify(this.irError("generalReciever", payload.request, "data is invalid:" + error.toString())));
                    break;
                }
                const ret62 = await this.score.lib.requestToGetBlock(this.score, ret61.oid, ret61.returnUndefinedIfFail, ret61.tenantId);
                if (ret62.isSuccess()) {
                    result.setPayloadType(ic.payload_type.RESULT_SUCCESS);
                    const d62: getBlockResult = {
                        oid: ret61.oid,
                        block: ret62.value
                    }
                    result.setDataAsString(JSON.stringify(d62));
                } else {
                    result.setPayloadType(ic.payload_type.RESULT_FAILURE);
                    result.setGErrorAsString(JSON.stringify(ret62.value));
                }
                break;
            case "ExamineBlockDifference":
                resultType = "response";
                if (payload.dataAsString === undefined) {
                    result.setPayloadType(ic.payload_type.RESULT_FAILURE);
                    result.setGErrorAsString(JSON.stringify(this.irError("generalReciever", payload.request, "data is undefined")));
                    break;
                }
                let ret71: inExamineBlockDiffernceDataFormat;
                try {
                    ret71 = JSON.parse(payload.dataAsString);
                } catch (error: any) {
                    result.setPayloadType(ic.payload_type.RESULT_FAILURE);
                    result.setGErrorAsString(JSON.stringify(this.irError("generalReciever", payload.request, "data is invalid:" + error.toString())));
                    break;
                }
                const ret72 = await this.score.lib.requestToExamineBlockDifference(this.score, ret71.list, ret71.tenantId);
                if (ret72.isSuccess()) {
                    result.setPayloadType(ic.payload_type.RESULT_SUCCESS);
                    result.setDataAsString(JSON.stringify(ret72.value));
                } else {
                    result.setPayloadType(ic.payload_type.RESULT_FAILURE);
                    result.setGErrorAsString(JSON.stringify(ret72.value));
                }
                break;
            case "ExaminePoolDifference":
                resultType = "response";
                if (payload.dataAsString === undefined) {
                    result.setPayloadType(ic.payload_type.RESULT_FAILURE);
                    result.setGErrorAsString(JSON.stringify(this.irError("generalReciever", payload.request, "data is undefined")));
                    break;
                }
                let ret81: inExaminePoolDiffernceDataFormat;
                try {
                    ret81 = JSON.parse(payload.dataAsString);
                } catch (error: any) {
                    result.setPayloadType(ic.payload_type.RESULT_FAILURE);
                    result.setGErrorAsString(JSON.stringify(this.irError("generalReciever", payload.request, "data is invalid:" + error.toString())));
                    break;
                }
                const ret82 = await this.score.lib.requestToExaminePoolDifference(this.score, ret81.list, ret81.tenantId);
                if (ret82.isSuccess()) {
                    result.setPayloadType(ic.payload_type.RESULT_SUCCESS);
                    result.setDataAsString(JSON.stringify(ret82.value));
                } else {
                    result.setPayloadType(ic.payload_type.RESULT_FAILURE);
                    result.setGErrorAsString(JSON.stringify(ret82.value));
                }
                break;
            case "DeclareBlockCreation":
                resultType = "response";
                if (payload.dataAsString === undefined) {
                    result.setPayloadType(ic.payload_type.RESULT_FAILURE);
                    result.setGErrorAsString(JSON.stringify(this.irError("generalReciever", payload.request, "data is undefined")));
                    break;
                }
                let ret91: Ca3TravelingIdFormat2;
                try {
                    ret91 = JSON.parse(payload.dataAsString);
                } catch (error: any) {
                    result.setPayloadType(ic.payload_type.RESULT_FAILURE);
                    result.setGErrorAsString(JSON.stringify(this.irError("generalReciever", payload.request, "data is invalid:" + error.toString())));
                    break;
                }
                const ret92 = await this.bcore.algorithm.requestToDeclareBlockCreation(this.bcore, ret91);
                if (ret92.isSuccess()) {
                    result.setPayloadType(ic.payload_type.RESULT_SUCCESS);
                    result.setDataAsString(JSON.stringify(ret92.value));
                } else {
                    result.setPayloadType(ic.payload_type.RESULT_FAILURE);
                    result.setGErrorAsString(JSON.stringify(ret92.value));
                }
                break;
            case "SignAndResendOrStore":
                resultType = "response";
                if (payload.dataAsString === undefined) {
                    result.setPayloadType(ic.payload_type.RESULT_FAILURE);
                    result.setGErrorAsString(JSON.stringify(this.irError("generalReciever", payload.request, "data is undefined")));
                    break;
                }
                let retA1: Ca3TravelingFormat;
                try {
                    retA1 = JSON.parse(payload.dataAsString);
                } catch (error: any) {
                    result.setPayloadType(ic.payload_type.RESULT_FAILURE);
                    result.setGErrorAsString(JSON.stringify(this.irError("generalReciever", payload.request, "data is invalid:" + error.toString())));
                    break;
                }
                const retA2 = await this.bcore.algorithm.requestToSignAndResendOrStore(this.bcore, retA1);
                if (retA2.isSuccess()) {
                    result.setPayloadType(ic.payload_type.RESULT_SUCCESS);
                    result.setDataAsString(JSON.stringify(retA2.value));
                } else {
                    result.setPayloadType(ic.payload_type.RESULT_FAILURE);
                    result.setGErrorAsString(JSON.stringify(retA2.value));
                }
                break;
            case "ResetTestNode":
                resultType = "response";
                result.setPayloadType(ic.payload_type.RESULT_FAILURE);
                result.setGErrorAsString(JSON.stringify(this.irError("generalReciever", payload.request, "ResetTestNode is not supported on this node.")));
                break;
            default:
                resultType = "terminate";
                LOG("Warning", "Ir:" + this.conf.self.nodename + ":generalReciever:IllegalRequest:" + payload.request);
                break;
        }
        if (resultType === "response") {
            const res = new ic.icGeneralPacket();
            res.setVersion(4);
            res.setPacketId(randomUUID());
            res.setSender(req.getReceiver());
            res.setReceiver(req.getSender());
            res.setPayload(result);
            res.setPrevId(req.getPacketId());
            return this.irOK(res);
        } else { // terminate, return an empty packet
            const res = new ic.icGeneralPacket();
            res.setVersion(4);
            res.setPacketId("");
            res.setPrevId(req.getPacketId());
            return this.irOK(res);
        }
    }
}