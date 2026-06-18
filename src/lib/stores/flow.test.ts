import { describe, it, expect } from 'vitest';
import { createFlowStore } from './flow.svelte.js';
import { FerretError } from '../errors.js';
import type { Flow } from '../types.js';

const sampleFlow: Flow = {
	id: 'flow-1',
	csrf_token: 'csrf-abc',
	expires_at: '2030-01-01T00:00:00Z',
	ui: { method: 'POST', action: '/login', fields: [] }
};

describe('createFlowStore', () => {
	it('starts idle with empty accessors', () => {
		const s = createFlowStore();
		expect(s.phase).toBe('idle');
		expect(s.flow).toBeNull();
		expect(s.flowId).toBeNull();
		expect(s.csrfToken).toBeNull();
		expect(s.ui).toBeNull();
		expect(s.error).toBeNull();
		expect(s.isLoading).toBe(false);
	});

	it('setLoading marks the store loading', () => {
		const s = createFlowStore();
		s.setLoading();
		expect(s.phase).toBe('loading');
		expect(s.isLoading).toBe(true);
	});

	it('setReady exposes flow, flowId, csrfToken and ui', () => {
		const s = createFlowStore();
		s.setReady(sampleFlow);
		expect(s.phase).toBe('ready');
		expect(s.flow).toEqual(sampleFlow);
		expect(s.flowId).toBe('flow-1');
		expect(s.csrfToken).toBe('csrf-abc');
		expect(s.ui).toEqual(sampleFlow.ui);
		expect(s.isLoading).toBe(false);
	});

	it('setSubmitting retains the flow and counts as loading', () => {
		const s = createFlowStore();
		s.setSubmitting(sampleFlow);
		expect(s.phase).toBe('submitting');
		expect(s.flowId).toBe('flow-1');
		expect(s.isLoading).toBe(true);
	});

	it('setSuccess stores data and drops the flow accessors', () => {
		const s = createFlowStore();
		s.setSuccess({ ok: true });
		expect(s.phase).toBe('success');
		expect(s.state).toEqual({ phase: 'success', data: { ok: true } });
		expect(s.flow).toBeNull();
	});

	it('setError keeps a FerretError verbatim and retains the flow for re-submit', () => {
		const s = createFlowStore();
		const err = new FerretError({ code: 'x', message: 'm' });
		s.setError(err, sampleFlow);
		expect(s.phase).toBe('error');
		expect(s.error).toBe(err);
		expect(s.flow).toEqual(sampleFlow);
	});

	it('setError wraps a non-Error value into an Error', () => {
		const s = createFlowStore();
		s.setError('boom');
		expect(s.phase).toBe('error');
		expect(s.error).toBeInstanceOf(Error);
		expect(s.error?.message).toBe('boom');
	});

	it('reset returns to idle', () => {
		const s = createFlowStore();
		s.setReady(sampleFlow);
		s.reset();
		expect(s.phase).toBe('idle');
		expect(s.flow).toBeNull();
	});
});
