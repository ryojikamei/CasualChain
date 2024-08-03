// GENERATED CODE -- DO NOT EDIT!

'use strict';
var grpc = require('@grpc/grpc-js');
var interconnect_pb = require('./interconnect_pb.js');

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
};

exports.interconnectClient = grpc.makeGenericClientConstructor(interconnectService);
