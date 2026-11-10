# Testing Patterns (reference)

Quick reference of testing patterns, illustrated in JavaScript/TypeScript (Jest, Testing Library, Supertest, Playwright). The principles (arrange-act-assert, naming, mocking only at boundaries, anti-patterns) apply in any ecosystem; in another stack use the repository's own framework and commands.

## Structure: arrange, act, assert

```typescript
it('creates a task with default pending status', () => {
  // Arrange
  const input = { title: 'Test Task', priority: 'high' };
  // Act
  const result = createTask(input);
  // Assert
  expect(result.title).toBe('Test Task');
  expect(result.status).toBe('pending');
});
```

## Naming

Pattern: unit, expected behavior, condition. A test name should read like a specification.

```typescript
describe('TaskService.createTask', () => {
  it('creates a task with default pending status', () => {});
  it('throws ValidationError when title is empty', () => {});
  it('trims whitespace from title', () => {});
});
```

## Assertions worth knowing

```typescript
expect(a).toBe(b);              // strict equality
expect(a).toEqual(b);           // deep equality
expect(n).toBeCloseTo(0.3, 5);  // floating point
expect(list).toHaveLength(3);
expect(obj).toHaveProperty('key', 'value');
expect(() => fn()).toThrow(ValidationError);
await expect(asyncFn()).resolves.toBe(value);
await expect(asyncFn()).rejects.toThrow(Error);
```

## Mocking

```typescript
const fn = jest.fn().mockResolvedValue({ data: 'test' });
expect(fn).toHaveBeenCalledWith('arg1');

jest.mock('./database', () => ({
  query: jest.fn().mockResolvedValue([{ id: 1 }]),
}));
```

Mock at boundaries only.

| Mock | Do not mock |
|---|---|
| Database calls | Internal utilities |
| HTTP requests | Business logic |
| File system | Data transformations |
| External APIs | Validation functions |
| Time (when needed) | Pure functions |

## Component testing

```tsx
it('submits the form with entered data', async () => {
  const onSubmit = jest.fn();
  render(<TaskForm onSubmit={onSubmit} />);

  // Find elements by role or label, not test IDs
  fireEvent.change(screen.getByRole('textbox', { name: /title/i }), {
    target: { value: 'New Task' },
  });
  fireEvent.click(screen.getByRole('button', { name: /create/i }));

  await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ title: 'New Task' }));
});
```

## API / integration testing

```typescript
it('creates a task and returns 201', async () => {
  const res = await request(app)
    .post('/api/tasks').send({ title: 'Test Task' })
    .set('Authorization', `Bearer ${testToken}`).expect(201);
  expect(res.body).toMatchObject({ id: expect.any(String), status: 'pending' });
});

it('returns 422 for invalid input', async () => { /* expect error code VALIDATION_ERROR */ });
it('returns 401 without authentication', async () => { /* no token */ });
```

Always cover the success path, a validation failure, and an unauthenticated call.

## End-to-end (browser)

Reserve E2E for critical user flows; run it in an environment set up for it, not as a substitute for unit or integration tests.

```typescript
test('user can create and complete a task', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /new task/i }).click();
  await page.getByRole('textbox', { name: /title/i }).fill('Buy groceries');
  await page.getByRole('button', { name: /create/i }).click();

  const task = page.getByRole('listitem').filter({ hasText: /buy groceries/i });
  await expect(task).toBeVisible();
});
```

## Anti-patterns

| Anti-pattern | Problem | Better |
|---|---|---|
| Testing implementation details | Breaks on refactor | Test inputs and outputs |
| Snapshot everything | Nobody reviews the diffs | Assert specific values |
| Shared mutable state | Tests pollute each other | Setup and teardown per test |
| Testing third-party code | Not your bug | Mock the boundary |
| Skipping tests to get CI green | Hides real bugs | Fix or delete the test |
| Permanent `test.skip` | Dead code | Remove or fix |
| Overly broad assertions | Misses regressions | Be specific |
| Unawaited async tests | Swallowed errors, false passes | Always await |
