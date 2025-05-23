import Fuse from "fuse.js"; // Keep Fuse import in case a student search helper is needed later, but it's not used in the provided class
import type { SheetDBClient, SheetDBResponse } from "../sheetdb/sheetdb"; // Assuming this path is correct
import { BaseRepo } from "./BaseRepo"; // Assuming this path is correct

// Define the Attendance interface/class
export class Attendance {
	// Note: updated_at is string in original, created_at is Date. Sticking to this for now,
	// but consistency (e.g., both Date or both ISO string) might be better depending on BaseRepo/SheetDBClient.
	constructor(
		public id: number,
		public student_id: number,
		public event: string,
		public created_at: Date, // Assuming BaseRepo reads this as a Date object
		public updated_at: string // Assuming BaseRepo handles this as a string (e.g., ISO format)
	) { }
}

// Define the Attendance Repository
export class AttendanceRepo extends BaseRepo<Attendance> {

	public constructor(dbClient: SheetDBClient) {
		super(dbClient, 'attendance', true); // 'attendance' is the sheet name, true possibly for auto-ID
	}

	/**
	 * Helper to compare if two Date objects represent the same day (ignoring time).
	 * Assumes the input dates are valid Date objects.
	 * @param date1 - The first date.
	 * @param date2 - The second date.
	 * @returns true if dates are on the same day, false otherwise.
	 */
	private isSameDay(date1: Date, date2: Date): boolean {
		// Check if date1 and date2 are valid Date objects before calling methods
		if (!(date1 instanceof Date) || isNaN(date1.getTime()) || !(date2 instanceof Date) || isNaN(date2.getTime())) {
			console.error("isSameDay received invalid Date objects:", date1, date2);
			// Depending on strictness, could throw or return false. Returning false here.
			return false;
		}
		return date1.getFullYear() === date2.getFullYear() &&
			date1.getMonth() === date2.getMonth() && // Month is 0-indexed
			date1.getDate() === date2.getDate();
	}

	/**
	 * Creates a new attendance record.
	 * Ensures uniqueness: only one record per student, per event, per day.
	 * @param params - The attendance data to create (without id, created_at, updated_at).
	 * @returns The SheetDBResponse if created, or null if a duplicate already exists for the same student, event, and day.
	 * Note: This method reads ALL attendance records first to check for uniqueness.
	 * For very large datasets, optimize if SheetDBClient supports server-side filtering.
	 */
	public async create(params: Omit<Omit<Omit<Attendance, 'updated_at'>, 'created_at'>, 'id'>): Promise<SheetDBResponse | null> {
		const today = new Date();

		// Use the helper method to check if attendance already exists for this student, event, and today
		const alreadyAttended = await this.hasAttended(params.student_id, params.event, today);

		if (alreadyAttended) {
			console.log(`Attendance already recorded for student ${params.student_id} for event "${params.event}" today.`);
			return null; // Indicate that no new record was created due to uniqueness constraint
		}

		// If no duplicate found, proceed with creation
		// Assuming BaseRepo._create automatically adds 'created_at' and 'updated_at' timestamps.
		return await this._create(params) as SheetDBResponse;
	}

	/**
	 * Updates an existing attendance record.
	 * Assumes the BaseRepo._update method handles finding the record by ID
	 * and potentially updating the 'updated_at' timestamp.
	 * @param attendance - The attendance object to update.
	 * @returns The SheetDBResponse from the update operation.
	 */
	public async update(attendance: Attendance): Promise<SheetDBResponse> {
		// columnName: string, value: string | number, data: Partial<Attendance>
		// Assuming 'id' is the unique key for updates
		return await this._update('id', attendance.id, attendance);
	}

	/**
	 * Deletes an attendance record by its ID.
	 * @param attendance - The attendance object to delete (only the ID is needed).
	 * @returns The SheetDBResponse from the delete operation.
	 */
	public async delete(attendance: Attendance): Promise<SheetDBResponse> {
		// Assuming 'id' is the unique key for deletes
		return await this._delete('id', attendance.id);
	}

	// --- Good Helper Methods ---

	/**
	 * Checks if a student has attended a specific event on a specific date.
	 * This method is used internally by `create` and can be used externally.
	 * Note: Reads ALL attendance records first. Optimize if SheetDBClient supports server-side filtering.
	 * @param studentId - The ID of the student.
	 * @param eventName - The name of the event.
	 * @param date - The date to check attendance for.
	 * @returns true if an attendance record exists for the student, event, and date, false otherwise.
	 */
	public async hasAttended(studentId: number, eventName: string, date: Date): Promise<boolean> {
		const records = await this._read(); // Read all records
		return records.some(record =>
			record.student_id === studentId &&
			record.event === eventName &&
			this.isSameDay(record.created_at, date)
		);
	}

	/**
	 * Gets all attendance records for a specific student.
	 * Note: Reads ALL attendance records first. Optimize if SheetDBClient supports server-side filtering.
	 * @param studentId - The ID of the student.
	 * @returns An array of Attendance records for the student.
	 */
	public async getAttendanceForStudent(studentId: number): Promise<Attendance[]> {
		const records = await this._read(); // Read all records
		return records.filter(record => record.student_id === studentId);
	}

	/**
	 * Gets all attendance records for a specific event.
	 * Note: Reads ALL attendance records first. Optimize if SheetDBClient supports server-side filtering.
	 * @param eventName - The name of the event.
	 * @returns An array of Attendance records for the event.
	 */
	public async getAttendanceForEvent(eventName: string): Promise<Attendance[]> {
		const records = await this._read(); // Read all records
		return records.filter(record => record.event === eventName);
	}

	/**
	 * Gets all attendance records for a specific date.
	 * Note: Reads ALL attendance records first. Optimize if SheetDBClient supports server-side filtering.
	 * @param date - The date to filter by (time component is ignored).
	 * @returns An array of Attendance records for the specified date.
	 */
	public async getAttendanceForDate(date: Date): Promise<Attendance[]> {
		const records = await this._read(); // Read all records
		return records.filter(record => this.isSameDay(record.created_at, date));
	}

	/**
	* Lists all unique event names found in the attendance records.
	* Note: Reads ALL attendance records first.
	* @returns An array of unique event names (strings).
	*/
	public async listAllEvents(): Promise<string[]> {
		const records = await this._read(); // Read all records
		const events = new Set<string>();
		records.forEach(record => {
			if (record.event) { // Ensure event is not null/undefined
				events.add(record.event);
			}
		});
		return Array.from(events);
	}

	/**
	* Gets a summary of attendance counts per event for a specific date.
	* Note: Reads ALL attendance records first, then filters and processes.
	* @param date - The date to summarize attendance for.
	* @returns An array of objects, each with an event name and the count of attendees for that event on that day.
	*/
	public async getAttendanceSummaryByEventAndDate(date: Date): Promise<{ event: string; count: number }[]> {
		const recordsToday = await this.getAttendanceForDate(date); // Use the helper to get records for the day
		const summary: { [event: string]: number } = {};

		recordsToday.forEach(record => {
			if (record.event) {
				summary[record.event] = (summary[record.event] || 0) + 1;
			}
		});

		// Convert the summary object to an array format
		return Object.keys(summary).map(event => ({
			event: event,
			count: summary[event]
		}));
	}

	// Removed 'lookFor' and 'teachersPhoneNumber' as they belong to a TeacherRepo.
}