'use client';
import { useState, useMemo, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Plus, Edit, Trash2, User } from 'lucide-react';
import AppLayout from '@/components/app-layout';
import { useFirestore } from '@/firebase';
import { useCollection } from '@/firebase/firestore/use-collection';
import { collection, deleteDoc, doc } from 'firebase/firestore';
import type { Career, Course, Group, Module, Teacher, Classroom, ScheduleEvent } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { CourseForm } from '@/components/courses/course-form';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { ScheduleCalendar } from '@/components/dashboard/schedule-calendar';
import { ManualScheduleForm } from '@/components/dashboard/manual-schedule-form';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';

type CourseWithDetails = Course & {
    moduleName: string;
    groupInfo: string;
    careerName: string;
    teacherName?: string;
};

const toISODateString = (date: Date) => {
    // Returns date as 'YYYY-MM-DD' in local timezone, not UTC
    const offset = date.getTimezoneOffset();
    const adjustedDate = new Date(date.getTime() - (offset*60*1000));
    return adjustedDate.toISOString().split('T')[0];
}

export default function AcademicCalendarPage() {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [currentView, setCurrentView] = useState('month');
    const [showCourseModal, setShowCourseModal] = useState(false);
    const [editingCourse, setEditingCourse] = useState<Course | null>(null);
    const [showScheduleModal, setShowScheduleModal] = useState(false);
    const [editingScheduleEvent, setEditingScheduleEvent] = useState<ScheduleEvent | undefined>(undefined);
    const [courseToSchedule, setCourseToSchedule] = useState<CourseWithDetails | null>(null);
    
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

    const coursesWithDetails: CourseWithDetails[] = useMemo(() => {
        if (!courses || !groups || !careers || !modules || !scheduleEvents || !teachers) return [];
        return courses.map(course => {
            const module = modules.find(m => m.id === course.moduleId);
            const group = groups.find(g => g.id === course.groupId);
            if (!group || !module) return null;
            const career = careers.find(c => c.id === group.careerId);
            
            const eventForCourse = scheduleEvents.find(e => e.courseId === course.id);
            const teacher = eventForCourse ? teachers.find(t => t.id === eventForCourse.teacherId) : undefined;

            return {
                ...course,
                moduleName: module.name,
                groupInfo: `Sem ${group.semester} - G ${group.name}`,
                careerName: career?.name || 'Carrera Desconocida',
                teacherName: teacher?.name,
            }
        }).filter((c): c is CourseWithDetails => c !== null);
    }, [courses, modules, groups, careers, scheduleEvents, teachers]);

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
                        const isToday = date.toDateString() === new Date().toDateString();

                        return (
                            <div
                                key={idx}
                                onClick={() => setSelectedDate(date)}
                                className={cn(`relative aspect-square p-2 cursor-pointer transition-colors duration-150 border-t border-l`,
                                    isOtherMonth ? 'bg-gray-50 text-gray-400' : 'bg-white hover:bg-gray-100'
                                )}
                            >
                                <div className={cn('font-semibold text-right mb-1', isToday ? 'text-primary' : '')}>{date.getDate()}</div>
                                {isToday && <div className="absolute top-2 right-2 text-xs font-bold text-primary opacity-75">HOY</div>}
                                <div className="space-y-1">
                                    {dayCourses.slice(0, 2).map(course => (
                                        <div
                                            key={course.id}
                                            className="text-xs px-1.5 py-0.5 rounded truncate text-white font-medium cursor-pointer bg-primary/80"
                                            title={course.moduleName}
                                            onClick={(e) => { e.stopPropagation(); openCourseModal(course); }}
                                        >
                                            {course.moduleName}
                                        </div>
                                    ))}
                                    {dayCourses.length > 2 && (
                                        <div className="text-xs text-gray-500 font-bold">+ {dayCourses.length - 2} más</div>
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
        const [selectedTeacher, setSelectedTeacher] = useState<string | undefined>(undefined);
        const [selectedGroup, setSelectedGroup] = useState<string | undefined>(undefined);
        const [selectedClassroom, setSelectedClassroom] = useState<string | undefined>(undefined);
    
        const groupOptions = useMemo(() => {
            if (!groups || !careers) return [];
            return groups.map(group => {
                const career = careers.find(c => c.id === group.careerId);
                return { id: group.id, name: `${career?.name || '...'} - Sem ${group.semester} - G ${group.name}` };
            }).sort((a, b) => a.name.localeCompare(b.name));
        }, [groups, careers]);
    
        useEffect(() => {
            if (teachers && teachers.length > 0 && !selectedTeacher) setSelectedTeacher(teachers.sort((a,b) => a.name.localeCompare(b.name))[0].id);
            if (groupOptions.length > 0 && !selectedGroup) setSelectedGroup(groupOptions[0].id);
            if (classrooms && classrooms.length > 0 && !selectedClassroom) setSelectedClassroom(classrooms.sort((a,b) => a.name.localeCompare(b.name))[0].id);
        }, [teachers, groupOptions, classrooms, selectedTeacher, selectedGroup, selectedClassroom]);
    
        const teacherEvents = useMemo(() => scheduleEvents?.filter(e => e.teacherId === selectedTeacher) || [], [scheduleEvents, selectedTeacher]);
        const groupEvents = useMemo(() => {
            if (!selectedGroup || !courses) return [];
            const groupCourseIds = courses.filter(c => c.groupId === selectedGroup).map(c => c.id);
            return scheduleEvents?.filter(e => groupCourseIds.includes(e.courseId)) || [];
        }, [scheduleEvents, selectedGroup, courses]);
        const classroomEvents = useMemo(() => scheduleEvents?.filter(e => e.classroomId === selectedClassroom) || [], [scheduleEvents, selectedClassroom]);

        const loading = loadingSchedules || loadingTeachers || loadingClassrooms || loadingGroups || loadingCourses || loadingModules || loadingCareers;

        if (loading) return <div className="flex justify-center items-center h-96"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>;

        return (
             <Tabs defaultValue="teacher" className="w-full">
                <TabsList>
                    <TabsTrigger value="teacher">Por Docente</TabsTrigger>
                    <TabsTrigger value="group">Por Grupo</TabsTrigger>
                    <TabsTrigger value="classroom">Por Aula</TabsTrigger>
                </TabsList>
                
                <TabsContent value="teacher" className="mt-4">
                   <div className="max-w-sm"><Select onValueChange={setSelectedTeacher} value={selectedTeacher}><SelectTrigger><SelectValue placeholder="Selecciona un docente..." /></SelectTrigger><SelectContent>{teachers?.sort((a,b) => a.name.localeCompare(b.name)).map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent></Select></div>
                   {selectedTeacher && <ScheduleCalendar events={teacherEvents} courses={courses || []} modules={modules || []} teachers={teachers || []} classrooms={classrooms || []} groups={groups || []} careers={careers || []} onEditEvent={handleEditScheduleEvent} onDeleteEvent={handleDeleteScheduleEvent} />}
                </TabsContent>
                <TabsContent value="group" className="mt-4">
                   <div className="max-w-sm"><Select onValueChange={setSelectedGroup} value={selectedGroup}><SelectTrigger><SelectValue placeholder="Selecciona un grupo..." /></SelectTrigger><SelectContent>{groupOptions?.map(g => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}</SelectContent></Select></div>
                   {selectedGroup && <ScheduleCalendar events={groupEvents} courses={courses || []} modules={modules || []} teachers={teachers || []} classrooms={classrooms || []} groups={groups || []} careers={careers || []} onEditEvent={handleEditScheduleEvent} onDeleteEvent={handleDeleteScheduleEvent} />}
                </TabsContent>
                <TabsContent value="classroom" className="mt-4">
                  <div className="max-w-sm"><Select onValueChange={setSelectedClassroom} value={selectedClassroom}><SelectTrigger><SelectValue placeholder="Selecciona un aula..." /></SelectTrigger><SelectContent>{classrooms?.sort((a, b) => a.name.localeCompare(b.name)).map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select></div>
                   {selectedClassroom && <ScheduleCalendar events={classroomEvents} courses={courses || []} modules={modules || []} teachers={teachers || []} classrooms={classrooms || []} groups={groups || []} careers={careers || []} onEditEvent={handleEditScheduleEvent} onDeleteEvent={handleDeleteScheduleEvent} />}
                </TabsContent>
            </Tabs>
        )
    };

    const ViewPlaceholder = ({ viewName }: { viewName: string }) => (
        <div className="flex items-center justify-center h-96 bg-gray-100 rounded-lg">
            <p className="text-gray-500">La vista de '{viewName}' aún no está implementada.</p>
        </div>
    );
    
    const selectedDayEvents = getCoursesForDate(selectedDate);

    return (
        <AppLayout>
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

                <div className="mb-8">
                    {currentView === 'month' && <MonthView />}
                    {currentView === 'week' && <WeekView />}
                    {currentView === 'day' && <ViewPlaceholder viewName="Día" />}
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
                            {selectedDayEvents.length > 0 ? selectedDayEvents.map(course => (
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
                            course={editingCourse || undefined}
                            allCourses={courses || []}
                            modules={modules || []}
                            groups={groups || []}
                            careers={careers || []}
                            onSuccess={closeCourseModal} 
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
              </CardContent>
            </Card>
        </AppLayout>
    );
}
