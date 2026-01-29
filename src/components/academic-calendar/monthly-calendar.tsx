'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { Course } from '@/lib/types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

type CourseWithDetails = Course & {
    moduleName: string;
    groupInfo: string;
    careerName: string;
};

interface MonthlyCalendarProps {
    courses: CourseWithDetails[];
    year: number;
    month: number;
    selectedDate: Date;
    onDateClick: (date: Date) => void;
}

const DayCell = ({
    date,
    eventsInDay,
    isCurrentMonth,
    isToday,
    isSelected,
    onDateClick
}: {
    date: Date,
    eventsInDay: CourseWithDetails[],
    isCurrentMonth: boolean,
    isToday: boolean,
    isSelected: boolean,
    onDateClick: (date: Date) => void
}) => {
    const day = date.getDate();
    
    const cellClasses = cn(
        "relative flex flex-col min-h-[120px] p-2 cursor-pointer transition-colors duration-150 border-t border-l",
        !isCurrentMonth && "bg-muted/30 text-muted-foreground/50",
        isCurrentMonth && "bg-background hover:bg-muted/70",
        isSelected && isCurrentMonth && "bg-primary text-primary-foreground hover:bg-primary",
        isToday && !isSelected && "border-2 border-accent"
    );

    const dayNumberClasses = cn(
        "font-bold text-sm ml-auto",
        isSelected && isCurrentMonth && "text-primary-foreground",
        isToday && !isSelected && "text-accent-foreground font-extrabold"
    );

    return (
      <div className={cellClasses} onClick={() => onDateClick(date)}>
        <div className="flex justify-between items-start">
            {isToday && (
                <span className="text-[10px] font-bold bg-accent text-accent-foreground px-1.5 py-0.5 rounded-full">HOY</span>
            )}
            <div className={dayNumberClasses}>{day}</div>
        </div>
        {isCurrentMonth && (
             <div className="space-y-1 overflow-hidden flex-1 mt-1">
                {eventsInDay.slice(0, 3).map(event => (
                    <Popover key={event.id}>
                        <PopoverTrigger asChild>
                             <div
                                className={cn(
                                    "text-foreground text-[10px] px-1 py-0.5 rounded-sm truncate cursor-pointer",
                                    isSelected ? "bg-primary-foreground/90 hover:bg-primary-foreground" : "bg-muted hover:bg-muted/80"
                                )}
                                title={`${event.moduleName}`}
                                onClick={(e) => e.stopPropagation()}
                            >
                                {event.moduleName}
                            </div>
                        </PopoverTrigger>
                         <PopoverContent className="w-80" onClick={(e) => e.stopPropagation()}>
                            <div className="space-y-2">
                                <h4 className="font-bold font-headline">{event.moduleName}</h4>
                                <p className="text-sm text-muted-foreground">{event.careerName} / {event.groupInfo}</p>
                                <p className="text-sm"><strong>Inicio:</strong> {format(new Date(event.startDate), "d MMM yyyy", { locale: es })}</p>
                                <p className="text-sm"><strong>Fin:</strong> {format(new Date(event.endDate), "d MMM yyyy", { locale: es })}</p>
                                <p className="text-sm"><strong>Horas Totales:</strong> {event.totalHours}</p>
                            </div>
                        </PopoverContent>
                    </Popover>
                ))}
                {eventsInDay.length > 3 && <div className="text-xs text-muted-foreground mt-1">+{eventsInDay.length - 3} más</div>}
            </div>
        )}
      </div>
    );
};

export function MonthlyCalendar({ courses, year, month, selectedDate, onDateClick }: MonthlyCalendarProps) {
    const calendarGrid = useMemo(() => {
        const firstDayOfMonth = new Date(year, month, 1);
        
        // Start from Sunday of the first week
        const startDate = new Date(firstDayOfMonth);
        startDate.setDate(startDate.getDate() - firstDayOfMonth.getDay()); 

        const days = [];
        for (let i = 0; i < 42; i++) { // 6 weeks * 7 days
            const date = new Date(startDate);
            date.setDate(startDate.getDate() + i);
            date.setHours(0, 0, 0, 0);

            const eventsForDay = courses.filter(event => {
                const eventStartDate = new Date(event.startDate);
                eventStartDate.setHours(0, 0, 0, 0);
                const eventEndDate = new Date(event.endDate);
                eventEndDate.setHours(0, 0, 0, 0);
                return date >= eventStartDate && date <= eventEndDate;
            });
            
            days.push({
                key: date.toISOString(),
                date: date,
                events: eventsForDay,
                isCurrentMonth: date.getMonth() === month,
                isToday: date.toDateString() === new Date().toDateString(),
                isSelected: date.toDateString() === selectedDate.toDateString(),
            });
        }
        return days;
    }, [year, month, courses, selectedDate]);

    const dayHeaders = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

    return (
        <div>
             <div className="grid grid-cols-7 border-y border-r">
                 {dayHeaders.map((day) => (
                    <div key={day} className="p-3 text-center font-semibold text-sm text-muted-foreground border-l">
                        {day}
                    </div>
                ))}
            </div>
            <div className="grid grid-cols-7 grid-rows-6 border-b border-r">
                {calendarGrid.map((dayData) => (
                     <DayCell 
                        key={dayData.key}
                        date={dayData.date} 
                        eventsInDay={dayData.events} 
                        isCurrentMonth={dayData.isCurrentMonth}
                        isToday={dayData.isToday}
                        isSelected={dayData.isSelected}
                        onDateClick={onDateClick}
                    />
                ))}
            </div>
        </div>
    );
}
