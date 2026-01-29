'use client';

import React from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { cn } from '@/lib/utils';
import type { ScheduleEvent, Teacher, Module, Classroom, Course, Group, Career } from '@/lib/types';
import { Button } from '../ui/button';
import { Edit, Trash2 } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";


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
  onEdit,
  onDelete,
}: {
  event: ScheduleEvent;
  courses: Course[];
  modules: Module[];
  teachers: Teacher[];
  classrooms: Classroom[];
  groups: Group[];
  careers: Career[];
  onEdit: (event: ScheduleEvent) => void;
  onDelete: (eventId: string) => void;
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

  const colorClasses = 'bg-primary/80 border border-primary text-primary-foreground';

  return (
    <Popover>
      <PopoverTrigger asChild>
        <div
          className={cn(
            'absolute w-[calc(100%-8px)] left-[4px] rounded-lg p-2 text-xs cursor-pointer hover:opacity-90 transition-opacity z-10',
            colorClasses
          )}
          style={{ top: `${topPosition}rem`, height: `${height}rem` }}
        >
          <p className="font-bold truncate">{module?.name ?? 'Evento'}</p>
          <p className="truncate text-xs opacity-80">{teacher?.name}</p>
          <p className="truncate text-xs opacity-80">{classroom?.name}</p>
        </div>
      </PopoverTrigger>
      <PopoverContent>
        <div className="space-y-3 text-sm">
            <h4 className="font-bold font-headline">{module?.name ?? "Evento Desconocido"}</h4>
            {group && <p className="text-xs text-muted-foreground -mt-2 mb-2">{career?.name ?? '...'} / Sem {group.semester} G{group.name}</p>}
            <p><strong>Docente:</strong> {teacher?.name ?? "N/A"}</p>
            <p><strong>Aula:</strong> {classroom?.name ?? "N/A"}</p>
            <p><strong>Horario:</strong> {event.day}, {event.startTime} - {event.endTime}</p>
            <p><strong>Semanas:</strong> {event.startWeek} - {event.endWeek}</p>
        </div>
        <div className="flex justify-end gap-2 pt-4 mt-4 border-t">
            <Button onClick={() => onEdit(event)} variant="ghost" size="icon" className="h-8 w-8">
                <Edit className="h-4 w-4" />
            </Button>
            <AlertDialog>
                <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Esta acción eliminará permanentemente la clase. No se puede deshacer.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => onDelete(event.id)} className="bg-destructive hover:bg-destructive/90">Eliminar</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
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
  onEditEvent: (event: ScheduleEvent) => void;
  onDeleteEvent: (eventId: string) => void;
}

export function ScheduleCalendar({ events, courses, modules, teachers, classrooms, groups, careers, onEditEvent, onDeleteEvent }: ScheduleCalendarProps) {
  return (
    <div className="mt-6 border rounded-xl shadow-sm bg-card">
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
                {TIME_SLOTS.map((time) => (
                    <div key={time} className="h-18 border-t relative">
                        <span className="text-xs text-muted-foreground absolute top-0 right-2 -translate-y-1/2 bg-card px-1">{time}</span>
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
                      onEdit={onEditEvent}
                      onDelete={onDeleteEvent}
                    />
                ))}
            </div>
            ))}
        </div>
      </div>
    </div>
  );
}

const DAYS_OF_WEEK = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const TIME_SLOTS = Array.from({ length: 16 }, (_, i) => `${(i + 7).toString().padStart(2, '0')}:00`); // 7 AM to 10 PM
