# update-vscode-extension

自动更新vscode插件（在插件内部使用）

## 描述

vscode本身就支持在每次启动vscode时自动更新插件，但这只针对于上传到vscode插件市场的插件。如果想针对公司开发一个插件，那么插件就不能上传到插件市场，该包就是为了解决这个问题的。

## 适用场景

1. 公司内或个人开发、不打算上传到插件市场的插件
2. 公司内部有搭建npm仓库
3. 适用于长时间启动的插件, 特别是设置了 `"activationEvents": ["*"]` 的插件

## 使用方法

1. vscode插件本身作为npm包进行更新和发布

npm包结构如下(默认结构，可通过参数自定义):
```
/
  extension.vsix # 通过vsce命令打包的vsix文件
  package.json
```

2. 插件内注册

```typescript
import vscode from 'vscode';
import registerUpdate from 'update-vscode-extension';
import isOnline from 'is-online';
import packageJSON from '../package.json';

const {
  runSlice, // 单次执行函数
  checkUpdate, // 监测是否需要更新
  forceUpdate, // 强制更新，一般在npm unpublish后用到
  stop, // 终止整个更新
} = registerUpdate(packageJSON.name, {
  npmTag: 'latest', // 默认为'latest'
  registryUrl: 'http://hnpm.hupu.io/', // 默认为'https://registry.npmjs.org/'
  currentVersion: packageJSON.version,
  vscodeAppRoot: vscode.env.appRoot,
  interval: fiveMinutes, // 监测更新频率，值为null时不自动更新
  vsixRelPathFromNPMPkg: './extension.vsix', // npm包中，vsix文件的相对路径，默认为'./extension.vsix'
  async customCheckUpdate() { // 默认使用 @juln/npm-pkg-version 检测获取最新版本号并版本, 如果公司的npm服务有特殊的权限校验, 比如需要请求头校验, 请自己实现版本检测功能
    const requireUpdate: boolean = TODO();
    return requireUpdate;
  },
  async beforeCheck() {
    console.log('beforeCheck');
    if (!await isOnline()) {
      throw new Error('网络连接失败，自动更新停止'); // 抛出异常可终止本次interval的更新 (注: 下个interval会再次调用beforeCheck)
    }
  },
  async beforeUpdate(err) {
    if (err) {
      console.log('监测版本失败: ', err);
      return;
    }
    console.log('beforeUpdate');
  },
  async afterUpdate(err) {
    if (err) {
      console.log('更新失败: ', err);
      return;
    }
    console.log('afterUpdate');
  },
});

// registerUpdate与setInterval等效，不会立即执行，如需立即执行，得手动调用runSlice
runSlice();
```

## 常见问题

1. vscode安装后, 目录结构改了, 导致无法拿到vscode执行路径, 没法更新.

解决版本: 设置环境变量VSCODE_BIN_PATH指向可执行文件code的路径 (对应process.env.VSCODE_BIN_PATH)

2. 如果公司的npm服务有特殊的权限校验, 比如需要请求头校验, 请自己实现版本检测功能

提供了customCheckUpdate的api, 可自定义版本检测功能
