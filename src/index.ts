import path from 'path';
import os from 'os';
import fs from 'fs-extra';
import axios from 'axios';
import spawn from 'cross-spawn';
import semver from 'semver';

const fiveMinutes = 5 * 60 * 1000;
const cacheDir = path.resolve(os.homedir(), '.update-vscode-extension');
fs.ensureDirSync(cacheDir);

const register = (pkgName: string, {
  npmTag = 'latest',
  registryUrl = 'https://registry.npmjs.org/',
  currentVersion,
  vscodeAppRoot,
  interval = fiveMinutes,
  vsixRelPathFromNPMPkg = './extension.vsix',
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
  beforeCheck?: () => Promise<void>;
  beforeUpdate?: (err?: any) => Promise<void>;
  afterUpdate?: (err?: any) => Promise<void>;
}) => {
  let intervalTimer: any;
  const stop = () => { clearInterval(intervalTimer); };

  const checkUpdate = async () => {
    const latestVersion = await getLatestVersion(pkgName, registryUrl, npmTag);
    return !!latestVersion && semver.lt(currentVersion, latestVersion);
  };

  const updateVsix = async () => {
    const cmdPath = path.resolve(vscodeAppRoot, 'bin/code');
    const vsixFilePath = path.resolve(cacheDir, 'node_modules', pkgName, vsixRelPathFromNPMPkg);

    await exec('npm', ['i', pkgName, '--tag', npmTag, `--registry=${registryUrl}`], { stdio: 'inherit', cwd: cacheDir });
    // code --install-extension vsixFilePath
    if (!fs.existsSync(vsixFilePath) || !fs.statSync(vsixFilePath).isFile()) {
      throw new Error(`vsix文件不存在(${vsixFilePath})`);
    }
    await exec(cmdPath, ['--install-extension', vsixFilePath], { stdio: 'inherit' });
  };

  const runSlice = async () => {
    await beforeCheck?.();
    try {
      if (!await checkUpdate()) return;
      await beforeUpdate?.();
    } catch (error) {
      await beforeUpdate?.(error);
      stop();
      return;
    }
    try {
      await updateVsix();
      await afterUpdate?.();
    } catch (error) {
      await afterUpdate?.(error);
      stop();
    }
  };

  if (interval !== null) {
    intervalTimer = setInterval(runSlice, interval);
  }

  return {
    runSlice,
    forceUpdate: updateVsix,
    checkUpdate,
    stop,
  };
};

const getLatestVersion = async (pkgName: string, registryUrl = 'https://registry.npmjs.org/', npmTag = 'latest') => {
  if (!registryUrl.endsWith('/')) registryUrl += '/';

  const { data, status } = await axios.get(registryUrl + pkgName);
  if (status !== 200) {
    throw new Error(`找不到npm包[${pkgName}]`);
  }

  const latestVersion: string | null = data?.['dist-tags']?.[npmTag] ?? null;
  return latestVersion;
};

const exec = (...args: Parameters<typeof spawn>) => {
  return new Promise((resolve, reject) => {
    spawn(...args)
      .on('close', resolve)
      .on('error', reject);
  });
};

// (function test() {
//   const {
//     runSlice, // 单次执行函数
//   } = register('gulp', {
//     registryUrl: 'http://hnpm.hupu.io/',
//     currentVersion: '0.0.1',
//     vscodeAppRoot: '/Users/zhuangjunlin/Desktop/Visual Studio Code.app/Contents/Resources/app',
//     interval: 20000, // 监测更新频率，值为null时不自动更新
//     vsixRelPathFromNPMPkg: './hupu.vsix', // npm包中，vsix文件的相对路径，默认为'./extension.vsix'
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
