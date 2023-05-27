import { OperationsClient } from './operations-client';
import { createServer } from 'http';
import { AddressInfo } from 'net';

describe('Operations Client', () => {
	test('Should be able to make a request with default fetch implementation', (done) => {
		const mock = {
			data: {
				id: '1',
			},
		};

		const server = createServer((req, res) => {
			res.end(JSON.stringify(mock));
		});

		server.listen(0, async () => {
			const client = new OperationsClient({
				baseURL: `http://localhost:${(server.address() as AddressInfo).port}`,
				clientRequest: {},
			});
			const { data, error } = await client.query({
				operationName: 'Weather',
			});

			expect(data).toEqual(mock.data);
			expect(error).toBeUndefined();

			done();
		});
	});
});