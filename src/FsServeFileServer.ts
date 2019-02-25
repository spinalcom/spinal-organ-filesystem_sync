/*
 * Copyright 2018 SpinalCom - www.spinalcom.com
 *
 * This file is part of SpinalCore.
 *
 * Please read all of the following terms and conditions
 * of the Free Software license Agreement ("Agreement")
 * carefully.
 *
 * This Agreement is a legally binding contract between
 * the Licensee (as defined below) and SpinalCom that
 * sets forth the terms and conditions that govern your
 * use of the Program. By installing and/or using the
 * Program, you agree to abide by all the terms and
 * conditions stated or referenced herein.
 *
 * If you do not agree to abide by these terms and
 * conditions, do not demonstrate your acceptance and do
 * not install or use the Program.
 * You should have received a copy of the license along
 * with this file. If not, see
 * <http://resources.spinalcom.com/licenses.pdf>.
 */

import express = require('express');
import * as path from 'path';

export class FsServeFileServer {
  app: express.Application;
  listenHost: string;
  port: number;

  constructor(listenHost: string, port: string|number) {
    this.listenHost = listenHost;
    this.port = typeof port === 'string' ? parseInt(port, 10) : port;
    this.app = express();
  }

  init(folders: any[]) {
    this.app.get('/file/:folder/:file', (req, res) => {
      const folder = req.params.folder;
      const file = req.params.file;
      console.log(`download ${folder}  ${file}`);

      for (const dir of folders) {
        if (dir.virtualPath === folder) {
          return res.download(path.resolve(dir.realPath, file));
        }
      }
      res.sendStatus(404);
    });
  }

  run() {
    this.app.listen(this.port, this.listenHost, () => {
      console.log(`App listening on port ${this.listenHost}:${this.port}!`);
    });
  }
}

export default FsServeFileServer;
