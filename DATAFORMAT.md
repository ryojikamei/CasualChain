# CasualChain Community Edition transaction & block data format guide

CasualChain has two types of data formats. One is the “transaction” format for holding user data. The other is the “block” format, which contains transactions and constitutes a blockchain.

## Transaction

### Data format definition

The datastore module defines the transaction data format.
```
/**
 * The transaction format
 */
export type objTx = {
    _id: string,
    type: string,
    tenant: string,
    settime: string,
    prev_id?: string,
    deliveryF: boolean,
    data?: object
};
```

#### _id: string

It is a 24-digit ID number that is unique for every transaction. The current CasualChain relies on MongoDB data structures, and this _id is exactly the same as the format of the MongoDB ObjectID.
For example, the string would be as follows
```
303148594a4a395a35484b37
```
The properties of the ObjectID guarantee that larger values are data created later. Some of CasualChain's APIs have the sortOrder option that sorts by this value as a key. Users do not generate or specify this value. The /post/byjson API automatically generates and specifies it, so users can see what _id is assigned in the return value of this API.

#### type: string

Specify the type of transaction. This value may be specified freely except for a few reserved words, but “new” is usually specified. Special reserved strings are “new”, “update”, and “delete”. These three can be used to associate different transactions and create a history chain. Please refer to the "Transaction chain" section for details on how to create a history chain.

#### tenant: string

This property is reserved for the tenant feature in the Enterprise Edition; in the Community Edition it is fixed to a certain value. Users do not specify this value.

#### settime: string

The date and time of registration in the system are specified in a human-readable format. This does not include time zone information. The time zone set for the system in operation is reflected as it is. Users do not specify this value.

#### prev_id: string (optional)

Specifies when to create a history chain. It is described in the “Transaction chain” section.

#### deliveryF: boolean

Specifies whether the data has been replicated to at least one other node. Immediately after the data is created, this value is false. The system generates and changes this value. Users do not specify this value.

#### data: object

Specify user data. Unlike internal definitions, user data must always be specified in /post/json API. User data can be freely accepted as long as it is in JSON format. However, its size is limited to a maximum of 15 MiB; if you want to handle data beyond 15 MiB, your application will need to split or merge it.

---
### Transaction chain

By specifying a special type, the system recognizes that those data are associated. This allows the system to express a history of changes to the data. This feature is called “Transaction chain".

#### Structure

A transaction chain is a group of data linked in one direction as follows.
```
 ---------------------------------------------------------------
|tx1: _id:001/type:"new"/data:{ "someuserdata": "initial data" }|
 ---------------------------------------------------------------
   |
   v
 -------------------------------------------------------------------------------
|tx1': _id:002/type:"update"/prev_id:001/data:{ "someuserdata": "updated data" }|
 -------------------------------------------------------------------------------
   |
   v
 -------------------------------------------------------------------------------------
|tx1'': _id:003/type:"update"/prev_id:002/data:{ "someuserdata": "more updated data" }|
 -------------------------------------------------------------------------------------
   |
   v
 -------------------------------------------------
|tx1''': _id:004/type:"delete"/prev_id:003/data:{}|
 -------------------------------------------------
```
First, register the initial data with the type “new”. To update data, set type to “update” and specify the previous _id value in prev_id. The system then recognizes that the two sets of data are associated and that the “update” data is the updated data of the "new" data. Updates can be made as many times as needed. Finally, type “delete” is used to indicate that this data has been deleted. Type “delete” should have empty data property.

#### Register a transaction chain

The following is an example of registering a series of transactions as a transaction chain.
```
$ curl -X POST --basic --user cc:demo-password -H'Content-Type: application/JSON; charset=UTF-8' -d '{ "type": "new", "data": { "someuserdata": "initial data" } }' http://localhost:9002/post/byjson
"3031485954445852585a4151"
$ curl -X POST --basic --user cc:demo-password -H'Content-Type: application/JSON; charset=UTF-8' -d '{ "type": "update", "prev_id": "3031485954445852585a4151", "data": { "someuserdata": "updated data" } }' http://localhost:9002/post/byjson
"3031485954445a3941584148"
$ curl -X POST --basic --user cc:demo-password -H'Content-Type: application/JSON; charset=UTF-8' -d '{ "type": "update", "prev_id": "3031485954445a3941584148", "data": { "someuserdata": "more updated data" } }' http://localhost:9002/post/byjson
"303148595445303047504746"
$ curl -X POST --basic --user cc:demo-password -H'Content-Type: application/JSON; charset=UTF-8' -d '{ "type": "delete", "prev_id": "303148595445303047504746", "data": {}}' http://localhost:9002/post/byjson
"303148595445304a44455446"
```

#### Referring to a transaction chain

