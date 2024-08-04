import { randomUUID } from "crypto";
import { setInterval } from "timers/promises";
import { promisify } from "util";

import clone from "clone";
import { Server, ServerCredentials, ChannelCredentials, handleBidiStreamingCall, ServerDuplexStream, UntypedServiceImplementation, ClientDuplexStream } from "@grpc/grpc-js";

import ic_grpc from "../../grpc/interconnect_grpc_pb.js";
import ic from "../../grpc/interconnect_pb.js";

import { inConnectionResetLevel } from "./index.js";

import { gResult, gSuccess, gFailure, gError } from "../utils.js";
import { moduleCondition } from "../index.js";

import { inConfigType, nodeProperty } from "../config/index.js";
import { ccLogType } from "../logger/index.js";
import { RUNTIME_MASTER_IDENTIFIER, DEFAULT_PARSEL_IDENTIFIER, ccSystemType } from "../system/index.js";
import { ccBlockType } from "../block/index.js";
import { ccKeyringType } from "../keyring/index.js";
import { ccInType, rpcResultFormat } from "./index.js";
import { InReceiverSubModule } from "./receiver.js";

class icServer implements ic_grpc.IinterconnectServer {
    constructor(
        public ccGeneralIc: handleBidiStreamingCall<ic.icGeneralPacket, ic.icGeneralPacket>
    ) {}
}

