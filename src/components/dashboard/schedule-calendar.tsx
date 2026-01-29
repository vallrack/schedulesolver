'use client';

import React from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { cn } from '@/lib/utils';
import type { ScheduleEvent, Teacher, Module, Classroom, Course, Group, Career } from '@/lib/types';

const DAYS_OF_WEEK = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const TIME_SLOTS = Array.from({ length: 16 }, (_, i) => `${(i + 7).toString().padStart(2, '0')}:00`); // 7 AM to 10 PM

const timeToMinutes = (time: string): number => {
  if (!time) return 0;
  const parts = time.split(':').map(t => parseInt(t, 10));
  const hours = parts[0] ?? 0;
  const minutes = parts[1] ?? 0;
  if (isNaN(hours) || isNaN(minutes)) {
    return 0;
  }
  return hours * 60 + minutes;
};

const EventCard = ({
  event,
  courses,
  modules,
  teachers,
  classrooms,
  groups,
  careers,
}: {
  event: ScheduleEvent;
  courses: Course[];
  modules: Module[];
  teachers: Teacher[];
  classrooms: Classroom[];
  groups: Group[];
  careers: Career[];
}) => {
  const course = courses.find(c => c.id === event.courseId);
  const module = modules.find((m) => m.id === course?.moduleId);
  const teacher = teachers.find((t) => t.id === event.teacherId);
  const classroom = classrooms.find((c) => c.id === event.classroomId);
  const group = groups.find(g => g.id === course?.groupId);
  const career = careers.find(c => c.id === group?.careerId);

  const startTimeInMinutes = timeToMinutes(event.startTime);
  const endTimeInMinutes = timeToMinutes(event.endTime);
  const durationInMinutes = endTimeInMinutes - startTimeInMinutes;

  const topPosition = ((startTimeInMinutes - 7 * 60) / 60) * 4.5; // 4.5rem per hour (h-18)
  const height = (durationInMinutes / 60) * 4.5;

  const colorClasses = 'bg-primary/10 border-primary/50 text-primary';

  return (
    <Popover>
      <PopoverTrigger asChild>
        <div
          className={cn(
            'absolute w-[calc(100%-8px)] left-[4px] rounded-lg p-2 text-xs cursor-pointer hover:opacity-90 transition-opacity z-10 border',
            colorClasses
          )}
          style={{ top: `${topPosition}rem`, height: `${height}rem` }}
        >
          <p className="font-bold truncate">{module?.name ?? 'Evento'}</p>
          <p className="truncate text-xs">{teacher?.name}</p>
          <p className="truncate text-xs">{classroom?.name}</p>
        </div>
      </PopoverTrigger>
      <PopoverContent>
        <div className="p-2 space-y-2 text-sm">
            <h4 className="font-bold font-headline">{module?.name ?? "Evento Desconocido"}</h4>
            {group && <p className="text-xs text-muted-foreground">{career?.name ?? 'Carrera desconocida'} / Sem {group.semester} G{group.name}</p>}
            <p><strong>Docente:</strong> {teacher?.name ?? "N/A"}</p>
            <p><strong>Aula:</strong> {classroom?.name ?? "N/A"}</p>
            <p><strong>Horario:</strong> {event.day}, {event.startTime} - {event.endTime}</p>
        </div>
      </PopoverContent>
    </Popover>
  );
};

interface ScheduleCalendarProps {
  events: ScheduleEvent[];
  courses: Course[];
  modules: Module[];
  teachers: Teacher[];
  classrooms: Classroom[];
  groups: Group[];
  careers: Career[];
}

export function ScheduleCalendar({ events, courses, modules, teachers, classrooms, groups, careers }: ScheduleCalendarProps) {
  return (
    <div className="mt-6 border rounded-xl shadow-sm bg-card overflow-hidden">
      <div className="grid grid-cols-[60px_repeat(6,1fr)]">
        {/* Corner */}
        <div className="h-12 border-b border-r"></div>

        {/* Day Headers */}
        {DAYS_OF_WEEK.map((day) => (
          <div key={day} className="h-12 text-center font-semibold flex items-center justify-center border-b border-r text-sm text-muted-foreground">
            {day}
          </div>
        ))}
        
        <div className='contents'>
            {/* Time Gutter */}
            <div className="col-start-1 row-start-2 flex flex-col border-r">
                {TIME_SLOTS.map((time, index) => (
                    <div key={time} className="h-18 relative">
                      <span className="text-xs text-muted-foreground absolute -top-2 right-2">{time}</span>
                    </div>
                ))}
            </div>

            {/* Calendar Grid */}
            {DAYS_OF_WEEK.map((day, dayIndex) => (
            <div key={day} className="relative border-r" style={{ gridColumnStart: dayIndex + 2, gridRowStart: 2 }}>
                {/* Hour lines */}
                {TIME_SLOTS.map((_, index) => (
                <div key={index} className={cn("h-18", "border-t")}></div>
                ))}
                {/* Events */}
                {events
                .filter((event) => event.day === day)
                .map((event) => (
                    <EventCard
                      key={event.id}
                      event={event}
                      courses={courses}
                      modules={modules}
                      teachers={teachers}
                      classrooms={classrooms}
                      groups={groups}
                      careers={careers}
                    />
                ))}
            </div>
            ))}
        </div>
      </div>
    </div>
  );
}
