// package: 
// file: interconnect.proto

/* tslint:disable */
/* eslint-disable */

import * as grpc from "grpc";
import * as interconnect_pb from "./interconnect_pb";

interface IinterconnectService extends grpc.ServiceDefinition<grpc.UntypedServiceImplementation> {
    ccGeneralIc: IinterconnectService_IccGeneralIc;
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

export const interconnectService: IinterconnectService;

export interface IinterconnectServer {
    ccGeneralIc: grpc.handleBidiStreamingCall<interconnect_pb.icGeneralPacket, interconnect_pb.icGeneralPacket>;
}

export interface IinterconnectClient {
    ccGeneralIc(): grpc.ClientDuplexStream<interconnect_pb.icGeneralPacket, interconnect_pb.icGeneralPacket>;
    ccGeneralIc(options: Partial<grpc.CallOptions>): grpc.ClientDuplexStream<interconnect_pb.icGeneralPacket, interconnect_pb.icGeneralPacket>;
    ccGeneralIc(metadata: grpc.Metadata, options?: Partial<grpc.CallOptions>): grpc.ClientDuplexStream<interconnect_pb.icGeneralPacket, interconnect_pb.icGeneralPacket>;
}

export class interconnectClient extends grpc.Client implements IinterconnectClient {
    constructor(address: string, credentials: grpc.ChannelCredentials, options?: object);
    public ccGeneralIc(options?: Partial<grpc.CallOptions>): grpc.ClientDuplexStream<interconnect_pb.icGeneralPacket, interconnect_pb.icGeneralPacket>;
    public ccGeneralIc(metadata?: grpc.Metadata, options?: Partial<grpc.CallOptions>): grpc.ClientDuplexStream<interconnect_pb.icGeneralPacket, interconnect_pb.icGeneralPacket>;
}
