// GENERATED CODE -- DO NOT EDIT!

'use strict';
var grpc = require('@grpc/grpc-js');
var interconnect_pb = require('./interconnect_pb.js');

function serialize_ctrlRequest(arg) {
  if (!(arg instanceof interconnect_pb.ctrlRequest)) {
    throw new Error('Expected argument of type ctrlRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_ctrlRequest(buffer_arg) {
  return interconnect_pb.ctrlRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_ctrlResponse(arg) {
  if (!(arg instanceof interconnect_pb.ctrlResponse)) {
    throw new Error('Expected argument of type ctrlResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_ctrlResponse(buffer_arg) {
  return interconnect_pb.ctrlResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_icGeneralPacket(arg) {
  if (!(arg instanceof interconnect_pb.icGeneralPacket)) {
    throw new Error('Expected argument of type icGeneralPacket');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_icGeneralPacket(buffer_arg) {
  return interconnect_pb.icGeneralPacket.deserializeBinary(new Uint8Array(buffer_arg));
}


var interconnectService = exports.interconnectService = {
  ccGeneralIc: {
    path: '/interconnect/ccGeneralIc',
    requestStream: true,
    responseStream: true,
    requestType: interconnect_pb.icGeneralPacket,
    responseType: interconnect_pb.icGeneralPacket,
    requestSerialize: serialize_icGeneralPacket,
    requestDeserialize: deserialize_icGeneralPacket,
    responseSerialize: serialize_icGeneralPacket,
    responseDeserialize: deserialize_icGeneralPacket,
  },
  ccCtrlLine: {
    path: '/interconnect/ccCtrlLine',
    requestStream: false,
    responseStream: false,
    requestType: interconnect_pb.ctrlRequest,
    responseType: interconnect_pb.ctrlResponse,
    requestSerialize: serialize_ctrlRequest,
    requestDeserialize: deserialize_ctrlRequest,
    responseSerialize: serialize_ctrlResponse,
    responseDeserialize: deserialize_ctrlResponse,
  },
};

exports.interconnectClient = grpc.makeGenericClientConstructor(interconnectService);
