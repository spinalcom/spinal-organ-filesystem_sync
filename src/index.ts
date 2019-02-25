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

require('json5/lib/register');
const config = require('../config.json5');
import { SpinalFsSync, folderPathDictionary } from './SpinalFsSync';
import { spinalCore } from 'spinal-core-connectorjs_type';
import FsServeFileServer from './FsServeFileServer';
type spinalDirectory = spinal.Directory<spinal.File<any>>;

const fsServeFileServer = new FsServeFileServer(
    config.fsServeServer.listenHost, config.fsServeServer.port);

const folders = config.path.map((elem: any) => {
  return {
    virtualPath: elem.virtualPath, realPath: elem.realPath,
  };
});
fsServeFileServer.init(folders);
const connectOpt =
    `http://${config.spinalConnector.user}:${config.spinalConnector.password}@${
        config.spinalConnector.host}:${config.spinalConnector.port}/`;

const conn = spinalCore.connect(connectOpt);
const rootPath: string = '/';

conn.load_or_make_dir(rootPath, (rootDir: spinalDirectory, err: boolean) => {
  if (err) throw new Error('Error in load root directory');
  folderPathDictionary.set(rootPath, rootDir);
  for (const item of config.path) {
    new SpinalFsSync(item.realPath, item.ignore, item.virtualPath, rootDir,
                     item.fsHostOrigin);
  }
  fsServeFileServer.run();

});
