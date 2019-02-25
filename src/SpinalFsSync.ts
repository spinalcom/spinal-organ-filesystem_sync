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
import * as chokidar from 'chokidar';
import * as path from 'path';
import * as fs from 'fs';
import { Directory, FileSystem, Str } from 'spinal-core-connectorjs_type';

import { HttpPath } from './Model/HttpPath';

const throttle = require('lodash.throttle');
type spinalDirectory = spinal.Directory<spinal.File<any>>;

const folderPathDictionary: Map<string, spinalDirectory> = new Map();
const loadPtrDictionary: Map<number, spinalDirectory> = new Map();

export class SpinalFsSync {
  realPath: string;
  ignorePatern: string|string[];
  folderRootPathInSpinal: spinal.Str;
  watcher: chokidar.FSWatcher;
  rootDir: spinalDirectory;
  host: spinal.Str;

  constructor(
      realPath: string, ignorePatern: string|string[],
      folderRootPathInSpinal: string, rootDir: spinalDirectory, host: string) {
    this.realPath = path.resolve(realPath);
    this.ignorePatern = ignorePatern;
    this.folderRootPathInSpinal = new Str(folderRootPathInSpinal);
    this.rootDir = rootDir;
    this.host = new Str(host);
    console.log(
        `Watching "${realPath}" and export to "${folderRootPathInSpinal}"`);

    this.watcher = chokidar.watch(this.realPath, { ignored: this.ignorePatern });
    const callbackOnChange =
        throttle(this.handleRealChange.bind(this), 2000, { leading: false });
    this.watcher.on('add', callbackOnChange)
        .on('change', callbackOnChange)
        .on('unlink', callbackOnChange)
        .on('addDir', callbackOnChange)
        .on('unlinkDir', callbackOnChange);
  }

  existInFolderPath(folderObj: any, file: string): boolean {
    for (const folderPa in folderObj) {
      if (folderPa === file) return true;
    }
    return false;
  }

  getFilesAndFolers() {
    const watchedPaths = this.watcher.getWatched();
    const res: {[folderPathInSpinal: string]: string[]} = {};
    for (const folderPath in watchedPaths) {
      if (watchedPaths.hasOwnProperty(folderPath)) {
        const relFolderPath = path.relative(this.realPath, folderPath);
        if (relFolderPath === '..') continue;
        const files = watchedPaths[folderPath];
        const realPahtFolderInSpinal: string =
            path.resolve(this.folderRootPathInSpinal.get(), relFolderPath);
        res[realPahtFolderInSpinal] =
            files
                .filter((file: string) => {
                  return this.existInFolderPath(
                             watchedPaths, path.resolve(folderPath, file)) ===
                      false;
                })
                .map((file) => {
                  return path.relative(
                      this.folderRootPathInSpinal.get(),
                      path.resolve(realPahtFolderInSpinal, file));
                });
      }
    }
    return res;
  }
  loadFile(file: spinal.File<any>): Promise<any> {
    if (typeof file._ptr.data.value !== 'undefined' &&
        loadPtrDictionary.has(file._ptr.data.value)) {
      return Promise.resolve(loadPtrDictionary.get(file._ptr.data.value));
    }

    if (typeof file._ptr.data.model !== 'undefined') {
      const res = Promise.resolve(file._ptr.data.model);
      return res;
    }
    if (typeof file._ptr.data.value !== 'undefined' &&
        typeof FileSystem._objects[file._ptr.data.value] !== 'undefined') {
      const res = Promise.resolve(FileSystem._objects[file._ptr.data.value]);
      return res;
    }

    return new Promise((resolve) => {
      file.load((model: spinal.Model) => resolve(model));
    });
  }

  getAndCreateFolderWithPath(folderPath: string): Promise<spinalDirectory> {
    if (folderPathDictionary.has(folderPath) === true) {
      const folder = folderPathDictionary.get(folderPath);
      return Promise.resolve(folder);
    }
    return new Promise(async (resolve) => {
      const tmpPath = folderPath.split(path.sep);
      const target = tmpPath.pop();
      const parentPath = path.join('/', ...tmpPath);
      const relFolderPath =
          path.relative(this.folderRootPathInSpinal.get(), folderPath);
      const parent = await this.getAndCreateFolderWithPath(parentPath);
      for (let idx = 0; idx < parent.length; idx += 1) {
        const element = parent[idx];
        if (element.name.get() === target) {
          const dir = await this.loadFile(element);
          folderPathDictionary.set(folderPath, dir);
          if (!(relFolderPath.length >= 2 && relFolderPath[0] === '.' &&
                relFolderPath[1] === '.')) {
            if (typeof element._info.synchronised === 'undefined') {
              element._info.mod_attr('synchronised', true);
            }
          }

          return resolve(dir);
        }
      }
      const dir: spinalDirectory = new Directory();
      let info: {icon: string, model_type: string, synchronised?: boolean};
      if (relFolderPath.length >= 2 && relFolderPath[0] === '.' &&
          relFolderPath[1] === '.') {
        info = { icon: 'folder', model_type: 'Directory' };
      } else {
        info = { icon: 'folder', model_type: 'Directory', synchronised: true };
      }
      parent.add_file(target, dir, info);
      return resolve(dir);
    });
  }

