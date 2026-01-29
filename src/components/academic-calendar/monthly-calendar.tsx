'use client';
import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { Course, Module } from '@/lib/types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

type CourseWithDetails = Course & {
    moduleName: string;
    groupInfo: string;
    careerName: string;
};

interface MonthlyCalendarProps {
    courses: CourseWithDetails[];
    modules: Module[];
    year: number;
    month: number; // 0-11
}

const DayCell = ({ date, eventsInDay }: { date: Date, eventsInDay: CourseWithDetails[] }) => {
    const day = date.getDate();
    const today = new Date();
    const isToday = date.toDateString() === today.toDateString();
    
    // Sort events to have a consistent order
    const sortedEvents = useMemo(() => {
        return [...eventsInDay].sort((a, b) => a.moduleName.localeCompare(b.moduleName));
    }, [eventsInDay]);

    return (
      <div className={cn("min-h-28 border-t border-l p-1.5 flex flex-col", isToday && "bg-accent/20")}>
        <div className={cn(
            "text-xs font-semibold mb-1 w-6 h-6 flex items-center justify-center rounded-full", 
            isToday ? "bg-primary text-primary-foreground" : "text-muted-foreground"
        )}>
          {day}
        </div>
        <div className="space-y-1 overflow-hidden">
          {sortedEvents.map(event => (
            <EventPill key={event.id} event={event} />
          ))}
        </div>
      </div>
    );
};

const EventPill = ({ event }: { event: CourseWithDetails }) => {
    const colors = ['bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-yellow-500', 'bg-indigo-500', 'bg-pink-500', 'bg-teal-500', 'bg-orange-500'];
    const colorIndex = event.moduleId.charCodeAt(0) % colors.length;
    const color = colors[colorIndex];

    return (
        <Popover>
            <PopoverTrigger asChild>
                <div
                className={cn(color, 'text-white text-xs p-1 rounded truncate cursor-pointer hover:opacity-80')}
                title={`${event.moduleName} - ${event.careerName}`}
                >
                {event.moduleName}
                </div>
            </PopoverTrigger>
            <PopoverContent className="w-80">
                <div className="space-y-2">
                    <h4 className="font-bold font-headline">{event.moduleName}</h4>
                    <p className="text-sm text-muted-foreground">{event.careerName} / {event.groupInfo}</p>
                    <p className="text-sm"><strong>Inicio:</strong> {format(new Date(event.startDate), "d MMM yyyy", { locale: es })}</p>
                    <p className="text-sm"><strong>Fin:</strong> {format(new Date(event.endDate), "d MMM yyyy", { locale: es })}</p>
                    <p className="text-sm"><strong>Horas Totales:</strong> {event.totalHours}</p>
                </div>
            </PopoverContent>
        </Popover>
    );
};

export function MonthlyCalendar({ courses, modules, year, month }: MonthlyCalendarProps) {
    const calendarGrid = useMemo(() => {
        const firstDayOfMonth = new Date(year, month, 1);
        const lastDayOfMonth = new Date(year, month + 1, 0);
        const daysInMonth = lastDayOfMonth.getDate();
        // Sunday - 0, Monday - 1, etc.
        const startDayOfWeek = firstDayOfMonth.getDay(); 
        
        const days = [];
        
        // Blank days before the start of the month
        for (let i = 0; i < startDayOfWeek; i++) {
            days.push(<div key={`blank-start-${i}`} className="border-t border-l bg-muted/50"></div>);
        }
        
        // Days of the month
        for (let day = 1; day <= daysInMonth; day++) {
            const currentDate = new Date(year, month, day);
            const eventsForDay = courses.filter(event => {
                const startDate = new Date(event.startDate);
                startDate.setHours(0, 0, 0, 0);
                const endDate = new Date(event.endDate);
                endDate.setHours(23, 59, 59, 999);
                return currentDate >= startDate && currentDate <= endDate;
            });
            days.push(<DayCell key={day} date={currentDate} eventsInDay={eventsForDay} />);
        }

        // Blank days after the end of the month to fill the grid
        const totalCells = startDayOfWeek + daysInMonth;
        const remainingCells = (7 - (totalCells % 7)) % 7;
        for (let i = 0; i < remainingCells; i++) {
             days.push(<div key={`blank-end-${i}`} className="border-t border-l bg-muted/50"></div>);
        }

        return days;
    }, [year, month, courses, modules]);

    const dayHeaders = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

    return (
        <div className="border-r border-b">
            <div className="grid grid-cols-7">
                {dayHeaders.map(day => (
                    <div key={day} className="p-2 text-center font-semibold text-sm border-t border-l">
                        {day}
                    </div>
                ))}
            </div>
            <div className="grid grid-cols-7">
                {calendarGrid}
            </div>
        </div>
    );
}
