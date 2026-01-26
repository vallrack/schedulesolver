export type User = {
  id: string;
  name: string;
  email: string;
  role: 'user' | 'admin' | 'super_admin';
}

export type Teacher = {
  id: string;
  name: string;
  email: string;
  maxWeeklyHours: number;
  specialties: string[]; // array of course IDs
  availability: { day: string; startTime: string; endTime: string }[];
  status: 'active' | 'inactive';
};

export type Course = {
  id: string;
  name:string;
  durationWeeks: number;
  totalHours: number;
  career: string;
  semester: number;
  group: string;
};

export type Classroom = {
  id: string;
  name: string;
  capacity: number;
  type: 'classroom' | 'lab';
};

export type ScheduleEvent = {
  id: string;
  courseId: string;
  teacherId: string;
  classroomId: string;
  day: string; // e.g., 'Monday'
  startTime: string; // e.g., '09:00'
  endTime: string; // e.g., '11:00'
  startWeek: number;
  endWeek: number;
};
