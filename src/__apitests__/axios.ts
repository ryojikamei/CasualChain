/**
 * Copyright (c) 2024 Ryoji Kamei
 * Released under the MIT license
 * https://opensource.org/licenses/mit-license.php
 */

import axios from "axios";
import { authTokens } from "./server";

export type responseType = {
    code: number,
    data: any,
    message: string,
    errormsg: string
}

function genHeaders(cmd: string, token: string): object {
    let header = { "Content-Type": "application/json; charset=utf-8" };

    if (cmd.endsWith("/login") === false) {
        header = { ...header, ...{ "Authorization": "Bearer " + token } };
    }

    return header;
}

export async function runAxios(cmd: string, method: string, bcapi: any, tokens: authTokens, payload?: string, nodeNo?: number): Promise<responseType> {
    let baseURL: string
    let headers: object
    if (cmd.startsWith("/sys/") === false) {
        switch (nodeNo) {
            case 2:
                baseURL = "http://" + bcapi.node2.host + ":" + bcapi.node2.userapi_port.toString();
                headers = genHeaders(cmd, tokens.node2_user);
                break;
            default:
                baseURL = "http://" + bcapi.node1.host + ":" + bcapi.node1.userapi_port.toString();
                headers = genHeaders(cmd, tokens.node1_user);
                break;
        }
    } else {
        switch (nodeNo) {
            case 2:
                baseURL = "http://" + bcapi.node2.host + ":" + bcapi.node2.adminapi_port.toString();
                headers = genHeaders(cmd, tokens.node2_admin);
                break;
            default:
                baseURL = "http://" + bcapi.node1.host + ":" + bcapi.node1.adminapi_port.toString();
                headers = genHeaders(cmd, tokens.node1_admin);
                break;
        }
    }
    
    let ret: responseType = {
        code: -1,
        data: "",
        message: "",
        errormsg: ""
    };
    let data: any = undefined;
    if (payload !== undefined) data = payload;
    await axios(cmd, {
        method: method,
        baseURL: baseURL,
        headers: headers,
        data: data
    })
    .then((onfullfilled) => {
        ret.code = onfullfilled.status;
        ret.data = onfullfilled.data;
    },(onrejected) => {
        if(onrejected.response) {
            ret.code = onrejected.response.status;
            ret.data = onrejected.response.data;
        } else {
            ret.code = -1;
        }

        ret.message = onrejected.code;
        ret.errormsg = onrejected.message;
    })

    return ret;
}