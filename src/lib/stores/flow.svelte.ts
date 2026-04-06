import type { Flow } from '../types.js';
import { FerretError } from '../errors.js';

export type FlowState =
	| { phase: 'idle' }
	| { phase: 'loading' }
	| { phase: 'ready'; flow: Flow }
	| { phase: 'submitting'; flow: Flow }
	| { phase: 'success'; data: unknown }
	| { phase: 'error'; error: FerretError | Error; flow?: Flow };

export function createFlowStore() {
	let state = $state<FlowState>({ phase: 'idle' });

	function setLoading() {
		state = { phase: 'loading' };
	}

	function setReady(flow: Flow) {
		state = { phase: 'ready', flow };
	}

	function setSubmitting(flow: Flow) {
		state = { phase: 'submitting', flow };
	}

	function setSuccess(data: unknown) {
		state = { phase: 'success', data };
	}

	function setError(error: unknown, flow?: Flow) {
		const err = error instanceof FerretError || error instanceof Error
			? error
			: new Error(String(error));
		state = { phase: 'error', error: err, flow };
	}

	function reset() {
		state = { phase: 'idle' };
	}

	return {
		get state() {
			return state;
		},
		get phase() {
			return state.phase;
		},
		get flow() {
			return 'flow' in state ? (state as { flow: Flow }).flow : null;
		},
		get flowId() {
			return 'flow' in state ? (state as { flow: Flow }).flow.id : null;
		},
		get csrfToken() {
			return 'flow' in state ? (state as { flow: Flow }).flow.csrf_token : null;
		},
		get ui() {
			return 'flow' in state ? (state as { flow: Flow }).flow.ui : null;
		},
		get error() {
			return state.phase === 'error' ? state.error : null;
		},
		get isLoading() {
			return state.phase === 'loading' || state.phase === 'submitting';
		},
		setLoading,
		setReady,
		setSubmitting,
		setSuccess,
		setError,
		reset
	};
}

export type FlowStore = ReturnType<typeof createFlowStore>;
