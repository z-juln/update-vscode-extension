import path from 'path';
import os from 'os';
import fs from 'fs-extra';
import spawn from 'cross-spawn';
// @ts-ignore
import latest from 'latest';
import ConfigStore from 'configstore';
import semver from 'semver';

const fiveMinutes = 5 * 60 * 1000;
const cacheDir = path.resolve(os.homedir(), '.update-vscode-extension');
fs.emptyDirSync(cacheDir);

const register = (pkgName: string, {
  vscodeAppRoot,
  interval = fiveMinutes,
}: {
  vscodeAppRoot: string;
  /** ms */
  interval?: number;
}) => {
  const metaConfig = new ConfigStore('', {}, {
    configPath: path.resolve(cacheDir, pkgName, 'meta.json'),
  });
  
  const init = async () => {
    const version = await getLatestVersion(pkgName);
    metaConfig.set('version', version);
  };

  const updateVscodeExtension = async ({
    pkgName,
    vscodeAppRoot,
    vsixRelPathFromNPMPkg = './extension.vsix',
  }: {
    pkgName: string;
    vscodeAppRoot: string;
    vsixRelPathFromNPMPkg?: string;
  }) => {
    const currentVersion = metaConfig.get('version');
    const latestVersion = await getLatestVersion(pkgName);

    const updateVsix = async () => {
      // code --install-extension vsixFilePath
      const cmdPath = path.resolve(vscodeAppRoot, 'bin/code');
      const vsixFilePath = path.resolve(cacheDir, pkgName, 'node_modules', pkgName, vsixRelPathFromNPMPkg);
    
      await exec('npm', ['i', pkgName], { stdio: 'inherit', cwd: cacheDir });
      await exec(cmdPath, ['--install-extension', vsixFilePath], { stdio: 'inherit' });
    };

    if (!semver.lt(currentVersion, latestVersion)) return;
    metaConfig.set('version', latestVersion);
    updateVsix();
  };

  const update = () => updateVscodeExtension({
    pkgName,
    vscodeAppRoot,
  });

  init().then(() => {
    setInterval(update, interval);
  });

  return update;
};


const getLatestVersion = (pkgName: string) => {
  return new Promise<string>((resolve, reject) => {
    latest(pkgName, function(err: any, version: string) {
      if (err) {
        reject(err);
      } else {
        resolve(version);
      }
    });
  });
};

const exec = (...args: Parameters<typeof spawn>) => {
  return new Promise((resolve, reject) => {
    spawn(...args)
      .on('close', resolve)
      .on('error', reject);
  });
};

module.exports = register;
