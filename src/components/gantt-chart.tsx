'use client';

import React from 'react';
import type { ScheduleEvent, Teacher, Course, Classroom } from '@/lib/types';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { cn } from '@/lib/utils';
import { mockTeachers, mockClassrooms } from '@/lib/mock-data';

const WEEKS = Array.from({ length: 20 }, (_, i) => i + 1); // 20 week semester

type ViewMode = 'teacher' | 'group' | 'classroom';

interface GanttChartProps {
    scheduleEvents: ScheduleEvent[];
    viewMode: ViewMode;
    resources: (Teacher | Course | Classroom)[];
    courses: Course[];
}

const getResourceName = (resource: Teacher | Course | Classroom, viewMode: ViewMode) => {
    if (viewMode === 'group') {
        const course = resource as Course;
        return `${course.career} S${course.semester} G${course.group}`;
    }
    return (resource as Teacher | Classroom).name;
};

const getResourceId = (resource: Teacher | Course | Classroom, viewMode: ViewMode) => {
    if(viewMode === 'group') {
        const course = resource as Course;
        return `${course.career}-${course.semester}-${course.group}`;
    }
    return resource.id;
}

const getEventResourceId = (event: ScheduleEvent, viewMode: ViewMode, courses: Course[]) => {
    if(viewMode === 'teacher') return event.teacherId;
    if(viewMode === 'classroom') return event.classroomId;
    if(viewMode === 'group') {
        const course = courses.find(c => c.id === event.courseId);
        if(!course) return 'unknown';
        return `${course.career}-${course.semester}-${course.group}`;
    }
    return 'unknown';
}

const EventPopoverContent = ({ event, course }: { event: ScheduleEvent; course?: Course }) => {
    const teacher = mockTeachers.find(t => t.id === event.teacherId);
    const classroom = mockClassrooms.find(c => c.id === event.classroomId);

    return (
        <div className="p-4 space-y-2 text-sm">
            <h4 className="font-bold font-headline">{course?.name ?? "Unknown Course"}</h4>
            <p><strong>Teacher:</strong> {teacher?.name ?? "N/A"}</p>
            <p><strong>Classroom:</strong> {classroom?.name ?? "N/A"}</p>
            <p><strong>Time:</strong> {event.day}, {event.startTime} - {event.endTime}</p>
            <p><strong>Weeks:</strong> {event.startWeek} - {event.endWeek}</p>
        </div>
    )
}

export function GanttChart({ scheduleEvents, viewMode, resources, courses }: GanttChartProps) {
    const colors = ['bg-accent/30 text-accent-foreground', 'bg-blue-200 text-blue-800', 'bg-green-200 text-green-800', 'bg-purple-200 text-purple-800', 'bg-yellow-200 text-yellow-800', 'bg-indigo-200 text-indigo-800'];

    return (
        <div className="relative mt-4 overflow-x-auto border rounded-lg bg-card">
            <div className="grid" style={{ gridTemplateColumns: '150px repeat(20, minmax(60px, 1fr))' }}>
                {/* Header */}
                <div className="sticky left-0 z-20 p-2 text-sm font-semibold text-center border-b border-r bg-muted">Resource</div>
                {WEEKS.map(week => (
                    <div key={week} className="p-2 text-xs font-semibold text-center border-b border-l bg-muted">{`W${week}`}</div>
                ))}

                {/* Body */}
                {resources.map((resource) => (
                    <React.Fragment key={getResourceId(resource, viewMode)}>
                        <div className="sticky left-0 z-20 p-2 text-sm font-medium text-left border-b border-r bg-muted/50 truncate" title={getResourceName(resource, viewMode)}>
                            {getResourceName(resource, viewMode)}
                        </div>
                        <div className="col-span-20 grid grid-cols-20 relative border-b">
                            {/* This div is the track for events */}
                            {scheduleEvents
                                .filter(event => getEventResourceId(event, viewMode, courses) === getResourceId(resource, viewMode))
                                .map((event, eventIndex) => {
                                    const course = courses.find(c => c.id === event.courseId);
                                    const colorIndex = course ? courses.findIndex(c => c.id === course.id) : eventIndex;
                                    const color = colors[colorIndex % colors.length];
                                    const span = event.endWeek - event.startWeek + 1;

                                    return (
                                        <Popover key={event.id}>
                                            <PopoverTrigger asChild>
                                                <div
                                                    className={cn("absolute top-1 h-[calc(100%-0.5rem)] rounded-md p-1.5 text-xs leading-tight cursor-pointer hover:opacity-80 transition-opacity z-10 flex flex-col justify-center", color)}
                                                    style={{ 
                                                      left: `calc(${(event.startWeek - 1) * 100 / 20}% + 2px)`,
                                                      width: `calc(${span * 100 / 20}% - 4px)`,
                                                    }}
                                                >
                                                    <p className="font-semibold truncate">{course?.name}</p>
                                                    <p className="truncate">{event.day.substring(0,3)} {event.startTime}</p>
                                                </div>
                                            </PopoverTrigger>
                                            <PopoverContent>
                                                <EventPopoverContent event={event} course={course} />
                                            </PopoverContent>
                                        </Popover>
                                    );
                                })}
                             <div className="grid grid-cols-20 col-span-20 min-h-[60px]">
                                {WEEKS.map(week => <div key={week} className="border-l"></div>)}
                            </div>
                        </div>
                    </React.Fragment>
                ))}
            </div>
        </div>
    );
}
