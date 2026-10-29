const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

test('manual reveal expands an unopened dependency tree with auto reveal disabled', async () => {
  const commands = new Map();
  const calls = [];
  const uri = value => ({ scheme: 'file', authority: '', fsPath: value, toString: () => `file://${value}` });
  let provider;
  const noOpEvent = () => ({ dispose() {} });
  const vscode = {
    EventEmitter: class { event = noOpEvent; fire() {} dispose() {} },
    Uri: { joinPath: (base, name) => uri(path.join(base.fsPath, name)) },
    FileType: { File: 1, Directory: 2, SymbolicLink: 64 },
    workspace: {
      workspaceFolders: [],
      getConfiguration: () => ({ get: () => false }),
      createFileSystemWatcher: () => ({ onDidChange: noOpEvent, onDidCreate: noOpEvent, onDidDelete: noOpEvent }),
      onDidChangeWorkspaceFolders: noOpEvent, onDidChangeConfiguration: noOpEvent,
      fs: { readDirectory: async value => value.fsPath === '/cache/lib'
        ? [['pkg', 2]] : [['source.go', 1]] }
    },
    window: {
      activeTextEditor: { document: { uri: uri('/cache/lib/pkg/source.go') } },
      createOutputChannel: () => ({ appendLine() {} }),
      onDidChangeActiveTextEditor: noOpEvent,
      createTreeView: (id, options) => {
        provider = options.treeDataProvider;
        return { reveal: async (node, options) => calls.push([node.label, options]) };
      }
    },
    commands: {
      registerCommand: (id, handler) => { commands.set(id, handler); return {}; },
      executeCommand: async (id, ...args) => calls.push([id, ...args])
    }
  };
  const sandbox = { module: { exports: {} }, setTimeout, clearTimeout,
    require: id => id === 'vscode' ? vscode : id === './modules' ? require('../src/modules') : require(id) };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src/extension.js'), 'utf8'), sandbox);
  sandbox.module.exports.activate({ subscriptions: [] });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(calls[0][0], 'setContext');
  assert.equal(calls[0][2], false);
  calls.length = 0;
  const group = { kind: 'group', label: 'Dependencies' };
  const root = { kind: 'directory', label: 'example.com/lib', uri: uri('/cache/lib'), parent: group };
  group.children = [root];
  provider.roots = [group];
  assert.equal(await provider.revealActive(), false);
  assert.equal(calls.length, 0);
  await commands.get('goExternalLibraries.revealInProject')();
  assert.deepEqual(calls.map(call => call[0]), [
    'goExternalLibraries.focus', 'Dependencies', 'example.com/lib', 'pkg', 'source.go'
  ]);
  assert.equal(calls[1][1].expand, true);
  assert.equal(calls.at(-1)[1].select, true);
  calls.length = 0;
  vscode.window.activeTextEditor.document.uri = uri('/project/main.go');
  await commands.get('goExternalLibraries.revealInProject')();
  assert.equal(calls[0][0], 'workbench.files.action.showActiveFileInExplorer');

  // Non-Go workspaces are hidden without requiring an installed Go executable.
  vscode.workspace.workspaceFolders = [{ name: 'web', uri: uri('/project/web') }];
  vscode.workspace.fs.stat = async () => { throw new Error('FileNotFound'); };
  calls.length = 0;
  await provider.refresh();
  assert.equal(calls.find(call => call[0] === 'setContext')[2], false);
  assert.equal(provider.roots.length, 0);

  // A marker keeps the view visible even when Go itself fails to execute.
  for (const marker of ['go.mod', 'go.work']) {
    vscode.workspace.fs.stat = async value => {
      if (value.fsPath.endsWith('/' + marker)) return { type: 1 };
      throw new Error('FileNotFound');
    };
    calls.length = 0;
    await provider.refresh();
    assert.equal(calls.find(call => call[0] === 'setContext')[2], true);
    assert.equal(provider.roots.length, 1);
  }
  vscode.workspace.fs.stat = async () => { throw new Error('FileNotFound'); };
  calls.length = 0;
  await provider.refresh();
  assert.equal(calls.find(call => call[0] === 'setContext')[2], false);
  assert.equal(provider.roots.length, 0);
});
