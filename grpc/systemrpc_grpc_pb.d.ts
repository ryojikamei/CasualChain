// package: 
// file: systemrpc.proto

/* tslint:disable */
/* eslint-disable */

import * as grpc from "grpc";
import * as systemrpc_pb from "./systemrpc_pb";

interface IgSystemRpcService extends grpc.ServiceDefinition<grpc.UntypedServiceImplementation> {
    [name:string]: grpc.UntypedHandleCall;
    ping: IgSystemRpcService_Iping;
    addPool: IgSystemRpcService_IaddPool;
    addBlock: IgSystemRpcService_IaddBlock;
    addBlockCa3: IgSystemRpcService_IaddBlockCa3;
    getPoolHeight: IgSystemRpcService_IgetPoolHeight;
    getBlockHeight: IgSystemRpcService_IgetBlockHeight;
    getBlockDigest: IgSystemRpcService_IgetBlockDigest;
    getBlock: IgSystemRpcService_IgetBlock;
    examineBlockDifference: IgSystemRpcService_IexamineBlockDifference;
    examinePoolDifference: IgSystemRpcService_IexaminePoolDifference;
    declareBlockCreation: IgSystemRpcService_IdeclareBlockCreation;
    signAndResendOrStore: IgSystemRpcService_IsignAndResendOrStore;
    resetTestNode: IgSystemRpcService_IresetTestNode;
}

