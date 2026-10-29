const { execFile } = require('node:child_process');

// go list emits adjacent JSON objects rather than a JSON array.
function parseObjects(input) {
  const objects = [];
  let depth = 0, start = -1, quoted = false, escaped = false;
  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (quoted) {
      if (escaped) escaped = false;
      else if (c === '\\') escaped = true;
      else if (c === '"') quoted = false;
      continue;
    }
    if (c === '"') quoted = true;
    else if (c === '{') { if (depth++ === 0) start = i; }
    else if (c === '}') {
      if (--depth < 0) throw new Error('Invalid Go JSON output');
      if (depth === 0) objects.push(JSON.parse(input.slice(start, i + 1)));
    } else if (depth === 0 && !/\s/.test(c)) throw new Error('Invalid Go JSON output');
  }
  if (depth || quoted) throw new Error('Incomplete Go JSON output');
  return objects;
}

function runGo(executable, args, cwd, timeout) {
  return new Promise((resolve, reject) => {
    execFile(executable, args, { cwd, timeout, maxBuffer: 32 * 1024 * 1024,
      env: { ...process.env, GOTOOLCHAIN: 'local', GOPROXY: 'off', GOSUMDB: 'off' } },
    (error, stdout, stderr) => {
      if (error) reject(new Error(`${args.join(' ')}: ${stderr.trim() || error.message}`));
      else resolve(stdout);
    });
  });
}

function dependency(module) {
  const actual = module.Replace || module;
  return { label: module.Path, version: module.Version || '', dir: actual.Dir,
    indirect: !!module.Indirect,
    replacement: module.Replace ? `${actual.Path}${actual.Version ? '@' + actual.Version : ''}` : '',
    error: actual.Error?.Err || module.Error?.Err };
}

module.exports = { parseObjects, runGo, dependency };
