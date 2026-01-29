'use client';
import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { Course } from '@/lib/types';
import { format, getDay, isToday as checkIsToday } from 'date-fns';
import { es } from 'date-fns/locale';
import { Button } from '../ui/button';

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
    // A simple hash function to get a color index
    const getColorIndex = (str: string) => {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = str.charCodeAt(i) + ((hash << 5) - hash);
        }
        return Math.abs(hash);
    }
    
    const colors = [
        'bg-blue-500', 'bg-green-500', 'bg-purple-500', 
        'bg-yellow-500', 'bg-indigo-500', 'bg-pink-500', 
        'bg-teal-500', 'bg-orange-500', 'bg-cyan-500', 'bg-lime-500'
    ];
    const colorIndex = getColorIndex(event.moduleId) % colors.length;
    const color = colors[colorIndex];

    return (
        <Popover>
            <PopoverTrigger asChild>
                <div
                className={cn(color, 'text-white text-[10px] px-1 py-0.5 rounded truncate cursor-pointer hover:opacity-80')}
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
    
    const sortedEvents = useMemo(() => {
        return [...eventsInDay].sort((a, b) => a.moduleName.localeCompare(b.moduleName));
    }, [eventsInDay]);

    return (
      <div className={cn(
          "min-h-28 rounded-lg border bg-card p-1.5 flex flex-col relative transition-all duration-150 ease-in-out",
          isOutOfMonth ? "bg-muted/50 cursor-default opacity-50" : "cursor-pointer hover:-translate-y-0.5 hover:shadow-md hover:border-primary/50",
          isToday && "border-2 border-primary shadow-lg"
      )}>
        <div className={cn(
            "text-xs font-bold mb-1 w-6 h-6 flex items-center justify-center rounded-full self-end", 
            isToday ? "bg-primary text-primary-foreground" : "text-foreground"
        )}>
          {day}
        </div>
        {!isOutOfMonth && 
            <div className="space-y-1 overflow-hidden flex-1">
            {sortedEvents.slice(0, 2).map(event => (
                <EventPill key={event.id} event={event} />
            ))}
            {sortedEvents.length > 2 && <div className="text-xs text-muted-foreground mt-1 text-center">+{sortedEvents.length - 2} más</div>}
            </div>
        }
        {isToday && !isOutOfMonth && (
            <div className="absolute top-1.5 left-1.5 text-[9px] font-bold px-2 py-0.5 rounded-full bg-primary/20 text-primary">HOY</div>
        )}
      </div>
    );
};

export function MonthlyCalendar({ courses, year, month, onPrevYear, onNextYear, onPrevMonth, onNextMonth }: MonthlyCalendarProps) {
    const calendarGrid = useMemo(() => {
        const firstDayOfMonth = new Date(year, month, 1);
        const lastDayOfMonth = new Date(year, month + 1, 0);
        
        const daysInMonth = lastDayOfMonth.getDate();
        let startDayOfWeek = getDay(firstDayOfMonth);
        // Adjust startDayOfWeek to be Monday-based (0=Mon, 6=Sun) if needed, but getDay() is Sun-based
        startDayOfWeek = startDayOfWeek === 0 ? 6 : startDayOfWeek -1; // Let's use Monday as start, so Sunday is 6
        // The provided example starts with sunday. So 0 is sunday. Let's stick with that.
        startDayOfWeek = getDay(firstDayOfMonth);
        
        const days = [];
        
        // Days from previous month
        const prevMonthLastDay = new Date(year, month, 0);
        const prevMonthDays = prevMonthLastDay.getDate();
        for (let i = startDayOfWeek - 1; i >= 0; i--) {
            const date = new Date(year, month - 1, prevMonthDays - i);
            days.push({ key: `prev-${i}`, date, events: [], isOutOfMonth: true });
        }
        
        // Days of the current month
        for (let day = 1; day <= daysInMonth; day++) {
            const currentDate = new Date(year, month, day);
            
            const eventsForDay = courses.filter(event => {
                const startDate = new Date(event.startDate);
                const endDate = new Date(event.endDate);
                // Set hours to 0 to compare dates only
                startDate.setHours(0,0,0,0);
                endDate.setHours(0,0,0,0);
                currentDate.setHours(0,0,0,0);
                return currentDate >= startDate && currentDate <= endDate;
            });
            days.push({ key: `current-${day}`, date: currentDate, events: eventsForDay, isOutOfMonth: false });
        }

        // Days from next month
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
            <div className="bg-gradient-to-r from-primary to-accent text-primary-foreground p-4">
                 <div className="grid grid-cols-2 md:grid-cols-[1fr_1fr_auto_1fr_1fr] gap-2 items-center">
                    <Button onClick={onPrevYear} variant="ghost" className="hover:bg-white/20 hover:text-white justify-start md:justify-center">« Año Anterior</Button>
                    <Button onClick={onPrevMonth} variant="ghost" className="hover:bg-white/20 hover:text-white justify-end md:justify-center">‹ Mes Anterior</Button>
                    <div className="col-span-2 md:col-span-1 order-first md:order-none text-center font-bold text-lg capitalize bg-white/20 border border-white/30 rounded-lg py-2">
                        {format(new Date(year, month), 'MMMM, yyyy', { locale: es })}
                    </div>
                    <Button onClick={onNextMonth} variant="ghost" className="hover:bg-white/20 hover:text-white justify-start md:justify-center">Mes Siguiente ›</Button>
                    <Button onClick={onNextYear} variant="ghost" className="hover:bg-white/20 hover:text-white justify-end md:justify-center">Año Siguiente »</Button>
                </div>
            </div>

             <div className="grid grid-cols-7 gap-2 bg-muted/80 p-2">
                {dayHeaders.map((day, index) => (
                    <div key={day} className={cn(
                        "p-2 text-center font-bold text-xs rounded-md text-foreground",
                        (index === 0 || index === 6) && "bg-destructive/10 text-destructive"
                    )}>
                        {day}
                    </div>
                ))}
            </div>
            
            <div className="grid grid-cols-7 gap-2 p-2 bg-muted/30">
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
