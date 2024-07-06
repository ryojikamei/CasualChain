import { randomUUID } from "crypto";
import { setInterval } from "timers/promises";
import { promisify } from "util";

import clone from "clone";
import { Server, ServerCredentials, ChannelCredentials, handleBidiStreamingCall, handleUnaryCall, ServerDuplexStream, UntypedServiceImplementation, ServerUnaryCall, sendUnaryData, ClientDuplexStream } from "@grpc/grpc-js";

import ic_grpc from "../../grpc_v2/interconnect_grpc_pb.js";
import ic from "../../grpc_v2/interconnect_pb.js";

import { gResult, gSuccess, gFailure, gError } from "../utils.js";
import { moduleCondition } from "../index.js";

import { inConfigType, nodeProperty } from "../config";
import { ccLogType } from "../logger/index.js";
import { RUNTIME_MASTER_IDENTIFIER, DEFAULT_PARSEL_IDENTIFIER, ccSystemType } from "../system/index.js";
import { ccBlockType } from "../block/index.js";
import { ccKeyringType } from "../keyring/index.js";
import { inAddBlockDataFormat, ccInTypeV2, inGetPoolHeightDataFormat, inGetBlockHeightDataFormat, inGetBlockDigestDataFormat, inGetBlockDataFormat, inExamineBlockDiffernceDataFormat, inExaminePoolDiffernceDataFormat } from "./v2_index.js";

// Temp
import systemrpc from '../../grpc_v1/systemrpc_pb.js';
import { rpcReturnFormat } from ".";
import { InReceiverSubModule } from "./v2_receiver.js";

export class icServer implements ic_grpc.IinterconnectServer {
    constructor(
        public ccGeneralIc: handleBidiStreamingCall<ic.icGeneralPacket, ic.icGeneralPacket>,
        public ccCtrlLine: handleUnaryCall<ic.ctrlRequest, ic.ctrlResponse>
    ) {}
}

export type generalInConnections = {
    [nodename: string]: ClientDuplexStream<ic.icGeneralPacket, ic.icGeneralPacket>
}

export type clientInstance = {
    call: ClientDuplexStream<ic.icGeneralPacket, ic.icGeneralPacket>,
    newinstance: boolean
}

export const generalInResultsType = { "yet": 0, "success": 1, "failure": 2 } as const;
export type generalInResults = {
    [requestId: string]: {
        state: number,
        installationtime: number,
        result?: gResult<ic.icGeneralPacket, gError>
    }
}

export class InModuleV2 {
    /**
     * Normal return method
     * @param response - response contents
     * @returns returns gSuccess instance contains response
     */
    public iOK<T>(response: T): gResult<T, never> {
        return new gSuccess(response)
    }
    /**
     * Abnormal return method
     * @param func - set the function/method name
     * @param pos - set the position in the func
     * @param message - set the error message
     * @returns returns gFailure instance contains gError instance
     */
    public iError(func: string, pos?: string, message?: string): gResult<never, gError> {
        return new gFailure(new gError("in", func, pos, message));
    }

    /**
     * Inter-class variable to set module condition
     */
    protected coreCondition: moduleCondition = "unloaded";
    /**
     * Return current condition of the module
     * @returns returns a word that represent the condition of the module
     */
    public getCondition(): moduleCondition {
        return this.coreCondition;
    }
    /**
     * Overwrite the condition of the module
     * @param condition - set a word that represent the condition of the module
     */
    public setCondition(condition: moduleCondition): void {
        this.coreCondition = condition;
    }

    protected generalConnections: generalInConnections;
    protected generalResults: generalInResults;

    protected log: ccLogType;
    protected conf: inConfigType;
    protected receiver: InReceiverSubModule;

    protected loopIsActive: boolean;
    protected ctrlQueue: ic.ctrlRequest[];
    public setRequest(request: ic.ctrlRequest) {
        this.ctrlQueue.push(request);
    }
    /** 
     * Holding server instance
     */
    protected server: Server;
    protected serviceImplementation: UntypedServiceImplementation | undefined;

    /**
     * Stub values for features not supported in the open source version
     */
    protected master_key: string
    protected common_parsel: string

