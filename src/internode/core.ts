/**
 * Copyright (c) 2024 Ryoji Kamei
 * Released under the MIT license
 * https://opensource.org/licenses/mit-license.php
 */

import clone from "clone";

import { promisify } from "util";
import { setInterval } from "timers/promises";

import { gResult, gSuccess, gFailure, gError } from "../utils.js";

import * as grpc from "@grpc/grpc-js";
//import { addReflection } from "grpc-server-reflection";
import systemrpc from '../../grpc/systemrpc_pb.js';
import systemrpc_grpc from "../../grpc/systemrpc_grpc_pb.js";
const { ccSystemRpcFormat, Param, ReturnCode, ReturnValues } = systemrpc;
const { gSystemRpcClient } = systemrpc_grpc;
import { ccInType, heightDataFormat, digestDataFormat, rpcConnectionFormat, rpcReturnFormat } from "./index.js";

import { inConfigType, nodeProperty } from "../config/index.js";
import { ccLogType } from "../logger/index.js";
import { RUNTIME_MASTER_IDENTIFIER, DEFAULT_PARSEL_IDENTIFIER, ccSystemType, examineHashes } from "../system/index.js";
import { ccBlockType } from "../block/index.js";
import { Ca3TravelingFormat, Ca3TravelingIdFormat2 } from "../block/algorithm/ca3.js";
import { ccKeyringType } from "../keyring/index.js";

/**
 * An internal class of InModule that list the inter-node APIs
 */
export class gSystemRpcServer implements systemrpc_grpc.IgSystemRpcServer {
    [name:string]: grpc.UntypedHandleCall;
    constructor(
        public ping: grpc.handleUnaryCall<systemrpc.ccSystemRpcFormat, systemrpc.ReturnValues>,
        public addPool: grpc.handleUnaryCall<systemrpc.ccSystemRpcFormat, systemrpc.ReturnCode>,
        public addBlock: grpc.handleUnaryCall<systemrpc.ccSystemRpcFormat, systemrpc.ReturnCode>,
        public addBlockCa3: grpc.handleUnaryCall<systemrpc.ccSystemRpcFormat, systemrpc.ReturnCode>,
        public getPoolHeight: grpc.handleUnaryCall<systemrpc.ccSystemRpcFormat, systemrpc.ReturnValues>,
        public getBlockHeight: grpc.handleUnaryCall<systemrpc.ccSystemRpcFormat, systemrpc.ReturnValues>,
        public getBlockDigest: grpc.handleUnaryCall<systemrpc.ccSystemRpcFormat, systemrpc.ReturnValues>,
        public getBlock: grpc.handleUnaryCall<systemrpc.ccSystemRpcFormat, systemrpc.ReturnValues>,
        public examineBlockDifference: grpc.handleUnaryCall<systemrpc.ccSystemRpcFormat, systemrpc.ReturnValues>,
        public examinePoolDifference: grpc.handleUnaryCall<systemrpc.ccSystemRpcFormat, systemrpc.ReturnValues>,
        public declareBlockCreation: grpc.handleUnaryCall<systemrpc.ccSystemRpcFormat, systemrpc.ReturnValues>,
        public signAndResendOrStore: grpc.handleUnaryCall<systemrpc.ccSystemRpcFormat, systemrpc.ReturnValues>,
        public resetTestNode: grpc.handleUnaryCall<systemrpc.ccSystemRpcFormat, systemrpc.ReturnCode>
    ){}   
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
    protected iOK<T>(response: T): gResult<T, never> {
        return new gSuccess(response)
    }
    /**
     * Abnormal return method
     * @param func - set the function/method name
     * @param pos - set the position in the func
     * @param message - set the error message
     * @returns returns gFailure instance contains gError instance
     */
    protected iError(func: string, pos?: string, message?: string): gResult<never, gError> {
        return new gFailure(new gError("in", func, pos, message));
    }

    protected log: ccLogType
    protected score: ccSystemType | undefined
    protected bcore: ccBlockType | undefined

    /**
     * Stub values for features not supported in the open source version
     */
    protected master_key: string
    protected common_parsel: string

    protected server: grpc.Server
    protected serverWatch: number // -1: shutdown, 0: not running, 1: runnning
    protected connections: rpcConnectionFormat

    constructor(log: ccLogType, systemInstance: ccSystemType, blockInstance: ccBlockType) {
        this.log = log;
        this.score = systemInstance;
        this.bcore = blockInstance;
        this.master_key = RUNTIME_MASTER_IDENTIFIER;
        this.common_parsel = DEFAULT_PARSEL_IDENTIFIER;
        this.server = new grpc.Server();
        this.serverWatch = 0;
        this.connections = {};
    }

    /**
     * The initialization of the InternodeModule. It has many argument to be set.
     * @param conf - set inConfigType instance
     * @param log - set ccLogType instance
     * @param systemInstance - set ccSystemType instance
     * @param blockInstance - set ccBlockType instance
     * @param keyringInstance - set ccKeyringType instance
     * @returns returns with gResult type, that is wrapped by a Promise, that contains ccInType if it's success, and unknown if it's failure.
     * So there is no need to be concerned about the failure status.
     */
    public async init(conf: inConfigType, log: ccLogType, systemInstance: ccSystemType, 
        blockInstance: ccBlockType, keyringInstance: ccKeyringType): Promise<gResult<ccInType, unknown>> {

        let core: ccInType = {
            lib: new InModule(log, systemInstance, blockInstance),
            conf: conf,
            log: this.log,
            s: systemInstance ?? undefined,
            b: blockInstance ?? undefined,
            k: keyringInstance ?? undefined
        }

        const LOG = this.log.lib.LogFunc(this.log);
        LOG("Info", 0, "InModule:init");

        this.score = core.s;
        this.bcore = core.b;
        
        return this.iOK(core);
    }

