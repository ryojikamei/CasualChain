/**
 * Copyright (c) 2024 Ryoji Kamei
 * Released under the MIT license
 * https://opensource.org/licenses/mit-license.php
 */

import systemrpc from '../../grpc_v1/systemrpc_pb.js';


export class gSystemRpcClientMock {
    constructor() {}

    public ping(request: systemrpc.ccSystemRpcFormat, callback: (error: any, response: systemrpc.ReturnValues) => void): any {
        const ret = new systemrpc.ReturnValues();
        if (request.hasParam() === false) {
            ret.setReturncode(0);
        } else {
            ret.setReturncode(-1);
        }
        callback(null, ret)
    };

    public addPool(request: systemrpc.ccSystemRpcFormat, callback: (error: any, response: systemrpc.ReturnCode) => void): any {
        const ret = new systemrpc.ReturnCode();
        if (request.hasParam() === false) {
            ret.setReturncode(0);
        } else {
            ret.setReturncode(-1);
        }
        callback(null, ret)
    }; 

    public addBlock(request: systemrpc.ccSystemRpcFormat, callback: (error: any, response: systemrpc.ReturnCode) => void): any {
        const ret = new systemrpc.ReturnCode();
        if (request.hasParam() === false) {
            ret.setReturncode(0);
        } else {
            ret.setReturncode(-1);
        }
        callback(null, ret)
    };

    public addBlockCa3(request: systemrpc.ccSystemRpcFormat, callback: (error: any, response: systemrpc.ReturnCode) => void): any {
        const ret = new systemrpc.ReturnCode();
        if (request.hasParam() === false) {
            ret.setReturncode(0);
        } else {
            ret.setReturncode(-1);
        }
        callback(null, ret)
    };

    public getPoolHeight(request: systemrpc.ccSystemRpcFormat, callback: (error: any, response: systemrpc.ReturnValues) => void): any {
        const ret = new systemrpc.ReturnValues();
        if (request.hasParam() === false) {
            ret.setReturncode(0);
        } else {
            ret.setReturncode(-1);
        }
        callback(null, ret)
    };

    public getBlockHeight(request: systemrpc.ccSystemRpcFormat, callback: (error: any, response: systemrpc.ReturnValues) => void): any {
        const ret = new systemrpc.ReturnValues();
        if (request.hasParam() === false) {
            ret.setReturncode(0);
        } else {
            ret.setReturncode(-1);
        }
        callback(null, ret)
    };

    public getBlockDigest(request: systemrpc.ccSystemRpcFormat, callback: (error: any, response: systemrpc.ReturnValues) => void): any {
        const ret = new systemrpc.ReturnValues();
        if (request.hasParam() === false) {
            ret.setReturncode(0);
        } else {
            ret.setReturncode(-1);
        }
        callback(null, ret)
    };

    public getBlock(request: systemrpc.ccSystemRpcFormat, callback: (error: any, response: systemrpc.ReturnValues) => void): any {
        const ret = new systemrpc.ReturnValues();
        if (request.hasParam() === false) {
            ret.setReturncode(0);
        } else {
            ret.setReturncode(-1);
        }
        callback(null, ret)
    };

    public examineBlockDifference(request: systemrpc.ccSystemRpcFormat, callback: (error: any, response: systemrpc.ReturnValues) => void): any {
        const ret = new systemrpc.ReturnValues();
        if (request.hasParam() === false) {
            ret.setReturncode(0);
        } else {
            ret.setReturncode(-1);
        }
        callback(null, ret)
    };

    public examinePoolDifference(request: systemrpc.ccSystemRpcFormat, callback: (error: any, response: systemrpc.ReturnValues) => void): any {
        const ret = new systemrpc.ReturnValues();
        if (request.hasParam() === false) {
            ret.setReturncode(0);
        } else {
            ret.setReturncode(-1);
        }
        callback(null, ret)
    };

    public declareBlockCreation(request: systemrpc.ccSystemRpcFormat, callback: (error: any, response: systemrpc.ReturnValues) => void): any {
        const ret = new systemrpc.ReturnValues();
        if (request.hasParam() === false) {
            ret.setReturncode(0);
        } else {
            ret.setReturncode(-1);
        }
        callback(null, ret)
    };

    public signAndResendOrStore(request: systemrpc.ccSystemRpcFormat, callback: (error: any, response: systemrpc.ReturnValues) => void): any {
        const ret = new systemrpc.ReturnValues();
        if (request.hasParam() === false) {
            ret.setReturncode(0);
        } else {
            ret.setReturncode(-1);
        }
        callback(null, ret)
    };

    public resetTestNode(request: systemrpc.ccSystemRpcFormat, callback: (error: any, response: systemrpc.ReturnCode) => void): any {
        const ret = new systemrpc.ReturnCode();
        if (request.hasParam() === false) {
            ret.setReturncode(0);
        } else {
            ret.setReturncode(-1);
        }
        callback(null, ret)
    };
}