interface IgSystemRpcService_Iping extends grpc.MethodDefinition<systemrpc_pb.ccSystemRpcFormat, systemrpc_pb.ReturnValues> {
    path: "/gSystemRpc/ping";
    requestStream: false;
    responseStream: false;
    requestSerialize: grpc.serialize<systemrpc_pb.ccSystemRpcFormat>;
    requestDeserialize: grpc.deserialize<systemrpc_pb.ccSystemRpcFormat>;
    responseSerialize: grpc.serialize<systemrpc_pb.ReturnValues>;
    responseDeserialize: grpc.deserialize<systemrpc_pb.ReturnValues>;
}
interface IgSystemRpcService_IaddPool extends grpc.MethodDefinition<systemrpc_pb.ccSystemRpcFormat, systemrpc_pb.ReturnCode> {
    path: "/gSystemRpc/addPool";
    requestStream: false;
    responseStream: false;
    requestSerialize: grpc.serialize<systemrpc_pb.ccSystemRpcFormat>;
    requestDeserialize: grpc.deserialize<systemrpc_pb.ccSystemRpcFormat>;
    responseSerialize: grpc.serialize<systemrpc_pb.ReturnCode>;
    responseDeserialize: grpc.deserialize<systemrpc_pb.ReturnCode>;
}
interface IgSystemRpcService_IaddBlock extends grpc.MethodDefinition<systemrpc_pb.ccSystemRpcFormat, systemrpc_pb.ReturnCode> {
    path: "/gSystemRpc/addBlock";
    requestStream: false;
    responseStream: false;
    requestSerialize: grpc.serialize<systemrpc_pb.ccSystemRpcFormat>;
    requestDeserialize: grpc.deserialize<systemrpc_pb.ccSystemRpcFormat>;
    responseSerialize: grpc.serialize<systemrpc_pb.ReturnCode>;
    responseDeserialize: grpc.deserialize<systemrpc_pb.ReturnCode>;
}
interface IgSystemRpcService_IaddBlockCa3 extends grpc.MethodDefinition<systemrpc_pb.ccSystemRpcFormat, systemrpc_pb.ReturnCode> {
    path: "/gSystemRpc/addBlockCa3";
    requestStream: false;
    responseStream: false;
    requestSerialize: grpc.serialize<systemrpc_pb.ccSystemRpcFormat>;
    requestDeserialize: grpc.deserialize<systemrpc_pb.ccSystemRpcFormat>;
    responseSerialize: grpc.serialize<systemrpc_pb.ReturnCode>;
    responseDeserialize: grpc.deserialize<systemrpc_pb.ReturnCode>;
}
interface IgSystemRpcService_IgetPoolHeight extends grpc.MethodDefinition<systemrpc_pb.ccSystemRpcFormat, systemrpc_pb.ReturnValues> {
    path: "/gSystemRpc/getPoolHeight";
    requestStream: false;
    responseStream: false;
    requestSerialize: grpc.serialize<systemrpc_pb.ccSystemRpcFormat>;
    requestDeserialize: grpc.deserialize<systemrpc_pb.ccSystemRpcFormat>;
    responseSerialize: grpc.serialize<systemrpc_pb.ReturnValues>;
    responseDeserialize: grpc.deserialize<systemrpc_pb.ReturnValues>;
}
interface IgSystemRpcService_IgetBlockHeight extends grpc.MethodDefinition<systemrpc_pb.ccSystemRpcFormat, systemrpc_pb.ReturnValues> {
    path: "/gSystemRpc/getBlockHeight";
    requestStream: false;
    responseStream: false;
    requestSerialize: grpc.serialize<systemrpc_pb.ccSystemRpcFormat>;
    requestDeserialize: grpc.deserialize<systemrpc_pb.ccSystemRpcFormat>;
    responseSerialize: grpc.serialize<systemrpc_pb.ReturnValues>;
    responseDeserialize: grpc.deserialize<systemrpc_pb.ReturnValues>;
}
interface IgSystemRpcService_IgetBlockDigest extends grpc.MethodDefinition<systemrpc_pb.ccSystemRpcFormat, systemrpc_pb.ReturnValues> {
    path: "/gSystemRpc/getBlockDigest";
    requestStream: false;
    responseStream: false;
    requestSerialize: grpc.serialize<systemrpc_pb.ccSystemRpcFormat>;
    requestDeserialize: grpc.deserialize<systemrpc_pb.ccSystemRpcFormat>;
    responseSerialize: grpc.serialize<systemrpc_pb.ReturnValues>;
    responseDeserialize: grpc.deserialize<systemrpc_pb.ReturnValues>;
}
interface IgSystemRpcService_IgetBlock extends grpc.MethodDefinition<systemrpc_pb.ccSystemRpcFormat, systemrpc_pb.ReturnValues> {
    path: "/gSystemRpc/getBlock";
    requestStream: false;
    responseStream: false;
    requestSerialize: grpc.serialize<systemrpc_pb.ccSystemRpcFormat>;
    requestDeserialize: grpc.deserialize<systemrpc_pb.ccSystemRpcFormat>;
    responseSerialize: grpc.serialize<systemrpc_pb.ReturnValues>;
    responseDeserialize: grpc.deserialize<systemrpc_pb.ReturnValues>;
}
interface IgSystemRpcService_IexamineBlockDifference extends grpc.MethodDefinition<systemrpc_pb.ccSystemRpcFormat, systemrpc_pb.ReturnValues> {
    path: "/gSystemRpc/examineBlockDifference";
    requestStream: false;
    responseStream: false;
    requestSerialize: grpc.serialize<systemrpc_pb.ccSystemRpcFormat>;
    requestDeserialize: grpc.deserialize<systemrpc_pb.ccSystemRpcFormat>;
    responseSerialize: grpc.serialize<systemrpc_pb.ReturnValues>;
    responseDeserialize: grpc.deserialize<systemrpc_pb.ReturnValues>;
}
interface IgSystemRpcService_IexaminePoolDifference extends grpc.MethodDefinition<systemrpc_pb.ccSystemRpcFormat, systemrpc_pb.ReturnValues> {
    path: "/gSystemRpc/examinePoolDifference";
    requestStream: false;
    responseStream: false;
    requestSerialize: grpc.serialize<systemrpc_pb.ccSystemRpcFormat>;
    requestDeserialize: grpc.deserialize<systemrpc_pb.ccSystemRpcFormat>;
    responseSerialize: grpc.serialize<systemrpc_pb.ReturnValues>;
    responseDeserialize: grpc.deserialize<systemrpc_pb.ReturnValues>;
}
interface IgSystemRpcService_IdeclareBlockCreation extends grpc.MethodDefinition<systemrpc_pb.ccSystemRpcFormat, systemrpc_pb.ReturnValues> {
    path: "/gSystemRpc/declareBlockCreation";
    requestStream: false;
    responseStream: false;
    requestSerialize: grpc.serialize<systemrpc_pb.ccSystemRpcFormat>;
    requestDeserialize: grpc.deserialize<systemrpc_pb.ccSystemRpcFormat>;
    responseSerialize: grpc.serialize<systemrpc_pb.ReturnValues>;
    responseDeserialize: grpc.deserialize<systemrpc_pb.ReturnValues>;
}
interface IgSystemRpcService_IsignAndResendOrStore extends grpc.MethodDefinition<systemrpc_pb.ccSystemRpcFormat, systemrpc_pb.ReturnValues> {
    path: "/gSystemRpc/signAndResendOrStore";
    requestStream: false;
    responseStream: false;
    requestSerialize: grpc.serialize<systemrpc_pb.ccSystemRpcFormat>;
    requestDeserialize: grpc.deserialize<systemrpc_pb.ccSystemRpcFormat>;
    responseSerialize: grpc.serialize<systemrpc_pb.ReturnValues>;
    responseDeserialize: grpc.deserialize<systemrpc_pb.ReturnValues>;
}
interface IgSystemRpcService_IresetTestNode extends grpc.MethodDefinition<systemrpc_pb.ccSystemRpcFormat, systemrpc_pb.ReturnCode> {
    path: "/gSystemRpc/resetTestNode";
    requestStream: false;
    responseStream: false;
    requestSerialize: grpc.serialize<systemrpc_pb.ccSystemRpcFormat>;
    requestDeserialize: grpc.deserialize<systemrpc_pb.ccSystemRpcFormat>;
    responseSerialize: grpc.serialize<systemrpc_pb.ReturnCode>;
    responseDeserialize: grpc.deserialize<systemrpc_pb.ReturnCode>;
}

