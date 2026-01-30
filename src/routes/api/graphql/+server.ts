import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { graphql } from '$lib/server/graphql';

export const POST: RequestHandler = async ({ request }) => {
  try {
    const { query, variables } = await request.json();

    if (!query) {
      return json({ errors: [{ message: 'Query is required' }] }, { status: 400 });
    }

    const result = await graphql(query, variables);
    return json(result);
  } catch (e) {
    return json(
      { errors: [{ message: e instanceof Error ? e.message : 'GraphQL request failed' }] },
      { status: 500 }
    );
  }
};
