import { useState } from 'react';
import { users_updateInput } from '../../components/generated/models';
import { useMutation } from '../../lib/react-query';

const Users = () => {
	const [state, setState] = useState<users_updateInput>({
		id: '1',
		name: 'Jens',
		bio: 'Founder of WunderGraph',
	});
	const { data, mutate } = useMutation({
		operationName: 'users/update',
	});
	return (
		<div>
			<input value={state.id} onChange={(e) => setState((s) => ({ ...s, id: e.target.value }))}></input>
			<input value={state.name} onChange={(e) => setState((s) => ({ ...s, name: e.target.value }))}></input>
			<input value={state.bio} onChange={(e) => setState((s) => ({ ...s, bio: e.target.value }))}></input>
			<button onClick={() => mutate(state)}>Update</button>
			<pre>{JSON.stringify(data)}</pre>
		</div>
	);
};

export default Users;
