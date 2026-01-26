import type { Teacher, Course, Classroom, ScheduleEvent } from './types';

export const mockTeachers: Teacher[] = [
  { id: 'T001', name: 'Dr. Alan Grant', email: 'alan.grant@example.com', maxWeeklyHours: 20, specialties: ['C001', 'C003'], availability: [] },
  { id: 'T002', name: 'Dr. Ellie Sattler', email: 'ellie.sattler@example.com', maxWeeklyHours: 18, specialties: ['C002'], availability: [] },
  { id: 'T003', name: 'Dr. Ian Malcolm', email: 'ian.malcolm@example.com', maxWeeklyHours: 15, specialties: ['C004'], availability: [] },
  { id: 'T004', name: 'John Hammond', email: 'john.hammond@example.com', maxWeeklyHours: 25, specialties: ['C005'], availability: [] },
];

export const mockCourses: Course[] = [
  { id: 'C001', name: 'Intro to Paleontology', durationWeeks: 8, totalHours: 48, career: 'Biology', semester: 1, group: 'A' },
  { id: 'C002', name: 'Paleobotany', durationWeeks: 16, totalHours: 96, career: 'Biology', semester: 1, group: 'A' },
  { id: 'C003', name: 'Advanced Fossil Analysis', durationWeeks: 8, totalHours: 64, career: 'Biology', semester: 2, group: 'B' },
  { id: 'C004', name: 'Chaos Theory', durationWeeks: 20, totalHours: 120, career: 'Mathematics', semester: 3, group: 'C' },
  { id: 'C005', name: 'Bio-Ethics', durationWeeks: 4, totalHours: 20, career: 'Philosophy', semester: 1, group: 'A' },
];

export const mockClassrooms: Classroom[] = [
  { id: 'R001', name: 'Lecture Hall 101', capacity: 150, type: 'classroom' },
  { id: 'R002', name: 'Lab A', capacity: 30, type: 'lab' },
  { id: 'R003', name: 'Seminar Room 203', capacity: 45, type: 'classroom' },
  { id: 'R004', name: 'Auditorium B', capacity: 300, type: 'classroom' },
];

export const mockScheduleEvents: ScheduleEvent[] = [
  { id: 'E001', courseId: 'C001', teacherId: 'T001', classroomId: 'R001', day: 'Monday', startTime: '09:00', endTime: '11:00', startWeek: 1, endWeek: 8 },
  { id: 'E002', courseId: 'C002', teacherId: 'T002', classroomId: 'R002', day: 'Tuesday', startTime: '10:00', endTime: '12:00', startWeek: 1, endWeek: 16 },
  { id: 'E003', courseId: 'C003', teacherId: 'T001', classroomId: 'R003', day: 'Wednesday', startTime: '13:00', endTime: '15:00', startWeek: 9, endWeek: 16 },
  { id: 'E004', courseId: 'C004', teacherId: 'T003', classroomId: 'R004', day: 'Friday', startTime: '08:00', endTime: '10:00', startWeek: 1, endWeek: 20 },
  { id: 'E005', courseId: 'C005', teacherId: 'T004', classroomId: 'R001', day: 'Thursday', startTime: '16:00', endTime: '18:00', startWeek: 5, endWeek: 8 },
];
