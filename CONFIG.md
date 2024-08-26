# CasualChain Community Edition configuration file guide

All configuration files are located under the config directory.

config/
  - *.json
  - *.pub
  - *.key
  - templates/

### config/*.json files

For each node in each startup mode, one configuration file is prepared in json format. The files here are already configured to work for demo or tests. However, no files are included that can be used in a production environment.
- demo_\<nodename>.json: configuration files for nodes that are run in demo mode
- dev_\<nodename>.json: configuration files for nodes that are run at development/debugging 
- apitest_\<nodename>.json: configuration files for nodes that are run in API test mode
- apitest_worker.json: the configuration file for API test worker process
- unittest.json: the configuration file using with unit tests

### config/\*.pub and config/*.key files

Each node must have a pair of private and public keys. These are created automatically. Unless there is a specific reason to do so, such as node recovery, it is acceptable to use the automatically created keys.

### JSON files under templates directory

Here you will find a semi-complete configuration file for the production environment.

---
Thus, there are a few types of configuration files. This section describes configuration files in JSON format, which users may edit.

## "logger" section, logger module settings

The logger module controls the output of logs written out.

#### "console_output" (boolean;true/false)

Specify whether console output is performed or not by true or false. Regardless of this setting, logs before this module is activated are output to the screen.

#### "console_level" (string)

Specify the maximum level of logging to be output to the console. The log levels are defined as follows:

- "error" (or "err" or "3")
- "warning" (or "warn" or "4")
- "notice" (or "5")
- "informational" (or "info" or "6")
- "debug" (or "7")

CasualChain follows traditional logging levels, emergency, alert and critical are not used. Shorthand and numerals are also available. The standard log level is "notice". If the log level is “notice”, messages tagged “error”, “warning”, and “notice” are displayed, and “informational” and “debug” messages are not displayed. To view all levels of logs, specify “debug”.

#### "file_output" (boolean;true/false)

Specify whether file output is performed or not by true or false. Regardless of this setting, logs before this module is activated are NOT output to the file.

#### "file_path" (string)

Specify the file to write the log to by absolute path. See the following file_rotation also for rotation.

#### "file_rotation" (boolean;true/false)

Specify true if you want CasualChain to allow log files to be rotated, false otherwise. If True, CasualChain will rotate every 14 days by appending the year, month, and day (YYYY-MM-DD-) to the beginning of the file name.

#### "file_level" (string)

Specify the maximum level of9, logging to be output to the file. The method of specifying the level is the same as console_level.

---
## "block" section, block module settings

The block module creates various type of blocks. The creation of blocks is done according to a certain algorithm. Currently, only the CA3 algorithm is implemented. In this section, you can configure the settings for the CA3 sub-module.

### "ca3" subsection

In the CA3 algorithm, the created block must travel between each node to obtain a certain number of approvals. Many of the following settings are adjustments to the approval process.

#### "minLifeTime" (number)

Specify the survival time in seconds for blocks created and sent out at this node. This value is the initial value. The remaining survival time is checked at each process of each node, and when it reaches zero, it is discarded. If this value is too small, processing capacity is greatly reduced due to frequent redoing of processing. Conversely, if this value is too large, node disconnection detection takes time when the network is unstable, resulting in reduced processing capacity.

#### "maxLifeTime" (number)

If a certain amount of time passes without notification that a block created and sent out at this node has been written to the blockchain, the block is considered to have been discarded en route. The time to make that decision is initially the value of minLifeTime. When the block is to be retransmitted, it is set to the current value increased by 50%. Each time a retransmission is made, the value is increased by 50%, but never by more than the value of maxLifeTime. In other words, maxLifeTime is the maximum value of survival time. This is specified in seconds.

#### "abnormalCountForJudging" (number)

If an error occurs in communication to a node due to a network error or some other reason, it is foolish to repeatedly attempt communication to that node. On the other hand, it is not a good idea to give up communication to the node immediately. This value specifies how many times an error occurs before giving up communication with the node. Generally, a node with an unstable network will set this value higher. It is not possible to set this value for each destination node.

#### "maxSignNodes" (number)

This value specifies how many nodes typically need to approve blocks created and sent out by this node. If no problems occur while the block is traveling through the network, it will receive approval from the number of nodes specified by this value. Then, the last node to approve the block will write it to the blockchain and notify it to the created node.

#### "minSignNodes" (number)

While a block is traveling through the network, it may not be possible to obtain further approval due to network failure or other reasons.
In such a case, if the block has already been approved for the value specified here for the node in process, the block will be written into the blockchain by that node. Note that the settings of the node doing the processing are applied, not those of the node that created the block.

---
## "system" section, system module settings

The system module provides functions for system administration to the administrator and other modules of the system.

#### "node_mode"

Specify the behavior of the entire CasualChain system. One of the following values should be specified.

- "standard": specify with a standard node that uses true mongodb. 
- "standard+init": specify to the node that uses true mongodb and is responsible for initializing the blockchain itself. This designation must not be made to more than one node on the network.
- "testing": specify if mongodb is to be used on volatile memory for demonstration, development, testing, etc.
- "testing+init": specify to the node that uses mongodb on volatile memory and is responsible for initializing the blockchain itself. This designation must not be made to more than one node on the network.

