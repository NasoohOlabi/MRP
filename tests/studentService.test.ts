// Basic test for StudentService
import { describe, test, expect } from 'bun:test';
import { StudentService } from '../src/core/services/studentService.js';

describe('StudentService', () => {
	test('should create a service instance', () => {
		const service = new StudentService();
		expect(service).toBeInstanceOf(StudentService);
	});

	test('should have getAllStudents method', () => {
		const service = new StudentService();
		expect(typeof service.getAllStudents).toBe('function');
	});

	test('should have registerStudent method', () => {
		const service = new StudentService();
		expect(typeof service.registerStudent).toBe('function');
	});
});

