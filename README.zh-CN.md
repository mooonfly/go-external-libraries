# Go External Libraries

[English](README.md)

在 VS Code 资源管理器中直接浏览 Go SDK 和模块依赖源码，提供类似 GoLand External Libraries 的依赖树体验。

## 功能

- 集中浏览 SDK 源码、直接依赖和间接依赖。
- 自动展开并选中当前依赖或 SDK 文件，保持键盘焦点在编辑器中。
- 通过资源管理器或 External Libraries 工具栏手动定位文件。
- 支持多根工作区、`go.work` 以及本地和版本 `replace` 指令。
- 模块和工作区文件变化时自动刷新。
- 浏览已缓存的源码，不自动下载模块或工具链。

## 环境要求

- VS Code 1.85.0 或更高版本。
- 系统 `PATH` 中可执行的 Go，或通过 `goExternalLibraries.goPath` 指定 Go 可执行文件。
- 已信任的工作区，且至少一个工作区文件夹根目录存在 `go.mod` 或 `go.work`。

远程开发时，Go 和依赖源码需位于远程扩展宿主。

## 安装

在本仓库中生成 VSIX：

```sh
npm run package
```

在 VS Code 扩展面板菜单中选择 **Install from VSIX…**，安装生成的文件。扩展 ID 为 `mooonfly.go-external-libraries`。

## 使用

1. 打开工作区文件夹根目录包含 `go.mod` 或 `go.work` 的 Go 项目。
2. 在资源管理器中展开 **External Libraries**。
3. 浏览 **Go SDK**、**Dependencies** 或 **Indirect dependencies**，点击文件打开源码。

面板仅在 Go 项目中显示。新增或删除模块/工作区文件、切换工作区文件夹后，显示状态会自动更新。非 Go 工作区文件夹不会触发 Go 命令。

通过 F12、Ctrl/Cmd+点击或切换编辑器打开依赖/SDK 源码时，面板会自动定位当前文件。自动定位要求 `explorer.autoReveal` 和 `goExternalLibraries.autoReveal` 均已启用。仅定位已加载的源码；被隐藏的间接依赖不参与定位。

### 命令

| 命令 | 功能 |
| --- | --- |
| **Project: Reveal Active File** | 依赖/SDK 文件定位到 External Libraries；其他文件使用 VS Code 原生资源管理器定位。按钮位于项目资源管理器工具栏。 |
| **External Libraries: Reveal Active File** | 展开依赖树并选中当前源码文件。 |
| **External Libraries: Refresh** | 重新加载 SDK 和模块依赖图。在终端下载依赖后可手动刷新。 |
| **External Libraries: Download Missing Modules** | 在所选工作区文件夹中运行 `go mod download`，完成后刷新面板。 |

关闭自动定位后仍可手动定位，且不会修改设置。工具栏空间不足时，按钮可能折叠到菜单中。

## 设置

| 设置 | 默认值 | 说明 |
| --- | --- | --- |
| `goExternalLibraries.autoReveal` | `true` | 自动定位当前依赖文件，同时遵循 `explorer.autoReveal`。 |
| `goExternalLibraries.goPath` | `"go"` | Go 可执行文件名称或路径，不支持 shell 命令。 |
| `goExternalLibraries.showIndirect` | `true` | 显示间接依赖。 |
| `goExternalLibraries.showSdk` | `true` | 显示 Go SDK 源码。 |
| `goExternalLibraries.timeout` | `60000` | Go 命令超时，单位为毫秒，最小值为 `1000`。 |

## 依赖下载与限制

浏览时使用 `GOPROXY=off`、`GOSUMDB=off` 和 `GOTOOLCHAIN=local`。未缓存的模块显示为 **source unavailable**。下载命令使用用户的 Go 网络配置，并可能更新 `go.sum`。

各 Go 工作区文件夹分别执行 Go 命令。若需展示嵌套独立模块的依赖，请将其添加为工作区文件夹。

文件树按需读取，隐藏点文件和符号链接。当前不支持 GOPATH 项目、vendor 专用模式，以及 GoLand 式完整索引或依赖搜索。

## 开发

运行时代码仅使用 Node.js 和 VS Code 内置 API，无需执行 `npm install`。

1. 用 VS Code 打开本仓库。
2. 按 F5 启动 Extension Development Host。
3. 在新窗口中打开 Go 项目进行调试。

检查并打包：

```sh
npm run check
npm test
npm run package
```

打包会自动执行语法检查和测试。测试需要本地 Go 可执行文件。打包命令通过 npm 使用 `@vscode/vsce`，首次运行可能需要下载。

## 参与贡献

欢迎提交问题和 Pull Request。报告问题时，请提供 VS Code 和 Go 版本、工作区目录结构，以及 **Go External Libraries** 输出面板中的相关日志。

[提交问题](https://github.com/mooonfly/go-external-libraries/issues)

## 许可证

[MIT](LICENSE)