    constructor(conf: inConfigType, log: ccLogType, systemInstance: ccSystemType, blockInstance: ccBlockType, keyringInstance: ccKeyringType) {
        this.conf = conf;
        this.log = log;
        this.coreCondition = "unloaded";
        this.loopIsActive = false;
        this.ctrlQueue = [];
        this.generalConnections = {};
        this.generalResults = {};
        this.server = new Server();
        this.master_key = RUNTIME_MASTER_IDENTIFIER;
        this.common_parsel = DEFAULT_PARSEL_IDENTIFIER;
        this.receiver = new InReceiverSubModule(this.conf, this.log, systemInstance, blockInstance);
    }

    /**
     * The initialization of the InternodeModule. It has many arguments to be set.
     * @param conf - set inConfigType instance
     * @param log - set ccLogType instance
     * @param systemInstance - set ccSystemType instance
     * @param blockInstance - set ccBlockType instance
     * @param keyringInstance - set ccKeyringType instance
     * @returns returns with gResult type, that is wrapped by a Promise, that contains ccInType if it's success, and unknown if it's failure.
     * So there is no need to be concerned about the failure status.
     */
    public async init(conf: inConfigType, log: ccLogType, systemInstance: ccSystemType, 
        blockInstance: ccBlockType, keyringInstance: ccKeyringType, ServerInstance?: any): Promise<gResult<ccInTypeV2, unknown>> {

        this.coreCondition = "loading";

        let core: ccInTypeV2 = {
            lib: new InModuleV2(conf, log, systemInstance, blockInstance, keyringInstance),
            conf: conf,
            log: log,
            receiver: this.receiver,
            s: systemInstance ?? undefined,
            b: blockInstance ?? undefined,
            k: keyringInstance ?? undefined
        }

        const LOG = core.log.lib.LogFunc(core.log);
        LOG("Info", 0, "In:" + this.conf.self.nodename + ":init");
        
        this.coreCondition = "initialized";
        core.lib.coreCondition = this.coreCondition;

        core.lib.generalResults = this.generalResults;

        await this.start(core, core.lib.generalServerServices(), ServerInstance)
        .then(() => { core.lib.coreCondition = "active"; })

        return this.iOK(core);
    }

    /**
     * Start this module
     * @param core - set ccInType instance
     * @param services - set server service implementations
     * @param serverInstance - can inject serverInstance
     * @returns returns with gResult, that is wrapped by a Promise, that contains void if it's success, and gError if it's failure.
     * So there is no need to check the value of success.
     */
    public async start(core: ccInTypeV2, services?: UntypedServiceImplementation, serverInstance?: any): Promise<gResult<void, gError>> {
        const LOG = core.log.lib.LogFunc(core.log);
        LOG("Info", 0, "In:" + this.conf.self.nodename + ":start");

        LOG("Debug", 0, "In:" + this.conf.self.nodename + ":start:startServer");
        if (serverInstance !== undefined) {
            this.server = serverInstance;
        }
        if (this.server === undefined) {
            return this.iError("start", "startServer", "server instance is not defined");
        }
        if (services !== undefined) { this.serviceImplementation = services };
        if (this.serviceImplementation === undefined) {
            return this.iError("start", "startServer", "serviceImplementation is not defined");
        }
        try {
            /* @ts-expect-error */
            this.server.addService(ic_grpc.interconnectService, this.generalServerServices());
            const creds: ServerCredentials = ServerCredentials.createInsecure();
            const port = "0.0.0.0:" + core.conf.self.rpc_port;
            this.server.bindAsync(port, creds, async () => {
                LOG("Notice", 0, "Inter-node  server starts");
                // both server and loop are ready
                for await (const _ of setInterval(100)) {
                    if (this.loopIsActive === true) {
                        this.coreCondition = "active";
                        return this.iOK(undefined);
                    }
                }
            });          
        } catch (error: any) {
            return this.iError("start", "startServer", error.toString());
        }

        return this.iError("start", "startServer", "unknown error");
    }

