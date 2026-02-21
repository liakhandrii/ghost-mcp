# Development

## Running Tests

Tests run against a local Ghost instance in Docker. Everything is automated:

```bash
npm test
```

This will:
1. Start a Ghost 6 Docker container and write API keys to `.ghost-api-key` (`pretest`)
2. Run the test suite with vitest (`test`)
3. Tear down the container (`posttest`)

No manual setup or environment variable sourcing needed.

To use a different port:

```bash
GHOST_PORT=3000 npm test
```

### Watch Mode

For iterative development, start Ghost once and use watch mode:

```bash
npm run ghost:start
npm run test:watch
```

When done:

```bash
npm run ghost:stop
```
