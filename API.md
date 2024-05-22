# CasualChain Community Edition REST-like API guide

## User APIs

### /get/byjson

#### Summary
It searches and gets data by JSON format, type GET.

#### IN
Sets the search condition by a key/value pair in JSON format in body.

#### OUT
On success, it returns response code 200 and transaction data in an array of JSON format, that is narrow down by the search condition. On fail, it returns response code 503 with error detail. Note that even if there is no corresponding data, the query succeeds and an empty array is returned as data.

#### Examples

The following retrieves all data where key is “nodename” and value is “demo_node2” from the node waiting on localhost:9002.
```
curl -X GET --basic --user cc:demo-password -H'Content-Type: application/JSON; charset=UTF-8' -d '{ "key": "nodename", "value": "demo_node2" }' http://localhost:9002/get/byjson
```

By default, the output is the one that matches the condition under the data section of each block. If you want the entire block to be evaluated, use the whole option. The following outputs all transactions whose “type” is “delete".
```
curl -X GET --basic --user cc:demo-password -H'Content-Type: application/JSON; charset=UTF-8' -d '{ "key": "type", "value": "delete", "whole": true }' http://localhost:9002/get/byjson
```

The range of data to be retrieved for /get/byjson is all transactions that the specified node has. There are skipblocked and skippooling options to limit this range. The following is an example of retrieving data only for transactions that have already been blocked.
```
curl -X GET --basic --user cc:demo-password -H'Content-Type: application/JSON; charset=UTF-8' -d '{ "key": "nodename", "value": "demo_node2", "skippooling": true }' http://localhost:9002/get/byjson
```

If multiple transactions match the condition, you may want to sort the data before outputting it. In that case, use the sortOrder option. The following is sorted in ascending order by oids before output.
```
curl -X GET --basic --user cc:demo-password -H'Content-Type: application/JSON; charset=UTF-8' -d '{ "key": "type", "value": "delete", "whole": true, "sortOrder": 1 }' http://localhost:9002/get/byjson
```
Set 1 for ascending order and -1 for descending order. Other values are ignored and no sorting is performed.

The constrainedSize option can also be used if you wish to limit the output size and terminate it in the middle. In the following example, the acquisition is terminated just before the data exceeds 1 MiB.
```
curl -X GET --basic --user cc:demo-password -H'Content-Type: application/JSON; charset=UTF-8' -d '{ "key": "nodename", "value": "demo_node2", "constrainedSize": 1048576 }' http://localhost:9002/get/byjson
```

Options can be set in any order. However, they are evaluated in the following order:
1. skipblocked/skippooling
2. whole
3. key/value
4. sortOrder
5. constrainedSize

---
### /get/byoid/:oid(\w{24})

#### Summary
It searches and gets data that has the oid, type GET.

#### IN
Set a 24-character oid at the end of url. The body will be ignored.

#### OUT
On success, it returns response code 200 and single transaction data in JSON format, that have the specified oid. On fail, it returns response code 503 with no data. Note that even if there is no corresponding data, the query succeeds and an empty string is returned as data.

#### Examples

The following retrieves the transaction whose oid is 3031485946334356504d5a59.
```
curl -X GET --basic --user cc:demo-password http://localhost:9002/get/byoid/3031485946334356504d5a59
```
The oid can be known when registering data using /post/json.

By default, the transaction's oid is used as the key to retrieve, but if you want to retrieve a block using the block's oid as the key, use the targetIsBlock option. The following gets the block where the oid is 303148594738544e454e3533.
```
curl -X GET --basic --user cc:demo-password -H'Content-Type: application/JSON; charset=UTF-8' -d '{ "targetIsBlock": true }' http://localhost:9002/get/byoid/303148594738544e454e3533
```

If you do not want the size of the data to be retrieved to exceed a certain value, the constrainedSize option can be used. The following returns empty data instead if the data of the oid to be retrieved exceeds 1 MiB.
```
curl -X GET --basic --user cc:demo-password -H'Content-Type: application/JSON; charset=UTF-8' -d '{ "constrainedSize": 1048576 }' http://localhost:9002/get/byoid/3031485946334356504d5a59
```