    /**
     * Restart this module
     * @param conf - set inConfigType instance
     * @param log - set ccLogType instance
     * @param systemInstance - set ccSystemType instance
     * @param blockInstance - set ccBlockType instance
     * @param keyringInstance - set ccKeyringType instance
     * @returns returns with gResult type, that is wrapped by a Promise, that contains ccInType if it's success, and gError if it's failure.
     */
    public async restart(core: ccInTypeV2, log: ccLogType, systemInstance: ccSystemType, blockInstance: ccBlockType, 
        keyringInstance: ccKeyringType): Promise<gResult<ccInTypeV2, gError>> {
        const LOG = core.log.lib.LogFunc(core.log);
        LOG("Info", 0, "In:" + this.conf.self.nodename + ":restart");

        this.coreCondition = "unloaded";
        const ret1 = await this.stop(core);
        if (ret1.isFailure()) return ret1;

        const ret2 = await this.init(core.conf, log, systemInstance, blockInstance, keyringInstance);
        if (ret2.isFailure()) { return this.iError("restart", "init", "unknown error") };
        const newCore: ccInTypeV2 = ret2.value;
        this.coreCondition = "initialized"

        this.coreCondition = "active";
        newCore.lib.coreCondition = this.coreCondition;
        return this.iOK(newCore);
    }

    /**
     * Stop this module
     * @param core - set ccInType instance
     * @returns returns with gResult, that is wrapped by a Promise, that contains void if it's success, and gError if it's failure.
     * So there is no need to check the value of success.
     */
    public async stop(core: ccInTypeV2): Promise<gResult<void, gError>> {
        const LOG = core.log.lib.LogFunc(core.log);
        LOG("Info", 0, "In:" + this.conf.self.nodename + ":stop");

        // server
        if (this.server === undefined) {
            return this.iError("stop", "stopServer", "server instance is not defined");
        }
        const promisedTryShutdown = promisify(this.server.tryShutdown).bind(this.server);
        await promisedTryShutdown()
        .then(() => {})
        .catch((error: any) => {
            return this.iError("stop", "stopServer", error.toString());
        })
        this.server = new Server();

        // channels
        const keys =  Object.keys(this.generalConnections);
        for (const key of keys) {
            const call = this.generalConnections[key];
            call.end();
        }
        this.generalConnections = {};
        return this.iOK<void>(undefined);
    }


    /* Server side functions */

    /**
     * Return implementaions of server services
     * @returns return the services with type UntypedServiceImplementation
     */
    protected generalServerServices(): UntypedServiceImplementation {
        const LOG = this.log.lib.LogFunc(this.log);
        LOG("Info", 0, "In:" + this.conf.self.nodename + ":generalServerServices");

        //const ccCtrlLine: handleUnaryCall<ic.ctrlRequest, ic.ctrlResponse> = (call: ServerUnaryCall<ic.ctrlRequest, ic.ctrlResponse>, callback: sendUnaryData<ic.ctrlResponse>) => {
        //
        //};
        
        return {
            ccGeneralIc: this.generalServerResponse.bind(this),
            ccCtrlLine: this.ctrlResponse.bind(this)
        };
    }

    /**
     * Implementation of general server response
     * @param call - connecting data stream
     */
    protected generalServerResponse(call: ServerDuplexStream<ic.icGeneralPacket, ic.icGeneralPacket>) {
        const LOG = this.log.lib.LogFunc(this.log);
        LOG("Info", 0, "In:" + this.conf.self.nodename + ":generalServerResonse");

        call.on("data", async (req: ic.icGeneralPacket) => {
            LOG("Debug", 0, "In:" + this.conf.self.nodename + ":generalServerResonse:dataArrived");

            this.receiver.generalReceiver(req)
            .then((ret) => {
                if (ret.isSuccess()) {
                    if (ret.value.getPacketId() !== "") { // Need response
                        call.write(ret.value);
                        call.on("error", () => {
                            LOG("Notice", 0, "In:" + this.conf.self.nodename + ":generalServerResonse:Failed sending a packet to: " + ret.value.getReceiver());
                        })
                    } // Otherwise, the process is terminated on this side, so keeping connection silently
                } else {
                    // Drop incorrect packets
                }
            })
        });
    }

    /**
     * Implementation of emergency control line. Necessity is being discussed.
     * @param call - incoming call data
     * @param callback - the callback
     * @returns returns the callback
     */
    protected ctrlResponse(call: ServerUnaryCall<ic.ctrlRequest, ic.ctrlResponse>, callback: sendUnaryData<ic.ctrlResponse>): sendUnaryData<ic.ctrlResponse> {

        const ret: sendUnaryData<ic.ctrlResponse> = () => {
            return null;
        }
        return ret;
    }


