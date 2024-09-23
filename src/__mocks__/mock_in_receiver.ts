import { randomUUID } from "crypto";
import ic from "../../grpc/interconnect_pb.js"
import { gResult, gSuccess, gFailure, gError } from "../utils.js";
import { objTx } from "../datastore";
import { examinedHashes } from "../system";
import { inAddBlockDataFormat, inHeightReturnDataFormat, inGetPoolHeightDataFormat, inGetBlockHeightDataFormat, inGetBlockDigestDataFormat, inDigestReturnDataFormat, inGetBlockDataFormat, inExamineBlockDiffernceDataFormat, inExaminePoolDiffernceDataFormat } from "../internode";
import { getBlockResult } from "../system";
import { generateSamples } from "../__testdata__/generator.js";
import { Ca3TravelingIdFormat2, Ca3TravelingFormat } from "../block/algorithm/ca3.js";

/* Mock fakes the response from remote in local */
export class InReceiverSubModuleMock {

    public irOK<T>(response: T): gResult<T, never> {
        return new gSuccess(response)
    }
    public irError(func: string, pos?: string, message?: string): gResult<never, gError> {
        return new gFailure(new gError("inr", func, pos, message));
    }

    //constructor(conf: any, log: any, systemInstance: any, blockInstance: any) {}

    public async generalReceiver(req: ic.icGeneralPacket): Promise<gResult<ic.icGeneralPacket, gError>> {
        console.log("in mocked generalReceiver")

        const payload = req.getPayload()?.toObject();
        if (payload === undefined) { return this.irError("generalReceiver", "parse", "Payload is undefined"); }

        if (payload.payloadType !== ic.payload_type.REQUEST) {
            return this.irOK(req);
        }

        const samples = await generateSamples();

        type responseOrTerminate = "response" | "terminate";
        let resultType: responseOrTerminate = "terminate";
        if (payload.request === undefined) { return this.irError("generalReceiver", "response", "Request is undefined"); }
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
                if (ret11[0].tenant === "Wrong") {
                    result.setPayloadType(ic.payload_type.RESULT_FAILURE);
                    result.setGErrorAsString(JSON.stringify(this.irError("generalReciever", payload.request, "The tenant is invalid")));
                } else {
                    result.setPayloadType(ic.payload_type.RESULT_SUCCESS);
                    result.setDataAsString("OK");
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
                if (ret21.traveling.block.tenant === "Wrong") {
                    result.setPayloadType(ic.payload_type.RESULT_FAILURE);
                    result.setGErrorAsString(JSON.stringify(this.irError("generalReciever", payload.request, "The tenant is invalid")));
                } else {
                    result.setPayloadType(ic.payload_type.RESULT_SUCCESS);
                    result.setDataAsString("OK");
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
                if (ret31.tenantId === "Wrong") {
                    result.setPayloadType(ic.payload_type.RESULT_FAILURE);
                    result.setGErrorAsString(JSON.stringify(this.irError("generalReciever", payload.request, "The tenant is invalid")));
                } else {
                    result.setPayloadType(ic.payload_type.RESULT_SUCCESS);
                    const d: inHeightReturnDataFormat = { height: 1 };
                    result.setDataAsString(JSON.stringify(d));
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
                if (ret41.tenantId === "Wrong") {
                    result.setPayloadType(ic.payload_type.RESULT_FAILURE);
                    result.setGErrorAsString(JSON.stringify(this.irError("generalReciever", payload.request, "The tenant is invalid")));
                } else {
                    result.setPayloadType(ic.payload_type.RESULT_SUCCESS);
                    const d42: inHeightReturnDataFormat = { height: 1 };
                    result.setDataAsString(JSON.stringify(d42));
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
                if (ret51.tenantId === "Wrong") {
                    result.setPayloadType(ic.payload_type.RESULT_FAILURE);
                    result.setGErrorAsString(JSON.stringify(this.irError("generalReciever", payload.request, "The tenant is invalid")));
                } else {
                    result.setPayloadType(ic.payload_type.RESULT_SUCCESS);
                    const blk0 = samples.blks.get("blk0");
                    const d52: inDigestReturnDataFormat = {
                        hash: blk0?.hash!,
                        height: 0
                    }
                    result.setDataAsString(JSON.stringify(d52));
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
                if (ret61.tenantId === "Wrong") {
                    result.setPayloadType(ic.payload_type.RESULT_FAILURE);
                    result.setGErrorAsString(JSON.stringify(this.irError("generalReciever", payload.request, "The tenant is invalid")));
                } else {
                    result.setPayloadType(ic.payload_type.RESULT_SUCCESS);
                    const blk0 = samples.blks.get("blk0");
                    const d62: getBlockResult = {
                        oid: blk0?._id!,
                        block: blk0
                    }
                    result.setDataAsString(JSON.stringify(d62));
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
                if (ret71.tenantId === "Wrong") {
                    result.setPayloadType(ic.payload_type.RESULT_FAILURE);
                    result.setGErrorAsString(JSON.stringify(this.irError("generalReciever", payload.request, "The tenant is invalid")));
                } else {
                    result.setPayloadType(ic.payload_type.RESULT_SUCCESS);
                    const blk2 = samples.blks.get("blk2");
                    const ret72: examinedHashes = {
                        add: [blk2!],
                        del: []
                    }
                    result.setDataAsString(JSON.stringify(ret72));
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
                if (ret81.tenantId === "Wrong") {
                    result.setPayloadType(ic.payload_type.RESULT_FAILURE);
                    result.setGErrorAsString(JSON.stringify(this.irError("generalReciever", payload.request, "The tenant is invalid")));
                } else {
                    result.setPayloadType(ic.payload_type.RESULT_SUCCESS);
                    const tx3 = samples.txs.get("tx3");
                    result.setDataAsString(JSON.stringify([tx3]));
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
                if (ret91.block?.tenant === "Wrong") {
                    result.setPayloadType(ic.payload_type.RESULT_FAILURE);
                    result.setGErrorAsString(JSON.stringify(-102));
                } else {
                    result.setPayloadType(ic.payload_type.RESULT_SUCCESS);
                    result.setDataAsString(JSON.stringify(101));
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
                if (retA1.block.tenant === "Wrong") {
                    result.setPayloadType(ic.payload_type.RESULT_FAILURE);
                    result.setGErrorAsString(JSON.stringify(3000)); // negatives, 1000s, 2000s, and 3000s 
                } else {
                    result.setPayloadType(ic.payload_type.RESULT_SUCCESS);
                    result.setDataAsString(JSON.stringify(0));
                }
                break;
            case "ResetTestNode":
                resultType = "response";
                result.setPayloadType(ic.payload_type.RESULT_FAILURE);
                result.setGErrorAsString(JSON.stringify(this.irError("generalReciever", payload.request, "ResetTestNode is not supported on this node.")));
                break;
            default:
                resultType = "terminate";
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