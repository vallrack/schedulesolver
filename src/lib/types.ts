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
  contractType: 'Tiempo Completo' | 'Medio Tiempo' | 'Por Horas';
  maxWeeklyHours: number;
  specialties: string[]; // array of subject IDs
  availability: { day: string; startTime: string; endTime: string }[];
  status: 'active' | 'inactive';
};

export type Group = {
  id: string;
  name: string;
  careerId: string;
  semester: number;
  studentCount: number;
};

export type Module = {
  id: string;
  name: string;
  description: string;
  totalHours: number;
}

export type Course = {
  id: string;
  moduleId: string;
  groupId: string;
  durationWeeks: number;
  totalHours: number;
  startDate: string; // Storing as ISO string or similar
  endDate: string; // Storing as ISO string or similar
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

export type Career = {
  id: string;
  name: string;
};
