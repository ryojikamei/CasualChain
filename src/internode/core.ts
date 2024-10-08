import { randomUUID } from "crypto";
import { setInterval } from "timers/promises";
import { promisify } from "util";
import { readFileSync } from "fs";

import clone from "clone";
import { Server, ServerCredentials, ChannelCredentials, ServerDuplexStream, UntypedServiceImplementation, ClientDuplexStream } from "@grpc/grpc-js";

import ic_grpc from "../../grpc/interconnect_grpc_pb.js";
import ic from "../../grpc/interconnect_pb.js";

import { inConnectionResetLevel, inRequestType, inConnection, inCall } from "./index.js";

import { gResult, gSuccess, gFailure, gError } from "../utils.js";
import { moduleCondition } from "../index.js";

import { inConfigType, nodeProperty } from "../config/index.js";
import { ccLogType } from "../logger/index.js";
import { ccSystemType } from "../system/index.js";
import { ccBlockType } from "../block/index.js";
import { ccKeyringType } from "../keyring/index.js";
import { ccConfigType } from "../config/index.js";
import { ccInType, rpcResultFormat } from "./index.js";
import { InReceiverSubModule } from "./receiver.js";

type inConnections = {
    [nodename: string]: inConnection
}

type clientInstance = {
    call: ClientDuplexStream<ic.icGeneralPacket, ic.icGeneralPacket>
    newcall: boolean
}

const inResultsType = { "yet": 0, "success": 1, "failure": 2 } as const;
type inResults = {
    [requestId: string]: {
        state: number,
        callId: string,
        installationtime: number,
        result: gResult<ic.icGeneralPacket, gError>
    }
}

/**
 * InternodeModule, that is in charge of communication among nodes
 */
export class InModule {
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
     * Variable common to each class for setting the module condition
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

    protected generalConnections: inConnections;
    public generalResults: inResults;

    protected log: ccLogType;
    protected conf: inConfigType;
    protected receiver: InReceiverSubModule;

    /** 
     * Holding server instance
     */
    protected server: Server;
    protected serviceImplementation: UntypedServiceImplementation | undefined;

    protected debugId: string

    constructor(conf: inConfigType, log: ccLogType, systemInstance: ccSystemType, blockInstance: ccBlockType, serverInstance?: any, receiverInstance?: any) {
        this.conf = conf;
        this.log = log;
        this.coreCondition = "unloaded";
        this.generalConnections = {};
        this.generalResults = {};
        this.server = serverInstance?? new Server();
        this.receiver = receiverInstance?? new InReceiverSubModule(this.conf, this.log, systemInstance, blockInstance);
        this.debugId = randomUUID();
    }

    /**
     * The initialization of the InternodeModule. It has many arguments to be set.
     * @param conf - set inConfigType instance
     * @param log - set ccLogType instance
     * @param systemInstance - set ccSystemType instance
     * @param blockInstance - set ccBlockType instance
     * @param keyringInstance - set ccKeyringType instance
     * @param ServerInstance - can inject server instance, mainly for tests
     * @param ServiceInstance - can inject server service instance, mainly for tests
     * @param receiverInstance - can inject receiver instance, mainly for tests
     * @returns returns with gResult type, that is wrapped by a Promise, that contains ccInType if it's success, and gError if it's failure.
     */
    public async init(conf: inConfigType, log: ccLogType, systemInstance: ccSystemType, blockInstance: ccBlockType, 
        keyringInstance: ccKeyringType, configInstance: ccConfigType, ServerInstance?: any, ServiceInstance?: any, receiverInstance?: any): Promise<gResult<ccInType, gError>> {

        this.coreCondition = "loading";

        let core: ccInType = {
            lib: new InModule(conf, log, systemInstance, blockInstance, ServerInstance, receiverInstance),
            conf: conf,
            log: log,
            s: systemInstance,
            b: blockInstance,
            k: keyringInstance,
            c: configInstance
        }

        const LOG = core.log.lib.LogFunc(core.log, "In", "init");
        LOG("Info", this.conf.self.nodename + ":start");
        
        this.coreCondition = "initialized";
        core.lib.coreCondition = this.coreCondition;

        core.lib.generalConnections = this.generalConnections;
        core.lib.generalResults = this.generalResults;
        
        let services: UntypedServiceImplementation;
        if (ServiceInstance === undefined) {
            services = core.lib.generalServerServices();
        } else {
            services = ServiceInstance;
        }
        const ret = await this.start(core, services);
        if (ret.isFailure()) return ret;
        core.lib.coreCondition = "active";

        return this.iOK(core);
    }