  getFileInFolder(dir: spinalDirectory, fileStat: fs.Stats): spinal.File<any> {
    for (let idx = 0; idx < dir.length; idx += 1) {
      const file = dir[idx];
      if (
        typeof file._info.dev !== 'undefined' && file._info.dev.get() === fileStat.dev &&
        typeof file._info.ino !== 'undefined' && file._info.ino.get() === fileStat.ino
      ) {
        return file;
      }
    }
    return null;
  }

  async updateFolderFiles(dir: spinalDirectory, files: string[], folderPath: string,
                          folderPathInSpinal: {[folderPathInSpinal: string]: string[]}) {
    const fileSet: Set<{dev: number, ino: number}> = new Set();
    for (const fileName of files) {
      let httpPath: HttpPath;
      const fName = path.basename(fileName);
      const relPath = path.resolve(this.realPath, fileName);
      const fileStat = fs.statSync(relPath);
      const file = this.getFileInFolder(dir, fileStat);
      fileSet.add({
        dev: fileStat.dev,
        ino: fileStat.ino,
      });
      if (file === null) {
        httpPath =
            new HttpPath(fName, this.folderRootPathInSpinal, this.host, fileStat.dev, fileStat.ino);
        dir.add_file(
          <any>httpPath.httpPath, httpPath, { model_type: 'HttpPath', synchronised: true,
            dev: httpPath.dev, ino: httpPath.ino });
      } else {

        httpPath = await this.loadFile(file);
        if (httpPath instanceof HttpPath && typeof file._info !== 'undefined' &&
            typeof file._info.model_type !== 'undefined' &&
            typeof file._info.synchronised !== 'undefined') {
          if (httpPath.httpPath.get() !== fName) {
            httpPath.httpPath.set(fName);
          }
          if (httpPath.httpRootPath.get() !== this.folderRootPathInSpinal.get()) {
            httpPath.httpRootPath.set(this.folderRootPathInSpinal);
          }
          if (typeof httpPath.host === 'undefined') {
            httpPath.mod_attr('host', this.host);
          }
          if (httpPath.host.get() !== this.host.get()) {
            httpPath.host.set(this.host);
          }
        }
      }
    }
    const fNames = files.map(fileName => path.basename(fileName)) ;

    for (let idx = 0; idx < dir.length; idx += 1) {
      const file = dir[idx];
      if (file._info.model_type.get() === 'HttpPath') {
        if (this.fileSetHasFile(file._info.dev.get(), file._info.ino.get(), fileSet) === false) {
          dir.remove_ref(file);
          idx = -1;
        }
      } else if (file._info.model_type.get() === 'Directory' &&
        typeof file._info.synchronised !== 'undefined' &&
        file._info.synchronised.get() === true) {
        const p = path.resolve(folderPath, file.name.get());
        let found = false;
        for (const folder in folderPathInSpinal) {
          if (p === folder) {
            found = true;
          }
        }
        if (!found) {
          dir.remove_ref(file);
        }
      }
    }
  }

  fileSetHasFile(dev: number, ino: number, fileSet: Set<{dev: number, ino: number}>): boolean {
    for (const file of fileSet) {
      if (file.dev === dev && file.ino === ino) return true;
    }
    return false;
  }

  async handleRealChange() {
    const filesAndFolders = this.getFilesAndFolers();
    // console.log(filesAndFolders);

    for (const folderPath in filesAndFolders) {
      if (filesAndFolders.hasOwnProperty(folderPath)) {
        // const element = filesAndFolders[folderPath];
        const dir = await this.getAndCreateFolderWithPath(folderPath);
        await this.updateFolderFiles(dir, filesAndFolders[folderPath], folderPath, filesAndFolders);
        // break;
      }
    }
  }
}

export default SpinalFsSync;
export { folderPathDictionary };
