import { AttendanceService } from "../features/attendance/model.js";
import { StudentService } from "../features/students/model.js";
import { TeacherService } from "../features/teachers/model.js";

export const studentService = new StudentService();
export const teacherService = new TeacherService();
export const attendanceService = new AttendanceService();