    /**
     * Start gRPC server.
     * @param core - set ccInType instance
     * @param serverInstance - can inject serverInstance
     * @returns returns with gResult, that is wrapped by a Promise, that contains void if it's success, and gError if it's failure.
     * So there is no need to check the value of success.
     */
    public async startServer(core: ccInType, serverInstance?: any): Promise<gResult<void, gError>> {
        const LOG = core.log.lib.LogFunc(core.log);
        LOG("Info", 0, "InModule:startServer");

        if (serverInstance !== undefined) {
            this.server = serverInstance;
        }
        //addReflection(server, "./grpc/systemrpc_descriptor.pb");
        try {
            this.server.addService(systemrpc_grpc.gSystemRpcService,
                new gSystemRpcServer(this.pingCallback, this.addPoolCallback, this.addBlockCa2Callback, 
                    this.addBlockCa3Callback,this.getPoolHeightCallback, this.getBlockHeightCallback,
                    this.getBlockDigestCallback, this.getBlockCallback, 
                    this.examineBlockDifferenceCallback, this.examinePoolDifferenceCallback, 
                    this.declareBlockCreationCallback, this.signAndResendOrStoreCallback,
                    this.resetTestNodeCallback)
                    );
            let creds: grpc.ServerCredentials;
            LOG("Notice", 0, "Inter-node server starts");
            creds = grpc.ServerCredentials.createInsecure();
            this.server.bindAsync("0.0.0.0:" + core.conf.self.rpc_port, creds, () => {
                LOG("Info", 0, "InModule:Listen");
            })
        } catch (error: any) {
            return this.iError("startServer", undefined, error.toString());
        }
        return this.iOK<void>(undefined);
    }

    /**
     * Stop gRPC server
     * @param core - set ccInType instance
     * @returns returns with gResult, that is wrapped by a Promise, that contains void if it's success, and gError if it's failure.
     * So there is no need to check the value of success.
     */
    public async stopServer(core: ccInType): Promise<gResult<void, gError>> {
        const LOG = core.log.lib.LogFunc(core.log);
        LOG("Info", 0, "InModule:stopServer");

        const promisedTryShutdown = promisify(this.server.tryShutdown).bind(this.server);
        await promisedTryShutdown()
        .then(() => {})
        .catch((error: any) => {
            return this.iError("stopServer", undefined, error.toString());
        })
        this.serverWatch = -1;
        return this.iOK<void>(undefined);
    }

