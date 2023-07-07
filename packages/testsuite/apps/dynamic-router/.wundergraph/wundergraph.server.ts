import { configureWunderGraphServer } from '@wundergraph/sdk/server';
import { url1, url2, url3 } from './datasources';

const mergeGraphQLResponses = async (responses: Response[]): Response => {
	// If any of the responses has a non-200 status code, return it
	const failed = responses.find((r) => r.status !== 200);
	if (failed) {
		return failed;
	}
	// Merge the data in the responses
	const payloads = await Promise.all(responses.map((r) => r.json()));
	// If any response has a GraphQL error, return it
	const errorIndex = payloads.findIndex((p) => p.error !== undefined);
	if (errorIndex >= 0) {
		return new Response(JSON.stringify(payloads[errorIndex]), responses[errorIndex]);
	}
	const data: any = {};
	payloads.forEach((p) => {
		const payloadData = p.data;
		for (const key of Object.keys(payloadData)) {
			const value = payloadData[key];
			const prev = data[key];
			if (prev) {
				if (Array.isArray(prev) && Array.isArray(value)) {
					data[key] = [...prev, ...value];
				} else if (Array.isArray(prev)) {
					data[key] = [...prev, value];
				} else if (Array.isArray(value)) {
					data[key] = [prev, ...value];
				} else {
					data[key] = [prev, value];
				}
			} else {
				data[key] = value;
			}
		}
	});
	return new Response(JSON.stringify({ data }), responses[0]);
};

export default configureWunderGraphServer(() => ({
	hooks: {
		global: {
			httpTransport: {
				onOriginTransport: {
					hook: async ({ request }) => {
						const data = await request.text();
						const p1 = fetch(
							new Request(url1, {
								method: request.method,
								headers: request.headers,
								body: data,
							})
						);
						const p2 = fetch(
							new Request(url2, {
								method: request.method,
								headers: request.headers,
								body: data,
							})
						);
						const p3 = fetch(
							new Request(url3, {
								method: request.method,
								headers: request.headers,
								body: data,
							})
						);
						const responses = await Promise.all([p1, p2, p3]);
						return mergeGraphQLResponses(responses);
					},
					enableForAllOperations: true,
				},
			},
		},
		queries: {},
		mutations: {},
	},
}));