    /**
     * Wait until the gRPC server is fully up and running
     * @param core - set ccInType instance
     * @param retryCount - set retry count of the ping
     * @param rpcInstance - can set rpcInstance. Mainly for testing
     * @returns returns with gResult, that is wrapped by a Promise, that contains void if it's success, and gError if it's failure.
     * So there is no need to check the value of success.
     */
    public async waitForRPCisOK(core: ccInTypeV2, retryCount: number, rpcInstance?: any): Promise<gResult<void, gError>> {
        const LOG = core.log.lib.LogFunc(core.log);
        LOG("Info", 0, "In:" + this.conf.self.nodename + ":waitForRPCisOK");

        let rpc;
        if (rpcInstance === undefined) {
            rpc = core.lib.sendRpc;
        } else {
            rpc = rpcInstance;
        }

        let sObj: systemrpc.ccSystemRpcFormat.AsObject;
        sObj = {
            version: 3,
            request: "Ping",
            param: undefined,
            dataasstring: ""
        }
        let nodes = clone(core.conf.nodes);
        for await (const targets of setInterval(1000, nodes, undefined)) {
            let retryNodes: nodeProperty[] = [];
            for (const target of targets) {
                if ((target.nodename === core.conf.self.nodename) && (target.rpc_port === core.conf.self.rpc_port)) continue;
                if (target.allow_outgoing === false) continue;
                sObj.param = { tenant: this.master_key };
                const ret = await rpc(core, target, sObj);
                if (ret.isFailure()) {
                    retryNodes.push(target);
                }
            }
            if (retryNodes.length === 0) {
                return this.iOK<void>(undefined);
            } else if (retryCount === 0) {
                return this.iError("waitForRPCisOK", "sendRpc", "Unreachable nodes have been remained yet:" + JSON.stringify(retryNodes));
            } else {
                retryCount--;
                nodes = retryNodes;
            }
        }
        return this.iError("waitForRPCisOK", "setInterval", "unknown error occured");
    }

    /* Client side functions */

    // Temp: convert format while examination

    /**
     * Send gRPC call to all nodes except disallowed nodes.
     * @param core - set ccInType instance
     * @param payload - set the payload to deliver
     * @param timeoutMs - can set timeout in milliseconds
     * @param clientInstance - can set the instance of client, mainly for testing
     * @returns returns with gResult type that contains rpcReturnFormat[] if it's success, and unknown if it's failure.
     * The return form of this method is somewhat special: it always returns success, and the result of each RPC is stored in rpcReturnFormat[].
     */
    public async sendRpcAll(core: ccInTypeV2, payload: systemrpc.ccSystemRpcFormat.AsObject, timeoutMs?: number,
        clientInstance?: any): Promise<gResult<rpcReturnFormat[], unknown>> {
        const LOG = core.log.lib.LogFunc(core.log);
        LOG("Info", 0, "In:" + this.conf.self.nodename + ":sendRpcAll");

        let rets: rpcReturnFormat[] = [];
        for(const target of core.conf.nodes) {
            if ((target.nodename === core.conf.self.nodename) && (target.rpc_port === core.conf.self.rpc_port)) continue;
            if (target.allow_outgoing === true) {
                const ret = await core.lib.sendRpc(core, target, payload, timeoutMs, clientInstance);
                if (ret.isFailure()) {
                    const ret2: rpcReturnFormat = JSON.parse(ret.value.message);
                    rets.push(ret2);
                } else {
                    rets.push(ret.value);
                }
            }
        }
        return this.iOK<rpcReturnFormat[]>(rets);
    }

