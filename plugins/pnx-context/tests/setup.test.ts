import { expect, test } from 'claude-code/testing'

import { ENVIRONMENTS, apiKeysUrl, baseOf, configureInput, environmentOf, extractKey } from '../hooks/setup'

test('takes the pnx_ key out of whatever was pasted, and nothing else', () => {
  expect(extractKey('pnx_09e7126f_abcDEF-123_xyz')).toBe('pnx_09e7126f_abcDEF-123_xyz')
  expect(extractKey('  "pnx_09e7126f_abcDEF-123_xyz"\n')).toBe('pnx_09e7126f_abcDEF-123_xyz')
  expect(extractKey('Key: pnx_09e7126f_abcDEF-123_xyz (shown once)')).toBe('pnx_09e7126f_abcDEF-123_xyz')
  expect(extractKey('')).toBeUndefined()
  expect(extractKey('*')).toBeUndefined()
  expect(extractKey('pnx_short')).toBeUndefined()
})

test('offers production first, knows the saved address, and links the API keys page', () => {
  expect(ENVIRONMENTS[0].id).toBe('prod')
  expect(environmentOf('https://agentic-platformnex-portal.dit1.ivedha.dev')).toBe('dit1')
  expect(environmentOf('https://elsewhere.example')).toBeUndefined()
  expect(apiKeysUrl(baseOf('prod'))).toBe('https://agentic-platformnex-portal.prod.ivedha.dev/account/api-keys')
})

test('saves exactly the key and the address', () => {
  expect(JSON.parse(configureInput('pnx_k', 'https://h'))).toEqual({ apiKey: 'pnx_k', baseUrl: 'https://h' })
})
