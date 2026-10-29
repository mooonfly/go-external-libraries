const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mkdtemp, writeFile, rm, realpath } = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { parseObjects, dependency, runGo } = require('../src/modules');

test('parses streamed Go objects with nested replacements and escaped braces', () => {
  const values = [{ Path: 'a', Replace: { Path: 'x{"\\}', Dir: '/tmp/x' } }, { Path: 'b', Indirect: true }];
  assert.deepEqual(parseObjects(values.map(x => JSON.stringify(x)).join('\n')), values);
  assert.deepEqual(parseObjects(' \n'), []);
  assert.throws(() => parseObjects('{"Path":'));
  assert.throws(() => parseObjects('garbage'));
});
test('resolves local and version replacements and missing sources', () => {
  assert.deepEqual(dependency({ Path: 'a', Version: 'v1.0.0', Replace: { Path: '../local', Dir: '/tmp/local' } }), {
    label: 'a', version: 'v1.0.0', dir: '/tmp/local', indirect: false, replacement: '../local', error: undefined
  });
  assert.equal(dependency({ Path: 'a', Replace: { Path: 'b', Version: 'v2.0.0' } }).replacement, 'b@v2.0.0');
  assert.equal(dependency({ Path: 'a', Error: { Err: 'missing' } }).error, 'missing');
});
test('loads actual Go module graph with local replacement without network', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'external-libraries-'));
  try {
    await writeFile(path.join(dir, 'go.mod'), 'module example.com/app\n\ngo 1.20\n\nrequire example.com/lib v0.0.0\nreplace example.com/lib => ./lib\n');
    const { mkdir } = require('node:fs/promises');
    await mkdir(path.join(dir, 'lib'));
    await writeFile(path.join(dir, 'lib/go.mod'), 'module example.com/lib\n\ngo 1.20\n');
    const graph = parseObjects(await runGo('go', ['list', '-m', '-e', '-json', 'all'], dir, 10000));
    assert.equal(graph.filter(m => m.Main).length, 1);
    assert.equal(dependency(graph.find(m => !m.Main)).dir, await realpath(path.join(dir, 'lib')));
    await assert.rejects(runGo('nonexistent-go-executable', ['env'], dir, 1000));
  } finally { await rm(dir, { recursive: true, force: true }); }
});