export const gSystemRpcService: IgSystemRpcService;

export interface IgSystemRpcServer {
    ping: grpc.handleUnaryCall<systemrpc_pb.ccSystemRpcFormat, systemrpc_pb.ReturnValues>;
    addPool: grpc.handleUnaryCall<systemrpc_pb.ccSystemRpcFormat, systemrpc_pb.ReturnCode>;
    addBlock: grpc.handleUnaryCall<systemrpc_pb.ccSystemRpcFormat, systemrpc_pb.ReturnCode>;
    addBlockCa3: grpc.handleUnaryCall<systemrpc_pb.ccSystemRpcFormat, systemrpc_pb.ReturnCode>;
    getPoolHeight: grpc.handleUnaryCall<systemrpc_pb.ccSystemRpcFormat, systemrpc_pb.ReturnValues>;
    getBlockHeight: grpc.handleUnaryCall<systemrpc_pb.ccSystemRpcFormat, systemrpc_pb.ReturnValues>;
    getBlockDigest: grpc.handleUnaryCall<systemrpc_pb.ccSystemRpcFormat, systemrpc_pb.ReturnValues>;
    getBlock: grpc.handleUnaryCall<systemrpc_pb.ccSystemRpcFormat, systemrpc_pb.ReturnValues>;
    examineBlockDifference: grpc.handleUnaryCall<systemrpc_pb.ccSystemRpcFormat, systemrpc_pb.ReturnValues>;
    examinePoolDifference: grpc.handleUnaryCall<systemrpc_pb.ccSystemRpcFormat, systemrpc_pb.ReturnValues>;
    declareBlockCreation: grpc.handleUnaryCall<systemrpc_pb.ccSystemRpcFormat, systemrpc_pb.ReturnValues>;
    signAndResendOrStore: grpc.handleUnaryCall<systemrpc_pb.ccSystemRpcFormat, systemrpc_pb.ReturnValues>;
    resetTestNode: grpc.handleUnaryCall<systemrpc_pb.ccSystemRpcFormat, systemrpc_pb.ReturnCode>;
}

