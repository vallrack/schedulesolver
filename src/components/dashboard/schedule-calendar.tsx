'use client';

import React from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { cn } from '@/lib/utils';
import type { ScheduleEvent, Teacher, Subject, Classroom } from '@/lib/types';

const DAYS_OF_WEEK = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const TIME_SLOTS = Array.from({ length: 16 }, (_, i) => `${(i + 7).toString().padStart(2, '0')}:00`); // 7 AM to 10 PM

const timeToMinutes = (time: string): number => {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
};

const EventCard = ({
  event,
  subjects,
  teachers,
  classrooms,
}: {
  event: ScheduleEvent;
  subjects: Subject[];
  teachers: Teacher[];
  classrooms: Classroom[];
}) => {
  const subject = subjects.find((c) => c.id === event.subjectId);
  const teacher = teachers.find((t) => t.id === event.teacherId);
  const classroom = classrooms.find((c) => c.id === event.classroomId);

  const startTimeInMinutes = timeToMinutes(event.startTime);
  const endTimeInMinutes = timeToMinutes(event.endTime);
  const durationInMinutes = endTimeInMinutes - startTimeInMinutes;

  const topPosition = ((startTimeInMinutes - 7 * 60) / 60) * 4.5; // 4.5rem per hour (h-18)
  const height = (durationInMinutes / 60) * 4.5;

  const colors = [
    'bg-blue-100 border-blue-300 text-blue-800',
    'bg-green-100 border-green-300 text-green-800',
    'bg-purple-100 border-purple-300 text-purple-800',
    'bg-yellow-100 border-yellow-300 text-yellow-800',
    'bg-indigo-100 border-indigo-300 text-indigo-800',
    'bg-pink-100 border-pink-300 text-pink-800',
    'bg-sky-100 border-sky-300 text-sky-800',
  ];
  const colorIndex = subjects.findIndex((c) => c.id === event.subjectId) % colors.length;
  const colorClasses = colors[colorIndex] || colors[0];

  return (
    <Popover>
      <PopoverTrigger asChild>
        <div
          className={cn(
            'absolute w-[calc(100%-4px)] left-[2px] rounded-lg p-2 text-xs cursor-pointer hover:opacity-90 transition-opacity z-10 border',
            colorClasses
          )}
          style={{ top: `${topPosition}rem`, height: `${height}rem` }}
        >
          <p className="font-bold truncate">{subject?.name ?? 'Evento'}</p>
          <p className="truncate text-xs opacity-80">{teacher?.name}</p>
          <p className="truncate text-xs opacity-80">{classroom?.name}</p>
        </div>
      </PopoverTrigger>
      <PopoverContent>
        <div className="p-2 space-y-2 text-sm">
            <h4 className="font-bold font-headline">{subject?.name ?? "Evento Desconocido"}</h4>
            <p><strong>Docente:</strong> {teacher?.name ?? "N/A"}</p>
            <p><strong>Aula:</strong> {classroom?.name ?? "N/A"}</p>
            <p><strong>Horario:</strong> {event.day}, {event.startTime} - {event.endTime}</p>
            <p><strong>Semanas:</strong> {event.startWeek} - {event.endWeek}</p>
        </div>
      </PopoverContent>
    </Popover>
  );
};

interface ScheduleCalendarProps {
  events: ScheduleEvent[];
  subjects: Subject[];
  teachers: Teacher[];
  classrooms: Classroom[];
}

export function ScheduleCalendar({ events, subjects, teachers, classrooms }: ScheduleCalendarProps) {
  return (
    <div className="mt-6 border rounded-xl overflow-hidden shadow-sm bg-card">
      <div className="grid grid-cols-[60px_repeat(6,1fr)]">
        {/* Corner */}
        <div className="h-12 border-b border-r"></div>

        {/* Day Headers */}
        {DAYS_OF_WEEK.map((day) => (
          <div key={day} className="h-12 text-center font-semibold flex items-center justify-center border-b border-l text-sm">
            {day}
          </div>
        ))}

        {/* Time Gutter */}
        <div className="row-span-full flex flex-col border-r">
          {TIME_SLOTS.map((time) => (
            <div key={time} className="h-18 flex items-center justify-center border-t">
              <span className="text-xs text-muted-foreground">{time}</span>
            </div>
          ))}
        </div>

        {/* Calendar Grid */}
        {DAYS_OF_WEEK.map((day) => (
          <div key={day} className="relative border-l">
            {/* Hour lines */}
            {TIME_SLOTS.map((time, index) => (
              <div key={time} className={cn("h-18", index > 0 && "border-t")}></div>
            ))}
            {/* Events */}
            {events
              .filter((event) => event.day === day)
              .map((event) => (
                <EventCard
                  key={event.id}
                  event={event}
                  subjects={subjects}
                  teachers={teachers}
                  classrooms={classrooms}
                />
              ))}
          </div>
        ))}
      </div>
    </div>
  );
}