### "events_internal" subsection

Specify the interval in minutes between executions of functions that the system automatically performs internally. Some of these functions are similar to those in file systems.

#### "postDeliveryPoolMinInterval" (number)

The postDeliveyPool is the function to propagate pooling data on this node to other nodes. Smaller values reduce the risk of data loss but increase the CPU load. However, in the current Community Edition, the pool is always placed in memory, so there is no risk reduction effect for power failure. This value should be equal to or less than the next “postAppendBlocksMinInterval” value.

#### "postAppendBlocksMinInterval" (number)

The postAppendBlocks bundles a data groups common to each node in the form of a single block and add it to the blockchain on the mongodb of this node, as well as to the blockchains of other nodes. The group of data common to each node refers only to data already propagated by the postDeliveryPool. This functionality is similar to the commit behavior in filesystems and databases. In Community Edition, this value must be set as low as possible to prevent data loss due to power failure. Also, due to mongodb limitations, the maximum size of a single block in CasualChain is 15 MiB. In this version of CasualChain, since this value simply defines the frequency of data writes, the maximum throughput of data writes is limited by this value.

#### "postScanAndFixPoolMinInterval" (number)

The postScanAndFixPool is the function that fixes incorrect transaction pool conditions. Since the blockchain is a distributed file system, data inconsistencies may occur due to network fragmentation and other factors. This fixes most of them in the transaction pool.

#### "postScanAndFixBlockMinInterval" (number)

The postScanAndFixBlock is the function that fixes incorrect blockchain conditions. This fixes most of them in the blockchain. Some of the modifications performed here depend on the correct transaction pool status. Thus, postScanAndFixPool would/should be executed first.

---
## "internode" section, inter-node module settings

The internode module is responsible for communication between nodes. In the current CasualChain, information about all communicating nodes must be listed here. The “self” subsection contains information about itself and the “nodes” subsection contains information about other nodes.

### "self" subsection

#### "nodename" (string)

Set the nodename of this node. The nodename does not have to be the same as the hostname on the network, but it must be the same name as here even when representing this node from another node.

#### "rpc_port" (number)

Specify the port number on which this node listens for connections from other nodes.

### "nodes" subsection

#### "allow_outgoing" (boolean;true/false)

Set this to true if that node has some problem and want to exclude communication to it. However, it will not prevent communication from that node. This should be done using a tool such as netfilter.

#### "nodename" (string)

Set the nodename of that node. The nodename does not have to be the same as the hostname on the network, but it must be the same as the nodename that that node specifies in the self subsection.

#### "host" (string)

Specify the IP address or hostname of that node.

#### "rpc_port" (number)

Specify the port number on which that node listens for connections from other nodes.

---
## "keyring" section, keyring module settings

The keyring module manages security stuff for network communication.

#### "create_keys_if_no_sign_key_exists" (boolean;true/false)

Automatically generates a set of keys when keys for signatures do not exist. When you prepare your own key, we recommend that it be false to avoid accidents.

#### "sign_key_file" (string)

Specify the file name of the key for signing, i.e., the private key.

#### "verify_key_file" (string)

Specify the file name of the key for verification, i.e., the public key.

---
## "datastore" section, datastore module settings

The datastore module faces mongodb and is responsible for low-level data input and output.

#### "password_encryption" (boolean;true/false)

Specify whether the specified password is encrypted or not. If it is specified in plaintext, set to false. The npm run pwdgen will output encrypted string and you replace password with it, then set to true.

#### "mongo_host" (string)

Specify the IP address or hostname of the mongodb that stores data for this node.

#### "mongo_port" (string)

Specify the mongodb port number to store data for this node.

#### "mongo_password" (string)

Specify the mongodb password for the database to store data for this node.

#### "mongo_dbname" (string)

Specify the mongodb database name to store the data for this node.

#### "mongo_dbuser" (string)

Specify the mongodb user name for the database to store the data for this node

#### "mongo_authdb" (string)

Specify the name of the database in which the data for user authentication is stored.

#### "mongo_blockcollection" (string)

Specify the name of the collection that will contain the blockchain.

---
## "event" section, event module settings

The event module is responsible for automatically executing methods in the system at regular intervals.

#### "enable_internaltasks" (boolean;true/false)

Specify whether to enable internal auto-run tasks. The list of tasks can be found in the “events_internal” subsection of the “system” section. If not enabled, you will have to execute them manually via the API.

---
## "api" section, api module settings

The api module is located on the system surface and is responsible for communication with applications.

### "rest" subsection

This is the configuration item for REST-like interfaces

#### "password_encryption" (boolean;true/false)

Specify whether specified passwords are encrypted or not. If they are specified in plaintext, set to false. The npm run pwdgen will output encrypted strings and you replace passwords with them, then set to true.

#### "userapi_port" (number)

Specify the port number for accessing the user api group.

#### "userapi_user" (string)

Specify the user name to access the user api group.

#### "userapi_password" (string)

Specify the password to access the user api group.

#### "adminapi_port" (number)

Specify the port number for accessing the administration api group.

#### "adminapi_user" (string)

Specify the user name to access the administration api group.

#### "adminapi_password" (string)

Specify the password to access the administration api group.

---

