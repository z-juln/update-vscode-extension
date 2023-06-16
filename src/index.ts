import path from 'path';
import os from 'os';
import fs from 'fs-extra';
import spawn from 'cross-spawn';
import semver from 'semver';
import { getLatestVersion } from '@juln/npm-pkg-version';

const fiveMinutes = 5 * 60 * 1000;
const cacheDir = path.resolve(os.homedir(), os.platform() === 'darwin' ? '.update-vscode-extension' : 'cache-update-vscode-extension');
fs.ensureDirSync(cacheDir);

const sleep = (timestamp: number) => new Promise<void>(resolve => setTimeout(resolve, timestamp));

const register = (pkgName: string, {
  npmTag = 'latest',
  registryUrl = 'https://registry.npmjs.org/',
  currentVersion,
  vscodeAppRoot,
  interval = fiveMinutes,
  vsixRelPathFromNPMPkg = './extension.vsix',
  customCheckUpdate,
  beforeCheck,
  beforeUpdate,
  afterUpdate,
}: {
  npmTag?: string;
  registryUrl?: string;
  currentVersion: string;
  vscodeAppRoot: string;
  /** ms */
  interval?: number | null;
  vsixRelPathFromNPMPkg?: string;
  customCheckUpdate?: () => Promise<Boolean>;
  beforeCheck?: () => Promise<void>;
  beforeUpdate?: (err?: any) => Promise<void>;
  afterUpdate?: (err?: any) => Promise<void>;
}) => {
  let isStoped = false;
  let isRunSlice = false;
  const stop = () => isStoped = true;

  const checkUpdate = customCheckUpdate ?? (async () => {
    const latestVersion = await getLatestVersion(pkgName, { registryUrl, npmTag });
    return !!latestVersion && semver.lt(currentVersion, latestVersion);
  });

  const updateVsix = async () => {
    const cmdPath = process.env.VSCODE_BIN_PATH ?? path.resolve(vscodeAppRoot, os.platform() === 'darwin' ? 'bin/code' : '../../bin/code');
    const vsixFilePath = path.resolve(cacheDir, 'node_modules', pkgName, vsixRelPathFromNPMPkg);

    if (!fs.existsSync(path.resolve(cacheDir, 'package.json'))) {
      await exec('npm', ['init', '-y'], { stdio: 'ignore', cwd: cacheDir, timeout: 3000 });
    }
    await exec('npm', ['i', `${pkgName}@${npmTag}`, `--registry=${registryUrl}`], { stdio: 'ignore', cwd: cacheDir, timeout: 3000 });
    // code --install-extension vsixFilePath
    if (!fs.existsSync(vsixFilePath) || !fs.statSync(vsixFilePath).isFile()) {
      throw new Error(`vsix文件不存在(${vsixFilePath})`);
    }
    await exec(cmdPath, ['--install-extension', vsixFilePath], { stdio: 'ignore', timeout: 3000 });
  };

  const runSlice = async () => {
    if (isRunSlice) return;
    isRunSlice = true;
    
    try {
      await beforeCheck?.();
      let checkUpdateError: any = null;
      try {
        if (!await checkUpdate()) return;
      } catch (error) {
        checkUpdateError = error;
      }
      await beforeUpdate?.(checkUpdateError);
      if (checkUpdateError) return;

      let updateError: any = null;
      try {
        await updateVsix();
      } catch (error) {
        updateError = error;
      }
      await afterUpdate?.(updateError);
    } finally {
      isRunSlice = false;
    }
  };

  const loop = async () => {
    if (interval === null) return;
    while (1) {
      if (isStoped) return;
      await sleep(interval);
      try {
        await runSlice();
      } catch {}
    }
  };

  loop();

  return {
    runSlice,
    forceUpdate: updateVsix,
    checkUpdate,
    stop,
  };
};

const exec = (...args: Parameters<typeof spawn>) => {
  const [command, spanwArgs = [], options = {}] = args;
  const { timeout, ...restOpts } = options;
  return new Promise((resolve, reject) => {
    // 需要手动timeout: https://github.com/nodejs/node/issues/43704
    const childProcess = spawn(command, spanwArgs, restOpts)
      .on('close', resolve)
      .on('error', reject);
    if (timeout) {
      setTimeout(() => {
        childProcess.emit('close');
        reject(new Error('ETIMEDOUT'));
      }, timeout);
    }
  });
};

// (function test() {
//   const {
//     runSlice, // 单次执行函数
//   } = register('@juln/npm-pkg-version', {
//     registryUrl: 'http://hnpm.hupu.io/',
//     currentVersion: '0.0.1',
//     vscodeAppRoot: os.platform() === 'darwin' ? 'e:\\Microsoft VS Code\\resources\\app' : 'e:\\Microsoft VS Code\\resources\\app',
//     interval: 3000, // 监测更新频率，值为null时不自动更新
//     vsixRelPathFromNPMPkg: './hupu.vsix', // npm包中，vsix文件的相对路径，默认为'./extension.vsix'
//     // async customCheckUpdate() {
//     //   return true;
//     // },
//     async beforeCheck() {
//       console.log('beforeCheck');
//     },
//     async beforeUpdate(err) {
//       if (err) {
//         console.log('监测版本失败: ', err);
//         return;
//       }
//       console.log('beforeUpdate');
//     },
//     async afterUpdate(err) {
//       if (err) {
//         console.log('更新失败: ', err);
//         return;
//       }
//       console.log('afterUpdate');
//     },
//   });

//   runSlice();
// })();

export default register;
