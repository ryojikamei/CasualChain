import { EventEmitter } from "events";

import * as grpc from "@grpc/grpc-js";
import ic from "../../grpc/interconnect_pb.js"
import { inConfigType } from "../config/zod.js";

import { InReceiverSubModuleMock } from "./mock_in_receiver.js";

export class ServerMock {
    //constructor(options?: grpc.ServerOptions) {}
    private testAddService: number;
    private testBindAsync: number;
    private testTryShutdown: number;
    constructor(testAddService: number, testBindAsync: number, testTryShutdown: number) {
        this.testAddService = testAddService;
        this.testBindAsync = testBindAsync;
        this.testTryShutdown = testTryShutdown;
    }

    public addService(service: grpc.ServiceDefinition, implementation: grpc.UntypedServiceImplementation) {
        if (this.testAddService === 0) {
            //console.log("addService OK");
            return undefined;
        }
        //console.log("addService error");
        throw new Error("addService error");
    }

    public async bindAsync(port: string, creds: grpc.ServerCredentials, callback: (error: Error | null, port: number) => void) {
        const bindPort: number = Number(port.split(":")[1]);
        if (this.testBindAsync === 0) {
            //console.log("bindAsync OK");
            callback(null, bindPort);
            return undefined;
        }
        //console.log("bindAsync error");
        callback(new Error("bindAsync error"), bindPort * -1);
        return undefined;
    }

    public tryShutdown(callback: (error?: Error) => void) {
        if (this.testTryShutdown === 0) {
            //console.log("tryShutdown OK");
            callback();
            return undefined;
        }
        //console.log("tryShutdown error");
        callback(new Error("tryShutdown error"));
        return undefined;
    }
}

type ccGeneralIcReturnType = {
    on: Function,
    write: Function,
    end: Function
}
const emitter = new EventEmitter();

class interconnectClient_Base {

    constructor(address: string, credentials: grpc.ChannelCredentials, options?: any) {}

    public ccGeneralIc(options?: Partial<grpc.CallOptions>): ccGeneralIcReturnType {
        return {
            on: this.register,
            write: this.write,
            end: this.writeAndTerminate
        }    
    }

    protected register(eventName: string, listener: (...args: any[]) => void) {
        emitter.on(eventName, listener);
    }

    // Fake a response.
    protected write(req: ic.icGeneralPacket, callback?: Function) {}

    protected writeAndTerminate() { /* Do nothing */ }
    
}

const InConf: inConfigType = {
    "self": {
        "nodename": "node1",
        "rpc_port": 7000
    },
    "abnormalCountForJudging": 2,
    "nodes": [
        {
            "allow_outgoing": true,
            "nodename": "node2",
            "host": "192.168.1.51",
            "rpc_port": 7000
        },
        {
            "allow_outgoing": true,
            "nodename": "node3",
            "host": "192.168.1.52",
            "rpc_port": 7000
        }
    ]
}

export class interconnectClient_Success extends interconnectClient_Base {

    // Success response
    protected write(req: ic.icGeneralPacket, callback?: Function) {
        if (callback !== undefined) {
            console.log("callback:MakeBox:" + req.getPacketId())
            callback();
        }
        const receiver = new InReceiverSubModuleMock();
        receiver.generalReceiver(req) // fake receiver of the server side
        .then((ret) => {
            if (ret.isSuccess()) {
                if (ret.value.getPacketId() !== "") {
                    emitter.emit("data", ret.value)  // receiver on the client side
                }
            }
        })
    }
}

export class interconnectClient_Failure extends interconnectClient_Base {

    // Failure response
    protected write(req: ic.icGeneralPacket, callback?: Function) {
        if (callback !== undefined) { callback(); }
        emitter.emit("error", req);
    }
}