import { describe, expect, it } from 'vitest';
import { fixtureState } from './state.js';
describe('foundation fixtures', () => { it('uses minor currency units and explicit job actions', () => { expect(fixtureState.quotes[0].currency).toBe('USD'); expect(fixtureState.jobs[0].allowedActions).toContain('send_message'); }); });
