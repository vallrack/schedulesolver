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
    onPrevYear: () => void;
    onNextYear: () => void;
    onPrevMonth: () => void;
    onNextMonth: () => void;
}

const EventPill = ({ event }: { event: CourseWithDetails }) => {
    return (
        <Popover>
            <PopoverTrigger asChild>
                <div
                className="bg-background/80 backdrop-blur-sm border border-border/50 text-foreground text-[10px] px-1.5 py-0.5 rounded-sm truncate cursor-pointer hover:bg-background"
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

const DayCell = ({ date, eventsInDay, isOutOfMonth }: { date: Date, eventsInDay: CourseWithDetails[], isOutOfMonth: boolean }) => {
    const day = date.getDate();
    const isToday = checkIsToday(date);
    
    const dayOfWeek = getDay(date); // 0 for Sunday

    const dayBgColors = [
        'hsl(var(--chart-1))', // Sunday (orangy red)
        'hsl(var(--chart-5))', // Monday (orange)
        'hsl(var(--chart-4))', // Tuesday (yellow)
        'hsl(var(--chart-2))', // Wednesday (green)
        'hsl(var(--accent))',  // Thursday (blue)
        'hsl(var(--primary))', // Friday (indigo/purple)
        'hsl(var(--chart-3))'  // Saturday (dark cyan)
    ];
    
    const dayOfWeekColor = dayBgColors[dayOfWeek];

    const sortedEvents = useMemo(() => {
        return [...eventsInDay].sort((a, b) => a.moduleName.localeCompare(b.moduleName));
    }, [eventsInDay]);

    return (
      <div 
        className={cn(
            "min-h-24 rounded-lg p-1 flex flex-col relative transition-all duration-150 ease-in-out aspect-square",
            isOutOfMonth ? "bg-muted/30 cursor-default" : "cursor-pointer hover:-translate-y-0.5 hover:shadow-md",
            isToday && "ring-2 ring-ring ring-offset-2 shadow-lg z-10"
        )}
        style={{ 
            backgroundColor: isOutOfMonth ? undefined : `color-mix(in srgb, ${dayOfWeekColor} 15%, hsl(var(--card)))`
        }}
      >
        <div className={cn(
            "text-sm font-bold mb-1 w-7 h-7 flex items-center justify-center rounded-full self-end", 
            isToday ? "bg-primary text-primary-foreground" : "text-card-foreground/60"
        )}>
          {day}
        </div>
        {!isOutOfMonth && 
            <div className="space-y-1 overflow-hidden flex-1">
            {sortedEvents.slice(0, 3).map(event => (
                <EventPill key={event.id} event={event} />
            ))}
            {sortedEvents.length > 3 && <div className="text-xs text-muted-foreground mt-1 text-center">+{sortedEvents.length - 3} más</div>}
            </div>
        }
      </div>
    );
};

export function MonthlyCalendar({ courses, year, month, onPrevYear, onNextYear, onPrevMonth, onNextMonth }: MonthlyCalendarProps) {
    const calendarGrid = useMemo(() => {
        const firstDayOfMonth = new Date(year, month, 1);
        const lastDayOfMonth = new Date(year, month + 1, 0);
        
        const daysInMonth = lastDayOfMonth.getDate();
        let startDayOfWeek = getDay(firstDayOfMonth);
        
        const days = [];
        
        const prevMonthLastDay = new Date(year, month, 0);
        const prevMonthDays = prevMonthLastDay.getDate();
        for (let i = startDayOfWeek - 1; i >= 0; i--) {
            const date = new Date(year, month - 1, prevMonthDays - i);
            days.push({ key: `prev-${i}`, date, events: [], isOutOfMonth: true });
        }
        
        for (let day = 1; day <= daysInMonth; day++) {
            const currentDate = new Date(year, month, day);
            currentDate.setHours(0,0,0,0);
            
            const eventsForDay = courses.filter(event => {
                const startDate = new Date(event.startDate);
                const endDate = new Date(event.endDate);
                startDate.setHours(0,0,0,0);
                endDate.setHours(0,0,0,0);
                return currentDate >= startDate && currentDate <= endDate;
            });
            days.push({ key: `current-${day}`, date: currentDate, events: eventsForDay, isOutOfMonth: false });
        }

        const totalCells = days.length;
        const remainingCells = (7 - (totalCells % 7)) % 7;
        for (let i = 1; i <= remainingCells; i++) {
             const date = new Date(year, month + 1, i);
             days.push({ key: `next-${i}`, date, events: [], isOutOfMonth: true });
        }

        return days;
    }, [year, month, courses]);

    const dayHeaders = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

    return (
        <div className="bg-card rounded-lg border shadow-sm overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b bg-muted/30">
                <h2 className="text-xl font-bold font-headline capitalize">
                    {format(new Date(year, month), 'MMMM, yyyy', { locale: es })}
                </h2>
                 <div className="flex items-center gap-2">
                    <Button onClick={onPrevMonth} variant="outline" size="icon" className="h-9 w-9"><ChevronLeft className="h-4 w-4" /><span className="sr-only">Mes anterior</span></Button>
                    <Button onClick={onNextMonth} variant="outline" size="icon" className="h-9 w-9"><ChevronRight className="h-4 w-4" /><span className="sr-only">Mes siguiente</span></Button>
                </div>
            </div>

            <div className="grid grid-cols-7 gap-1 p-2">
                {dayHeaders.map((day) => (
                    <div key={day} className="p-2 text-center font-bold text-xs rounded-md text-muted-foreground">
                        {day}
                    </div>
                ))}
            </div>
            
            <div className="grid grid-cols-7 gap-1 p-2">
                {calendarGrid.map(dayData => (
                    <DayCell 
                        key={dayData.key} 
                        date={dayData.date} 
                        eventsInDay={dayData.events} 
                        isOutOfMonth={dayData.isOutOfMonth} 
                    />
                ))}
            </div>
        </div>
    );
}