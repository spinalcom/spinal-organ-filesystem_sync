# spinal-organ-filesystem_sync

A organ that act as a FileServer and then duplicate a filesystem to the spinalHub.

## Requirements

- [Nodejs JavaScript runtime](https://nodejs.org/en/download/)  (use package manager if possible)
- [PM2](https://github.com/Unitech/pm2) a process manager ( `npm install pm2 -g` )

## Installation

### Clone this repository, Install dependencies and build source

```sh
# Clone this repository
~ $> git clone https://github.com/spinalcom/spinal-organ-filesystem_sync.git
~ $> cd spinal-organ-filesystem_sync
# Install dependencies
~/spinal-organ-filesystem_sync $> npm install
# build source
~/spinal-organ-filesystem_sync $> npm run build
```

### Edit the configuration file `config.json5`

```js
// config.json5
{
  spinalConnector: { // Configuration to connect to the spinalcom' server
    user: 168, // spinalcom user id
    password: "JHGgcz45JKilmzknzelf65ddDadggftIO98P", // spinalcom user password
    host: "localhost", // spinalcom' host server address, can be an ip address
    port: 7777 // spinalcom' server port
  },
  fsServeServer: { // Configuration for the FileServer
    // listenHost - host/ip to 'listen'
    // '0.0.0.0' means listen to all,
    // if you want to restrict it you can put the ip of the client (browser)
    listenHost: '0.0.0.0',
    port: 7789,
    tmpFolder: 'tmp_files'
  },
  path: [{
    realPath: '.', // Path to the folder to synchronize to the spinalhub.
    virtualPath: '/__users__/admin/filesystem_sync/dsadsa', // where to put the synchonized data in the spinalhub virtual filesystem.
    ignore: ['**/node_modules', "**/.*"], // patern filename to ignore. Here means "node_modules" and everything that start with "."
    fsHostOrigin: "http://localhost:7789" // how the client can contact the server. Replace localhost by the ip that launch this organ.
  }, // it's an array so it can handle multiple folder to multiple places
  // {
  //   realPath: '../spinal-lib-forgefile',
  //   ignore: ['**/node_modules', "**/.*"],
  //   virtualPath: '/__users__/admin/filesystem_sync2',
  // }
  ]
}
```

## Launch the organ

### With node

```sh
~/spinal-organ-filesystem_sync $> node index.js
```

### With pm2
To start it as a daemon and the auto restart in case of crash and so on...
```sh
~/spinal-organ-filesystem_sync $> pm2 start index.js --name spinal-organ-filesystem_sync

# then to check the state
$ pm2 list
$ pm2 show spinal-organ-filesystem_sync

# to check the log
$ pm2 log spinal-organ-filesystem_sync

# to stop the organ the log

# 'stop' the process and keep in the list and can restarted with with `pm2 start <id|name>`
$ pm2 stop spinal-organ-filesystem_sync
# or stop then remove from the list of pm2 process
$ pm2 delete spinal-organ-filesystem_sync
```

## FileServer

> Route GET -> `/file/:folder/:file`

Where `:folder` and `:file` equals an `encodeURIComponent` of the `httpRootPath` and `httpPath` respectively.

```js
// javascript function sample to get the url to get from the model
function get_GET_URI_request(fileHttpPathModel) {
  if (fileHttpPathModel._info.model_type.get() !== "HttpPath")
    return Promsie.reject(new Error("Not an HttpPath"));
  return new Promise((resolve, reject) => {
    fileHttpPathModel._ptr.load(httpPath => {
      if (!httpPath) return reject(new Error("Load Fail"));
      resolve(
        httpPath.host.get() +
          "/file/" +
          encodeURIComponent(httpPath.httpRootPath.get()) +
          "/" +
          encodeURIComponent(httpPath.httpPath.get())
      );
    });
  });
}
```

> Route POST -> `/upload/:file`

```js
function get_POST_URI_request(
  DirectorySynchonizedFileModel,
  stringPathToPushInHub
) {
  const host = DirectorySynchonizedFileModel.info.host.get();
  return host + "/upload/" + encodeURIComponent(stringPathToPushInHub);
}
```
