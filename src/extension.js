const vscode = require('vscode');
const path = require('node:path');
const { execFile } = require('node:child_process');
const { parseObjects, runGo, dependency } = require('./modules');

class Libraries {
  constructor(output) {
    this.output = output;
    this.changed = new vscode.EventEmitter();
    this.onDidChangeTreeData = this.changed.event;
    this.generation = 0;
    this.roots = [];
  }
  config(uri) { return vscode.workspace.getConfiguration('goExternalLibraries', uri); }
  async refresh() {
    const generation = ++this.generation;
    const candidates = vscode.workspace.workspaceFolders || [];
    const detected = await Promise.all(candidates.map(async folder => {
      const markers = await Promise.all(['go.mod', 'go.work'].map(async name => {
        try {
          const stat = await vscode.workspace.fs.stat(vscode.Uri.joinPath(folder.uri, name));
          return !!(stat.type & vscode.FileType.File);
        } catch { return false; }
      }));
      return markers.some(Boolean) ? folder : undefined;
    }));
    if (generation !== this.generation) return;
    const folders = detected.filter(Boolean);
    await vscode.commands.executeCommand('setContext', 'goExternalLibraries.hasGoProject', folders.length > 0);
    if (generation !== this.generation) return;
    const roots = await Promise.all(folders.map(async folder => {
      const config = this.config(folder.uri);
      const go = args => runGo(config.get('goPath'), args, folder.uri.fsPath, config.get('timeout'));
      const children = [];
      try {
        const env = JSON.parse(await go(['env', '-json', 'GOROOT', 'GOVERSION', 'GOMOD', 'GOWORK']));
        if (config.get('showSdk') && env.GOROOT) children.push({
          kind: 'directory', label: `Go SDK ${env.GOVERSION}`, uri: vscode.Uri.file(path.join(env.GOROOT, 'src'))
        });
        if ((env.GOMOD && env.GOMOD !== '/dev/null' && env.GOMOD !== 'NUL') || (env.GOWORK && env.GOWORK !== 'off')) {
          const modules = parseObjects(await go(['list', '-m', '-e', '-json', 'all']));
          const dependencies = modules.filter(m => !m.Main).map(dependency);
          for (const indirect of [false, true]) {
            if (indirect && !config.get('showIndirect')) continue;
            const entries = dependencies.filter(m => m.indirect === indirect).sort((a, b) => a.label.localeCompare(b.label));
            if (entries.length) children.push({ kind: 'group', label: indirect ? 'Indirect dependencies' : 'Dependencies',
              children: entries.map(m => ({ ...m, kind: m.dir ? 'directory' : 'missing', uri: m.dir ? vscode.Uri.file(m.dir) : undefined })) });
          }
          for (const m of modules.filter(m => m.Error)) children.push({ kind: 'message', label: m.Error.Err });
        } else children.push({ kind: 'message', label: 'No go.mod or go.work in this folder' });
      } catch (error) {
        this.output.appendLine(`[${folder.name}] ${error.message}`);
        children.push({ kind: 'message', label: 'Unable to load libraries — see Golang External Libraries output', detail: error.message });
      }
      return { kind: 'group', label: folder.name, children };
    }));
    if (generation !== this.generation) return;
    this.roots = folders.length === 1 ? roots[0].children : roots;
    const link = (nodes, parent) => nodes.forEach(node => {
      node.parent = parent;
      if (node.children) link(node.children, node);
    });
    link(this.roots, undefined);
    this.changed.fire();
    await this.revealActive();
  }
  getParent(node) { return node.parent; }
  autoRevealEnabled(uri) {
    return vscode.workspace.getConfiguration('explorer').get('autoReveal', true) !== false
      && this.config(uri).get('autoReveal', true);
  }
  async revealActive(manual = false) {
    const uri = vscode.window.activeTextEditor?.document.uri;
    if (!uri || !this.view || (!manual && !this.autoRevealEnabled(uri))) return false;
    const generation = this.generation;
    const candidates = [];
    const visit = nodes => nodes.forEach(node => {
      if (node.kind === 'directory' && node.uri?.scheme === uri.scheme && node.uri.authority === uri.authority) {
        const relative = path.relative(node.uri.fsPath, uri.fsPath);
        if (relative && !path.isAbsolute(relative) && relative !== '..' && !relative.startsWith(`..${path.sep}`)) candidates.push({ node, relative });
      }
      if (node.kind === 'group' && node.children) visit(node.children);
    });
    visit(this.roots);
    // Prefer the closest enclosing module when module source roots overlap.
    candidates.sort((a, b) => a.relative.split(path.sep).length - b.relative.split(path.sep).length);
    if (!candidates.length) return false;
    let { node, relative } = candidates[0];
    for (const part of relative.split(path.sep)) {
      node = (await this.getChildren(node)).find(child => child.label === part);
      if (!node) return false;
    }
    const valid = () => generation === this.generation
      && vscode.window.activeTextEditor?.document.uri.toString() === uri.toString()
      && (manual || this.autoRevealEnabled(uri));
    if (!valid()) return false;
    try {
      if (manual) await vscode.commands.executeCommand('goExternalLibraries.focus');
      // Materialize and expand ancestors even when the view has never been opened.
      const ancestors = [];
      for (let parent = node.parent; parent; parent = parent.parent) ancestors.unshift(parent);
      for (const parent of ancestors) {
        if (!valid()) return false;
        await this.view.reveal(parent, { select: false, focus: false, expand: true });
      }
      if (!valid()) return false;
      await this.view.reveal(node, { select: true, focus: manual, expand: false });
      return true;
    } catch (error) { this.output.appendLine(`Reveal: ${error.message}`); return false; }
  }
  getTreeItem(node) {
    const expandable = node.kind === 'group' || node.kind === 'directory';
    const item = new vscode.TreeItem(node.label, expandable ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None);
    item.resourceUri = node.uri;
    item.description = [node.version, node.replacement && `→ ${node.replacement}`, node.kind === 'missing' && 'source unavailable'].filter(Boolean).join(' ');
    item.tooltip = [node.label, node.uri?.fsPath, node.replacement, node.error, node.detail].filter(Boolean).join('\n');
    if (node.kind === 'file') item.command = { command: 'vscode.open', title: 'Open Source', arguments: [node.uri] };
    if (node.kind === 'group') item.iconPath = new vscode.ThemeIcon('library');
    if (node.kind === 'missing' || node.kind === 'message') item.iconPath = new vscode.ThemeIcon('warning');
    return item;
  }
  async getChildren(node) {
    if (!node) return this.roots;
    if (node.children) return node.children;
    if (node.kind !== 'directory') return [];
    try {
      const entries = await vscode.workspace.fs.readDirectory(node.uri);
      // Symlinks are deliberately excluded to avoid loops and unrelated trees.
      node.children = entries.filter(([name, type]) => !name.startsWith('.') && !(type & vscode.FileType.SymbolicLink))
        .sort((a, b) => Number(!!(b[1] & vscode.FileType.Directory)) - Number(!!(a[1] & vscode.FileType.Directory)) || a[0].localeCompare(b[0]))
        .map(([label, type]) => ({ kind: type & vscode.FileType.Directory ? 'directory' : 'file', label, uri: vscode.Uri.joinPath(node.uri, label), parent: node }));
      return node.children;
    } catch (error) {
      this.output.appendLine(error.message);
      return [{ kind: 'message', label: 'Source directory unavailable', detail: error.message }];
    }
  }
  dispose() { clearTimeout(this.timer); this.generation++; this.changed.dispose(); }
  schedule() { clearTimeout(this.timer); this.timer = setTimeout(() => this.refresh(), 400); }
}