    /**
     * Start this module
     * @param core - set ccInType instance
     * @param services - set server service implementations
     * @param serverInstance - can inject server instance
     * @returns returns with gResult, that is wrapped by a Promise, that contains void if it's success, and gError if it's failure.
     * So there is no need to check the value of success.
     */
    protected async start(core: ccInType, services?: UntypedServiceImplementation): Promise<gResult<void, gError>> {
        const LOG = core.log.lib.LogFunc(core.log, "In", "start");
        LOG("Info", this.conf.self.nodename + ":start");

        LOG("Debug", this.conf.self.nodename + ":start:startServer");
        if (services !== undefined) { this.serviceImplementation = services; }
        if (this.serviceImplementation === undefined) {
            return this.iError("start", "startServer", "serviceImplementation is not defined");
        }
        let result: gResult<void, gError> | undefined;
        try {
            /* @ts-expect-error */
            this.server.addService(ic_grpc.interconnectService, this.serviceImplementation);
        } catch (error) {
            // Ignore error for duplication
        }
        try {
            let creds: ServerCredentials;
            if ((core.conf.self.use_tls_internode === true) && (core.k !== undefined) && (core.k.cache[0] !== undefined) && (core.k.cache[0].tls_crt !== undefined) && (core.k.cache[0].sign_key !== undefined)) {
                creds = ServerCredentials.createSsl(
                    readFileSync("config/" + core.k.conf.tls_ca_crt_file),
                    [{cert_chain: Buffer.from(core.k.cache[0].tls_crt), 
                        private_key: Buffer.from(core.k.cache[0].sign_key)}],
                    false
                )
            } else {
                if (core.conf.self.use_tls_internode === true) { return this.iError("start", "createSsl", "could not create TLS connection"); }
                creds = ServerCredentials.createInsecure();
            }
            const port = "0.0.0.0:" + core.conf.self.rpc_port;
            this.server.bindAsync(port, creds, (error: any) => {
                if (error === null) {
                    LOG("Notice", "Inter-node server is starting for " + port);
                    result = this.iOK(undefined);
                } else {
                    result = this.iError("start", "createInsecure", error.toString());
                }
            });
        } catch (error: any) {
            result = this.iError("start", "createServer", error.toString());
        }
        for await (const _ of setInterval(200)) {
            if (result !== undefined) {
                return result;
            }
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
    public async restart(core: ccInType, log: ccLogType, systemInstance: ccSystemType, blockInstance: ccBlockType, 
        keyringInstance: ccKeyringType, configInstance: ccConfigType, serverInstance?: any, ServiceInstance?: any): Promise<gResult<ccInType, gError>> {
        const LOG = core.log.lib.LogFunc(core.log, "In", "restart");
        LOG("Info", this.conf.self.nodename + ":start");

        this.coreCondition = "unloaded";
        const ret1 = await this.stop(core, serverInstance, ServiceInstance);
        if (ret1.isFailure()) return ret1;

        const ret2 = await this.init(core.conf, log, systemInstance, blockInstance, keyringInstance, configInstance, serverInstance, ServiceInstance);
        if (ret2.isFailure()) { return this.iError("restart", "init", "unknown error") };
        const newCore: ccInType = ret2.value;
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
    public async stop(core: ccInType, serverInstance?: any, ServiceInstance?: any): Promise<gResult<void, gError>> {
        const LOG = core.log.lib.LogFunc(core.log, "In", "stop");
        LOG("Info", this.conf.self.nodename + ":start");

        try {
            const promisedTryShutdown = promisify(this.server.tryShutdown).bind(this.server);
            await promisedTryShutdown()
            .then(() => {})
            .catch((error: any) => {
                return this.iError("stop", "stopServer", error.toString());
            })
        } catch (error) {
            LOG("Info", this.conf.self.nodename + ":ignore failing of server stop.");   
        }
        
        this.server = serverInstance?? new Server();

        // channels
        core.lib.generalConnections = {};
        return this.iOK<void>(undefined);
    }


    /* Server side functions */

    /**
     * Return implementaions of server services
     * @returns return the services with type UntypedServiceImplementation
     */
    protected generalServerServices(): UntypedServiceImplementation {
        const LOG = this.log.lib.LogFunc(this.log, "In", "generalServerServices");
        LOG("Info", this.conf.self.nodename + ":start");
        return {
            ccGeneralIc: this.generalServerResponse.bind(this)
        };
    }

    /**
     * Implementation of general server response
     * @param call - connecting data stream
     */
    protected generalServerResponse(call: ServerDuplexStream<ic.icGeneralPacket, ic.icGeneralPacket>) {
        const LOG = this.log.lib.LogFunc(this.log, "In", "generalServerResponse");
        LOG("Info", this.conf.self.nodename + ":start");

        call.on("data", async (req: ic.icGeneralPacket) => {
            LOG("Debug", this.conf.self.nodename + ":generalServerResonse:dataArrived");

            this.receiver.generalReceiver(req)
            .then((ret) => {
                if (ret.isSuccess()) {
                    if (ret.value.getPacketId() !== "") { // Need response
                        call.write(ret.value);
                        call.on("error", () => {
                            LOG("Notice", this.conf.self.nodename + ":generalServerResonse:Failed sending a packet to: " + ret.value.getReceiver());
                        })
                    } // Otherwise, the process is terminated on this side, so keeping connection silently
                } else {
                    // Drop incorrect packets
                }
            })
        });
    }

    /* Client side functions */

    /**
     * Wait until other gRPC servers are fully up and running
     * @param core - set ccInType instance
     * @param waitSec - set minimum number of seconds to wait for response
     * @param clientImpl - can inject client implementation class. Mainly for tests
     * @param removeAllChannel - can check from channel creation. Mainly for tests
     * @returns returns with gResult, that is wrapped by a Promise, that contains void if it's success, and gError if it's failure.
     * So there is no need to check the value of success.
     */
    public async waitForRPCisOK(core: ccInType, waitSec: number, clientImpl?: any, removeAllChannel?: boolean): Promise<gResult<void, gError>> {
        const LOG = core.log.lib.LogFunc(core.log, "In", "waitForRPCisOK");
        LOG("Info", this.conf.self.nodename + ":start");

        let leftNodes = clone(core.conf.nodes);
        if (removeAllChannel === true) {
            for (const node of leftNodes) {
                delete core.lib.generalConnections[node.nodename];
            }
        }

        for await (const _ of setInterval(1000)) {
            const ret: gResult<rpcResultFormat[], gError> = await this.runRpcs(core, leftNodes, "Ping", "Ping", waitSec, "check", clientImpl);
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

    /**
     * Receive error list of other nodes, and blocks communication with nodes where a certain number of errors have occurred.
     * @param core - set ccInType instance
     * @param abnormalNodes - set a list of node names that have problems
     * @returns returns no useful values
     */
    public async disableAbnormalNodes(core: ccInType, abnormalNodes: string[]): Promise<gResult<void, unknown>> {
        const LOG = core.log.lib.LogFunc(core.log, "In", "disableAbnormalNodes");
        LOG("Info", this.conf.self.nodename + ":start");

        // When disabled
        if (core.conf.abnormalCountForJudging === 0) {
            LOG("Info", this.conf.self.nodename + ":disabled");
            return this.iOK(undefined);
        }

        if (core.c === undefined) { this.iError("disableAbnormalNodes", "setNodeConfiguration", "Unknown error"); }

        if (abnormalNodes.length !== 0) {
            for (const abnormalNodeName of abnormalNodes) {
                for (const confNode of core.conf.nodes) {
                    if (abnormalNodeName === confNode.nodename) {
                        LOG("Info", this.conf.self.nodename + ":increment " + abnormalNodeName);
                        let count = 1;
                        if (confNode.abnormal_count !== undefined) {
                            count = confNode.abnormal_count + 1;
                        }
                        core.c.lib.setNodeConfiguration(abnormalNodeName, "abnormal_count", count.toString());
                        if (count >= core.conf.abnormalCountForJudging) {
                            LOG("Notice", this.conf.self.nodename + ":disable " + abnormalNodeName);
                            core.c.lib.setNodeConfiguration(abnormalNodeName, "allow_outgoing", "false");
                        }
                    }
                }
            }
        }

        return this.iOK(undefined);
    }

    /**
     * Run RPCs to multiple nodes in parallel
     * @param core - set ccInType instance
     * @param targets - set target nodes' information with an array of nodeProperty format
     * @param request - set request string listing at inRequestType
     * @param dataAsString - set data for the request as a string
     * @param maxRetryCount - can set limit of retries. The default is 30.
     * @param resetLevel - can set the level of network resetting when RPC is failed. If it failed again, the level will be escalated. See description of inConnectionResetLevel for the detail.
     * @param clientImpl - can inject client implementation class. Mainly for tests
     * @returns returns with gResult, that is wrapped by a Promise, that contains the result with an array of rpcResultFormat if it's success, and gError if it's failure.
     */
    public async runRpcs(core: ccInType, targets: nodeProperty[], request: inRequestType, dataAsString: string, maxRetryCount?: number, resetLevel?: inConnectionResetLevel, clientImpl?: any): Promise<gResult<rpcResultFormat[], gError>> {
        const LOG = core.log.lib.LogFunc(core.log, "In", "runRpcs");

        if (maxRetryCount === undefined) { maxRetryCount = 30; }
        if (resetLevel === undefined) { resetLevel = "no"; }

        LOG("Info", this.conf.self.nodename + ":" + request + ", max retry:" + maxRetryCount.toString());

        let normalNodes: nodeProperty[] = [];
        for (const target of targets) {
            if ((target.nodename === core.conf.self.nodename) && (target.rpc_port === core.conf.self.rpc_port)) continue;
            // Auto target control effect
            if (target.allow_outgoing === false) continue;
            normalNodes.push(target);
        }
        if (normalNodes.length === 0) {
            return this.iError("runRpcs", "runRpcs", "No nodes are allowed to communicate");
        }

        const payload = this.makeOnePayload(request, dataAsString);

        const results: rpcResultFormat[] = [];
        for (const target of normalNodes) {
            const ret = await this.getConnection(core, target.nodename, resetLevel, clientImpl);
            if (ret.isFailure()) { return ret };

            const packet = this.makeOnePacket(core, target, payload);
            LOG("Debug", this.conf.self.nodename + ":msg " + packet.getPacketId() + " from " + packet.getSender() + " to " + packet.getReceiver());

            this.sendOnePacket(core, packet); // async
            
            results.push({
                id: packet.getPacketId(),
                node: target,
                result: this.iError("undefined")
            });
        }

        // Wait until all results are available.
        const size = results.length;
        let retryNodes: nodeProperty[] = [];
        let successResults: rpcResultFormat[] = [];
        let failureResults: rpcResultFormat[] = [];
        for await (const _ of setInterval(500)) {
            retryNodes = [];
            successResults = [];
            failureResults = [];
            for (const result of results) {
                if (core.lib.generalResults[result.id].state === inResultsType.success) {
                    successResults.push(result);
                }
                if (core.lib.generalResults[result.id].state === inResultsType.failure) {
                    failureResults.push(result);
                    retryNodes.push(result.node);
                }
            }
            if (failureResults.length + successResults.length === size) { break; }
        }

        // Retry; set resetLevel when retrying
        let restResults: rpcResultFormat[] = [];
        if ((retryNodes.length !== 0) && (maxRetryCount > 0)) {
            maxRetryCount--;
            switch (resetLevel) {
                case "no":
                    resetLevel = "call";
                    break;
                case "call":
                    resetLevel = "channel";
                    break;
                case "channel": // Do not retry fails with channel reset
                    LOG("Notice", this.conf.self.nodename + ":Some communication after channel reset for some nodes were still failed. Gave up for them.");
                    resetLevel = "never";
                    break;
                case "check":
                    resetLevel = "check";
                    break;
                case "never":
                    resetLevel = "never";
                    break;
                default:
                    resetLevel = "no";
                    break;
            }
            if (resetLevel !== "never") {
                const ret = await this.runRpcs(core, retryNodes, request, dataAsString, maxRetryCount, resetLevel, clientImpl);
                if (ret.isFailure()) return ret;
                restResults = ret.value;
            } else {
                restResults = failureResults;
            }
        } else {
            restResults = failureResults;
        }
        const finalResults: rpcResultFormat[] = successResults.concat(restResults);

        // Insert results (Convert to external format)
        for (const result of finalResults) {
            result.result = core.lib.generalResults[result.id].result;
            delete core.lib.generalResults[result.id];
        }
        return this.iOK(finalResults);
    }
    /**
     * Make a payload of a packet
     * @param request - set request type
     * @param dataAsString - set data as string
     * @returns returns a payload with icPacketPayload object
     */
    protected makeOnePayload(request: string, dataAsString: string): ic.icPacketPayload {
        const payload = new ic.icPacketPayload();
        payload.setPayloadType(ic.payload_type.REQUEST);
        payload.setRequest(request);
        payload.setDataAsString(dataAsString);
        return payload;
    }
    /**
     * Make a packet with a payload
     * @param core - set ccInType instance
     * @param target - set target node information with nodeProperty format
     * @param payload - set the payload to deliver
     * @returns returns a packet with icGeneralPacket object
     */
    protected makeOnePacket(core: ccInType, target: nodeProperty, payload: ic.icPacketPayload): ic.icGeneralPacket {
        const LOG = core.log.lib.LogFunc(core.log, "In", "makeOnePacket");
        LOG("Info", this.conf.self.nodename + ":start");
        let id: `${string}-${string}-${string}-${string}-${string}`
        while (true) {
            id = randomUUID(); // Critical at collision
            if (core.lib.generalResults[id] === undefined) break;
        }
        const packet = new ic.icGeneralPacket();
        packet.setVersion(4);
        packet.setPacketId(id);
        packet.setSender(core.conf.self.nodename);
        packet.setReceiver(target.nodename);
        packet.setPayload(payload);
        packet.setPrevId("");
        return packet;
    }
    /**
     * Send a packet to the destination
     * @param core - set ccInType instance
     * @param packet - set the packet
     */
    protected async sendOnePacket(core: ccInType, packet: ic.icGeneralPacket): Promise<void> {
        const LOG = core.log.lib.LogFunc(core.log, "In", "sendOnePacket");
        LOG("Info", this.conf.self.nodename + ":start");

        const call = core.lib.generalConnections[packet.getReceiver()].call;
        call.conn.write(packet, () => {
            LOG("Debug", "CallId: " + call.id + ":Make a reply box for packetId: " + packet.getPacketId());
            core.lib.generalResults[packet.getPacketId()] = {
                state: inResultsType.yet,
                callId: call.id,
                installationtime: new Date().valueOf(),
                result: this.iError("undefined")
            }
        });
    }

    /**
     * Make a new connection in call level, and add call listeners and packet handlers
     * @param core - set ccInType instance
     * @param channel - set channel instance for the target node
     * @returns returns ClientDuplexStream
     */
    protected makeNewCallWithListener(core: ccInType, channel: ic_grpc.interconnectClient, targetName: string): inCall {
        const LOG = core.log.lib.LogFunc(core.log, "In", "makeNewCallWithListener");
        LOG("Info", "start");

        const call: inCall = {
            conn: channel.ccGeneralIc(),
            id: randomUUID()
        }

        call.conn.on("error", async (req: ic.icGeneralPacket) => {
            try {
                LOG("Debug", core.lib.conf.self.nodename + ":makeNewCallWithListener:call_" + call.id + ":data error to " + req.getReceiver());
                core.lib.generalResults[req.getPacketId()] = {
                    state: inResultsType.failure,
                    callId: call.id,
                    installationtime: new Date().valueOf(),
                    result: core.lib.iError("sendRequest", "writeRequest", "Failed sending a packet to: " + req.getReceiver())
                }
            } catch (error) {
                const err = JSON.stringify(req)
                LOG("Debug", core.lib.conf.self.nodename + ":makeNewCallWithListener:call_" + call.id + ":" + err);
                for (const item of Object.keys(core.lib.generalResults)) {
                    const result = core.lib.generalResults[item];
                    if ((result.callId === call.id) && (result.state === inResultsType.yet)) {
                        core.lib.generalResults[item].state = inResultsType.failure;
                        core.lib.generalResults[item].result = core.lib.iError("sendRequest", "writeRequest", err)
                        LOG("Debug", core.lib.conf.self.nodename + ":makeNewCallWithListener:call_" + call.id + ":Error saved");
                    }
                }
            }
        })
        call.conn.on("data", async (req: ic.icGeneralPacket) => {
            LOG("Debug", core.lib.conf.self.nodename + ":makeNewCallWithListener:call_" + call.id+ ":dataArrived from " + req.getSender());
            /**
             * The return packet:
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
            core.lib.receiver.generalReceiver(req)
            .then((ret) => {
                LOG("Debug", "ObjectId: " + core.lib.debugId)
                if (ret.isSuccess()) {
                    if (ret.value.getPayload()?.getPayloadType() === ic.payload_type.REQUEST) {
                        if (ret.value.getPacketId() !== "") {
                            call.conn.write(ret.value);
                            call.conn.on("error", () => {
                                LOG("Notice", this.conf.self.nodename + ":makeNewCallWithListener:Failed sending a packet to: " + ret.value.getReceiver());
                            })
                        }
                    } else {
                        //if ((core.lib.generalResults[req.getPrevId()] !== undefined) && (core.lib.generalResults[req.getPrevId()].state === inResultsType.yet)) {
                        if (core.lib.generalResults[req.getPrevId()] !== undefined) {
                            if (core.lib.generalResults[req.getPrevId()].state === inResultsType.failure) {
                                LOG("Warning", "Overwrite failure result with new success result");
                            } else if (core.lib.generalResults[req.getPrevId()].state === inResultsType.success) {
                                LOG("Notice", "Overwrite success result with new success result. It's OK for unit testing.");
                            }
                            core.lib.generalResults[req.getPrevId()].state = inResultsType.success;
                            core.lib.generalResults[req.getPrevId()].result = core.lib.iOK(ret.value);
                        } else {
                            LOG("Notice", "Dropped a packet that was addressed to me but for which no reply box was provided. It's OK for unit testing.");
                            LOG("Debug", "A reply box for id: " + req.getPrevId() + " should have been prepared.");
                        }
                    }
                }
            })
        });

        return call;
    }
    /**
     * Make a new connection from creating the channel
     * @param core - set ccInType instance
     * @param targetName - set target name
     * @param targetHostPort - set a string with the format hostname or ip + ":" + port number
     * @param clientImpl - can inject client implementation class. Mainly for tests
     * @returns returns with gResult, that is wrapped by a Promise, that contains void if it's success, and gError if it's failure.
     * So there is no need to check the value of success.
     */
    protected makeNewChannelAndCall(core: ccInType, targetName: string, targetHostPort: string, clientImpl?: any): gResult<void, gError> {
        const LOG = core.log.lib.LogFunc(core.log, "In", "makeNewChannelAndCall");
        LOG("Info", "start for " + targetName);

        try {
            const creds: ChannelCredentials = ChannelCredentials.createInsecure();
            let newchannel: ic_grpc.interconnectClient;
            if (clientImpl === undefined) {
                newchannel = new ic_grpc.interconnectClient(targetHostPort, creds);
            } else {
                newchannel = new clientImpl(targetHostPort, creds);
            }
            const channelId = randomUUID();
            LOG("Debug", targetName + ":channel " + channelId + "is created");
            const newcall = this.makeNewCallWithListener(core, newchannel, targetName);
            core.lib.generalConnections[targetName] = {
                channel: { conn: newchannel, id: channelId },
                call: newcall
            }
            return this.iOK(undefined);
        } catch (error: any) {
            return this.iError("makeNewChannelAndCall", "create", error.toString());
        }
    }
    /**
     * Connect to the target's server or reuse already-established connection
     * @param core - set ccInType instance
     * @param nodename - set target's nodename
     * @param resetLevel - can set "call", "channel", or "check" to force to reset a connection
     * @param clientImpl - can inject client implementation class. Mainly for tests
     * @returns returns with gResult, that is wrapped by a Promise, that contains the result with clientImpl format if it's success, and gError if it's failure.
     */
    protected async getConnection(core: ccInType, nodename: string, resetLevel?: inConnectionResetLevel, clientImpl?: any): Promise<gResult<clientInstance, gError>> {
        const LOG = core.log.lib.LogFunc(core.log, "In", "getConnection");
        LOG("Info", "start for " + nodename);

        let found1: boolean = false;
        let target: string = "";
        for (const node of core.conf.nodes) {
            if (nodename === node.nodename) {
                found1 = true;
                if (node.allow_outgoing === true) { 
                    target = node.host + ":" + node.rpc_port;
                }
                break;
            }
        }
        if (found1 === false) {
            return this.iError("getConnection", "nodeConfiguration", "nodename " + nodename + " is not found in the node list");
        }
        if (target === "") {
            return this.iError("getConnection", "nodeConfiguration", "nodename " + nodename + " is not allowed in the node list");
        }

        // AS-IS first
        if ((resetLevel === undefined) || (resetLevel === "no") || (resetLevel === "never")) {
            if (core.lib.generalConnections[nodename] !== undefined) {
                return this.iOK({ call: core.lib.generalConnections[nodename].call.conn, newcall: false });
            }
            if (resetLevel === "never") {
                return this.iError("getConnection", "generalConnections", "There is no connection for nodename " + nodename);
            }
        }
        // Recover-call-only second
        if ((resetLevel === "call") || (resetLevel === "check")) {
            if (core.lib.generalConnections[nodename] !== undefined) {
                core.lib.generalConnections[nodename].call.conn.end();
                core.lib.generalConnections[nodename].call = this.makeNewCallWithListener(core, core.lib.generalConnections[nodename].channel.conn, nodename);
                return this.iOK({ call: core.lib.generalConnections[nodename].call.conn, newcall: true });
            }
        }
        // Otherwise, full creation
        try {
            core.lib.generalConnections[nodename].call.conn.end();
        } catch (error) {
            
        }
        const ret = this.makeNewChannelAndCall(core, nodename, target, clientImpl);
        if (ret.isSuccess()) {
            return this.iOK({ call: core.lib.generalConnections[nodename].call.conn, newcall: true });
        } else {
            return ret;
        }
    }
}