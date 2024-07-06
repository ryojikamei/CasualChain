// package: 
// file: interconnect.proto

/* tslint:disable */
/* eslint-disable */

import * as grpc from "grpc";
import * as interconnect_pb from "./interconnect_pb";

interface IinterconnectService extends grpc.ServiceDefinition<grpc.UntypedServiceImplementation> {
    ccGeneralIc: IinterconnectService_IccGeneralIc;
    ccCtrlLine: IinterconnectService_IccCtrlLine;
}

interface IinterconnectService_IccGeneralIc extends grpc.MethodDefinition<interconnect_pb.icGeneralPacket, interconnect_pb.icGeneralPacket> {
    path: "/interconnect/ccGeneralIc";
    requestStream: true;
    responseStream: true;
    requestSerialize: grpc.serialize<interconnect_pb.icGeneralPacket>;
    requestDeserialize: grpc.deserialize<interconnect_pb.icGeneralPacket>;
    responseSerialize: grpc.serialize<interconnect_pb.icGeneralPacket>;
    responseDeserialize: grpc.deserialize<interconnect_pb.icGeneralPacket>;
}
interface IinterconnectService_IccCtrlLine extends grpc.MethodDefinition<interconnect_pb.ctrlRequest, interconnect_pb.ctrlResponse> {
    path: "/interconnect/ccCtrlLine";
    requestStream: false;
    responseStream: false;
    requestSerialize: grpc.serialize<interconnect_pb.ctrlRequest>;
    requestDeserialize: grpc.deserialize<interconnect_pb.ctrlRequest>;
    responseSerialize: grpc.serialize<interconnect_pb.ctrlResponse>;
    responseDeserialize: grpc.deserialize<interconnect_pb.ctrlResponse>;
}

export const interconnectService: IinterconnectService;

export interface IinterconnectServer {
    ccGeneralIc: grpc.handleBidiStreamingCall<interconnect_pb.icGeneralPacket, interconnect_pb.icGeneralPacket>;
    ccCtrlLine: grpc.handleUnaryCall<interconnect_pb.ctrlRequest, interconnect_pb.ctrlResponse>;
}

export interface IinterconnectClient {
    ccGeneralIc(): grpc.ClientDuplexStream<interconnect_pb.icGeneralPacket, interconnect_pb.icGeneralPacket>;
    ccGeneralIc(options: Partial<grpc.CallOptions>): grpc.ClientDuplexStream<interconnect_pb.icGeneralPacket, interconnect_pb.icGeneralPacket>;
    ccGeneralIc(metadata: grpc.Metadata, options?: Partial<grpc.CallOptions>): grpc.ClientDuplexStream<interconnect_pb.icGeneralPacket, interconnect_pb.icGeneralPacket>;
    ccCtrlLine(request: interconnect_pb.ctrlRequest, callback: (error: grpc.ServiceError | null, response: interconnect_pb.ctrlResponse) => void): grpc.ClientUnaryCall;
    ccCtrlLine(request: interconnect_pb.ctrlRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: interconnect_pb.ctrlResponse) => void): grpc.ClientUnaryCall;
    ccCtrlLine(request: interconnect_pb.ctrlRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: interconnect_pb.ctrlResponse) => void): grpc.ClientUnaryCall;
}

export class interconnectClient extends grpc.Client implements IinterconnectClient {
    constructor(address: string, credentials: grpc.ChannelCredentials, options?: object);
    public ccGeneralIc(options?: Partial<grpc.CallOptions>): grpc.ClientDuplexStream<interconnect_pb.icGeneralPacket, interconnect_pb.icGeneralPacket>;
    public ccGeneralIc(metadata?: grpc.Metadata, options?: Partial<grpc.CallOptions>): grpc.ClientDuplexStream<interconnect_pb.icGeneralPacket, interconnect_pb.icGeneralPacket>;
    public ccCtrlLine(request: interconnect_pb.ctrlRequest, callback: (error: grpc.ServiceError | null, response: interconnect_pb.ctrlResponse) => void): grpc.ClientUnaryCall;
    public ccCtrlLine(request: interconnect_pb.ctrlRequest, metadata: grpc.Metadata, callback: (error: grpc.ServiceError | null, response: interconnect_pb.ctrlResponse) => void): grpc.ClientUnaryCall;
    public ccCtrlLine(request: interconnect_pb.ctrlRequest, metadata: grpc.Metadata, options: Partial<grpc.CallOptions>, callback: (error: grpc.ServiceError | null, response: interconnect_pb.ctrlResponse) => void): grpc.ClientUnaryCall;
}
