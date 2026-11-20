import { expect, test } from 'claude-code/testing'

import { baseName, isAbsolutePath, normalizePath, rootContaining, scannedRepo } from '../hooks/lib'

test('a folder is spelled one way on every OS', () => {
  expect(normalizePath('C:\\work\\Agentic-portal\\')).toBe('c:/work/Agentic-portal')
  expect(normalizePath('c:/work/x')).toBe('c:/work/x')
  expect(normalizePath('C:\\')).toBe('c:/')
  expect(normalizePath('/home/me/x/')).toBe('/home/me/x')
  expect(normalizePath('/')).toBe('/')
})

test('absolute paths are recognised on every OS', () => {
  for (const path of ['/home/me/x.ts', 'C:\\w\\x.ts', 'c:/w/x.ts', '\\\\server\\share\\x.ts']) expect(isAbsolutePath(path)).toBe(true)
  for (const path of ['x.ts', 'src\\x.ts', 'C:x.ts', '']) expect(isAbsolutePath(path)).toBe(false)
})

test('the repository holding a path is found however Windows spells either', () => {
  const roots = ['c:/w/gateway', 'c:/w/gateway/packages/inner', '/home/me/portal']
  expect(rootContaining('C:\\w\\gateway\\src\\x.ts', roots)).toBe('c:/w/gateway')
  expect(rootContaining('C:\\W\\Gateway\\src\\x.ts', roots)).toBe('c:/w/gateway')
  // The deepest wins when repositories nest.
  expect(rootContaining('c:/w/gateway/packages/inner/a.ts', roots)).toBe('c:/w/gateway/packages/inner')
  expect(rootContaining('C:\\w\\gateway', roots)).toBe('c:/w/gateway')
  // A neighbour with the same start is not inside it.
  expect(rootContaining('C:\\w\\gateway-old\\x.ts', roots)).toBeUndefined()
  // macOS and Linux paths stay case-sensitive, as before.
  expect(rootContaining('/home/me/portal/src/x.ts', roots)).toBe('/home/me/portal')
  expect(rootContaining('/home/me/Portal/src/x.ts', roots)).toBeUndefined()
})

test('a repository read by git keeps a clean remote and a usable branch', () => {
  expect(scannedRepo('C:\\w\\gateway', 'https://someone:s3cret@github.com/o/gateway.git\n', 'feat/x\n', 'abc1234\n')).toEqual({
    root: 'c:/w/gateway',
    remote: 'https://github.com/o/gateway.git',
    branch: 'feat/x',
    head: 'abc1234',
  })
  // A detached HEAD and a repository with no remote or commit yet.
  expect(scannedRepo('/w/new', '', 'HEAD', '')).toEqual({ root: '/w/new', remote: undefined, branch: undefined, head: undefined })
})

test('a folder name is read from either kind of path', () => {
  expect(baseName('C:\\w\\gateway')).toBe('gateway')
  expect(baseName('/w/gateway/')).toBe('gateway')
})
