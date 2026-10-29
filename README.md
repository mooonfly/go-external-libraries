# Golang External Libraries

[简体中文](README.zh-CN.md)

Browse Go SDK and module dependency sources directly in the VS Code Explorer, with a library tree inspired by GoLand's External Libraries.

## Features

- Browse SDK sources, direct dependencies, and indirect dependencies in one view.
- Automatically reveal the active dependency or SDK file without moving keyboard focus.
- Manually reveal files from the Explorer or External Libraries toolbar.
- Support multi-root workspaces, `go.work`, and local or versioned `replace` directives.
- Refresh when module and workspace files change.
- Browse cached sources without automatically downloading modules or toolchains.

## Requirements

- VS Code 1.85.0 or later.
- Go available on `PATH`, or a Go executable configured with `goExternalLibraries.goPath`.
- A trusted workspace with `go.mod` or `go.work` at the root of at least one workspace folder.

For remote development, Go and dependency sources must be available on the remote extension host.

## Installation

Build a VSIX from this repository:

```sh
npm run package
```

In VS Code, open the Extensions view, choose **Install from VSIX…** from its menu, and select the generated file. The extension ID is `mooonfly.golang-extenal-libraries`.

## Usage

1. Open a Go project containing `go.mod` or `go.work` at the workspace folder root.
2. Expand **External Libraries** in the Explorer.
3. Browse **Go SDK**, **Dependencies**, or **Indirect dependencies**, then select a file to open its source.

The view appears only for Go projects. Adding or removing a module/workspace file, or changing workspace folders, updates its visibility. Non-Go workspace folders do not trigger Go commands.

When you navigate to dependency or SDK code using F12, Ctrl/Cmd+click, or editor switching, the tree reveals the active file. Automatic reveal requires both `explorer.autoReveal` and `goExternalLibraries.autoReveal` to be enabled. Only loaded sources are eligible; hidden indirect dependencies are excluded.

### Commands

| Command | Behavior |
| --- | --- |
| **Project: Reveal Active File** | Reveals dependency/SDK files in External Libraries; otherwise uses VS Code's built-in Explorer reveal. Available in the project Explorer toolbar. |
| **External Libraries: Reveal Active File** | Expands the library tree and selects the active source file. |
| **External Libraries: Refresh** | Reloads the SDK and module graph. Use after downloading dependencies in a terminal. |
| **External Libraries: Download Missing Modules** | Runs `go mod download` in the selected workspace folder, then refreshes the view. |

Manual reveal works even when automatic reveal is disabled and does not change your settings. Toolbar actions may appear in the overflow menu when space is limited.

## Settings

| Setting | Default | Description |
| --- | --- | --- |
| `goExternalLibraries.autoReveal` | `true` | Reveal active library files automatically; also respects `explorer.autoReveal`. |
| `goExternalLibraries.goPath` | `"go"` | Go executable name or path, not a shell command. |
| `goExternalLibraries.showIndirect` | `true` | Show indirect dependencies. |
| `goExternalLibraries.showSdk` | `true` | Show Go SDK sources. |
| `goExternalLibraries.timeout` | `60000` | Go command timeout in milliseconds; minimum `1000`. |

## Module downloads and limitations

Browsing runs Go with `GOPROXY=off`, `GOSUMDB=off`, and `GOTOOLCHAIN=local`. Modules that are not cached appear as **source unavailable**. The download command uses your Go network configuration and may update `go.sum`.

Each Go workspace folder is queried separately. Add nested standalone modules as workspace folders if you want their dependencies included.

Directories are read on demand. Dotfiles and symbolic links are hidden. GOPATH projects, vendor-only mode, and full GoLand-style indexing or dependency search are outside the current scope.

## Development

The runtime uses only Node.js and VS Code built-in APIs; no `npm install` is required.

1. Open this repository in VS Code.
2. Press F5 to launch an Extension Development Host.
3. Open a Go project in that window to try the extension.

Run validation and build a package:

```sh
npm run check
npm test
npm run package
```

Packaging automatically runs syntax checks and tests. The tests require a local Go executable. The packaging command uses `@vscode/vsce` through npm and may download it on first use.

## Contributing

Bug reports and pull requests are welcome. When reporting an issue, include your VS Code and Go versions, workspace layout, and relevant messages from the **Golang External Libraries** output channel.

[Report an issue](https://github.com/mooonfly/go-external-libraries/issues)

## License

[MIT](LICENSE)