The following is an example of referencing a registered transaction chain.
```
$ curl -X GET --basic --user cc:demo-password http://localhost:9002/get/history/303148595445304a44455446
```
Data that is from the last posted to the first are sequentially stored in an array, and it is output.
The _id of the last transaction must be specified to correctly display the entire history.


## Block

This section describes the format of the blocks. A chain of blocks is a blockchain. The current CasualChain blockchain structure is very basic and is not explained in this document. Any document on the Internet will be helpful.

### Data format definition

The block module defines the transaction data format.
```
/**
 * Ca3BlockFormat is just a extension of Ca2BlockFormat.
 * Differences in handling of existing tags with CA2(version: undefined) are:
 * - version: 2.
 * - miner?: Not used. Because the first node signed is a miner
 * - data?: genesis block doesn't have it, however parcel blocks have it
 * - type: genesis block is "genesis", parcel blocks are "parcel_open"/"parcel_close"
 */
export type Ca3BlockFormat = Ca2BlockFormat & {
    _id: string,
    version: number, // 2
    tenant: string,
    height: number,
    size: number,
    data?: objTx[], // genesis block doesn't have it
    type?: string,  // genesis block doesn't have it
    settime: string,
    timestamp: string,
    prev_hash: string,
    signedby: SignedBy,
    signcounter: number,
    hash: string
}
/**
 * The signature format
 */
export type SignedBy = {
    [node_name: string]: string
}

/**
 * Previous format of block
 * WARNING: The order of the contents must not be transposed.
 * It might be considered tampered with.
 */
export type Ca2BlockFormat = {
    _id: string,
    version: number, // 1
    tenant: string,
    height: number,
    size: number,
    data?: objTx[], // genesis block doesn't have it
    type?: string,  // genesis block doesn't have it
    settime: string,
    timestamp: string,
    miner?: string,  // genesis block doesn't have it
    prev_hash: string,
    hash: string
}
export type blockFormat = Ca2BlockFormat | Ca3BlockFormat;
```
Ca2BlockFormat was the format used in earlier versions and is no longer used; Ca3BlockFormat is the current format. Therefore, Ca3BlockFormat is described here. It should be noted that unlike the transaction data format, the data format of a block cannot change the order of its properties.

#### _id: string

It is a 24-digit ID number that is unique for every blocks. The current CasualChain relies on MongoDB data structures, and this _id is exactly the same as the format of the MongoDB ObjectID.
For example, the string would be as follows
```
303148595443393539504d31
```
The properties of the ObjectID guarantee that larger values are data created later. Some of CasualChain's APIs have the sortOrder option that sorts by this value as a key.

#### version: number

This number represents the version of the data format. Whenever there is a change in format, this number is incremented. The current version is 2.

#### tenant: string

This property is reserved for the tenant feature in the Enterprise Edition; in the Community Edition it is fixed to a certain value. The tenant value of a block is always the same as the tenant value of the transactions contained in it.

#### height: number

This property indicates the position of this block within the chain. The first block (genesis block) is 0.

#### size: number

This property indicates how much data this block contains. If the type is other than data, this value should be 0.

#### data: objTx[] (optional)

If the type is data, the actual data is stored under the data property. Otherwise, this property does not exist.

#### type: string

This property specifies the type of block. Specify “genesis” or “data” here.
- “genesis”: refers to the first block in the blockchain; in CasualChain it contains no data.
- “data”: refers to a block that contains transaction data; in CasualChain, a single block can have multiple transaction data. For compatibility, this property is treated as optional, but in practice this property is never omitted.

#### settime: string

The date and time of registration in the system are specified in DateTime, a human-readable format. This does not include time zone information. The time zone set for the system in operation is reflected as it is.

#### timestamp: string

The date and time of registration in the system are specified in UNIXTime format.

#### prev_hash: string

Stores the hash value of the block created one before. Hash will be explained later. Note that in the first block, this number is "0".

#### hash: string

A hash function is a mathematical algorithm that generates a fixed-length unique value (hash value) from arbitrary data. It always produces the same hash value for the same input and even a slight change in the input results in a completely different hash value. This property allows for verifying the integrity of data, secure storage, and transmission of data.
What is set here is the hash value obtained by inputting data for the entire block other than the hash value itself. This includes the value of prev_hash. Hash values play a very important role in the blockchain.

#### signedby: [node_name: string]: string

A blocked data goes through an approval process that is inspected by creating node and several other nodes. The name of the approved node and its signature data are recorded here. An approval adds the result of hash value calculation to the target data. The target data also includes the hash values of the nodes that have been approved so far.

#### signcounter: number

This value is a counter for how many more signature requests. The first block creation node sets the initial value. It is decremented each time a signature is made, and when it reaches 0, the block is saved.


