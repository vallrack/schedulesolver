'use client';
import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { Course } from '@/lib/types';
import { format, getDay, isToday as checkIsToday } from 'date-fns';
import { es } from 'date-fns/locale';
import { Button } from '../ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';

type CourseWithDetails = Course & {
    moduleName: string;
    groupInfo: string;
    careerName: string;
};

interface MonthlyCalendarProps {
    courses: CourseWithDetails[];
    year: number;
    month: number; // 0-11
    onPrevMonth: () => void;
    onNextMonth: () => void;
}

const EventPill = ({ event }: { event: CourseWithDetails }) => {
    return (
        <Popover>
            <PopoverTrigger asChild>
                <div
                className="bg-white/90 text-black text-[10px] px-1.5 py-0.5 rounded-sm truncate cursor-pointer hover:bg-white"
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

const DayCell = ({ date, eventsInDay, isOutOfMonth, isToday }: { date: Date, eventsInDay: CourseWithDetails[], isOutOfMonth: boolean, isToday: boolean }) => {
    const day = date.getDate();
    
    const cellClasses = cn(
        "relative flex flex-col min-h-28 p-2",
        isOutOfMonth ? "bg-muted/30" : "bg-background",
        isToday && "bg-[hsl(var(--chart-2))]"
    );

    const dayNumberClasses = cn(
        "text-sm font-semibold",
        isOutOfMonth ? "text-muted-foreground/60" : "text-foreground/80",
        isToday && "text-white"
    );

    return (
      <div className={cellClasses}>
        <div className={dayNumberClasses}>{day}</div>
        {!isOutOfMonth && (
             <div className="space-y-1 overflow-hidden flex-1 mt-1">
                {eventsInDay.slice(0, 3).map(event => (
                    <EventPill key={event.id} event={event} />
                ))}
                {eventsInDay.length > 3 && <div className="text-xs text-muted-foreground mt-1">+{eventsInDay.length - 3} más</div>}
            </div>
        )}
      </div>
    );
};

export function MonthlyCalendar({ courses, year, month, onPrevMonth, onNextMonth }: MonthlyCalendarProps) {
    const calendarGrid = useMemo(() => {
        const startDate = new Date(year, month, 1);
        
        const startDayOfWeek = startDate.getDay(); // 0 = Sunday
        
        const days = [];

        // Always 42 cells for a 6-week layout
        for (let i = 0; i < 42; i++) {
            const dayOffset = i - startDayOfWeek;
            const date = new Date(year, month, dayOffset + 1);
            date.setHours(0,0,0,0);
            
            const isCurrentMonth = date.getMonth() === month;

            const eventsForDay = isCurrentMonth ? courses.filter(event => {
                const eventStartDate = new Date(event.startDate);
                eventStartDate.setHours(0,0,0,0);
                const eventEndDate = new Date(event.endDate);
                eventEndDate.setHours(0,0,0,0);
                return date >= eventStartDate && date <= eventEndDate;
            }) : [];

            days.push({
                key: date.toISOString(),
                date: date,
                events: eventsForDay,
                isOutOfMonth: !isCurrentMonth,
            });
        }

        return days;
    }, [year, month, courses]);

    const dayHeaders = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

    return (
        <div className="bg-card rounded-lg border shadow-sm">
            <div className="flex items-center justify-between p-3 border-b">
                <div className="flex items-center gap-2">
                    <Button onClick={onPrevMonth} variant="ghost" size="icon" className="h-9 w-9">
                        <ChevronLeft className="h-5 w-5" />
                    </Button>
                    <h2 className="text-lg font-semibold font-headline capitalize text-center w-36">
                        {format(new Date(year, month), 'MMMM yyyy', { locale: es })}
                    </h2>
                    <Button onClick={onNextMonth} variant="ghost" size="icon" className="h-9 w-9">
                        <ChevronRight className="h-5 w-5" />
                    </Button>
                </div>
                 <div className="hidden sm:flex items-center gap-1 bg-muted p-1 rounded-md">
                    <Button variant="default" size="sm" className="h-8 text-xs px-3">Mes</Button>
                    <Button variant="ghost" size="sm" className="h-8 text-xs px-3">Semana</Button>
                    <Button variant="ghost" size="sm" className="h-8 text-xs px-3">Día</Button>
                </div>
            </div>

            <div className="grid grid-cols-7 divide-x border-b">
                 {dayHeaders.map((day) => (
                    <div key={day} className="p-2 text-center font-medium text-xs text-muted-foreground">
                        {day}
                    </div>
                ))}
            </div>
             <div className="grid grid-cols-7 divide-y">
                {calendarGrid.map((dayData, index) => (
                     <div key={dayData.key} className="divide-x grid grid-cols-[repeat(7,1fr)]">
                        <div className={cn(index % 7 === 0 ? '' : 'border-l')}>
                           <DayCell 
                                date={dayData.date} 
                                eventsInDay={dayData.events} 
                                isOutOfMonth={dayData.isOutOfMonth} 
                                isToday={checkIsToday(dayData.date)}
                            />
                        </div>
                     </div>
                ))}
            </div>
        </div>
    );
}