    /**
     * Send gRPC call to the specified node.
     * @param core - set ccInType instance
     * @param target - set the target with nodeProperty format
     * @param payload - set the payload to deliver
     * @param timeoutMs - can set timeout in milliseconds
     * @param clientInstance - can inject clientInstance
     * @returns returns with gResult, that is wrapped by a Promise, that contains the result with rpcReturnFormat if it's success, and gError if it's failure.
     * Note that the stringified rpcReturnFormat is stored in the error details.
     */
    public async sendRpc(core: ccInTypeV2, target: nodeProperty, payload: systemrpc.ccSystemRpcFormat.AsObject, 
        timeoutMs?: any, clientInstance?: any, retry?: any): Promise<gResult<rpcReturnFormat, gError>> {
        const LOG = core.log.lib.LogFunc(core.log);
        LOG("Info", 0, "In:" + this.conf.self.nodename + ":sendRpc");
        LOG("Debug", 0, "In:" + this.conf.self.nodename + ":sendRpc:" + payload.request);

        let skipRetry: boolean = false;
        const p = new ic.icPacketPayload();
        p.setPayloadType(ic.payload_type.REQUEST);
        p.setRequest(payload.request);
        switch (payload.request) {
            case "Ping":
                skipRetry = true;
                p.setDataAsString("Ping");
                break;
            case "AddPool":
                p.setDataAsString(payload.dataasstring);
                break;
            case "AddBlock":
                p.setDataAsString(payload.dataasstring);
                break;
            case "AddBlockCa3":
                const data1: inAddBlockDataFormat = {
                    traveling: JSON.parse(payload.dataasstring),
                    removeFromPool: payload.param?.removepool
                }
                p.setDataAsString(JSON.stringify(data1));
                break;
            case "GetPoolHeight":
                const data2: inGetPoolHeightDataFormat = {
                    tenantId: payload.param?.tenant
                }
                p.setDataAsString(JSON.stringify(data2));
                break;
            case "GetBlockHeight":
                const data3: inGetBlockHeightDataFormat = {
                    tenantId: payload.param?.tenant
                }
                p.setDataAsString(JSON.stringify(data3));
                break;
            case "GetBlockDigest":
                const data4: inGetBlockDigestDataFormat = {
                    tenantId: payload.param?.tenant,
                    failIfUnhealthy: payload.param?.failifunhealthy
                }
                p.setDataAsString(JSON.stringify(data4));
                break;
            case "GetBlock":
                const data5: inGetBlockDataFormat = {
                    oid: payload.dataasstring,
                    tenantId: payload.param?.tenant,
                    returnUndefinedIfFail: payload.param?.returnundefinedifnoexistent
                }
                p.setDataAsString(JSON.stringify(data5));
                break;
            case "ExamineBlockDifference":
                const data6: inExamineBlockDiffernceDataFormat = {
                    list: JSON.parse(payload.dataasstring),
                    tenantId: payload.param?.tenant
                }
                p.setDataAsString(JSON.stringify(data6));
                break;
            case "ExaminePoolDifference":
                const data7: inExaminePoolDiffernceDataFormat = {
                    list: payload.dataasstring.split(","),
                    tenantId: payload.param?.tenant
                }
                p.setDataAsString(JSON.stringify(data7));
                break;
            case "DeclareBlockCreation":
                p.setDataAsString(payload.dataasstring);
                break;
            case "SignAndResendOrStore":
                p.setDataAsString(payload.dataasstring);
                break;
            case "ResetTestNode":
                p.setDataAsString(payload.dataasstring);
                break;
            default:
                LOG("Warning", 1, "In:" + this.conf.self.nodename + ":sendRpc:IllegalRequest:" + payload.request);
                return core.lib.iError("sendRpc", "convert", "In:" + this.conf.self.nodename + ":sendRpc:IllegalRequest:" + payload.request);
        }

        const ret1 = await core.lib.sendRequest(core, target, p, skipRetry);
        if (ret1.isFailure()) { return ret1; }

        const ret2 = await core.lib.receiveResult(core, ret1.value);
        if (ret2.isFailure()) { return ret2 }
        if (ret2.value === undefined) { return core.lib.iError("sendRpc", "receiveResult", "payload is empty"); }

        let retCode = -1;
        let retData = undefined;
        if (ret2.value.getPayloadType() === ic.payload_type.RESULT_SUCCESS) {
            retCode = 0;
            retData = ret2.value.getDataAsString();
        } else {
            retCode = -1;
            retData = ret2.value.getDataAsString();
        }
        const ret3: rpcReturnFormat = {
            targetHost: target.host + ":" + target.rpc_port,
            request: payload.request,
            status: retCode,
            data: retData
        }

        return core.lib.iOK(ret3);
    }

    /**
     * The method to get the result
     * @param core - set ccInType instance
     * @param requestId - set the requestId that was returned from sendRequest()
     * @returns returns with gResult, that is wrapped by a Promise, that contains the result with ic.icPacketPayload or undefined if it's success, and gError if it's failure.
     */
    protected async receiveResult(core: ccInTypeV2, requestId: string): Promise<gResult<ic.icPacketPayload | undefined, gError>> {
        const LOG = this.log.lib.LogFunc(this.log);
        LOG("Info", 0, "In:" + this.conf.self.nodename + ":receiveResult");

        if (this.generalResults[requestId] === undefined) {
            return this.iError("receiveResult", "ReturnBox", "The return box for " + requestId + " has NOT been prepared.");
        }

        for await (const result of setInterval(100, this.generalResults[requestId])) {
            if ((result.state !== generalInResultsType.yet) && (result.result !== undefined)) {
                const ret = result.result;
                if (ret.isSuccess()) {
                    delete this.generalResults[requestId];
                    return this.iOK(ret.value.getPayload())
                };
                return ret;
            }
        }
        return this.iError("receiveResult", "EOM", "unknown error");
    }

