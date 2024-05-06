
# What is CasualChain?

A blockchain core system that doesn't have any incentive features inside

- Man shall not live by crypto currency alone


# Setup for evaluation

Currently, no convenient setup program is provided. Future versions may simplify the setup process.

## Prerequirements: a Linux system that can run following components: 

- Node.js 18 (20 will be supported soon)
- OpenSSL (probably already installed)
- Git
- 4.4 =< MongoDB =< 6.0 (required transaction feature. 6.1 - 6.5 was not tested but they may work. 7.0 will be supported later)

Here is a installation example for ubuntu 22.04:
```
$ sudo apt install git
$ sudo apt install nodejs npm
$ sudo npm install n -g
$ sudo n 18
$ sudo apt purge nodejs npm
$ sudo apt autoremove
$ sudo apt install gnupg curl
$ curl -fsSL https://www.mongodb.org/static/pgp/server-6.0.asc | \
  sudo gpg -o /usr/share/keyrings/mongodb-server-6.0.gpg \
  --dearmor
$ echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-6.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/6.0 multiverse" | \
  sudo tee /etc/apt/sources.list.d/mongodb-org-6.0.list
$ sudo apt update
$ sudo apt install -y mongodb-org
``` 
MongoDB server can also be run on a different node than the one running CasualChain. However, some of the api tests require MongoDB tools.

## Get the code

```
$ git clone https://github.com/ryojikamei/CasualChain.git
$ cd CasualChain
```
or download the zip and unzip it instead.


## Build the tree

```
$ npm install
$ npm run build
```

## Prepare a private key to run a node

One private key is required to create a block. If you have your own unique private key, use it. Alternatively, create it as follows

```
$ openssl genpkey -algorithm ed25519 -out config/example_ca.key

```

By default, CasualChain automatically generates the necessary files based on example_ca.key under config. Please put your private key here.

## Run a demo

Try to see if the demo is bootable. This process can be skipped. Demo can be stopped with Ctrl-C.

```
$ npm run demo
```

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

### Create configuration file for each instance

Unfinished configuration files are provided.

```
$ ls config/prod_*
config/prod_node1.json        config/prod_node2.json
config/prod_node3.json
```

There is one configuration file per node.

#### Make configuration file for community edition

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



