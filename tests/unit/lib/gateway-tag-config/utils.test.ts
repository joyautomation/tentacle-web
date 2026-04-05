import { describe, it, expect } from 'vitest';
import { mapDatatype } from '$lib/components/gateway-tag-config/utils';

describe('mapDatatype', () => {
	it('maps BOOL to boolean', () => {
		expect(mapDatatype('BOOL')).toBe('boolean');
		expect(mapDatatype('boolean')).toBe('boolean');
	});

	it('maps numeric PLC types to number', () => {
		const numericTypes = [
			'DINT',
			'INT',
			'SINT',
			'LINT',
			'REAL',
			'LREAL',
			'UDINT',
			'UINT',
			'USINT',
			'ULINT'
		];
		for (const type of numericTypes) {
			expect(mapDatatype(type)).toBe('number');
		}
	});

	it('maps STRING to string', () => {
		expect(mapDatatype('STRING')).toBe('string');
	});

	it('maps STRUCT to struct', () => {
		expect(mapDatatype('STRUCT')).toBe('struct');
	});

	it('is case-insensitive', () => {
		expect(mapDatatype('dint')).toBe('number');
		expect(mapDatatype('Dint')).toBe('number');
		expect(mapDatatype('bool')).toBe('boolean');
	});

	it('defaults unknown types to number', () => {
		expect(mapDatatype('UNKNOWN')).toBe('number');
		expect(mapDatatype('CUSTOM_TYPE')).toBe('number');
	});
});
