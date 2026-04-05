import { setupServer } from 'msw/node';
import { handlers } from './handlers';

/**
 * MSW server for unit/integration tests.
 * Intercepts fetch calls to GraphQL endpoints and returns mock responses.
 *
 * Usage in tests:
 *   import { server } from '../../mocks/server';
 *
 *   beforeAll(() => server.listen());
 *   afterEach(() => server.resetHandlers());
 *   afterAll(() => server.close());
 *
 *   // Override for specific test:
 *   server.use(
 *     http.post('/api/graphql', () => HttpResponse.json({ data: { ... } }))
 *   );
 */
export const server = setupServer(...handlers);
