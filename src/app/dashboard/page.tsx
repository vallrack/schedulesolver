'use client';
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, Plus, Edit, Trash2, User, Clock, School, Download } from 'lucide-react';
import AppLayout from '@/components/app-layout';
import { useFirestore } from '@/firebase';
import { useCollection } from '@/firebase/firestore/use-collection';
import { collection, deleteDoc, doc } from 'firebase/firestore';
import type { Career, Course, Group, Module, Teacher, Classroom, ScheduleEvent } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { CourseForm } from '@/components/courses/course-form';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScheduleCalendar } from '@/components/dashboard/schedule-calendar';
import { ManualScheduleForm } from '@/components/dashboard/manual-schedule-form';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import * as XLSX from 'xlsx';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';


type ReportToPrint = {
    title: string;
    headers: string[];
    data: Record<string, any>[];
    fileName: string;
} | null;

const PrintableReport = React.forwardRef<HTMLDivElement, { report: NonNullable<ReportToPrint> }>(({ report }, ref) => (
    <div ref={ref} className="p-8">
        <h1 className="text-2xl font-bold mb-4">{report.title}</h1>
        <Table>
            <TableHeader>
                <TableRow>
                    {report.headers.map(header => <TableHead key={header}>{header}</TableHead>)}
                </TableRow>
            </TableHeader>
            <TableBody>
                {report.data.map((row, rowIndex) => (
                    <TableRow key={rowIndex}>
                        {report.headers.map(header => (
                            <TableCell key={header}>{row[header]}</TableCell>
                        ))}
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    </div>
));
PrintableReport.displayName = 'PrintableReport';


type CourseWithDetails = Course & {
    moduleName: string;
    groupInfo: string;
    careerName: string;
    teacherName?: string;
};

const toISODateString = (date: Date) => {
    const offset = date.getTimezoneOffset();
    const adjustedDate = new Date(date.getTime() - (offset*60*1000));
    return adjustedDate.toISOString().split('T')[0];
}

export default function DashboardPage() {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [currentView, setCurrentView] = useState('month');
    const [showCourseModal, setShowCourseModal] = useState(false);
    const [editingCourse, setEditingCourse] = useState<Course | null>(null);
    const [showScheduleModal, setShowScheduleModal] = useState(false);
    const [editingScheduleEvent, setEditingScheduleEvent] = useState<ScheduleEvent | undefined>(undefined);
    const [courseToSchedule, setCourseToSchedule] = useState<CourseWithDetails | null>(null);
    
    const [activeWeekTab, setActiveWeekTab] = useState('teacher');
    const [selectedTeacher, setSelectedTeacher] = useState<string | undefined>(undefined);
    const [selectedGroup, setSelectedGroup] = useState<string | undefined>(undefined);
    const [selectedClassroom, setSelectedClassroom] = useState<string | undefined>(undefined);

    const [exportDialogOpen, setExportDialogOpen] = useState(false);
    const [reportToPrint, setReportToPrint] = useState<ReportToPrint>(null);

    const { toast } = useToast();
    const firestore = useFirestore();

    // Data fetching
    const { data: courses, loading: loadingCourses } = useCollection<Course>(useMemo(() => firestore ? collection(firestore, 'courses') : null, [firestore]));
    const { data: modules, loading: loadingModules } = useCollection<Module>(useMemo(() => firestore ? collection(firestore, 'modules') : null, [firestore]));
    const { data: groups, loading: loadingGroups } = useCollection<Group>(useMemo(() => firestore ? collection(firestore, 'groups') : null, [firestore]));
    const { data: careers, loading: loadingCareers } = useCollection<Career>(useMemo(() => firestore ? collection(firestore, 'careers') : null, [firestore]));
    const { data: teachers, loading: loadingTeachers } = useCollection<Teacher>(useMemo(() => firestore ? collection(firestore, 'teachers') : null, [firestore]));
    const { data: classrooms, loading: loadingClassrooms } = useCollection<Classroom>(useMemo(() => firestore ? collection(firestore, 'classrooms') : null, [firestore]));
    const { data: scheduleEvents, loading: loadingSchedules } = useCollection<ScheduleEvent>(useMemo(() => firestore ? collection(firestore, 'schedules') : null, [firestore]));

    const allDataLoaded = !loadingCourses && !loadingModules && !loadingGroups && !loadingCareers && !loadingTeachers && !loadingClassrooms && !loadingSchedules;

    useEffect(() => {
        if (reportToPrint) {
            const timeoutId = setTimeout(() => {
                window.print();
                setReportToPrint(null);
            }, 100);
            return () => clearTimeout(timeoutId);
        }
    }, [reportToPrint]);


    const coursesWithDetails: CourseWithDetails[] = useMemo(() => {
        if (!allDataLoaded) return [];
        return courses!.map(course => {
            const module = modules!.find(m => m.id === course.moduleId);
            const group = groups!.find(g => g.id === course.groupId);
            if (!group || !module) return null;
            const career = careers!.find(c => c.id === group.careerId);
            
            const eventForCourse = scheduleEvents!.find(e => e.courseId === course.id);
            const teacher = eventForCourse ? teachers!.find(t => t.id === eventForCourse.teacherId) : undefined;

            return {
                ...course,
                moduleName: module.name,
                groupInfo: `Sem ${group.semester} - G ${group.name}`,
                careerName: career?.name || 'Carrera Desconocida',
                teacherName: teacher?.name,
            }
        }).filter((c): c is CourseWithDetails => c !== null);
    }, [allDataLoaded, courses, modules, groups, careers, scheduleEvents, teachers]);
    
    const groupOptions = useMemo(() => {
        if (!groups || !careers) return [];
        return groups.map(group => {
            const career = careers.find(c => c.id === group.careerId);
            return { id: group.id, name: `${career?.name || '...'} - Sem ${group.semester} - G ${group.name}` };
        }).sort((a, b) => a.name.localeCompare(b.name));
    }, [groups, careers]);

    useEffect(() => {
        if (currentView === 'week' && allDataLoaded) {
            if (teachers && teachers.length > 0 && !selectedTeacher) setSelectedTeacher(teachers.sort((a,b) => a.name.localeCompare(b.name))[0].id);
            if (groupOptions.length > 0 && !selectedGroup) setSelectedGroup(groupOptions[0].id);
            if (classrooms && classrooms.length > 0 && !selectedClassroom) setSelectedClassroom(classrooms.sort((a,b) => a.name.localeCompare(b.name))[0].id);
        }
    }, [currentView, allDataLoaded, teachers, groupOptions, classrooms, selectedTeacher, selectedGroup, selectedClassroom]);


    const navigateMonth = (direction: number) => {
        setCurrentDate(current => {
            const newDate = new Date(current);
            newDate.setDate(1); 
            newDate.setMonth(newDate.getMonth() + direction);
            return newDate;
        });
    };
    
    const getCoursesForDate = (date: Date) => {
        const checkDateStr = toISODateString(date);
        return coursesWithDetails.filter(course => {
            const startDateStr = course.startDate.split('T')[0];
            const endDateStr = course.endDate.split('T')[0];
            return checkDateStr >= startDateStr && checkDateStr <= endDateStr;
        });
    };

    const openCourseModal = (course: Course | null = null) => {
        setEditingCourse(course);
        setShowCourseModal(true);
    };

    const closeCourseModal = () => {
        setShowCourseModal(false);
        setEditingCourse(null);
    };
    
    const handleEditScheduleEvent = (event: ScheduleEvent) => {
        setEditingScheduleEvent(event);
        setShowScheduleModal(true);
    };
    
    const handleDeleteScheduleEvent = async (eventId: string) => {
        if (!firestore) return;
        const eventRef = doc(firestore, 'schedules', eventId);
        try {
            await deleteDoc(eventRef);
            toast({
                variant: 'destructive',
                title: 'Clase Eliminada',
                description: 'La clase ha sido eliminada del horario.',
            });
        } catch (e) {
            const permissionError = new FirestorePermissionError({
                path: eventRef.path,
                operation: 'delete',
            });
            errorEmitter.emit('permission-error', permissionError);
        }
    };
    
    const closeScheduleModal = () => {
        setShowScheduleModal(false);
        setEditingScheduleEvent(undefined);
        setCourseToSchedule(null);
    };
    
    const handleAssignTeacher = (course: CourseWithDetails) => {
        setCourseToSchedule(course);
        setEditingScheduleEvent(undefined);
        setShowScheduleModal(true);
    };


    const handleDeleteCourse = async (courseId: string) => {
        if (!firestore) return;
        const courseRef = doc(firestore, 'courses', courseId);
        try {
            await deleteDoc(courseRef);
            toast({
                variant: 'destructive',
                title: 'Curso Eliminado',
                description: 'El curso programado ha sido eliminado.',
            });
            closeCourseModal();
        } catch(e) {
            const permissionError = new FirestorePermissionError({ path: courseRef.path, operation: 'delete' });
            errorEmitter.emit('permission-error', permissionError);
        }
    };
    
    const MonthView = () => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const firstDayOfMonth = new Date(year, month, 1);
        const startDate = new Date(firstDayOfMonth);
        startDate.setDate(startDate.getDate() - startDate.getDay());
    
        const days = Array.from({ length: 42 }, (_, i) => {
            const date = new Date(startDate);
            date.setDate(startDate.getDate() + i);
            return date;
        });
    
        const dayOfWeekMap = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    
        return (
            <div className="border rounded-lg overflow-hidden bg-white">
                <div className="grid grid-cols-7 bg-gray-50">
                    {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map(day => (
                        <div key={day} className="py-3 text-center font-semibold text-sm text-gray-500 border-b border-l">{day}</div>
                    ))}
                </div>
                <div className="grid grid-cols-7 grid-rows-6">
                    {days.map((date, idx) => {
                        const dayCourses = getCoursesForDate(date);
                        const isOtherMonth = date.getMonth() !== month;
                        const isTodayDate = date.toDateString() === new Date().toDateString();
                        const dayOfWeek = dayOfWeekMap[date.getDay()];
                        
                        const scheduledCoursesForDay = dayCourses.map(course => {
                            const scheduleEvent = scheduleEvents?.find(e => e.courseId === course.id && e.day === dayOfWeek);
                            if (!scheduleEvent) return null;
                            
                            const teacher = teachers?.find(t => t.id === scheduleEvent.teacherId);
                            const classroom = classrooms?.find(c => c.id === scheduleEvent.classroomId);

                            return {
                                ...course,
                                scheduleEvent,
                                teacher,
                                classroom
                            }
                        }).filter((c): c is NonNullable<typeof c> => c !== null);


                        return (
                            <div
                                key={idx}
                                onClick={() => setSelectedDate(date)}
                                className={cn(`relative aspect-square p-2 cursor-pointer transition-colors duration-150 border-t border-l`,
                                    isOtherMonth ? 'bg-gray-50 text-gray-400' : 'bg-white hover:bg-gray-100'
                                )}
                            >
                                <div className={cn('font-semibold text-right mb-1', isTodayDate ? 'text-primary' : '')}>{date.getDate()}</div>
                                {isTodayDate && <div className="absolute top-2 right-2 text-xs font-bold text-primary opacity-75">HOY</div>}
                                <div className="space-y-1">
                                    {scheduledCoursesForDay.slice(0, 2).map(course => (
                                        <Popover key={course.id}>
                                            <PopoverTrigger asChild>
                                                <div
                                                    className="text-xs px-1.5 py-0.5 rounded truncate text-white font-medium cursor-pointer bg-primary/80"
                                                    title={course.moduleName}
                                                    onClick={(e) => e.stopPropagation()} // Prevent day selection
                                                >
                                                    {course.moduleName}
                                                </div>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-72" onClick={(e) => e.stopPropagation()}>
                                                <div className="grid gap-4">
                                                    <div className="space-y-1">
                                                        <div className="flex justify-between items-start">
                                                            <div>
                                                                <h4 className="font-medium leading-none">{course.moduleName}</h4>
                                                                <p className="text-sm text-muted-foreground">
                                                                    {course.careerName} / {course.groupInfo}
                                                                </p>
                                                            </div>
                                                            <div className="flex items-center -mt-1 -mr-2">
                                                                <Button onClick={() => handleEditScheduleEvent(course.scheduleEvent)} variant="ghost" size="icon" className="h-8 w-8">
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
                                                                            <AlertDialogAction onClick={() => handleDeleteScheduleEvent(course.scheduleEvent.id)} className="bg-destructive hover:bg-destructive/90">Eliminar</AlertDialogAction>
                                                                        </AlertDialogFooter>
                                                                    </AlertDialogContent>
                                                                </AlertDialog>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="grid gap-2 text-sm">
                                                        <div className="flex items-center gap-2">
                                                            <Clock className="h-4 w-4 text-muted-foreground" />
                                                            <span>{course.scheduleEvent.startTime} - {course.scheduleEvent.endTime}</span>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <User className="h-4 w-4 text-muted-foreground" />
                                                            <span>{course.teacher?.name || 'No asignado'}</span>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <School className="h-4 w-4 text-muted-foreground" />
                                                            <span>{course.classroom?.name || 'No asignada'}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </PopoverContent>
                                        </Popover>
                                    ))}
                                    {scheduledCoursesForDay.length > 2 && (
                                        <div className="text-xs text-gray-500 font-bold">+ {scheduledCoursesForDay.length - 2} más</div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };
    
    const WeekView = () => {
        const teacherEvents = useMemo(() => scheduleEvents?.filter(e => e.teacherId === selectedTeacher) || [], [scheduleEvents, selectedTeacher]);
        const groupEvents = useMemo(() => {
            if (!selectedGroup || !courses) return [];
            const groupCourseIds = courses.filter(c => c.groupId === selectedGroup).map(c => c.id);
            return scheduleEvents?.filter(e => groupCourseIds.includes(e.courseId)) || [];
        }, [scheduleEvents, selectedGroup, courses]);
        const classroomEvents = useMemo(() => scheduleEvents?.filter(e => e.classroomId === selectedClassroom) || [], [scheduleEvents, selectedClassroom]);

        if (!allDataLoaded) return <div className="flex justify-center items-center h-96"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>;

        return (
             <Tabs defaultValue="teacher" className="w-full" onValueChange={setActiveWeekTab}>
                <TabsList className="no-print">
                    <TabsTrigger value="teacher">Por Docente</TabsTrigger>
                    <TabsTrigger value="group">Por Grupo</TabsTrigger>
                    <TabsTrigger value="classroom">Por Aula</TabsTrigger>
                </TabsList>
                
                <TabsContent value="teacher" className="mt-4">
                   <div className="max-w-sm no-print"><Select onValueChange={setSelectedTeacher} value={selectedTeacher}><SelectTrigger><SelectValue placeholder="Selecciona un docente..." /></SelectTrigger><SelectContent>{teachers?.sort((a,b) => a.name.localeCompare(b.name)).map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent></Select></div>
                   {selectedTeacher && <ScheduleCalendar events={teacherEvents} courses={courses || []} modules={modules || []} teachers={teachers || []} classrooms={classrooms || []} groups={groups || []} careers={careers || []} onEditEvent={handleEditScheduleEvent} onDeleteEvent={handleDeleteScheduleEvent} />}
                </TabsContent>
                <TabsContent value="group" className="mt-4">
                   <div className="max-w-sm no-print"><Select onValueChange={setSelectedGroup} value={selectedGroup}><SelectTrigger><SelectValue placeholder="Selecciona un grupo..." /></SelectTrigger><SelectContent>{groupOptions?.map(g => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}</SelectContent></Select></div>
                   {selectedGroup && <ScheduleCalendar events={groupEvents} courses={courses || []} modules={modules || []} teachers={teachers || []} classrooms={classrooms || []} groups={groups || []} careers={careers || []} onEditEvent={handleEditScheduleEvent} onDeleteEvent={handleDeleteScheduleEvent} />}
                </TabsContent>
                <TabsContent value="classroom" className="mt-4">
                  <div className="max-w-sm no-print"><Select onValueChange={setSelectedClassroom} value={selectedClassroom}><SelectTrigger><SelectValue placeholder="Selecciona un aula..." /></SelectTrigger><SelectContent>{classrooms?.sort((a, b) => a.name.localeCompare(b.name)).map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select></div>
                   {selectedClassroom && <ScheduleCalendar events={classroomEvents} courses={courses || []} modules={modules || []} teachers={teachers || []} classrooms={classrooms || []} groups={groups || []} careers={careers || []} onEditEvent={handleEditScheduleEvent} onDeleteEvent={handleDeleteScheduleEvent} />}
                </TabsContent>
            </Tabs>
        )
    };

    const DayView = () => {
        const dayOfWeekMap = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
        const dayOfWeek = dayOfWeekMap[selectedDate.getDay()];
    
        const eventsForDay = useMemo(() => {
            if (!allDataLoaded) return [];
            
            const selectedDateStr = toISODateString(selectedDate);
    
            return scheduleEvents!
                .filter(event => {
                    if (event.day !== dayOfWeek) return false;
                    
                    const course = courses!.find(c => c.id === event.courseId);
                    if (!course) return false;
                    
                    const courseStartDateStr = course.startDate.split('T')[0];
                    const courseEndDateStr = course.endDate.split('T')[0];
                    
                    return selectedDateStr >= courseStartDateStr && selectedDateStr <= courseEndDateStr;
                })
                .map(event => {
                    const course = courses!.find(c => c.id === event.courseId)!;
                    const module = modules!.find(m => m.id === course.moduleId)!;
                    const teacher = teachers!.find(t => t.id === event.teacherId)!;
                    const classroom = classrooms!.find(c => c.id === event.classroomId)!;
                    const group = groups!.find(g => g.id === course.groupId)!;
                    const career = careers!.find(c => c.id === group.careerId)!;
    
                    return {
                        ...event,
                        moduleName: module.name,
                        teacherName: teacher.name,
                        classroomName: classroom.name,
                        groupInfo: `${career.name} - Sem ${group.semester} - G ${group.name}`
                    };
                })
                .sort((a, b) => a.startTime.localeCompare(b.startTime));
    
        }, [selectedDate, allDataLoaded, scheduleEvents, courses, modules, teachers, classrooms, groups, careers]);
        
        return (
            <div>
                <h2 className="text-2xl font-bold mb-4 capitalize">
                    {selectedDate.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
                </h2>
                {eventsForDay.length === 0 ? (
                    <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg">
                        <p className="text-gray-500">No hay clases programadas para este día.</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {eventsForDay.map(event => (
                            <Card key={event.id} className="transition-all hover:shadow-md">
                                <CardContent className="p-4 flex items-center gap-4">
                                    <div className="text-center w-24 flex-shrink-0 border-r pr-4">
                                        <p className="text-lg font-bold text-primary">{event.startTime}</p>
                                        <p className="text-sm text-muted-foreground">a</p>
                                        <p className="text-lg font-bold text-primary">{event.endTime}</p>
                                    </div>
                                    <div className="flex-grow grid grid-cols-1 md:grid-cols-3 gap-x-4 gap-y-2 text-sm">
                                        <div className="col-span-1 md:col-span-3">
                                            <p className="font-bold text-base">{event.moduleName}</p>
                                            <p className="text-muted-foreground">{event.groupInfo}</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <User className="h-4 w-4 text-muted-foreground" />
                                            <span>{event.teacherName}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <School className="h-4 w-4 text-muted-foreground" />
                                            <span>{event.classroomName}</span>
                                        </div>
                                    </div>
                                    <div className="flex flex-col gap-1 ml-auto">
                                        <Button onClick={() => handleEditScheduleEvent(event)} variant="outline" size="icon" className="h-8 w-8">
                                            <Edit className="h-4 w-4" />
                                        </Button>
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button variant="outline" size="icon" className="h-8 w-8 text-destructive hover:text-destructive hover:border-destructive/50">
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
                                                    <AlertDialogAction onClick={() => handleDeleteScheduleEvent(event.id)} className="bg-destructive hover:bg-destructive/90">Eliminar</AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </div>
        )
    };

    return (
        <AppLayout>
            {reportToPrint ? (
                <div className="print-only">
                    <PrintableReport report={reportToPrint} />
                </div>
            ) : (
                <div className="no-print">
                    <Card className="shadow-lg">
                        <CardContent className="p-6">
                            <div className="flex justify-between items-center mb-6 pb-4 border-b">
                                <div className="flex items-center gap-2">
                                    <Button onClick={() => navigateMonth(-1)} variant="outline" size="icon" className="h-9 w-9">
                                        <ChevronLeft className="w-5 h-5" />
                                    </Button>
                                    <h1 className="text-xl font-bold text-gray-800 w-48 text-center capitalize">
                                        {currentDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}
                                    </h1>
                                    <Button onClick={() => navigateMonth(1)} variant="outline" size="icon" className="h-9 w-9">
                                        <ChevronRight className="w-5 h-5" />
                                    </Button>
                                </div>

                                <div className="flex items-center gap-4">
                                    <Button variant="outline" size="sm" onClick={() => setExportDialogOpen(true)} disabled={!allDataLoaded}>
                                        <Download className="mr-2 h-4 w-4" />
                                        Exportar
                                    </Button>
                                    <div className="flex gap-1 bg-muted p-1 rounded-md">
                                        {['month', 'week', 'day'].map(view => (
                                            <Button
                                                key={view}
                                                onClick={() => setCurrentView(view)}
                                                size="sm"
                                                variant={currentView === view ? 'default' : 'ghost'}
                                                className="capitalize h-8 text-xs px-3"
                                            >
                                                {view === 'month' ? 'Mes' : view === 'week' ? 'Semana' : 'Día'}
                                            </Button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                            
                            <div className="printable-area">
                                <div className="mb-8">
                                    {currentView === 'month' && <MonthView />}
                                    {currentView === 'week' && <WeekView />}
                                    {currentView === 'day' && <DayView />}
                                </div>
                            </div>

                            {currentView === 'month' && (
                                <div className="bg-white rounded-lg">
                                    <div className="flex justify-between items-center mb-4 pb-4 border-b">
                                        <h3 className="text-lg font-semibold text-gray-800">
                                            Cursos para el {selectedDate.toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })}
                                        </h3>
                                        <Button onClick={() => openCourseModal()} size="sm">
                                            <Plus className="w-4 h-4 mr-2" />
                                            Programar Curso
                                        </Button>
                                    </div>

                                    <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
                                        {getCoursesForDate(selectedDate).length > 0 ? getCoursesForDate(selectedDate).map(course => (
                                            <div key={course.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-all">
                                                <div className="w-2 h-12 rounded-full flex-shrink-0 bg-primary mt-1" />
                                                <div className="flex-1">
                                                    <div className="font-semibold text-gray-800">{course.moduleName}</div>
                                                    <div className="text-sm text-gray-600">{course.careerName} / {course.groupInfo}</div>
                                                    <div className="flex items-center gap-2 mt-1 pt-1">
                                                        <User className="w-4 h-4 text-muted-foreground" />
                                                        {course.teacherName ? (
                                                            <span className="text-sm text-muted-foreground font-medium">{course.teacherName}</span>
                                                        ) : (
                                                            <Button variant="link" size="sm" className="p-0 h-auto text-xs" onClick={() => handleAssignTeacher(course)}>
                                                                Asignar Docente
                                                            </Button>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="flex gap-2">
                                                    <Button onClick={() => openCourseModal(course)} variant="ghost" size="icon" className="w-8 h-8 text-blue-600 hover:text-blue-700">
                                                        <Edit className="w-4 h-4" />
                                                    </Button>
                                                    <AlertDialog>
                                                        <AlertDialogTrigger asChild>
                                                            <Button variant="ghost" size="icon" className="w-8 h-8 text-red-600 hover:text-red-700"><Trash2 className="w-4 h-4" /></Button>
                                                        </AlertDialogTrigger>
                                                        <AlertDialogContent>
                                                            <AlertDialogHeader>
                                                                <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                                                                <AlertDialogDescription>Esta acción eliminará permanentemente el curso. No se puede deshacer.</AlertDialogDescription>
                                                            </AlertDialogHeader>
                                                            <AlertDialogFooter>
                                                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                                <AlertDialogAction onClick={() => handleDeleteCourse(course.id)} className="bg-destructive hover:bg-destructive/90">Eliminar</AlertDialogAction>
                                                            </AlertDialogFooter>
                                                        </AlertDialogContent>
                                                    </AlertDialog>
                                                </div>
                                            </div>
                                        )) : (
                                            <p className="text-center text-gray-500 py-4">No hay cursos programados para este día.</p>
                                        )}
                                    </div>
                                </div>
                            )}
                            
                            <Dialog open={showCourseModal} onOpenChange={closeCourseModal}>
                                <DialogContent className="sm:max-w-xl">
                                    <DialogHeader>
                                        <DialogTitle>{editingCourse ? 'Editar Curso' : 'Programar Nuevo Curso'}</DialogTitle>
                                        <DialogDescription>
                                            {editingCourse ? 'Actualiza los detalles del curso.' : `Programa un nuevo curso que inicia cerca de la fecha seleccionada: ${selectedDate.toLocaleDateString('es-ES')}`}
                                        </DialogDescription>
                                    </DialogHeader>
                                    <CourseForm 
                                        key={editingCourse?.id || 'new-course'}
                                        course={editingCourse || undefined}
                                        allCourses={courses || []}
                                        modules={modules || []}
                                        groups={groups || []}
                                        careers={careers || []}
                                        onSuccess={closeCourseModal}
                                        teachers={teachers || []}
                                        scheduleEvents={scheduleEvents || []}
                                    />
                                </DialogContent>
                            </Dialog>

                            <Dialog open={showScheduleModal} onOpenChange={closeScheduleModal}>
                                <DialogContent className="sm:max-w-lg">
                                    <DialogHeader>
                                        <DialogTitle>{editingScheduleEvent ? "Editar Clase" : "Asignar Horario a Curso"}</DialogTitle>
                                        <DialogDescription>
                                        {editingScheduleEvent ? "Modifica los detalles de la clase." : (courseToSchedule ? `Asignando horario para: ${courseToSchedule.moduleName}`: "Añade una clase al horario. El sistema verificará conflictos.")}
                                        </DialogDescription>
                                    </DialogHeader>
                                    <ManualScheduleForm 
                                        key={editingScheduleEvent?.id || courseToSchedule?.id || 'new-schedule-event'}
                                        courses={courses || []}
                                        modules={modules || []}
                                        groups={groups || []}
                                        careers={careers || []}
                                        teachers={teachers || []}
                                        classrooms={classrooms || []}
                                        scheduleEvents={scheduleEvents || []}
                                        eventToEdit={editingScheduleEvent}
                                        courseToSchedule={courseToSchedule || undefined}
                                        onSuccess={closeScheduleModal}
                                    />
                                </DialogContent>
                            </Dialog>

                             <ExportDialog 
                                open={exportDialogOpen}
                                onOpenChange={setExportDialogOpen}
                                onPrintRequest={setReportToPrint}
                                data={{
                                    courses: courses || [],
                                    modules: modules || [],
                                    groups: groups || [],
                                    careers: careers || [],
                                    teachers: teachers || [],
                                    classrooms: classrooms || [],
                                    scheduleEvents: scheduleEvents || [],
                                    currentDate: currentDate,
                                }}
                            />
                        </CardContent>
                    </Card>
                </div>
            )}
        </AppLayout>
    );
}


type ExportDialogProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onPrintRequest: (report: NonNullable<ReportToPrint>) => void;
    data: {
        courses: Course[];
        modules: Module[];
        groups: Group[];
        careers: Career[];
        teachers: Teacher[];
        classrooms: Classroom[];
        scheduleEvents: ScheduleEvent[];
        currentDate: Date;
    }
}

type ReportType = 'teacher' | 'group' | 'career' | 'module' | 'classroom' | 'month';

function ExportDialog({ open, onOpenChange, onPrintRequest, data }: ExportDialogProps) {
    const { toast } = useToast();
    const [reportType, setReportType] = useState<ReportType | undefined>();
    const [selectedId, setSelectedId] = useState<string | undefined>();
    const [isExporting, setIsExporting] = useState(false);

    const { courses, modules, groups, careers, teachers, classrooms, scheduleEvents, currentDate } = data;

    const teacherOptions = useMemo(() => teachers.sort((a, b) => a.name.localeCompare(b.name)), [teachers]);
    const groupOptions = useMemo(() => groups.map(group => {
            const career = careers.find(c => c.id === group.careerId);
            return { id: group.id, name: `${career?.name || '...'} - Sem ${group.semester} - G ${group.name}` };
        }).sort((a, b) => a.name.localeCompare(b.name)), [groups, careers]);
    const careerOptions = useMemo(() => careers.sort((a, b) => a.name.localeCompare(b.name)), [careers]);
    const moduleOptions = useMemo(() => modules.sort((a, b) => a.name.localeCompare(b.name)), [modules]);
    const classroomOptions = useMemo(() => classrooms.sort((a, b) => a.name.localeCompare(b.name)), [classrooms]);

    useEffect(() => {
        setSelectedId(undefined);
    }, [reportType]);

    const generateReport = (): NonNullable<ReportToPrint> | null => {
        if (!reportType || (reportType !== 'month' && !selectedId)) {
            toast({ variant: 'destructive', title: 'Selección Incompleta', description: 'Por favor, selecciona un tipo de reporte y un ítem.' });
            return null;
        }

        const reportHeaders = ['Fecha', 'Día', 'Hora Inicio', 'Hora Fin', 'Módulo', 'Docente', 'Grupo', 'Aula'];
        let reportData: Record<string, any>[] = [];
        let reportTitle = '';
        let fileName = 'horario.xlsx';

        const dayOfWeekMap = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
        const daysOrder = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];


        const processEvents = (events: ScheduleEvent[], isMonthly = false) => {
            let processedData: Record<string, any>[] = [];

            events.forEach(event => {
                const course = courses.find(c => c.id === event.courseId);
                if (!course) return;

                const module = modules.find(m => m.id === course.moduleId);
                const teacher = teachers.find(t => t.id === event.teacherId);
                const classroom = classrooms.find(c => c.id === event.classroomId);
                const group = groups.find(g => g.id === course.groupId);
                const career = careers.find(c => c.id === group?.careerId);
                const groupName = group ? `${career?.name || ''} - Sem ${group.semester} - G ${group.name}` : '';

                if (isMonthly) {
                     const year = currentDate.getFullYear();
                     const month = currentDate.getMonth();
                     const firstDayOfMonth = new Date(year, month, 1);
                     const lastDayOfMonth = new Date(year, month + 1, 0);
                     const eventDayIndex = dayOfWeekMap.indexOf(event.day);
                     const courseStartDate = new Date(course.startDate);
                     const courseEndDate = new Date(course.endDate);

                     for (let day = new Date(firstDayOfMonth); day <= lastDayOfMonth; day.setDate(day.getDate() + 1)) {
                         if (day >= courseStartDate && day <= courseEndDate && day.getDay() === eventDayIndex) {
                             processedData.push({
                                 'Fecha': day.toLocaleDateString('es-ES'),
                                 'Día': event.day,
                                 'Hora Inicio': event.startTime, 'Hora Fin': event.endTime,
                                 'Módulo': module?.name || '', 'Docente': teacher?.name || '',
                                 'Grupo': groupName, 'Aula': classroom?.name || ''
                             });
                         }
                     }
                } else {
                     processedData.push({
                        'Fecha': 'Semanal', 'Día': event.day,
                        'Hora Inicio': event.startTime, 'Hora Fin': event.endTime,
                        'Módulo': module?.name || '', 'Docente': teacher?.name || '',
                        'Grupo': groupName, 'Aula': classroom?.name || ''
                    });
                }
            });

            return processedData.sort((a, b) => {
                if (isMonthly) {
                    const dateA = new Date(a.Fecha.split('/').reverse().join('-')).getTime();
                    const dateB = new Date(b.Fecha.split('/').reverse().join('-')).getTime();
                    if (dateA !== dateB) return dateA - dateB;
                }
                const dayA = daysOrder.indexOf(a['Día']);
                const dayB = daysOrder.indexOf(b['Día']);
                if (dayA !== dayB) return dayA - dayB;
                return a['Hora Inicio'].localeCompare(b['Hora Inicio']);
            });
        };

        switch (reportType) {
            case 'teacher': {
                const teacher = teachers.find(t => t.id === selectedId)!;
                reportTitle = `Horario para Docente: ${teacher.name}`;
                fileName = `horario_docente_${teacher.name.replace(/ /g, '_')}.xlsx`;
                const events = scheduleEvents.filter(e => e.teacherId === selectedId);
                reportData = processEvents(events);
                break;
            }
            case 'group': {
                const group = groupOptions.find(g => g.id === selectedId)!;
                reportTitle = `Horario para Grupo: ${group.name}`;
                fileName = `horario_grupo_${group.name.replace(/ /g, '_').replace(/[\\/?*:[\]]/g, '')}.xlsx`;
                const groupCourseIds = courses.filter(c => c.groupId === selectedId).map(c => c.id);
                const events = scheduleEvents.filter(e => groupCourseIds.includes(e.courseId));
                reportData = processEvents(events);
                break;
            }
            case 'career': {
                const career = careers.find(c => c.id === selectedId)!;
                reportTitle = `Horario para Carrera: ${career.name}`;
                fileName = `horario_carrera_${career.name.replace(/ /g, '_')}.xlsx`;
                const careerGroupIds = groups.filter(g => g.careerId === selectedId).map(g => g.id);
                const careerCourseIds = courses.filter(c => careerGroupIds.includes(c.groupId)).map(c => c.id);
                const events = scheduleEvents.filter(e => careerCourseIds.includes(e.courseId));
                reportData = processEvents(events);
                break;
            }
            case 'module': {
                const module = modules.find(m => m.id === selectedId)!;
                reportTitle = `Horario para Módulo: ${module.name}`;
                fileName = `horario_modulo_${module.name.replace(/ /g, '_')}.xlsx`;
                const moduleCourseIds = courses.filter(c => c.moduleId === selectedId).map(c => c.id);
                const events = scheduleEvents.filter(e => moduleCourseIds.includes(e.courseId));
                reportData = processEvents(events);
                break;
            }
             case 'classroom': {
                const classroom = classrooms.find(c => c.id === selectedId)!;
                reportTitle = `Horario para Aula: ${classroom.name}`;
                fileName = `horario_aula_${classroom.name.replace(/ /g, '_')}.xlsx`;
                const events = scheduleEvents.filter(e => e.classroomId === selectedId);
                reportData = processEvents(events);
                break;
            }
            case 'month': {
                reportTitle = `Horario para ${currentDate.toLocaleString('es-ES', { month: 'long', year: 'numeric' })}`;
                fileName = `horario_${currentDate.toLocaleString('es-ES', { month: 'short', year: 'numeric' }).replace('.', '').replace(' ', '_')}.xlsx`;
                reportData = processEvents(scheduleEvents, true);
                break;
            }
        }
        
        if (reportType !== 'month') {
            reportHeaders.shift(); // Remove 'Fecha' for weekly reports
        }

        if (reportData.length === 0) {
            toast({ title: 'Sin Datos', description: 'No se encontraron eventos para la selección actual.' });
            return null;
        }

        return { data: reportData, title: reportTitle, headers: reportHeaders, fileName };
    }

    const handleExcelExport = () => {
        setIsExporting(true);
        const report = generateReport();
        if (report) {
            const worksheet = XLSX.utils.json_to_sheet(report.data);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, report.title.substring(0, 31));
            XLSX.writeFile(workbook, report.fileName);
        }
        setIsExporting(false);
    };

    const handlePrint = () => {
        setIsExporting(true);
        const report = generateReport();
        if (report) {
            onPrintRequest(report);
            onOpenChange(false);
        }
        setIsExporting(false);
    };


    const renderSelector = () => {
        switch(reportType) {
            case 'teacher': return <Select value={selectedId} onValueChange={setSelectedId}><SelectTrigger><SelectValue placeholder="Selecciona un docente..." /></SelectTrigger><SelectContent>{teacherOptions.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent></Select>;
            case 'group': return <Select value={selectedId} onValueChange={setSelectedId}><SelectTrigger><SelectValue placeholder="Selecciona un grupo..." /></SelectTrigger><SelectContent>{groupOptions.map(g => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}</SelectContent></Select>;
            case 'career': return <Select value={selectedId} onValueChange={setSelectedId}><SelectTrigger><SelectValue placeholder="Selecciona una carrera..." /></SelectTrigger><SelectContent>{careerOptions.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select>;
            case 'module': return <Select value={selectedId} onValueChange={setSelectedId}><SelectTrigger><SelectValue placeholder="Selecciona un módulo..." /></SelectTrigger><SelectContent>{moduleOptions.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent></Select>;
            case 'classroom': return <Select value={selectedId} onValueChange={setSelectedId}><SelectTrigger><SelectValue placeholder="Selecciona un aula..." /></SelectTrigger><SelectContent>{classroomOptions.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select>;
            default: return null;
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Generar Reporte de Horario</DialogTitle>
                    <DialogDescription>
                        Selecciona el tipo de reporte y el formato que deseas generar.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="report-type">Tipo de Reporte</Label>
                        <Select value={reportType} onValueChange={(v) => setReportType(v as ReportType)}>
                            <SelectTrigger id="report-type">
                                <SelectValue placeholder="Selecciona un tipo..." />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="teacher">Por Docente</SelectItem>
                                <SelectItem value="group">Por Grupo</SelectItem>
                                <SelectItem value="career">Por Carrera</SelectItem>
                                <SelectItem value="module">Por Módulo</SelectItem>
                                <SelectItem value="classroom">Por Aula (Semanal)</SelectItem>
                                <SelectItem value="month">Mes Completo</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    {reportType && reportType !== 'month' && (
                        <div className="space-y-2">
                            <Label>Seleccionar Ítem</Label>
                            {renderSelector()}
                        </div>
                    )}
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                    <Button onClick={handlePrint} disabled={isExporting}>Imprimir/Guardar PDF</Button>
                    <Button onClick={handleExcelExport} disabled={isExporting}>
                        {isExporting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Exportar a Excel
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