type inConnection = {
    channel: ic_grpc.interconnectClient,
    call: ClientDuplexStream<ic.icGeneralPacket, ic.icGeneralPacket>
}
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
    protected generalResults: inResults;

    protected log: ccLogType;
    protected conf: inConfigType;
    protected receiver: InReceiverSubModule;

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
     * @param ServerInstance - can inject server instance, mainly for tests
     * @returns returns with gResult type, that is wrapped by a Promise, that contains ccInType if it's success, and unknown if it's failure.
     * So there is no need to be concerned about the failure status.
     */
    public async init(conf: inConfigType, log: ccLogType, systemInstance: ccSystemType, 
        blockInstance: ccBlockType, keyringInstance: ccKeyringType, ServerInstance?: any): Promise<gResult<ccInType, unknown>> {

        this.coreCondition = "loading";

        let core: ccInType = {
            lib: new InModule(conf, log, systemInstance, blockInstance, keyringInstance),
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
     * @param serverInstance - can inject server instance
     * @returns returns with gResult, that is wrapped by a Promise, that contains void if it's success, and gError if it's failure.
     * So there is no need to check the value of success.
     */
    public async start(core: ccInType, services?: UntypedServiceImplementation, serverInstance?: any): Promise<gResult<void, gError>> {
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
                LOG("Notice", 0, "Inter-node server is starting");
                this.coreCondition = "active";
                return this.iOK(undefined);
            });          
        } catch (error: any) {
            return this.iError("start", "createInsecure", error.toString());
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
        keyringInstance: ccKeyringType): Promise<gResult<ccInType, gError>> {
        const LOG = core.log.lib.LogFunc(core.log);
        LOG("Info", 0, "In:" + this.conf.self.nodename + ":restart");

        this.coreCondition = "unloaded";
        const ret1 = await this.stop(core);
        if (ret1.isFailure()) return ret1;

        const ret2 = await this.init(core.conf, log, systemInstance, blockInstance, keyringInstance);
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
    public async stop(core: ccInType): Promise<gResult<void, gError>> {
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
        return {
            ccGeneralIc: this.generalServerResponse.bind(this)
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
     * Wait until the gRPC server is fully up and running
     * @param core - set ccInType instance
     * @param waitSec - set minimum number of seconds to wait for response
     * @param rpcInstance - can set rpcInstance. Mainly for testing
     * @returns returns with gResult, that is wrapped by a Promise, that contains void if it's success, and gError if it's failure.
     * So there is no need to check the value of success.
     */
    public async waitForRPCisOK(core: ccInType, waitSec: number, rpcInstance?: any): Promise<gResult<void, gError>> {
        const LOG = core.log.lib.LogFunc(core.log);
        LOG("Info", 0, "In:" + this.conf.self.nodename + ":waitForRPCisOK");

        let leftNodes = clone(core.conf.nodes);
        for await (const _ of setInterval(1000)) {
            
            let ret: gResult<rpcResultFormat[], gError>
            if (rpcInstance === undefined) {
                ret = await this.runRpcs(core, leftNodes, "Ping", "Ping", waitSec, "check");
            } else {
                ret = await rpcInstance(core, leftNodes, "Ping", "Ping", waitSec, "check");
            }
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
        const id = randomUUID();
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
        const LOG = core.log.lib.LogFunc(core.log);
        LOG("Info", 0, "In:" + this.conf.self.nodename + ":sendPacket");

        const call = this.generalConnections[packet.getReceiver()].call;
        call.write(packet, () => {
            LOG("Debug", 0, "Make a reply box for id: " + packet.getPacketId());
            this.generalResults[packet.getPacketId()] = {
                state: inResultsType.yet,
                installationtime: new Date().valueOf(),
                result: this.iError("undefined")
            }
        });
    }

    /**
     * Run RPCs to multiple nodes in parallel
     * @param core - set ccInType instance
     * @param targets - set target nodes' information with an array of nodeProperty format
     * @param request - set request string
     * @param dataAsString - set data for the request as a string
     * @param maxRetryCount - can set limit of retries. The default is 30.
     * @param resetLevel - can set the level of network resetting when RPC is failed. If it failed again, the level will be escalated, except for "check" level for network checking.
     * @returns returns with gResult, that is wrapped by a Promise, that contains the result with an array of rpcResultFormat if it's success, and gError if it's failure.
     */
    public async runRpcs(core: ccInType, targets: nodeProperty[], request: string, dataAsString: string, maxRetryCount?: number, resetLevel?: inConnectionResetLevel): Promise<gResult<rpcResultFormat[], gError>> {
        const LOG = core.log.lib.LogFunc(core.log);
        LOG("Info", 0, "In:" + this.conf.self.nodename + ":runRpcs");

        if (maxRetryCount === undefined) { maxRetryCount = 30; }
        if (resetLevel === undefined) { resetLevel = "no"; }

        // Auto target control is a provisional specification
        let normalNodes: nodeProperty[] = [];
        for (const target of targets) {
            if ((target.nodename === core.conf.self.nodename) && (target.rpc_port === core.conf.self.rpc_port)) continue;
            if (target.allow_outgoing === false) continue;
            normalNodes.push(target);
        }
        if (normalNodes.length === 0) {
            return this.iError("runRpcs", "runRpcs", "No nodes are allowed to communicate");
        }

        const payload = this.makeOnePayload(request, dataAsString);

        const results: rpcResultFormat[] = [];
        for (const target of normalNodes) {
            const ret = await this.getConnection(core, target.nodename, resetLevel);
            if (ret.isFailure()) { return ret };

            const packet = this.makeOnePacket(core, target, payload);
            LOG("Debug", 0, "In:" + this.conf.self.nodename + ":runRpcs:msg " + packet.getPacketId() + " from " + packet.getSender() + " to " + packet.getReceiver());

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
                if (this.generalResults[result.id].state === inResultsType.success) {
                    successResults.push(result);
                }
                if (this.generalResults[result.id].state === inResultsType.failure) {
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
                    LOG("Notice", 0, "In:" + this.conf.self.nodename + ":runRpcs:Some communication after channel reset for some nodes were still failed. Gave up for them.");
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
                const ret = await this.runRpcs(core, retryNodes, request, dataAsString, maxRetryCount, resetLevel);
                if (ret.isFailure()) return ret;
                restResults = ret.value;
            } else {
                restResults = failureResults;
            }
        }
        const finalResults: rpcResultFormat[] = successResults.concat(restResults);

        // Insert results (Convert to external format)
        for (const result of finalResults) {
            result.result = this.generalResults[result.id].result;
            delete this.generalResults[result.id];
        }
        return this.iOK(finalResults);
    }
    /**
     * Make a new connection in call level, and add call listeners and packet handlers
     * @param core - set ccInType instance
     * @param channel - set channel instance for the target node
     * @returns returns ClientDuplexStream
     */
    protected makeNewCallWithListener(core: ccInType, channel: ic_grpc.interconnectClient): ClientDuplexStream<ic.icGeneralPacket, ic.icGeneralPacket> {
        const LOG = core.log.lib.LogFunc(core.log);
        LOG("Info", 0, "InModule:makeNewCallWithListener");

        const newcall = channel.ccGeneralIc();

        newcall.on("error", async (req: ic.icGeneralPacket) => {
            LOG("Debug", 0, "In:" + this.conf.self.nodename + ":getConnection:data error to " + req.getReceiver());
            this.generalResults[req.getPacketId()] = {
                state: inResultsType.failure,
                installationtime: new Date().valueOf(),
                result: this.iError("sendRequest", "writeRequest", "Failed sending a packet to: " + req.getReceiver())
            }
        })
        newcall.on("data", async (req: ic.icGeneralPacket) => {
            LOG("Debug", 0, "In:" + this.conf.self.nodename + ":getConnection:dataArrived from " + req.getSender());
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
            this.receiver.generalReceiver(req)
            .then((ret) => {
                if (ret.isSuccess()) {
                    if (ret.value.getPayload()?.getPayloadType() === ic.payload_type.REQUEST) {
                        if (ret.value.getPacketId() !== "") {
                            newcall.write(ret.value);
                            newcall.on("error", () => {
                                LOG("Notice", 0, "In:" + this.conf.self.nodename + ":getConnection:Failed sending a packet to: " + ret.value.getReceiver());
                            })
                        }
                    } else {
                        if ((this.generalResults[req.getPrevId()] !== undefined) && (this.generalResults[req.getPrevId()].state === inResultsType.yet)) {
                            this.generalResults[req.getPrevId()].state = inResultsType.success;
                            this.generalResults[req.getPrevId()].result = this.iOK(ret.value);
                        } else {
                            LOG("Notice", 0, "Dropped a packet that was addressed to me but for which no reply box was provided");
                            LOG("Debug", 0, "A reply box for id: " + req.getPrevId() + " should have been prepared.");
                        }
                    }
                }
            })
        });

        return newcall;
    }
    /**
     * Make a new connection from creating the channel
     * @param core - set ccInType instance
     * @param targetName - set target name
     * @param targetHostPort - set a string with the format hostname or ip + ":" + port number
     * @returns returns with gResult, that is wrapped by a Promise, that contains void if it's success, and gError if it's failure.
     * So there is no need to check the value of success.
     */
    protected makeNewChannelAndCall(core: ccInType, targetName: string, targetHostPort: string): gResult<void, gError> {
        const LOG = core.log.lib.LogFunc(core.log);
        LOG("Info", 0, "InModule:makeNewChannelAndCall");

        try {
            const creds: ChannelCredentials = ChannelCredentials.createInsecure();
            const newchannel = new ic_grpc.interconnectClient(targetHostPort, creds);
            const newcall = this.makeNewCallWithListener(core, newchannel);
            this.generalConnections[targetName] = {
                channel: newchannel,
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
     * @returns returns with gResult, that is wrapped by a Promise, that contains the result with clientInstance format if it's success, and gError if it's failure.
     */
    protected async getConnection(core: ccInType, nodename: string, resetLevel?: inConnectionResetLevel): Promise<gResult<clientInstance, gError>> {
        const LOG = core.log.lib.LogFunc(core.log);
        LOG("Info", 0, "IcModule:getConnection");

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
        if ((resetLevel === undefined) || (resetLevel === "no")) {
            if (this.generalConnections[nodename] !== undefined) {
                return this.iOK({ call: this.generalConnections[nodename].call, newcall: false });
            }
        }
        // Recover-call-only second
        if ((resetLevel === "call") || (resetLevel === "check")) {
            if (this.generalConnections[nodename] !== undefined) {
                this.generalConnections[nodename].call.end();
                this.generalConnections[nodename].call = this.makeNewCallWithListener(core, this.generalConnections[nodename].channel);
                return this.iOK({ call: this.generalConnections[nodename].call, newcall: true });
            }
        }
        // Otherwise, full creation
        try {
            this.generalConnections[nodename].call.end();
        } catch (error) {
            
        }
        const ret = this.makeNewChannelAndCall(core, nodename, target);
        if (ret.isSuccess()) {
            return this.iOK({ call: this.generalConnections[nodename].call, newcall: true });
        } else {
            return ret;
        }
    }
}