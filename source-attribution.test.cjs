const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');

test('source page keeps original attribution even after client-side navigation', () => {
  const source = readFileSync(require('node:path').join(__dirname, 'serve.js'), 'utf8');
  const encoded = source.match(/const BRAND_RUNTIME = (".*");/)[1];
  const runtime = JSON.parse(encoded);
  const functionBody = runtime.slice(runtime.indexOf('function replacement('), runtime.indexOf('function change('));
  const context = { location: { pathname: '/create' } };
  vm.createContext(context);
  vm.runInContext(functionBody, context);
  assert.equal(context.replacement('VOZEB PRO copyright'), '金立方 GoldCube copyright');
  context.location.pathname = '/open-source';
  assert.equal(context.replacement('VOZEB PRO copyright'), 'VOZEB PRO copyright');
  context.location.pathname = '/open-source/';
  assert.equal(context.replacement('VOZEB PRO copyright'), 'VOZEB PRO copyright');
});
