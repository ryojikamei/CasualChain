// GENERATED CODE -- DO NOT EDIT!

'use strict';
var grpc = require('@grpc/grpc-js');
var systemrpc_pb = require('./systemrpc_pb.js');

function serialize_ReturnCode(arg) {
  if (!(arg instanceof systemrpc_pb.ReturnCode)) {
    throw new Error('Expected argument of type ReturnCode');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_ReturnCode(buffer_arg) {
  return systemrpc_pb.ReturnCode.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_ReturnValues(arg) {
  if (!(arg instanceof systemrpc_pb.ReturnValues)) {
    throw new Error('Expected argument of type ReturnValues');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_ReturnValues(buffer_arg) {
  return systemrpc_pb.ReturnValues.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_ccSystemRpcFormat(arg) {
  if (!(arg instanceof systemrpc_pb.ccSystemRpcFormat)) {
    throw new Error('Expected argument of type ccSystemRpcFormat');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_ccSystemRpcFormat(buffer_arg) {
  return systemrpc_pb.ccSystemRpcFormat.deserializeBinary(new Uint8Array(buffer_arg));
}


var gSystemRpcService = exports.gSystemRpcService = {
  ping: {
    path: '/gSystemRpc/ping',
    requestStream: false,
    responseStream: false,
    requestType: systemrpc_pb.ccSystemRpcFormat,
    responseType: systemrpc_pb.ReturnValues,
    requestSerialize: serialize_ccSystemRpcFormat,
    requestDeserialize: deserialize_ccSystemRpcFormat,
    responseSerialize: serialize_ReturnValues,
    responseDeserialize: deserialize_ReturnValues,
  },
  addPool: {
    path: '/gSystemRpc/addPool',
    requestStream: false,
    responseStream: false,
    requestType: systemrpc_pb.ccSystemRpcFormat,
    responseType: systemrpc_pb.ReturnCode,
    requestSerialize: serialize_ccSystemRpcFormat,
    requestDeserialize: deserialize_ccSystemRpcFormat,
    responseSerialize: serialize_ReturnCode,
    responseDeserialize: deserialize_ReturnCode,
  },
  addBlock: {
    path: '/gSystemRpc/addBlock',
    requestStream: false,
    responseStream: false,
    requestType: systemrpc_pb.ccSystemRpcFormat,
    responseType: systemrpc_pb.ReturnCode,
    requestSerialize: serialize_ccSystemRpcFormat,
    requestDeserialize: deserialize_ccSystemRpcFormat,
    responseSerialize: serialize_ReturnCode,
    responseDeserialize: deserialize_ReturnCode,
  },
  addBlockCa3: {
    path: '/gSystemRpc/addBlockCa3',
    requestStream: false,
    responseStream: false,
    requestType: systemrpc_pb.ccSystemRpcFormat,
    responseType: systemrpc_pb.ReturnCode,
    requestSerialize: serialize_ccSystemRpcFormat,
    requestDeserialize: deserialize_ccSystemRpcFormat,
    responseSerialize: serialize_ReturnCode,
    responseDeserialize: deserialize_ReturnCode,
  },
  getPoolHeight: {
    path: '/gSystemRpc/getPoolHeight',
    requestStream: false,
    responseStream: false,
    requestType: systemrpc_pb.ccSystemRpcFormat,
    responseType: systemrpc_pb.ReturnValues,
    requestSerialize: serialize_ccSystemRpcFormat,
    requestDeserialize: deserialize_ccSystemRpcFormat,
    responseSerialize: serialize_ReturnValues,
    responseDeserialize: deserialize_ReturnValues,
  },
  getBlockHeight: {
    path: '/gSystemRpc/getBlockHeight',
    requestStream: false,
    responseStream: false,
    requestType: systemrpc_pb.ccSystemRpcFormat,
    responseType: systemrpc_pb.ReturnValues,
    requestSerialize: serialize_ccSystemRpcFormat,
    requestDeserialize: deserialize_ccSystemRpcFormat,
    responseSerialize: serialize_ReturnValues,
    responseDeserialize: deserialize_ReturnValues,
  },
  getBlockDigest: {
    path: '/gSystemRpc/getBlockDigest',
    requestStream: false,
    responseStream: false,
    requestType: systemrpc_pb.ccSystemRpcFormat,
    responseType: systemrpc_pb.ReturnValues,
    requestSerialize: serialize_ccSystemRpcFormat,
    requestDeserialize: deserialize_ccSystemRpcFormat,
    responseSerialize: serialize_ReturnValues,
    responseDeserialize: deserialize_ReturnValues,
  },
  getBlock: {
    path: '/gSystemRpc/getBlock',
    requestStream: false,
    responseStream: false,
    requestType: systemrpc_pb.ccSystemRpcFormat,
    responseType: systemrpc_pb.ReturnValues,
    requestSerialize: serialize_ccSystemRpcFormat,
    requestDeserialize: deserialize_ccSystemRpcFormat,
    responseSerialize: serialize_ReturnValues,
    responseDeserialize: deserialize_ReturnValues,
  },
  examineBlockDifference: {
    path: '/gSystemRpc/examineBlockDifference',
    requestStream: false,
    responseStream: false,
    requestType: systemrpc_pb.ccSystemRpcFormat,
    responseType: systemrpc_pb.ReturnValues,
    requestSerialize: serialize_ccSystemRpcFormat,
    requestDeserialize: deserialize_ccSystemRpcFormat,
    responseSerialize: serialize_ReturnValues,
    responseDeserialize: deserialize_ReturnValues,
  },
  examinePoolDifference: {
    path: '/gSystemRpc/examinePoolDifference',
    requestStream: false,
    responseStream: false,
    requestType: systemrpc_pb.ccSystemRpcFormat,
    responseType: systemrpc_pb.ReturnValues,
    requestSerialize: serialize_ccSystemRpcFormat,
    requestDeserialize: deserialize_ccSystemRpcFormat,
    responseSerialize: serialize_ReturnValues,
    responseDeserialize: deserialize_ReturnValues,
  },
  declareBlockCreation: {
    path: '/gSystemRpc/declareBlockCreation',
    requestStream: false,
    responseStream: false,
    requestType: systemrpc_pb.ccSystemRpcFormat,
    responseType: systemrpc_pb.ReturnValues,
    requestSerialize: serialize_ccSystemRpcFormat,
    requestDeserialize: deserialize_ccSystemRpcFormat,
    responseSerialize: serialize_ReturnValues,
    responseDeserialize: deserialize_ReturnValues,
  },
  signAndResendOrStore: {
    path: '/gSystemRpc/signAndResendOrStore',
    requestStream: false,
    responseStream: false,
    requestType: systemrpc_pb.ccSystemRpcFormat,
    responseType: systemrpc_pb.ReturnValues,
    requestSerialize: serialize_ccSystemRpcFormat,
    requestDeserialize: deserialize_ccSystemRpcFormat,
    responseSerialize: serialize_ReturnValues,
    responseDeserialize: deserialize_ReturnValues,
  },
  resetTestNode: {
    path: '/gSystemRpc/resetTestNode',
    requestStream: false,
    responseStream: false,
    requestType: systemrpc_pb.ccSystemRpcFormat,
    responseType: systemrpc_pb.ReturnCode,
    requestSerialize: serialize_ccSystemRpcFormat,
    requestDeserialize: deserialize_ccSystemRpcFormat,
    responseSerialize: serialize_ReturnCode,
    responseDeserialize: deserialize_ReturnCode,
  },
};

exports.gSystemRpcClient = grpc.makeGenericClientConstructor(gSystemRpcService);
