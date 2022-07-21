import path from 'path';
import os from 'os';
import fs from 'fs-extra';
import spawn from 'cross-spawn';
// @ts-ignore
import latest from 'latest';
import semver from 'semver';

const fiveMinutes = 5 * 60 * 1000;
const cacheDir = path.resolve(os.homedir(), '.update-vscode-extension');
fs.emptyDirSync(cacheDir);

const register = (pkgName: string, {
  currentVersion,
  vscodeAppRoot,
  interval = fiveMinutes,
  vsixRelPathFromNPMPkg = './extension.vsix',
  beforeCheck,
  beforeUpdate,
  afterUpdate,
}: {
  currentVersion: string;
  vscodeAppRoot: string;
  /** ms */
  interval?: number | null;
  vsixRelPathFromNPMPkg?: string;
  beforeCheck?: () => Promise<void>;
  beforeUpdate?: (err?: any) => Promise<void>;
  afterUpdate?: (err?: any) => Promise<void>;
}) => {
  const checkUpdate = async () => {
    const latestVersion = await getLatestVersion(pkgName);
    return !semver.lt(currentVersion, latestVersion);
  };

  const updateVsix = async () => {
    const cmdPath = path.resolve(vscodeAppRoot, 'bin/code');
    const vsixFilePath = path.resolve(cacheDir, pkgName, 'node_modules', pkgName, vsixRelPathFromNPMPkg);
  
    await exec('npm', ['i', pkgName], { stdio: 'inherit', cwd: cacheDir });
    // code --install-extension vsixFilePath
    await exec(cmdPath, ['--install-extension', vsixFilePath], { stdio: 'inherit' });
  };

  const runSlice = async () => {
    await beforeCheck?.();
    try {
      if (!await checkUpdate()) return;
      await beforeUpdate?.();
    } catch (error) {
      await beforeUpdate?.(error);
      return;
    }
    try {
      await updateVsix();
      await afterUpdate?.();
    } catch (error) {
      await afterUpdate?.(error);
    }
  };

  if (interval !== null) {
    setInterval(runSlice, interval);
  }

  return {
    runSlice,
    forceUpdate: updateVsix,
    checkUpdate,
  };
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

export default register;