Options can be set in any order. However, the targetIsBlock option is always evaluated before the constrainedSize option.

---
### /get/alltxs

#### Summary
It gets all transaction data, type GET.

#### IN
There are no mandatory arguments.

#### OUT
On success, it returns response code 200 and transaction data in an array of JSON format. On fail, it returns response code 503 with error detail. Note that even if there is no corresponding data, the query succeeds and an empty array is returned as data.

#### Examples

The following retrieves all transaction data from the node waiting on localhost:9002. These include transactions that have not yet been propagated to other nodes.
```
curl -X GET --basic --user cc:demo-password http://localhost:9002/get/alltxs
```

The sortOrder option sorts transactions by oid before outputting them. If 1 is given, it sorts in ascending order; if -1 is given, it sorts in descending order. Other values are invalid, and are ignored.
```
curl -X GET --basic --user cc:demo-password -H'Content-Type: application/JSON; charset=UTF-8' -d '{ "sortOrder": 1 }' http://localhost:9002/get/alltxs
```

The constrainedSize option limits the size of the output data, which can be set from 0 to 15728640 (15 MiB). Values outside the range are rounded. From the first transaction to the transaction just before the limit is exceeded can be retrieved.
In the following example, the acquisition is terminated just before the data exceeds 1 MiB.
```
curl -X GET --basic --user cc:demo-password -H'Content-Type: application/JSON; charset=UTF-8' -d '{ "constrainedSize": 1048576 }' http://localhost:9002/get/alltxs
```

However, since data order is not guaranteed, in practice it would need to be used in conjunction with the sortOrder option. The two options can be specified in any order, but the sortOrder option is always evaluated first.
```
curl -X GET --basic --user cc:demo-password -H'Content-Type: application/JSON; charset=UTF-8' -d '{ "constrainedSize": 1048576, "sortOrder": -1 }' http://localhost:9002/get/alltxs
```


---
### /get/blocked

#### Summary
It gets all already-blockchained data, type GET.

#### IN
There are no mandatory arguments.

#### OUT
On success, it returns response code 200 and transaction data in an array of JSON format. This API returns data in the blockchain structure. That is, the array may contains multiple or single blocks, and a block may contain multiple or single transactions in 'data' section. The very first block is called the genesis block and contains no data. On fail, it returns response code 503 with no data.

#### Examples

The following retrieves all blocks containing multiple or single transaction data from the node waiting on localhost:9002. 
```
curl -X GET --basic --user cc:demo-password http://localhost:9002/get/blocked
```

If you just want to enumerate all transactions contained in all blocks, use the bareTransaction option.
```
curl -X GET --basic --user cc:demo-password -H'Content-Type: application/JSON; charset=UTF-8' -d '{ "bareTransaction": true }' http://localhost:9002/get/blocked
```

As with /get/alltxs, the sortOrder and constrainedSize options can be used. The three options can be specified in any order, but the order in which they are evaluated is fixed. The bareTransaction option is evaluated first, then the sortOrder option, and finally the constrainedSize option.

In the next example, transactions are first taken out of blocks and then sorted in ascending order by transaction's oids.
```
curl -X GET --basic --user cc:demo-password -H'Content-Type: application/JSON; charset=UTF-8' -d '{ "sortOrder": 1, "bareTransaction": true }' http://localhost:9002/get/blocked
```

In the next example, data are prepared as blocks, sorted in descending order by block's oid, and finally the blocks from the first block to just before exceeding 1 MiB are output.
```
curl -X GET --basic --user cc:demo-password -H'Content-Type: application/JSON; charset=UTF-8' -d '{ "sortOrder": -1, "constrainedSize": 1048576 }' http://localhost:9002/get/blocked
```

Note that the presence or absence of the bareTransaction option changes the target on which subsequent options act.

---
### /get/history/:oid(\w{24})

