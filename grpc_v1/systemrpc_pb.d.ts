// package: 
// file: systemrpc.proto

/* tslint:disable */
/* eslint-disable */

import * as jspb from "google-protobuf";

export class Param extends jspb.Message { 

    hasTenant(): boolean;
    clearTenant(): void;
    getTenant(): string | undefined;
    setTenant(value: string): Param;

    hasRemovepool(): boolean;
    clearRemovepool(): void;
    getRemovepool(): boolean | undefined;
    setRemovepool(value: boolean): Param;

    hasFailifunhealthy(): boolean;
    clearFailifunhealthy(): void;
    getFailifunhealthy(): boolean | undefined;
    setFailifunhealthy(value: boolean): Param;

    hasReturnundefinedifnoexistent(): boolean;
    clearReturnundefinedifnoexistent(): void;
    getReturnundefinedifnoexistent(): boolean | undefined;
    setReturnundefinedifnoexistent(value: boolean): Param;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): Param.AsObject;
    static toObject(includeInstance: boolean, msg: Param): Param.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: Param, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): Param;
    static deserializeBinaryFromReader(message: Param, reader: jspb.BinaryReader): Param;
}

export namespace Param {
    export type AsObject = {
        tenant?: string,
        removepool?: boolean,
        failifunhealthy?: boolean,
        returnundefinedifnoexistent?: boolean,
    }
}

export class ccSystemRpcFormat extends jspb.Message { 
    getVersion(): number;
    setVersion(value: number): ccSystemRpcFormat;
    getRequest(): string;
    setRequest(value: string): ccSystemRpcFormat;

    hasParam(): boolean;
    clearParam(): void;
    getParam(): Param | undefined;
    setParam(value?: Param): ccSystemRpcFormat;
    getDataasstring(): string;
    setDataasstring(value: string): ccSystemRpcFormat;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): ccSystemRpcFormat.AsObject;
    static toObject(includeInstance: boolean, msg: ccSystemRpcFormat): ccSystemRpcFormat.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: ccSystemRpcFormat, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): ccSystemRpcFormat;
    static deserializeBinaryFromReader(message: ccSystemRpcFormat, reader: jspb.BinaryReader): ccSystemRpcFormat;
}

export namespace ccSystemRpcFormat {
    export type AsObject = {
        version: number,
        request: string,
        param?: Param.AsObject,
        dataasstring: string,
    }
}

export class ReturnCode extends jspb.Message { 
    getReturncode(): number;
    setReturncode(value: number): ReturnCode;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): ReturnCode.AsObject;
    static toObject(includeInstance: boolean, msg: ReturnCode): ReturnCode.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: ReturnCode, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): ReturnCode;
    static deserializeBinaryFromReader(message: ReturnCode, reader: jspb.BinaryReader): ReturnCode;
}

export namespace ReturnCode {
    export type AsObject = {
        returncode: number,
    }
}

export class ReturnValues extends jspb.Message { 
    getReturncode(): number;
    setReturncode(value: number): ReturnValues;
    getDataasstring(): string;
    setDataasstring(value: string): ReturnValues;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): ReturnValues.AsObject;
    static toObject(includeInstance: boolean, msg: ReturnValues): ReturnValues.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: ReturnValues, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): ReturnValues;
    static deserializeBinaryFromReader(message: ReturnValues, reader: jspb.BinaryReader): ReturnValues;
}

export namespace ReturnValues {
    export type AsObject = {
        returncode: number,
        dataasstring: string,
    }
}
