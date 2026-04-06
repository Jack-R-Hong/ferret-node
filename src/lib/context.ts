import { getContext, setContext } from 'svelte';
import type { FerretClient } from './client.js';
import type { SessionStore } from './stores/session.svelte.js';

const CLIENT_KEY = Symbol('ferret-client');
const SESSION_KEY = Symbol('ferret-session');
const T_KEY = Symbol('ferret-t');

export type TFunction = (key: string, params?: Record<string, unknown>) => string;

export function setFerretContext(client: FerretClient, session: SessionStore, t: TFunction) {
	setContext(CLIENT_KEY, client);
	setContext(SESSION_KEY, session);
	setContext(T_KEY, t);
}

export function getFerretClient(): FerretClient {
	return getContext<FerretClient>(CLIENT_KEY);
}

export function getFerretSession(): SessionStore {
	return getContext<SessionStore>(SESSION_KEY);
}

export function getFerretT(): TFunction {
	return getContext<TFunction>(T_KEY);
}