#### Summary
It gets the chain to the past of the specified transaction, type GET.

#### IN
Set a 24-character oid at the end of url. The body will be ignored.

#### OUT
On success, it returns an array of JSON that contains all transactions from the specified transaction into the past. Note that future transactions are not included. On fail, it returns response code 503 with error detail. Note that even if there is no corresponding data, the query succeeds and an empty array is returned as data.

#### Examples

The following retrieves the transaction with oid 303148594738544e4531534d and all previous transactions chained to it. See DATAFORMAT.md for information on how to create transaction chains. Transaction chains are a convenient way to represent history.
```
curl -X GET --basic --user cc:demo-password http://localhost:9002/get/history/303148594738544e4531534d
```

If the size of the history is too large, it can be limited by the constrainedSize option. In the following example, no past history beyond 1 MiB is shown.
```
curl -X GET --basic --user cc:demo-password -H'Content-Type: application/JSON; charset=UTF-8' -d '{ "constrainedSize": 1048576 }' http://localhost:9002/get/history/303148594738544e4531534d
```

---
### /post/byjson

#### Summary
It posts a transaction with JSON format, type POST.

#### IN
Set user data in JSON format, under 'data' key. Also, a transaction must have 'type' key with a value. By default, key 'type' can have a value of one of three types. That is, 'new', 'update', or 'delete'. Transactions that have no relation to others have 'new'. An update transaction of a previous transaction is appended with 'update'. And the transaction whose purpose is to disable a series of transactions is 'delete'. For 'update' and 'delete' transactions, an 'prev_id' key containing the value of oid of the previous transaction is required also.

#### OUT
On success, it returns response code 200 and oid in the body. On fail, it returns response code 503 with error detail.

#### Examples

The following registers a simple data with the key “userdata” and the value “demo1”.
```
curl -X POST --basic --user cc:demo-password -H'Content-Type: application/JSON; charset=UTF-8' -d '{ "type": "new", "data": { "userdata": "demo1" } }' http://localhost:9002/post/byjson
```
User data can be freely designed as values relative to the “data” key in JSON format. However, its size cannot exceed 15 MiB.

---
## Administration APIs

### /sys/syncblocked

#### Summary
It checks blockchain on remote nodes and syncs with the major node status, type POST. It recovers the local blockchain by checking remote ones. It makes the local blockchain syncing with the MAJOR node status, and then local transactions that have not been in major blockchain are pushed back to the pooling state.

#### IN
There are no mandatory arguments.

#### OUT
On success, it returns response code 200 and 0 as return code. On fail, it returns response code 503 with error detail.

#### Examples

The entire process is automatic. If run without any options, the repair will continue from the inspection. The following example is executed for the node allocated to localhost:8002.
```
curl -X POST --basic --user admin:admin-password http://localhost:8002/sys/syncblocked
```

If you only want to perform inspections, add the scanonly option.
```
curl -X POST --basic --user admin:admin-password -H'Content-Type: application/JSON; charset=UTF-8' -d '{ "scanonly": true }' http://localhost:8002/sys/syncblocked
```

To prevent unnecessary deblocking, it is recommended to run /sys/syncpooling before running /sys/syncblocked.

---
### /sys/syncpooling

#### Summary
It checks transactions both in pooling and blocked and removes duplications from pooling, and then checks pooling state on remote nodes and get lacking transactions, type POST.

#### IN
There are no mandatory arguments.

#### OUT
On success, it returns response code 200 and 0 as return code. On fail, it returns response code 503 with error detail.

#### Examples
The entire process is automatic. If run without any options, the repair will continue from the inspection. The following example is executed for the node allocated to localhost:8002.
```
curl -X POST --basic --user admin:admin-password http://localhost:8002/sys/syncpooling
```

If you only want to perform inspections, add the scanonly option.
```
curl -X POST --basic --user admin:admin-password -H'Content-Type: application/JSON; charset=UTF-8' -d '{ "scanonly": true }' http://localhost:8002/sys/syncpooling
```