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
import { inAddBlockDataFormat, ccInTypeV2, inGetPoolHeightDataFormat, inGetBlockHeightDataFormat, inGetBlockDigestDataFormat, inGetBlockDataFormat, inExamineBlockDiffernceDataFormat, inExaminePoolDiffernceDataFormat, rpcResultFormat } from "./v2_index.js";

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
        result: gResult<ic.icGeneralPacket, gError>
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
     * @param waitSec - set minimum number of seconds to wait for response
     * @param rpcInstance - can set rpcInstance. Mainly for testing
     * @returns returns with gResult, that is wrapped by a Promise, that contains void if it's success, and gError if it's failure.
     * So there is no need to check the value of success.
     */
    public async waitForRPCisOK(core: ccInTypeV2, waitSec: number, rpcInstance?: any): Promise<gResult<void, gError>> {
        const LOG = core.log.lib.LogFunc(core.log);
        LOG("Info", 0, "In:" + this.conf.self.nodename + ":waitForRPCisOK");

        let leftNodes = clone(core.conf.nodes);
        for await (const _ of setInterval(1000)) {
            let pingNodes: nodeProperty[] = []
            for (const target of leftNodes) {
                if ((target.nodename === core.conf.self.nodename) && (target.rpc_port === core.conf.self.rpc_port)) continue;
                if (target.allow_outgoing === false) continue;
                pingNodes.push(target);
            }
            if (pingNodes.length === 0) {
                return this.iError("waitForRPCisOK", "runRpcs", "No nodes are allowed to communicate");
            }

            const ret = await this.runRpcs(core, pingNodes, "Ping", "Ping", true);
            if (ret.isFailure()) return ret;
            leftNodes = [];
            for (const result of ret.value) {
                if (result.result.isFailure()) { leftNodes.push(result.node); }
            }
            if (leftNodes.length === 0) {
                return this.iOK<void>(undefined);
            } else if (waitSec <= 0) {
                return this.iError("waitForRPCisOK", "runRpcs", "Unreachable nodes have been remained yet:" + JSON.stringify(leftNodes));
            } else {
                waitSec--;
            }
        }
        return this.iError("waitForRPCisOK", "setInterval", "unknown error occured");
    }

    /* Client side functions */

    public async runRpcs(core: ccInTypeV2, targets: nodeProperty[], request: string, dataAsString: string, skipRetry?: boolean): Promise<gResult<rpcResultFormat[], gError>> {
        const LOG = core.log.lib.LogFunc(core.log);
        LOG("Info", 0, "In:" + this.conf.self.nodename + ":runRpcs");

        const payload = new ic.icPacketPayload();
        payload.setPayloadType(ic.payload_type.REQUEST);
        payload.setRequest(request);
        payload.setDataAsString(dataAsString);

        const results: rpcResultFormat[] = []
        for (const target of targets) {
            const ret = await this.setupConnectionWithReceiver(core, target);
            if (ret.isFailure()) { return ret };
            const call = this.generalConnections[target.nodename];

            const id = randomUUID();
            const msg = new ic.icGeneralPacket();
            msg.setVersion(4);
            msg.setPacketId(id);
            msg.setSender(core.conf.self.nodename);
            msg.setReceiver(target.nodename);
            msg.setPayload(payload);
            msg.setPrevId("");
            LOG("Debug", 0, "In:" + this.conf.self.nodename + ":runRpcs:msg " + msg.getPacketId() + " from " + msg.getSender() + " to " + msg.getReceiver());
            
            results.push({
                id: id,
                node: target,
                result: this.iError("undefined")
            });

            call.write(msg, () => {
                this.generalResults[msg.getPacketId()] = {
                    state: generalInResultsType.yet,
                    installationtime: new Date().valueOf(),
                    result: this.iError("undefined")
                }
            });
            call.on("error", async () => {
                if (skipRetry !== true) {
                    const ret = await this.setupConnectionWithReceiver(core, target);
                    if (ret.isFailure()) { return ret };
                    const call = this.generalConnections[target.nodename];

                    call.write(msg, () => {
                        this.generalResults[msg.getPacketId()] = {
                            state: generalInResultsType.yet,
                            installationtime: new Date().valueOf(),
                            result: this.iError("undefined")
                        }
                    });
                    call.on("error", () => {
                        this.generalResults[msg.getPacketId()] = {
                            state: generalInResultsType.failure,
                            installationtime: new Date().valueOf(),
                            result: this.iError("sendRequest", "writeRequest", "Failed sending a packet to: " + msg.getReceiver())
                        }
                    });
                } else {
                    this.generalResults[msg.getPacketId()] = {
                        state: generalInResultsType.failure,
                        installationtime: new Date().valueOf(),
                        result: this.iError("sendRequest", "writeRequest", "Failed sending a packet to: " + msg.getReceiver())
                    }
                }
            });
        }

        // Wait until all results are available.
        const size = targets.length;
        for await (const _ of setInterval(500)) {
            let resolved = 0;
            for (const result of results) {
                if (this.generalResults[result.id].state !== generalInResultsType.yet) { resolved++; }
            }
            if (resolved === size) { break; }
        }

        // Insert results
        for (const result of results) {
            result.result = this.generalResults[result.id].result;
            delete this.generalResults[result.id];
        }
        return this.iOK(results);
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