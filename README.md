# update-vscode-extension

自动更新vscode插件（在插件内部使用）

## 描述

vscode本身就支持在每次启动vscode时自动更新插件，但这只针对于上传到vscode插件市场的插件。如果想针对公司开发一个插件，那么插件就不能上传到插件市场，该包就是为了解决这个问题的。

## 适用场景

1. 公司内或个人开发、不打算上传到插件市场的插件
2. 公司内部有搭建npm仓库

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
import packageJSON from '../package.json';

const {
  runSlice, // 单次执行函数
  checkUpdate, // 监测是否需要更新
  forceUpdate, // 强制更新，一般在npm unpublish后用到
} = registerUpdate(packageJSON.name, {
  currentVersion: packageJSON.version,
  vscodeAppRoot: vscode.env.appRoot,
  interval: fiveMinutes, // 监测更新频率，值为null时不自动更新
  vsixRelPathFromNPMPkg: './extension.vsix', // npm包中，vsix文件的相对路径，默认为'./extension.vsix'
  async beforeCheck() {
    console.log('beforeCheck');
  },
  async beforeUpdate() {
    console.log('beforeUpdate');
  },
  async afterUpdate() {
    console.log('afterUpdate');
  },
});

// registerUpdate与setInterval等效，不会立即执行，如需立即执行，得手动调用runSlice
runSlice();
```