export interface IgSystemRpcClient {
    ping(request: systemrpc_pb.ccSystemRpcFormat, callback: (error: grpc.ServiceError | null, response: systemrpc_pb.ReturnValues) => void): grpc.ClientUnaryCall;
    ping(request: systemrpc_pb.ccSystemRpcFormat, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: systemrpc_pb.ReturnValues) => void): grpc.ClientUnaryCall;
    ping(request: systemrpc_pb.ccSystemRpcFormat, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: systemrpc_pb.ReturnValues) => void): grpc.ClientUnaryCall;
    addPool(request: systemrpc_pb.ccSystemRpcFormat, callback: (error: grpc.ServiceError | null, response: systemrpc_pb.ReturnCode) => void): grpc.ClientUnaryCall;
    addPool(request: systemrpc_pb.ccSystemRpcFormat, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: systemrpc_pb.ReturnCode) => void): grpc.ClientUnaryCall;
    addPool(request: systemrpc_pb.ccSystemRpcFormat, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: systemrpc_pb.ReturnCode) => void): grpc.ClientUnaryCall;
    addBlock(request: systemrpc_pb.ccSystemRpcFormat, callback: (error: grpc.ServiceError | null, response: systemrpc_pb.ReturnCode) => void): grpc.ClientUnaryCall;
    addBlock(request: systemrpc_pb.ccSystemRpcFormat, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: systemrpc_pb.ReturnCode) => void): grpc.ClientUnaryCall;
    addBlock(request: systemrpc_pb.ccSystemRpcFormat, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: systemrpc_pb.ReturnCode) => void): grpc.ClientUnaryCall;
    addBlockCa3(request: systemrpc_pb.ccSystemRpcFormat, callback: (error: grpc.ServiceError | null, response: systemrpc_pb.ReturnCode) => void): grpc.ClientUnaryCall;
    addBlockCa3(request: systemrpc_pb.ccSystemRpcFormat, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: systemrpc_pb.ReturnCode) => void): grpc.ClientUnaryCall;
    addBlockCa3(request: systemrpc_pb.ccSystemRpcFormat, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: systemrpc_pb.ReturnCode) => void): grpc.ClientUnaryCall;
    getPoolHeight(request: systemrpc_pb.ccSystemRpcFormat, callback: (error: grpc.ServiceError | null, response: systemrpc_pb.ReturnValues) => void): grpc.ClientUnaryCall;
    getPoolHeight(request: systemrpc_pb.ccSystemRpcFormat, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: systemrpc_pb.ReturnValues) => void): grpc.ClientUnaryCall;
    getPoolHeight(request: systemrpc_pb.ccSystemRpcFormat, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: systemrpc_pb.ReturnValues) => void): grpc.ClientUnaryCall;
    getBlockHeight(request: systemrpc_pb.ccSystemRpcFormat, callback: (error: grpc.ServiceError | null, response: systemrpc_pb.ReturnValues) => void): grpc.ClientUnaryCall;
    getBlockHeight(request: systemrpc_pb.ccSystemRpcFormat, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: systemrpc_pb.ReturnValues) => void): grpc.ClientUnaryCall;
    getBlockHeight(request: systemrpc_pb.ccSystemRpcFormat, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: systemrpc_pb.ReturnValues) => void): grpc.ClientUnaryCall;
    getBlockDigest(request: systemrpc_pb.ccSystemRpcFormat, callback: (error: grpc.ServiceError | null, response: systemrpc_pb.ReturnValues) => void): grpc.ClientUnaryCall;
    getBlockDigest(request: systemrpc_pb.ccSystemRpcFormat, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: systemrpc_pb.ReturnValues) => void): grpc.ClientUnaryCall;
    getBlockDigest(request: systemrpc_pb.ccSystemRpcFormat, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: systemrpc_pb.ReturnValues) => void): grpc.ClientUnaryCall;
    getBlock(request: systemrpc_pb.ccSystemRpcFormat, callback: (error: grpc.ServiceError | null, response: systemrpc_pb.ReturnValues) => void): grpc.ClientUnaryCall;
    getBlock(request: systemrpc_pb.ccSystemRpcFormat, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: systemrpc_pb.ReturnValues) => void): grpc.ClientUnaryCall;
    getBlock(request: systemrpc_pb.ccSystemRpcFormat, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: systemrpc_pb.ReturnValues) => void): grpc.ClientUnaryCall;
    examineBlockDifference(request: systemrpc_pb.ccSystemRpcFormat, callback: (error: grpc.ServiceError | null, response: systemrpc_pb.ReturnValues) => void): grpc.ClientUnaryCall;
    examineBlockDifference(request: systemrpc_pb.ccSystemRpcFormat, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: systemrpc_pb.ReturnValues) => void): grpc.ClientUnaryCall;
    examineBlockDifference(request: systemrpc_pb.ccSystemRpcFormat, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: systemrpc_pb.ReturnValues) => void): grpc.ClientUnaryCall;
    examinePoolDifference(request: systemrpc_pb.ccSystemRpcFormat, callback: (error: grpc.ServiceError | null, response: systemrpc_pb.ReturnValues) => void): grpc.ClientUnaryCall;
    examinePoolDifference(request: systemrpc_pb.ccSystemRpcFormat, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: systemrpc_pb.ReturnValues) => void): grpc.ClientUnaryCall;
    examinePoolDifference(request: systemrpc_pb.ccSystemRpcFormat, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: systemrpc_pb.ReturnValues) => void): grpc.ClientUnaryCall;
    declareBlockCreation(request: systemrpc_pb.ccSystemRpcFormat, callback: (error: grpc.ServiceError | null, response: systemrpc_pb.ReturnValues) => void): grpc.ClientUnaryCall;
    declareBlockCreation(request: systemrpc_pb.ccSystemRpcFormat, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: systemrpc_pb.ReturnValues) => void): grpc.ClientUnaryCall;
    declareBlockCreation(request: systemrpc_pb.ccSystemRpcFormat, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: systemrpc_pb.ReturnValues) => void): grpc.ClientUnaryCall;
    signAndResendOrStore(request: systemrpc_pb.ccSystemRpcFormat, callback: (error: grpc.ServiceError | null, response: systemrpc_pb.ReturnValues) => void): grpc.ClientUnaryCall;
    signAndResendOrStore(request: systemrpc_pb.ccSystemRpcFormat, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: systemrpc_pb.ReturnValues) => void): grpc.ClientUnaryCall;
    signAndResendOrStore(request: systemrpc_pb.ccSystemRpcFormat, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: systemrpc_pb.ReturnValues) => void): grpc.ClientUnaryCall;
    resetTestNode(request: systemrpc_pb.ccSystemRpcFormat, callback: (error: grpc.ServiceError | null, response: systemrpc_pb.ReturnCode) => void): grpc.ClientUnaryCall;
    resetTestNode(request: systemrpc_pb.ccSystemRpcFormat, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: systemrpc_pb.ReturnCode) => void): grpc.ClientUnaryCall;
    resetTestNode(request: systemrpc_pb.ccSystemRpcFormat, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: systemrpc_pb.ReturnCode) => void): grpc.ClientUnaryCall;
}