async function download(provider) {
  const folders = vscode.workspace.workspaceFolders || [];
  const folder = folders.length === 1 ? folders[0] : await vscode.window.showWorkspaceFolderPick();
  if (!folder) return;
  const config = provider.config(folder.uri);
  await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: 'Downloading Go modules' }, async () => {
    try {
      await new Promise((resolve, reject) => execFile(config.get('goPath'), ['mod', 'download'], {
        cwd: folder.uri.fsPath, timeout: config.get('timeout'), maxBuffer: 32 * 1024 * 1024
      }, (error, stdout, stderr) => error ? reject(new Error(stderr || error.message)) : resolve(stdout)));
      await provider.refresh();
    } catch (error) {
      provider.output.appendLine(error.message);
      vscode.window.showErrorMessage(`Go module download failed: ${error.message}`);
    }
  });
}

function activate(context) {
  const output = vscode.window.createOutputChannel('Golang External Libraries');
  const provider = new Libraries(output);
  provider.view = vscode.window.createTreeView('goExternalLibraries', { treeDataProvider: provider, showCollapseAll: true });
  const watcher = vscode.workspace.createFileSystemWatcher('**/{go.mod,go.sum,go.work,go.work.sum}');
  context.subscriptions.push(output, provider, watcher,
    provider.view,
    vscode.commands.registerCommand('goExternalLibraries.revealInProject', async () => {
      if (!vscode.window.activeTextEditor) return;
      await ready;
      if (await provider.revealActive(true)) return;
      return vscode.commands.executeCommand('workbench.files.action.showActiveFileInExplorer');
    }),
    vscode.commands.registerCommand('goExternalLibraries.reveal', async () => { await ready; return provider.revealActive(true); }),
    vscode.window.onDidChangeActiveTextEditor(() => provider.revealActive()),
    vscode.commands.registerCommand('goExternalLibraries.refresh', () => provider.refresh()),
    vscode.commands.registerCommand('goExternalLibraries.download', () => download(provider)),
    watcher.onDidChange(() => provider.schedule()), watcher.onDidCreate(() => provider.schedule()), watcher.onDidDelete(() => provider.schedule()),
    vscode.workspace.onDidChangeWorkspaceFolders(() => provider.schedule()),
    vscode.workspace.onDidChangeConfiguration(e => { if (e.affectsConfiguration('goExternalLibraries')) provider.schedule(); })
  );
  const ready = provider.refresh();
}

module.exports = { activate };