    /**
     * The method to post the request
     * @param core - set ccInType instance
     * @param target - set the target node information by nodeProperty format
     * @param payload - set the data to post by ic.icPacketPayload
     * @param skipRetry - can set true when retry is unneeded.
     * @returns returns with gResult, that is wrapped by a Promise, that contains the request Id as string if it's success, and gError if it's failure.
     */
    protected async sendRequest(core: ccInTypeV2, target: nodeProperty, payload: ic.icPacketPayload, skipRetry?: boolean): Promise<gResult<string, gError>> {
        const LOG = this.log.lib.LogFunc(this.log);
        LOG("Info", 0, "In:" + this.conf.self.nodename + ":sendRequest");

        let finished: number = generalInResultsType.yet;
        let result: gResult<string, gError> = this.iError("sendRequest", "unknown", "unknown error");

        const ret = await this.setupConnectionWithReceiver(core, target);
        if (ret.isFailure()) { return ret };
        const call = this.generalConnections[target.nodename];

        const msg = new ic.icGeneralPacket();
        msg.setVersion(4);
        msg.setPacketId(randomUUID());
        msg.setSender(core.conf.self.nodename);
        msg.setReceiver(target.nodename);
        msg.setPayload(payload);
        msg.setPrevId("");
        LOG("Debug", 0, "In:" + this.conf.self.nodename + ":sendRequest:msg " + msg.getPacketId() + " from " + msg.getSender() + " to " + msg.getReceiver());

        call.write(msg, () => { // Overwrite by "error" event when actually the callback is error
            result = this.iOK(msg.getPacketId());
            finished = generalInResultsType.success;
            this.generalResults[msg.getPacketId()] = {
                state: generalInResultsType.yet,
                installationtime: new Date().valueOf()
            }
        });
        call.on("error", async () => {
            if (skipRetry !== true) {
                LOG("Info", 0, "In:" + this.conf.self.nodename + ":generalRequest:Failed sending a packet to: " + msg.getReceiver() + ", retry.");
                const ret = await this.setupConnectionWithReceiver(core, target, true);
                if (ret.isFailure()) { result = ret };
                const call = this.generalConnections[target.nodename];

                call.write(msg);
                call.on("error", () => {
                    LOG("Notice", 0, "In:" + this.conf.self.nodename + ":generalRequest:Failed to retry sending a packet to: " + msg.getReceiver() + ", gave up.");
                    result = this.iError("sendRequest", "writeRequest", "Failed sending a packet to: " + msg.getReceiver());
                    finished = generalInResultsType.failure;
                    delete this.generalResults[msg.getPacketId()];
                });
            } else {
                LOG("Info", 0, "In:" + this.conf.self.nodename + ":generalRequest:Failed to retry sending a packet to: " + msg.getReceiver());
                result = this.iError("sendRequest", "writeRequest", "Failed sending a packet to: " + msg.getReceiver());
                finished = generalInResultsType.failure;
                delete this.generalResults[msg.getPacketId()];
            }
        })

        for await (const _ of setInterval(100)) {
            if (finished !== generalInResultsType.yet) {
                LOG("Debug", 0, "In:" + this.conf.self.nodename + ":sendRequest:result:" + JSON.stringify(result));
                return result;
            }
        }

        return this.iError("sendRequest", "EOM", "unknown error");
    }

