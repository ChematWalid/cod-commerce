/** Injection tokens of the gateway's ports, whose adapters live in `infrastructure/`. */
export const KILL_SWITCH = Symbol('INBOUND_KILL_SWITCH');
export const INBOUND_SCOPES = Symbol('INBOUND_SCOPES');
export const INBOUND_STORE = Symbol('INBOUND_STORE');
export const INBOUND_QUEUE = Symbol('INBOUND_QUEUE');
export const INBOUND_DUE_SCAN = Symbol('INBOUND_DUE_SCAN');
export const KEY_PURGE_STORE = Symbol('INBOUND_KEY_PURGE_STORE');
export const INBOUND_IDS = Symbol('INBOUND_IDS');
export const INBOUND_ENVIRONMENT = Symbol('INBOUND_ENVIRONMENT');
export const INBOUND_PORTS = Symbol('INBOUND_PORTS');