export class gSystemRpcClient extends grpc.Client implements IgSystemRpcClient {
    constructor(address: string, credentials: grpc.ChannelCredentials, options?: object);
    public ping(request: systemrpc_pb.ccSystemRpcFormat, callback: (error: grpc.ServiceError | null, response: systemrpc_pb.ReturnValues) => void): grpc.ClientUnaryCall;
    public ping(request: systemrpc_pb.ccSystemRpcFormat, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: systemrpc_pb.ReturnValues) => void): grpc.ClientUnaryCall;
    public ping(request: systemrpc_pb.ccSystemRpcFormat, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: systemrpc_pb.ReturnValues) => void): grpc.ClientUnaryCall;
    public addPool(request: systemrpc_pb.ccSystemRpcFormat, callback: (error: grpc.ServiceError | null, response: systemrpc_pb.ReturnCode) => void): grpc.ClientUnaryCall;
    public addPool(request: systemrpc_pb.ccSystemRpcFormat, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: systemrpc_pb.ReturnCode) => void): grpc.ClientUnaryCall;
    public addPool(request: systemrpc_pb.ccSystemRpcFormat, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: systemrpc_pb.ReturnCode) => void): grpc.ClientUnaryCall;
    public addBlock(request: systemrpc_pb.ccSystemRpcFormat, callback: (error: grpc.ServiceError | null, response: systemrpc_pb.ReturnCode) => void): grpc.ClientUnaryCall;
    public addBlock(request: systemrpc_pb.ccSystemRpcFormat, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: systemrpc_pb.ReturnCode) => void): grpc.ClientUnaryCall;
    public addBlock(request: systemrpc_pb.ccSystemRpcFormat, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: systemrpc_pb.ReturnCode) => void): grpc.ClientUnaryCall;
    public addBlockCa3(request: systemrpc_pb.ccSystemRpcFormat, callback: (error: grpc.ServiceError | null, response: systemrpc_pb.ReturnCode) => void): grpc.ClientUnaryCall;
    public addBlockCa3(request: systemrpc_pb.ccSystemRpcFormat, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: systemrpc_pb.ReturnCode) => void): grpc.ClientUnaryCall;
    public addBlockCa3(request: systemrpc_pb.ccSystemRpcFormat, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: systemrpc_pb.ReturnCode) => void): grpc.ClientUnaryCall;
    public getPoolHeight(request: systemrpc_pb.ccSystemRpcFormat, callback: (error: grpc.ServiceError | null, response: systemrpc_pb.ReturnValues) => void): grpc.ClientUnaryCall;
    public getPoolHeight(request: systemrpc_pb.ccSystemRpcFormat, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: systemrpc_pb.ReturnValues) => void): grpc.ClientUnaryCall;
    public getPoolHeight(request: systemrpc_pb.ccSystemRpcFormat, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: systemrpc_pb.ReturnValues) => void): grpc.ClientUnaryCall;
    public getBlockHeight(request: systemrpc_pb.ccSystemRpcFormat, callback: (error: grpc.ServiceError | null, response: systemrpc_pb.ReturnValues) => void): grpc.ClientUnaryCall;
    public getBlockHeight(request: systemrpc_pb.ccSystemRpcFormat, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: systemrpc_pb.ReturnValues) => void): grpc.ClientUnaryCall;
    public getBlockHeight(request: systemrpc_pb.ccSystemRpcFormat, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: systemrpc_pb.ReturnValues) => void): grpc.ClientUnaryCall;
    public getBlockDigest(request: systemrpc_pb.ccSystemRpcFormat, callback: (error: grpc.ServiceError | null, response: systemrpc_pb.ReturnValues) => void): grpc.ClientUnaryCall;
    public getBlockDigest(request: systemrpc_pb.ccSystemRpcFormat, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: systemrpc_pb.ReturnValues) => void): grpc.ClientUnaryCall;
    public getBlockDigest(request: systemrpc_pb.ccSystemRpcFormat, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: systemrpc_pb.ReturnValues) => void): grpc.ClientUnaryCall;
    public getBlock(request: systemrpc_pb.ccSystemRpcFormat, callback: (error: grpc.ServiceError | null, response: systemrpc_pb.ReturnValues) => void): grpc.ClientUnaryCall;
    public getBlock(request: systemrpc_pb.ccSystemRpcFormat, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: systemrpc_pb.ReturnValues) => void): grpc.ClientUnaryCall;
    public getBlock(request: systemrpc_pb.ccSystemRpcFormat, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: systemrpc_pb.ReturnValues) => void): grpc.ClientUnaryCall;
    public examineBlockDifference(request: systemrpc_pb.ccSystemRpcFormat, callback: (error: grpc.ServiceError | null, response: systemrpc_pb.ReturnValues) => void): grpc.ClientUnaryCall;
    public examineBlockDifference(request: systemrpc_pb.ccSystemRpcFormat, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: systemrpc_pb.ReturnValues) => void): grpc.ClientUnaryCall;
    public examineBlockDifference(request: systemrpc_pb.ccSystemRpcFormat, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: systemrpc_pb.ReturnValues) => void): grpc.ClientUnaryCall;
    public examinePoolDifference(request: systemrpc_pb.ccSystemRpcFormat, callback: (error: grpc.ServiceError | null, response: systemrpc_pb.ReturnValues) => void): grpc.ClientUnaryCall;
    public examinePoolDifference(request: systemrpc_pb.ccSystemRpcFormat, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: systemrpc_pb.ReturnValues) => void): grpc.ClientUnaryCall;
    public examinePoolDifference(request: systemrpc_pb.ccSystemRpcFormat, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: systemrpc_pb.ReturnValues) => void): grpc.ClientUnaryCall;
    public declareBlockCreation(request: systemrpc_pb.ccSystemRpcFormat, callback: (error: grpc.ServiceError | null, response: systemrpc_pb.ReturnValues) => void): grpc.ClientUnaryCall;
    public declareBlockCreation(request: systemrpc_pb.ccSystemRpcFormat, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: systemrpc_pb.ReturnValues) => void): grpc.ClientUnaryCall;
    public declareBlockCreation(request: systemrpc_pb.ccSystemRpcFormat, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: systemrpc_pb.ReturnValues) => void): grpc.ClientUnaryCall;
    public signAndResendOrStore(request: systemrpc_pb.ccSystemRpcFormat, callback: (error: grpc.ServiceError | null, response: systemrpc_pb.ReturnValues) => void): grpc.ClientUnaryCall;
    public signAndResendOrStore(request: systemrpc_pb.ccSystemRpcFormat, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: systemrpc_pb.ReturnValues) => void): grpc.ClientUnaryCall;
    public signAndResendOrStore(request: systemrpc_pb.ccSystemRpcFormat, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: systemrpc_pb.ReturnValues) => void): grpc.ClientUnaryCall;
    public resetTestNode(request: systemrpc_pb.ccSystemRpcFormat, callback: (error: grpc.ServiceError | null, response: systemrpc_pb.ReturnCode) => void): grpc.ClientUnaryCall;
    public resetTestNode(request: systemrpc_pb.ccSystemRpcFormat, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: systemrpc_pb.ReturnCode) => void): grpc.ClientUnaryCall;
    public resetTestNode(request: systemrpc_pb.ccSystemRpcFormat, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: systemrpc_pb.ReturnCode) => void): grpc.ClientUnaryCall;
}