    /**
     * Connect to the target's server or reuse already-established connection
     * @param core - set ccInType instance
     * @param nodename - set target's nodename
     * @param reset - force to make a new connection
     * @returns returns with gResult, that is wrapped by a Promise, that contains the result with clientInstance format if it's success, and gError if it's failure.
     */
    protected async getConnection(core: ccInTypeV2, nodename: string, reset?: boolean): Promise<gResult<clientInstance, gError>> {
        const LOG = core.log.lib.LogFunc(core.log);
        LOG("Info", 0, "IcModule:getConnection");

        let found: boolean = false;
        let target: string = "";
        for (const node of core.conf.nodes) {
            if (nodename === node.nodename) {
                found = true;
                if (node.allow_outgoing === true) { 
                    target = node.host + ":" + node.rpc_port;
                }
                break;
            }
        }
        if (found === false) {
            return this.iError("getConnection", "nodeConfiguration", "nodename " + nodename + " is not found in the node list");
        }
        if (target === "") {
            return this.iError("getConnection", "nodeConfiguration", "nodename " + nodename + " is not allowed in the node list");
        }

        let current: ClientDuplexStream<ic.icGeneralPacket, ic.icGeneralPacket> | undefined = undefined;
        const keys = Object.keys(this.generalConnections);
        for (const key of keys) {
            if (key === nodename) {
                current = this.generalConnections[key];
                break;
            };
        }
        if ((current !== undefined) && (reset !== true)) {
            return this.iOK({ call: current, newinstance: false });
        }
        if ((current !== undefined) && (reset === true)) {
            current.end()
        }
        try {
            const creds: ChannelCredentials = ChannelCredentials.createInsecure();
            const newclient = new ic_grpc.interconnectClient(target, creds);
            this.generalConnections[nodename] = newclient.ccGeneralIc();
            return this.iOK({ call: this.generalConnections[nodename], newinstance: true });
        } catch (error: any) {
            return this.iError("getConnection", "interconnectClient", error.toString());
        }
    }

    /**
     * The client side's connection method
     * @param core - set ccInType instance
     * @param target - set the target with nodeProperty format
     * @param reset - can set true when it should be a new connection
     * @returns returns with gResult, that is wrapped by a Promise, that returns nothing if it's success, and gError if it's failure.
     */
    protected async setupConnectionWithReceiver(core: ccInTypeV2, target: nodeProperty, reset?: boolean): Promise<gResult<void, gError>> {
        const LOG = this.log.lib.LogFunc(this.log);
        LOG("Info", 0, "In:" + this.conf.self.nodename + ":setupConnectionWithReceiver");

        const ret = await this.getConnection(core, target.nodename, reset);
        if (ret.isFailure()) { return ret };
        if (ret.value.newinstance === true) {
            const call = ret.value.call;
            call.on("data", async (req: ic.icGeneralPacket) => {
                LOG("Debug", 0, "In:" + this.conf.self.nodename + ":setupConnectionWithReceiver:dataArrived");
                /**
                 * 1. isFailure() === true: parsing itself is failed, drop.
                 * 2. isSuccess() === true: parsing successful.
                 * 2.1. ret.value.getPayload()?.getPayloadType() !== ic.payload_type.REQUEST
                 *     This should be the response what it has been requesting
                 * 2.1.1. generalResults[req.getPrevId()] has been prepared
                 *     It need to be saved.
                 * 2.1.2. generalResults[req.getPrevId()] has NOT been prepared
                 *     Drop it. (Do nothing)
                 * 2.2. ret.value.getPayload()?.getPayloadType() === ic.payload_type.REQUEST
                 *     This is request
                 * 2.2.1. ret.value.getPacketId() !== ""
                 *     It needs response.
                 * 2.2.2. ret.value.getPacketId() === ""
                 *     It needs to be terminated with no response. (Do nothing)
                 */
                this.receiver.generalReceiver(req)
                .then((ret) => {
                    if (ret.isSuccess()) {
                        if (ret.value.getPayload()?.getPayloadType() === ic.payload_type.REQUEST) {
                            if (ret.value.getPacketId() !== "") {
                                call.write(ret.value);
                                call.on("error", () => {
                                    LOG("Notice", 0, "In:" + this.conf.self.nodename + ":setupConnectionWithReceiver:Failed sending a packet to: " + ret.value.getReceiver());
                                })
                            }
                        } else {
                            if ((core.lib.generalResults[req.getPrevId()] !== undefined) && (core.lib.generalResults[req.getPrevId()].state === generalInResultsType.yet)) {
                                core.lib.generalResults[req.getPrevId()].state = generalInResultsType.success;
                                core.lib.generalResults[req.getPrevId()].result = this.iOK(ret.value);
                            } else {
                                LOG("Notice", 0, "Dropped a packet that was addressed to me but for which no reply box was provided")
                            }
                        }
                    }
                })
            });

            // Save
            this.generalConnections[target.nodename] = call;
        }

        return this.iOK(undefined)
    }

}