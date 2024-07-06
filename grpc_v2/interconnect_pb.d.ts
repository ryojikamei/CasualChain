// package: 
// file: interconnect.proto

/* tslint:disable */
/* eslint-disable */

import * as jspb from "google-protobuf";

export class icPacketPayload extends jspb.Message { 
    getPayloadType(): payload_type;
    setPayloadType(value: payload_type): icPacketPayload;

    hasGErrorAsString(): boolean;
    clearGErrorAsString(): void;
    getGErrorAsString(): string | undefined;
    setGErrorAsString(value: string): icPacketPayload;

    hasRequest(): boolean;
    clearRequest(): void;
    getRequest(): string | undefined;
    setRequest(value: string): icPacketPayload;

    hasDataAsString(): boolean;
    clearDataAsString(): void;
    getDataAsString(): string | undefined;
    setDataAsString(value: string): icPacketPayload;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): icPacketPayload.AsObject;
    static toObject(includeInstance: boolean, msg: icPacketPayload): icPacketPayload.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: icPacketPayload, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): icPacketPayload;
    static deserializeBinaryFromReader(message: icPacketPayload, reader: jspb.BinaryReader): icPacketPayload;
}

export namespace icPacketPayload {
    export type AsObject = {
        payloadType: payload_type,
        gErrorAsString?: string,
        request?: string,
        dataAsString?: string,
    }
}

export class icGeneralPacket extends jspb.Message { 
    getVersion(): number;
    setVersion(value: number): icGeneralPacket;
    getPacketId(): string;
    setPacketId(value: string): icGeneralPacket;
    getSender(): string;
    setSender(value: string): icGeneralPacket;
    getReceiver(): string;
    setReceiver(value: string): icGeneralPacket;

    hasPayload(): boolean;
    clearPayload(): void;
    getPayload(): icPacketPayload | undefined;
    setPayload(value?: icPacketPayload): icGeneralPacket;
    getPrevId(): string;
    setPrevId(value: string): icGeneralPacket;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): icGeneralPacket.AsObject;
    static toObject(includeInstance: boolean, msg: icGeneralPacket): icGeneralPacket.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: icGeneralPacket, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): icGeneralPacket;
    static deserializeBinaryFromReader(message: icGeneralPacket, reader: jspb.BinaryReader): icGeneralPacket;
}

export namespace icGeneralPacket {
    export type AsObject = {
        version: number,
        packetId: string,
        sender: string,
        receiver: string,
        payload?: icPacketPayload.AsObject,
        prevId: string,
    }
}

export class ctrlRequest extends jspb.Message { 
    getVersion(): number;
    setVersion(value: number): ctrlRequest;
    getSender(): string;
    setSender(value: string): ctrlRequest;
    getReceiver(): string;
    setReceiver(value: string): ctrlRequest;
    getRequest(): string;
    setRequest(value: string): ctrlRequest;
    getParams(): string;
    setParams(value: string): ctrlRequest;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): ctrlRequest.AsObject;
    static toObject(includeInstance: boolean, msg: ctrlRequest): ctrlRequest.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: ctrlRequest, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): ctrlRequest;
    static deserializeBinaryFromReader(message: ctrlRequest, reader: jspb.BinaryReader): ctrlRequest;
}

export namespace ctrlRequest {
    export type AsObject = {
        version: number,
        sender: string,
        receiver: string,
        request: string,
        params: string,
    }
}

export class ctrlResponse extends jspb.Message { 
    getReturncode(): number;
    setReturncode(value: number): ctrlResponse;
    getResult(): string;
    setResult(value: string): ctrlResponse;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): ctrlResponse.AsObject;
    static toObject(includeInstance: boolean, msg: ctrlResponse): ctrlResponse.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: ctrlResponse, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): ctrlResponse;
    static deserializeBinaryFromReader(message: ctrlResponse, reader: jspb.BinaryReader): ctrlResponse;
}

export namespace ctrlResponse {
    export type AsObject = {
        returncode: number,
        result: string,
    }
}

export enum payload_type {
    REQUEST = 0,
    RESULT_SUCCESS = 1,
    RESULT_FAILURE = 2,
}