    /**
     * Wait until the gRPC server is fully up and running
     * @param core - set ccInType instance
     * @param retryCount - set retry count of the ping
     * @param rpcInstance - can set rpcInstance. Mainly for testing
     * @returns returns with gResult, that is wrapped by a Promise, that contains void if it's success, and gError if it's failure.
     * So there is no need to check the value of success.
     */
    public async waitForRPCisOK(core: ccInType, retryCount: number, rpcInstance?: any): Promise<gResult<void, gError>> {
        const LOG = core.log.lib.LogFunc(core.log);
        LOG("Info", 0, "InModule:waitForRPCisOK");

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
                // Wait for wake up of heartbeat
                /* this.serverHeartbeat(core, rpcInstance);
                for await (const serverWatch of setInterval(100, this.serverWatch, undefined)) {
                    if (serverWatch === 1) break
                } */
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

    public async waitForServerIsOK(core: ccInType, target: nodeProperty, rpcInstance?: any): Promise<gResult<void, gError>> {
        const LOG = core.log.lib.LogFunc(core.log);
        LOG("Info", 0, "InModule:waitForServerIsOK");

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

        LOG("Info", 0, "InModule:waitForServerIsOK__2");
        for await (const node of setInterval(1000, target, undefined)) {
            LOG("Info", 0, "InModule:waitForServerIsOK__3");
            let ret: any
            try {
                ret = await rpc(core, node, sObj, 1000);
            } catch (error: any) {
                LOG("Info", 0, "InModule:waitForServerIsOK__4:" + error.toString());
            }
            LOG("Info", 0, "InModule:waitForServerIsOK__5");
            if (ret.isSuccess()) {
                if ((ret.value.status === 0) && (ret.value.data === "Pong")) {
                    LOG("Notice", 0, "Server " + node.nodename + " is OK");
                    break;
                }
            }
            LOG("Debug", 0, "Server " + node.nodename + " is still down");
        }
        return this.iOK<void>(undefined);
    }

    /**
     * Detect and recover from unexpected server termination
     * @param core - set ccInType instance
     * @param rpcInstance - can set rpcInstance. Mainly for testing
     * @param serverInstance - can inject serverInstance
     * @returns returns no useful values
     */
    public async serverHeartbeat(core: ccInType, rpcInstance?: any, serverInstance?: any): Promise<gResult<void, gError>> {
        const LOG = core.log.lib.LogFunc(core.log);
        LOG("Info", 0, "InModule:serverHeartbeat");

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

        const target: nodeProperty = {
            allow_outgoing: true,
            nodename: core.conf.self.nodename,
            rpc_port: core.conf.self.rpc_port,
            host: "localhost",
            abnormal_count: 999
        }

        for await (const serverWatch of setInterval(1000, this.serverWatch, undefined)) {
            if (serverWatch === -1) break;
            if (serverWatch === 0) this.serverWatch = 1;
            LOG("Debug", 0, "Server heartbeat check");

            const ret = await rpc(core, target, sObj);
            if (ret.isSuccess()) {
                if ((ret.value.status === 0) && (ret.value.data === "Pong")) {
                    LOG("Debug", 0, "Server heartbeat OK")
                    continue
                }
            }
            LOG("Notice", 0, "Unexpected internode server termination detected. Restarting: ", { lf: false });
            const ret2 = await core.lib.startServer(core, serverInstance);
            if (ret2.isSuccess()) {
                LOG("Notice", 0, "[ OK ]");
            } else {
                LOG("Notice", 0, "[FAIL]");
                LOG("Notice", 0, JSON.stringify(ret2.value));
                LOG("Notice", 0, "Force restarting: ", { lf: false });
                const promisedForceShutdown = promisify(this.server.forceShutdown).bind(this.server);
                await promisedForceShutdown()
                .then(() => {
                    core.lib.startServer(core, serverInstance)
                    .then(() => { LOG("Notice", 0, "[ OK ]"); })
                    .catch((error: any) => {
                        LOG("Notice", 0, "[FAIL]");
                        LOG("Notice", 0, error.toString());
                    })
                })
                .catch((error: any) => {
                    LOG("Notice", 0, "[FAIL]");
                    LOG("Notice", 0, error.toString());
                })
            }
        }

        return this.iOK<void>(undefined);
    }

    public async startPing(core: ccInType): Promise<void> {

        let payload =  new systemrpc.ccSystemRpcFormat();
        payload.setVersion(1);
        payload.setRequest("Ping");
        payload.setParam(undefined);
        payload.setDataasstring("");

        for await (const _ of setInterval(100)) {
            const ret = await this.sendRpcAll(core, payload.toObject())
            console.log("[" + core.conf.self.nodename + "]:" + JSON.stringify(ret));
        }
    }

    /**
     * The function for checking communication
     * 
     */
    public pingCallback: grpc.handleUnaryCall<systemrpc.ccSystemRpcFormat, systemrpc.ReturnValues> = (call, callback) => {
        const LOG = this.log.lib.LogFunc(this.log);
        LOG("Info", 0, "InModule:pingCallback");

        let ret: systemrpc.ReturnValues = new ReturnValues();
        ret = ret.setReturncode(0);
        ret = ret.setDataasstring("Pong");
        return callback(null, ret);
    }

    /**
     * The relay function for AddPool to call requestToAddPool.
     */
    public addPoolCallback: grpc.handleUnaryCall<systemrpc.ccSystemRpcFormat, systemrpc.ReturnCode> = (call, callback) => {
        const LOG = this.log.lib.LogFunc(this.log);
        LOG("Info", 0, "InModule:addPoolCallback");

        let ret: systemrpc.ReturnCode = new ReturnCode();

        const ret1 = JSON.parse(call.request.getDataasstring());

        if (this.score !== undefined) {
            this.score.lib.requestToAddPool(this.score, ret1)
            .then((data) => {
                if (data.isFailure()) {
                    ret = ret.setReturncode(-1);
                    return callback(null, ret);
                }
                ret = ret.setReturncode(0);
                return callback(null, ret);
            })
        } else {
            throw new Error("The system module is down");
        }
    }

    /**
     * The function to answer communications from CA2 nodes
     */
    public addBlockCa2Callback: grpc.handleUnaryCall<systemrpc.ccSystemRpcFormat, systemrpc.ReturnCode> = (call, callback) => {
        const LOG = this.log.lib.LogFunc(this.log);
        LOG("Info", 0, "InModule:addBlockCallback");

        let ret1: systemrpc.ReturnCode = new ReturnCode();
        LOG("Warning", 0, "Ca2 request, addBlockCa2Callback, is ignored. CA2 is not supported on this node.");
        ret1 = ret1.setReturncode(-2);
        return callback(null, ret1);
    }

    /**
     * The relay function for AddBlock from CA3 node to call requestToAddBlock properly.
     */
    public addBlockCa3Callback: grpc.handleUnaryCall<systemrpc.ccSystemRpcFormat, systemrpc.ReturnCode> = (call, callback) => {
        const LOG = this.log.lib.LogFunc(this.log);
        LOG("Info", 0, "InModule:addBlockCallback");

        let ret: systemrpc.ReturnCode = new ReturnCode();
        const tObj: Ca3TravelingFormat = JSON.parse(call.request.getDataasstring());
        const params = call.request.getParam();
        let removeFromPool: boolean | undefined;
        if (params !== undefined) {
            removeFromPool = params.getRemovepool();
        }
        if (this.score !== undefined) {
            this.score.lib.requestToAddBlock(this.score, tObj.block, removeFromPool, tObj.trackingId)
            .then((data) => {
                if (data.isFailure()) {
                    ret = ret.setReturncode(-1);
                    return callback(null, ret);
                }
                ret = ret.setReturncode(0);
                if (ret.getReturncode() === 0) {
                    if (this.bcore !== undefined) {
                        this.bcore.algorithm.closeATransaction(tObj.trackingId);
                    }
                }
                return callback(null, ret);
            })
        } else {
            throw new Error("The system module is down");
        }
    }

    /**
     * The relay function for GetPoolHeight to call requestToGetPoolHeight.
     */
    public getPoolHeightCallback: grpc.handleUnaryCall<systemrpc.ccSystemRpcFormat, systemrpc.ReturnValues> = (call, callback) => {
        const LOG = this.log.lib.LogFunc(this.log);
        LOG("Info", 0, "InModule:getPoolHeightCallback");

        let ret: systemrpc.ReturnValues = new ReturnValues();
        const params = call.request.getParam();
        let tenantId: string | undefined;
        if (params !== undefined) {
            tenantId = params.getTenant();
        }
        if (this.score !== undefined) {
            this.score.lib.requestToGetPoolHeight(this.score, tenantId)
            .then((data) => {
                if (data.isFailure()) {
                    ret = ret.setReturncode(-1);
                    return callback(null, ret);
                }
                ret = ret.setReturncode(0);
                const d: heightDataFormat = {
                    height: data.value
                }
                ret = ret.setDataasstring(JSON.stringify(d))
                return callback(null, ret);
            })
        } else {
            throw new Error("The system module is down");
        }
    }

    /**
     * The relay function for GetBlockHeight to call requestToGetBlockHeight.
     */
    public getBlockHeightCallback: grpc.handleUnaryCall<systemrpc.ccSystemRpcFormat, systemrpc.ReturnValues> = (call, callback) => {
        const LOG = this.log.lib.LogFunc(this.log);
        LOG("Info", 0, "InModule:getBlockHeightCallback");

        let ret: systemrpc.ReturnValues = new ReturnValues();
        const params = call.request.getParam();
        let tenantId: string | undefined;
        if (params !== undefined) {
            tenantId = params.getTenant();
        }
        if (this.score !== undefined) {
            this.score.lib.requestToGetBlockHeight(this.score, tenantId)
            .then((data) => {
                if (data.isFailure()) {
                    ret = ret.setReturncode(-1);
                    return callback(null, ret);
                }   
                ret = ret.setReturncode(0);
                const d: heightDataFormat = {
                    height: data.value
                }
                ret = ret.setDataasstring(JSON.stringify(d))
                return callback(null, ret);
            })
        } else {
            throw new Error("The system module is down");
        }
    }

    /**
     * The relay function for GetBlockDigest to call requestToGetLastHash.
     */
    public getBlockDigestCallback: grpc.handleUnaryCall<systemrpc.ccSystemRpcFormat, systemrpc.ReturnValues> = (call, callback) => {
        const LOG = this.log.lib.LogFunc(this.log);
        LOG("Info", 0, "InModule:getBlockDigestCallback");

        let ret: systemrpc.ReturnValues = new ReturnValues();
        const params = call.request.getParam();
        let tenantId: string | undefined;
        let failIfUnhealthy: boolean | undefined;
        if (params !== undefined) {
            tenantId = params.getTenant();
            failIfUnhealthy = params.getFailifunhealthy();
        }
        if (this.score !== undefined) {
            this.score.lib.requestToGetLastHash(this.score, tenantId, failIfUnhealthy)
            .then((data) => {
                if (data.isFailure()) {
                    ret = ret.setReturncode(-1);
                    return callback(null, ret);
                }
                if (data.value.hash !== "") {
                    ret = ret.setReturncode(0);
                } else {
                    ret = ret.setReturncode(-1);
                }
                const d: digestDataFormat = {
                    hash: data.value.hash,
                    height: data.value.height
                }
                ret = ret.setDataasstring(JSON.stringify(d))
                return callback(null, ret);
            })
        } else {
            throw new Error("The system module is down");
        }
    }

    /**
     * The relay function for GetBlock to call requestToGetBlock.
     */
    public getBlockCallback: grpc.handleUnaryCall<systemrpc.ccSystemRpcFormat, systemrpc.ReturnValues> = (call, callback) => {
        const LOG = this.log.lib.LogFunc(this.log);
        LOG("Info", 0, "InModule:getBlockCallback");

        let ret: systemrpc.ReturnValues = new ReturnValues();
        const oid: string = call.request.getDataasstring();
        const params = call.request.getParam();
        let tenantId: string | undefined;
        let returnUndefinedIfFail: boolean | undefined;
        if (params !== undefined) {
            tenantId = params.getTenant();
            returnUndefinedIfFail = params.getReturnundefinedifnoexistent();
        }
        if (this.score !== undefined) {
            this.score.lib.requestToGetBlock(this.score, oid, returnUndefinedIfFail, tenantId)
            .then((data) => {
                if (data.isFailure()) {
                    ret = ret.setReturncode(-1);
                    return callback(null, ret);
                }
                if (data.value !== undefined) {
                    ret = ret.setDataasstring(JSON.stringify(data.value));
                    return callback(null, ret);
                } else {
                    return callback(null, undefined);
                }
            })
        } else {
            throw new Error("The system module is down");
        }
    }

    /**
     * The relay function for ExamineBlockDifference to call requestToExamineBlockDifference.
     */
    public examineBlockDifferenceCallback: grpc.handleUnaryCall<systemrpc.ccSystemRpcFormat, systemrpc.ReturnValues> = (call, callback) => {
        const LOG = this.log.lib.LogFunc(this.log);
        LOG("Info", 0, "InModule:examineBlockDifferenceCallback");

        const examineList: examineHashes = JSON.parse(call.request.getDataasstring());
        let ret: systemrpc.ReturnValues = new ReturnValues();
        const params = call.request.getParam();
        let tenantId: string | undefined;
        if (params !== undefined) {
            tenantId = params.getTenant();
        }
        if (this.score !== undefined) {
            this.score.lib.requestToExamineBlockDifference(this.score, examineList, tenantId)
            .then((data) => {
                if (data.isFailure()) {
                    ret = ret.setReturncode(-1);
                    return callback(null, ret);
                }
                ret = ret.setReturncode(0);
                ret = ret.setDataasstring(JSON.stringify(data.value))
                return callback(null, ret);
            })
        } else {
            throw new Error("The system module is down");
        }
    }

    /**
     * The relay function for ExaminePoolDifference to call requestToExaminePoolDifference.
     */
    public examinePoolDifferenceCallback: grpc.handleUnaryCall<systemrpc.ccSystemRpcFormat, systemrpc.ReturnValues> = (call, callback) => {
        const LOG = this.log.lib.LogFunc(this.log);
        LOG("Info", 0, "InModule:examinePoolDifferenceCallback");

        const examineList: string[] = call.request.getDataasstring().split(",");
        let ret: systemrpc.ReturnValues = new ReturnValues();
        const params = call.request.getParam();
        let tenantId: string | undefined;
        if (params !== undefined) {
            tenantId = params.getTenant();
        }
        if (this.score !== undefined) {
            this.score.lib.requestToExaminePoolDifference(this.score, examineList, tenantId)
            .then((data) => {
                if (data.isFailure()) {
                    ret = ret.setReturncode(-1);
                    return callback(null, ret);
                }
                ret = ret.setReturncode(0);
                ret = ret.setDataasstring(JSON.stringify(data.value))
                return callback(null, ret);
            })
        } else {
            throw new Error("The system module is down");
        }
    }
    
    /**
     * The relay function for DeclareBlockCreation to call requestToDeclareBlockCreation.
     */
    public declareBlockCreationCallback: grpc.handleUnaryCall<systemrpc.ccSystemRpcFormat, systemrpc.ReturnValues> = (call, callback) => {
        const LOG = this.log.lib.LogFunc(this.log);
        LOG("Info", 0, "InModule:declareBlockCreationCallback");

        const tObj: Ca3TravelingIdFormat2 = JSON.parse(call.request.getDataasstring());
        let ret: systemrpc.ReturnValues = new ReturnValues();
        if (this.bcore !== undefined) {
            this.bcore.algorithm.requestToDeclareBlockCreation(this.bcore, tObj)
            .then((data: any) => {
                if (data.isFailure()) {
                    ret = ret.setReturncode(-1);
                    return callback(null, ret);
                }
                ret = ret.setReturncode(0);
                ret = ret.setDataasstring(JSON.stringify(data.value));
                return callback(null, ret);
            })
        } else {
            throw new Error("The block module is down");
        }
    }
    
    /**
     * The relay function for SignAndResendOrStore to call requestToSignAndResendOrStore.
     */
    public signAndResendOrStoreCallback: grpc.handleUnaryCall<systemrpc.ccSystemRpcFormat, systemrpc.ReturnValues> = (call, callback) => {
        const LOG = this.log.lib.LogFunc(this.log);
        LOG("Info", 0, "InModule:signAndResendOrStoreCallback");

        const tObj: Ca3TravelingFormat = JSON.parse(call.request.getDataasstring());
        let ret: systemrpc.ReturnValues = new ReturnValues();
        if (this.bcore !== undefined) {
            this.bcore.algorithm.requestToSignAndResendOrStore(this.bcore, tObj)
            .then((data: any) => {
                if (data.isFailure()) {
                    ret = ret.setReturncode(-1);
                    return callback(null, ret);
                }
                ret = ret.setReturncode(0);
                ret = ret.setDataasstring(JSON.stringify(data.value));
                return callback(null, ret);
            })
        } else {
            throw new Error("The block module is down");
        }
    }    

    /**
     * Whole network reset call from a node to each node. Testing only.
     */
    public resetTestNodeCallback: grpc.handleUnaryCall<systemrpc.ccSystemRpcFormat, systemrpc.ReturnCode> = (call, callback) => {
        const LOG = this.log.lib.LogFunc(this.log);
        LOG("Info", 0, "InModule:resetTestNodeCallback");

        let ret1: systemrpc.ReturnCode = new ReturnCode();
        LOG("Warning", 0, "resetTestNodeCallback is ignored. It is not supported on this node.");
        ret1 = ret1.setReturncode(-2);
        return callback(null, ret1);
    }


    /**
     * Send gRPC call to all nodes except disallowed nodes.
     * @param core - set ccInType instance
     * @param payload - set the payload to deliver
     * @param timeoutMs - can set timeout in milliseconds
     * @param clientInstance - can set the instance of client, mainly for testing
     * @returns returns with gResult type that contains rpcReturnFormat[] if it's success, and unknown if it's failure.
     * The return form of this method is somewhat special: it always returns success, and the result of each RPC is stored in rpcReturnFormat[].
     */
    public async sendRpcAll(core: ccInType, payload: systemrpc.ccSystemRpcFormat.AsObject, timeoutMs?: number,
        clientInstance?: systemrpc_grpc.gSystemRpcClient): Promise<gResult<rpcReturnFormat[], unknown>> {
        const LOG = core.log.lib.LogFunc(core.log);
        LOG("Info", 0, "InModule:sendRpcAll");

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
     * create gRPC connection to a target
     * @param core - set ccInType instance
     * @param target - set target information with nodeProperty type
     * @param timeoutMs - can set timeout in milliseconds
     * @param clientInstance - can set the instance of client, mainly for testing
     * @returns returns with gResult, that is wrapped by a Promise, that contains the result with systemrpc_grpc.gSystemRpcClient if it's success, and gError if it's failure.
     */
    protected async createRpcConnection(core: ccInType, target: nodeProperty, timeoutMs?: number, 
        clientInstance?: systemrpc_grpc.gSystemRpcClient): Promise<gResult<systemrpc_grpc.gSystemRpcClient, gError>> {
        const LOG = core.log.lib.LogFunc(core.log);
        LOG("Info", 0, "InModule:createRpcConnection");

        const targetHost: string = target.host + ":" + target.rpc_port;
        let client: systemrpc_grpc.gSystemRpcClient;

        if (this.connections[targetHost] !== undefined) {
            LOG("Debug", 0, "InModule:createRpcConnection:reuse");
            client = this.connections[targetHost];
        } else {
            if (clientInstance === undefined) {
                let creds: grpc.ChannelCredentials;
                creds = grpc.credentials.createInsecure();
                if (timeoutMs === undefined) {
                    client = new gSystemRpcClient(targetHost, creds, { waitForReady: true });
                } else {
                    client = new gSystemRpcClient(targetHost, creds, { waitForReady: true, deadline: timeoutMs });
                }
            } else {
                client = clientInstance;
            }
            this.connections[targetHost] = client;
        }

        return this.iOK(client);
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
    public async sendRpc(core: ccInType, target: nodeProperty, payload: systemrpc.ccSystemRpcFormat.AsObject, 
        timeoutMs?: number, clientInstance?: systemrpc_grpc.gSystemRpcClient, retry?: number): Promise<gResult<rpcReturnFormat, gError>> {
        const LOG = core.log.lib.LogFunc(core.log);

        const targetHost: string = target.host + ":" + target.rpc_port;
        if (retry === undefined) {
            LOG("Info", 0, "InModule:sendRpc:" + targetHost);
            retry = 1;
        } else {
            retry++;
            delete this.connections[targetHost];
            LOG("Info", 0, "InModule:sendRpc(" + retry.toString()  + "):" + targetHost);
        }
        let ret: rpcReturnFormat = {
            targetHost: targetHost,
            request: payload.request,
            status: -1,
            data: undefined
        }

        if (target.allow_outgoing === false) {
            ret.data = "disallowCommunication";
            return this.iError("sendRpc", "disallowCommunication", JSON.stringify(ret));
        }

        const ret2 = await core.lib.createRpcConnection(core, target, timeoutMs, clientInstance);
        if (ret2.isFailure()) {
            ret.status = -2;
            ret.data = ret2.value.origin.detail;
            return this.iError("sendRpc", "createRpcConnection", JSON.stringify(ret));
        }
        const client: systemrpc_grpc.gSystemRpcClient = ret2.value;

        //return await core.lib.callRpcFunc(core, client, payload, ret);
        const ret3 = await core.lib.callRpcFunc(core, client, payload, ret);
        if (ret3.isSuccess()) { return ret3 };
        const ret4: rpcReturnFormat = JSON.parse(ret3.value.message);
        switch (ret4.status) {
            case -1:
                if (retry > 10) return ret3;
                //await core.lib.waitForServerIsOK(core, target);
                return await core.lib.sendRpc(core, target, payload, timeoutMs, clientInstance, retry);
            case -14:
            //    if (retry > 10) return ret3;
            //    await core.lib.waitForServerIsOK(core, target);
                return await core.lib.sendRpc(core, target, payload, timeoutMs, clientInstance, retry);
            default:
                return ret3;
        }
    }

    /**
     * Call one of functions that is supported this module 
     * @param core - set ccInType instance
     * @param client - set client instance
     * @param payload - set the payload to deliver
     * @param ret - set properties of the target host in rpcReturnFormat
     * @returns returns with gResult, that is wrapped by a Promise, that contains the result with rpcReturnFormat if it's success, and gError if it's failure.
     */
    protected async callRpcFunc(core: ccInType, client: systemrpc_grpc.gSystemRpcClient, payload:
        systemrpc.ccSystemRpcFormat.AsObject, ret: rpcReturnFormat): Promise<gResult<rpcReturnFormat, gError>> {
        const LOG = core.log.lib.LogFunc(core.log);
        LOG("Info", 0, "InModule:callRpcFunc");

        let gPayload: systemrpc.ccSystemRpcFormat = new ccSystemRpcFormat();
        gPayload.setVersion(payload.version);
        gPayload.setRequest(payload.request);
        if (payload.param !== undefined) {
            const Param1: systemrpc.Param = new Param();
            if (payload.param.tenant === undefined) {
                if (this.score !== undefined) Param1.setTenant(this.common_parsel);
            } else {
                Param1.setTenant(payload.param.tenant);
            }
            if (payload.param.removepool === true) {
                Param1.setRemovepool(true);
            } else {
                Param1.setRemovepool(false);
            }
            if (payload.param.failifunhealthy === true) {
                Param1.setFailifunhealthy(true);
            } else {
                Param1.setFailifunhealthy(false);
            }
            if (payload.param.returnundefinedifnoexistent === true) {
                Param1.setReturnundefinedifnoexistent(true);
            } else {
                Param1.setReturnundefinedifnoexistent(false);
            }
            gPayload.setParam(Param1);
        }
        if (payload.dataasstring !== undefined) {
            gPayload.setDataasstring(payload.dataasstring);
        }

        switch (payload.request) {
            case "Ping":
                LOG("Info", 0, "InModule:sendRpc:Ping");
                const promisedPing = promisify<systemrpc.ccSystemRpcFormat, systemrpc.ReturnValues>(client.ping).bind(client);
                await promisedPing(gPayload)
                .then((res) => {
                    ret.status = res.getReturncode() * 100;
                    ret.data = res.getDataasstring();
                }).catch((reason) => {
                    const gRPCException: any = reason;
                    ret.status = gRPCException.code * -1;
                    ret.data = gRPCException.details;
                    LOG("Info", 0, "InModule:sendRpc:Exception:" +  JSON.stringify(ret));
                })
                break;
            case "AddPool":
                LOG("Info", 0, "InModule:sendRpc:AddPool");
                const promisedAddPool = promisify<systemrpc.ccSystemRpcFormat, systemrpc.ReturnCode>(client.addPool).bind(client);
                await promisedAddPool(gPayload)
                .then((res) => {
                    ret.status = res.getReturncode() * 100; // Shift to avoid conflicts with gRPC status codes
                }).catch((reason) => {
                    const gRPCException: any = reason;
                    ret.status = gRPCException.code * -1;
                    ret.data = gRPCException.details;
                    LOG("Info", 0, "InModule:sendRpc:Exception:" +  JSON.stringify(ret));
                })
                break;
            case "AddBlock":
                LOG("Info", 0, "InModule:sendRpc:AddBlock");
                const promisedAddBlock = promisify<systemrpc.ccSystemRpcFormat, systemrpc.ReturnCode>(client.addBlock).bind(client);
                await promisedAddBlock(gPayload)
                .then((res) => {
                    ret.status = res.getReturncode() * 100;
                }).catch((reason) => {
                    const gRPCException: any = reason;
                    ret.status = gRPCException.code * -1;
                    ret.data = gRPCException.details;
                    LOG("Info", 0, "InModule:sendRpc:Exception:" +  JSON.stringify(ret));
                })
                break;
            case "AddBlockCa3":
                LOG("Info", 0, "InModule:sendRpc:AddBlockCa3");
                const promisedAddBlockCa3 = promisify<systemrpc.ccSystemRpcFormat, systemrpc.ReturnCode>(client.addBlockCa3).bind(client);
                await promisedAddBlockCa3(gPayload)
                .then((res) => {
                    ret.status = res.getReturncode() * 100;
                }).catch((reason) => {
                    const gRPCException: any = reason;
                    ret.status = gRPCException.code * -1;
                    ret.data = gRPCException.details;
                    LOG("Info", 0, "InModule:sendRpc:Exception:" +  JSON.stringify(ret));
                })
                break;
            case "GetPoolHeight":
                LOG("Info", 0, "InModule:sendRpc:GetPoolHeight");
                const promisedGetPoolHeight = promisify<systemrpc.ccSystemRpcFormat, systemrpc.ReturnValues>(client.getPoolHeight).bind(client);
                await promisedGetPoolHeight(gPayload)
                .then((res) => {
                    ret.status = res.getReturncode() * 100;
                    ret.data = res.getDataasstring();
                }).catch((reason) => {
                    const gRPCException: any = reason;
                    ret.status = gRPCException.code * -1;
                    ret.data = gRPCException.details;
                    LOG("Info", 0, "InModule:sendRpc:Exception:" +  JSON.stringify(ret));
                })
                break;
            case "GetBlockHeight":
                LOG("Info", 0, "InModule:sendRpc:GetBlockHeight");
                const promisedGetBlockHeight = promisify<systemrpc.ccSystemRpcFormat, systemrpc.ReturnValues>(client.getBlockHeight).bind(client);
                await promisedGetBlockHeight(gPayload)
                .then((res) => {
                    ret.status = res.getReturncode() * 100;
                    ret.data = res.getDataasstring();
                }).catch((reason) => {
                    const gRPCException: any = reason;
                    ret.status = gRPCException.code * -1;
                    ret.data = gRPCException.details;
                    LOG("Info", 0, "InModule:sendRpc:Exception:" +  JSON.stringify(ret));
                })
                break;
            case "GetBlockDigest":
                LOG("Info", 0, "InModule:sendRpc:GetBlockDigest");
                const promisedGetBlockDigest = promisify<systemrpc.ccSystemRpcFormat, systemrpc.ReturnValues>(client.getBlockDigest).bind(client);
                await promisedGetBlockDigest(gPayload)
                .then((res) => {
                    ret.status = res.getReturncode() * 100;
                    ret.data = res.getDataasstring();
                }).catch((reason) => {
                    const gRPCException: any = reason;
                    ret.status = gRPCException.code * -1;
                    ret.data = gRPCException.details;
                    LOG("Info", 0, "InModule:sendRpc:Exception:" +  JSON.stringify(ret));
                })
                break;
            case "GetBlock":
                LOG("Info", 0, "InModule:sendRpc:GetBlock");
                const promisedGetBlock = promisify<systemrpc.ccSystemRpcFormat, systemrpc.ReturnValues>(client.getBlock).bind(client);
                await promisedGetBlock(gPayload)
                .then((res) => {
                    ret.status = res.getReturncode() * 100;
                    ret.data = res.getDataasstring();
                }).catch((reason) => {
                    const gRPCException: any = reason;
                    ret.status = gRPCException.code * -1;
                    ret.data = gRPCException.details;
                    LOG("Info", 0, "InModule:sendRpc:Exception:" +  JSON.stringify(ret));
                })
                break;
            case "ExamineBlockDifference":
                LOG("Info", 0, "InModule:sendRpc:ExamineBlockDifference");
                const promisedExamineBlockDifference = promisify<systemrpc.ccSystemRpcFormat, systemrpc.ReturnValues>(client.examineBlockDifference).bind(client);
                await promisedExamineBlockDifference(gPayload)
                .then((res) => {
                    ret.status = res.getReturncode() * 100;
                    ret.data = res.getDataasstring();
                }).catch((reason) => {
                    const gRPCException: any = reason;
                    ret.status = gRPCException.code * -1;
                    ret.data = gRPCException.details;
                    LOG("Info", 0, "InModule:sendRpc:Exception:" +  JSON.stringify(ret));
                })
                break;
            case "ExaminePoolDifference":
                LOG("Info", 0, "InModule:sendRpc:ExaminePoolDifference");
                const promisedExaminePoolDifference = promisify<systemrpc.ccSystemRpcFormat, systemrpc.ReturnValues>(client.examinePoolDifference).bind(client);
                await promisedExaminePoolDifference(gPayload)
                .then((res) => {
                    ret.status = res.getReturncode() * 100;
                    ret.data = res.getDataasstring();
                }).catch((reason) => {
                    const gRPCException: any = reason;
                    ret.status = gRPCException.code * -1;
                    ret.data = gRPCException.details;
                    LOG("Info", 0, "InModule:sendRpc:Exception:" +  JSON.stringify(ret));
                })
                break;
            case "DeclareBlockCreation":
                LOG("Info", 0, "InModule:sendRpc:DeclareBlockCreation");
                const promisedDeclareBlockCreation = promisify<systemrpc.ccSystemRpcFormat, systemrpc.ReturnValues>(client.declareBlockCreation).bind(client);
                await promisedDeclareBlockCreation(gPayload)
                .then((res) => {
                    ret.status = res.getReturncode() * 100;
                    ret.data = res.getDataasstring();
                }).catch((reason) => {
                    const gRPCException: any = reason;
                    ret.status = gRPCException.code * -1;
                    ret.data = gRPCException.details;
                    LOG("Info", 0, "InModule:sendRpc:Exception:" +  JSON.stringify(ret));
                })
                break;
            case "SignAndResendOrStore":
                LOG("Info", 0, "InModule:sendRpc:SignAndResendOrStore");
                const promisedSignAndResendOrStore = promisify<systemrpc.ccSystemRpcFormat, systemrpc.ReturnValues>(client.signAndResendOrStore).bind(client);
                await promisedSignAndResendOrStore(gPayload)
                .then((res) => {
                    ret.status = res.getReturncode() * 100;
                    ret.data = res.getDataasstring();
                }).catch((reason) => {
                    const gRPCException: any = reason;
                    ret.status = gRPCException.code * -1;
                    ret.data = gRPCException.details;
                    LOG("Info", 0, "InModule:sendRpc:Exception:" +  JSON.stringify(ret));
                })
                break;
            case "ResetTestNode":
                LOG("Info", 0, "InModule:sendRpc:ResetTestNode");
                const promisedResetTestNode = promisify<systemrpc.ccSystemRpcFormat, systemrpc.ReturnCode>(client.resetTestNode).bind(client);
                await promisedResetTestNode(gPayload)
                .then((res) => {
                    ret.status = res.getReturncode() * 100;
                }).catch((reason) => {
                    const gRPCException: any = reason;
                    ret.status = gRPCException.code * -1;
                    ret.data = gRPCException.details;
                    LOG("Info", 0, "InModule:sendRpc:Exception:" +  JSON.stringify(ret));
                })
                break;
            default:
                LOG("Warning", 1, "InModule:sendRpc:IllegalRequest:" + payload.request);
                break;
        }

        if (ret.status >= 0) {
            return this.iOK<rpcReturnFormat>(ret);
        } else {
            return this.iError("sendRpc", "rpcReturnFormat", JSON.stringify(ret));
        }
    }
}
