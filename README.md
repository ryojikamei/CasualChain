
# What is CasualChain?

A blockchain core system that doesn't have any incentive features inside

- Man shall not live by crypto currency alone

# Documentation

- [Code reference](https://ryojikamei.github.io/CasualChain/index.html)
- [Overview(English)](https://github.com/ryojikamei/CasualChain/blob/main/CasualChain_OverView-en.pdf)
- [Overview(Japanese)](https://github.com/ryojikamei/CasualChain/blob/main/CasualChain_OverView-ja.pdf)
- [API guide](https://github.com/ryojikamei/CasualChain/blob/main/API.md)
- [DataFormat guide](https://github.com/ryojikamei/CasualChain/blob/main/DATAFORMAT.md)
- [Configuration guide](https://github.com/ryojikamei/CasualChain/blob/main/CONFIG.md)

# Try to run a demo

## Setup path

There are three different ways:

1. Building from the code (Current recommendation)
2. Using npm
3. Using docker (Much easy but demo version only)

In any case, a Linux system with MongoDB version 4.4 or higher can be installed is required.
CasualChain also uses OpenSSL commands directly. This is usually already installed.


## When building from the code

### Install the Node.js

Version 18.x and 20.x are tested.
Here is a installation example for ubuntu 22.04.
```
$ sudo apt install nodejs npm
$ sudo npm install n -g
$ sudo n 20
$ sudo apt purge nodejs npm
$ sudo apt autoremove
```

### Download and compile the code

```
$ sudo apt install git
$ git clone https://github.com/ryojikamei/CasualChain.git
$ cd CasualChain
$ npm install
$ npm run build
```

### Run a demo

```
$ npm run demo
```
Demo can be stopped with Ctrl-C.
APIs are listed in the overview pdf file.

## When using npm

Registered in npm, but not a library, so not a very smart way to do it.
In future versions, the core will be made into a library, which will be more useful.

### Install the Node.js

```
$ sudo apt install nodejs npm
$ sudo npm install n -g
$ sudo n 20
$ sudo apt purge nodejs npm
$ sudo apt autoremove
```

### Install CasualChain

```
$ npm install casualchain
$ cd node_modules/casualchain
$ ln -s systemrpc_grpc_pb.cjs  grpc/systemrpc_grpc_pb.js
$ ln -s systemrpc_pb.cjs  grpc/systemrpc_pb.js
$ npm install
```

### Run a demo

```
$ npm run demo
```
Demo can be stopped with Ctrl-C.
APIs are listed in the overview pdf file.


## When using docker

Currently only a demo version is available. It cannot be used for full-scale evaluation.
See https://hub.docker.com/repository/docker/ryojikamei/casualchain/general
to seek the recent image.
```
$ sudo docker image pull ryojikamei/casualchain:demo_<timestamp>
$ sudo docker container run -p 8001:8001 -p 9001:9001 ryojikamei/casualchain:demo_<timestamp>
```
Demo can be stopped like:
```
$ sudo docker container list
CONTAINER ID   IMAGE                                        COMMAND                   CREATED              STATUS              PORTS                                                                                                      NAMES
490e3caef3d8   ryojikamei/casualchain:demo_20240529084025   "docker-entrypoint.s…"   About a minute ago   Up About a minute   0.0.0.0:8001->8001/tcp, :::8001->8001/tcp, 8002/tcp, 0.0.0.0:9001->9001/tcp, :::9001->9001/tcp, 9002/tcp   quizzical_lederberg
$ sudo docker container stop quizzical_lederberg
```

# Run for a long-term evaluation

The two startup modes - dev, and demo - build the MongoDB on volatile memory.
When starting in a long-term evaluation, MongoDB must be configured as normal.

## MongoDB installation

CasualChain stores blocked data in MongoDB. Version 4.4 or higher is required because CasualChain requires the transaction feature.

Here is a installation example for ubuntu 22.04. MongoDB for ubuntu 24.04 does not yet exist.
```
$ sudo apt install gnupg curl
$ curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | \
  sudo gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg \
  --dearmor
$ echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | \
  sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list
$ sudo apt update
$ sudo apt install -y mongodb-org
```

## A pair of private key and public key to run a node

Required keys are automatically generated upon initial startup.
They will be in config/\<run mode>_\<node name>.key and config/\<run mode>_\<node name>.pub.
Alternatively, you may use keys you have provided.

## MongoDB configuration

The two startup modes - dev, and demo - build the MongoDB on volatile memory.
When starting in evaluation, MongoDB must be configured as normal.

Here is a minimal configuration of MongoDB.
These setups are insufficient in terms of availability because all instances are stored on a single server. When building a production environment, prepare servers for the number of nodes.

### Start mongod

```
$ sudo systemctl enable --now mongod
```

### Create admin account

```
$ mongosh
test> use admin
switched to db admin
admin> db.createUser({
... "user": "admin",
... "pwd": "<some hard password>",
... "roles": [{"role":"userAdminAnyDatabase","db":"admin"}]
... });
{ ok: 1 }
admin> <exit with Ctrl-D>
```

### Enable authorization

```
$ sudo vi /etc/mongod.conf
```
Open mongod.conf and enable authorization.
```
security:
  authorization: enabled
```
Restart the mongod
```
$ sudo systemctl restart mongod
```

### Create account for each CasualChain instance

I recommend starting at least 3 instances, so prepare 3 databases.
Passwords will be specified later in CasualChain configuration files, so they must be remembered.

```
$ mongosh -u admin -p <password for admin>
test> use bcdb1;
switched to db bcdb1
bcdb1> db.createUser({
... "user": "bcuser1",
... "pwd": "<some hard password>",
... "roles": [{"role":"dbOwner","db":"bdcb1"}]
... });
{ ok: 1 }
bcdb1> use bcdb2;
switched to db bcdb2
bcdb2> db.createUser({
... "user": "bcuser2",
... "pwd": "<some hard password>",
... "roles": [{"role":"dbOwner","db":"bdcb2"}]
... });
{ ok: 1 }
bcdb2> use bcdb3;
switched to db bcdb3
bcdb3> db.createUser({
... "user": "bcuser3",
... "pwd": "<some hard password>",
... "roles": [{"role":"dbOwner","db":"bdcb3"}]
... });
{ ok: 1 }
bcdb3> <exit with Ctrl-D>
$ sudo systemctl restart mongod
```

### Put configuration file for each instance

Unfinished configuration files are provided.

```
$ cp -a config/template/* .
$ ls config/prod_*
config/prod_node1.json        config/prod_node2.json
config/prod_node3.json
```

There is one configuration file per node.

### Edit configuration files

Edit the three files, prod_node1.json, prod_node2.json, and prod_node3.json, and activate them as configuration files.
The following is a list of the parts of each file that need to be modified.

- "logger":"filepath"\
Specify a valid file path.

- "datastore":"mongo_password"\
Specify here the password to access the MongoDB database that you have already set up using mongosh.

- "api":"rest":"userapi_password"\
Specify the password for the user API.

- "api":"rest":"adminapi_password"\
Specify the password for the administration API.

# Run

Startup entries for node1 through node3 are provided in package.json.
Prepare three VTs and run the npm command from each.

```
$ npm run prod_node1
```
```
$ npm run prod_node2
```
```
$ npm run prod_node3
```



