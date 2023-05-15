import { createOperation } from '../../generated/wundergraph.factory';

export default createOperation.query({
	handler: async ({ context }) => {
		return {
			hello: context.hello(),
		};
	},
});
