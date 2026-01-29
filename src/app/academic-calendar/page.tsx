'use client';
import { useState, useMemo } from 'react';
import { addMonths, subMonths, format } from 'date-fns';
import { es } from 'date-fns/locale';
import AppLayout from '@/components/app-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PlusCircle, Calendar as CalendarIcon, Clock, Trash2, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { useFirestore } from '@/firebase';
import { useCollection } from '@/firebase/firestore/use-collection';
import { collection, deleteDoc, doc } from 'firebase/firestore';
import type { Career, Course, Group, Module } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { CourseForm } from '@/components/courses/course-form';
import { MonthlyCalendar } from '@/components/academic-calendar/monthly-calendar';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { ScrollArea } from '@/components/ui/scroll-area';

type CourseWithDetails = Course & {
    moduleName: string;
    groupInfo: string;
    careerName: string;
};

export default function AcademicCalendarPage() {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [dialogOpen, setDialogOpen] = useState(false);

    const firestore = useFirestore();
    const { toast } = useToast();

    // Data fetching
    const { data: courses, loading: loadingCourses } = useCollection<Course>(useMemo(() => firestore ? collection(firestore, 'courses') : null, [firestore]));
    const { data: modules, loading: loadingModules } = useCollection<Module>(useMemo(() => firestore ? collection(firestore, 'modules') : null, [firestore]));
    const { data: groups, loading: loadingGroups } = useCollection<Group>(useMemo(() => firestore ? collection(firestore, 'groups') : null, [firestore]));
    const { data: careers, loading: loadingCareers } = useCollection<Career>(useMemo(() => firestore ? collection(firestore, 'careers') : null, [firestore]));

    const loading = loadingCourses || loadingModules || loadingGroups || loadingCareers;

    const coursesWithDetails: CourseWithDetails[] = useMemo(() => {
        if (!courses || !groups || !careers || !modules) return [];
        return courses.map(course => {
            const module = modules.find(m => m.id === course.moduleId);
            const group = groups.find(g => g.id === course.groupId);
            if (!group || !module) return null;
            const career = careers.find(c => c.id === group.careerId);
            return {
                ...course,
                moduleName: module.name,
                groupInfo: `Sem ${group.semester} - G ${group.name}`,
                careerName: career?.name || 'Carrera Desconocida',
            }
        }).filter((c): c is CourseWithDetails => c !== null);
    }, [courses, modules, groups, careers]);
    
    const eventsForSelectedDate = useMemo(() => {
        const checkDate = new Date(selectedDate);
        checkDate.setHours(0,0,0,0);
        return coursesWithDetails.filter(event => {
            const eventStartDate = new Date(event.startDate);
            eventStartDate.setHours(0,0,0,0);
            const eventEndDate = new Date(event.endDate);
            eventEndDate.setHours(0,0,0,0);
            return checkDate >= eventStartDate && checkDate <= eventEndDate;
        }).sort((a,b) => a.moduleName.localeCompare(b.moduleName));
    }, [selectedDate, coursesWithDetails]);


    const handlePreviousMonth = () => setCurrentDate(current => subMonths(current, 1));
    const handleNextMonth = () => setCurrentDate(current => addMonths(current, 1));
    const handleDateClick = (date: Date) => setSelectedDate(date);

    const handleDelete = async (courseId: string) => {
        if (!firestore) return;
        const courseRef = doc(firestore, 'courses', courseId);
        try {
            await deleteDoc(courseRef);
            toast({
                variant: 'destructive',
                title: 'Curso Eliminado',
                description: 'El curso programado ha sido eliminado.',
            });
        } catch(e) {
            const permissionError = new FirestorePermissionError({ path: courseRef.path, operation: 'delete' });
            errorEmitter.emit('permission-error', permissionError);
        }
    };
    
    const calculateDuration = (start: string, end: string) => {
        const startDate = new Date(start);
        const endDate = new Date(end);
        const diff = endDate.getTime() - startDate.getTime();
        const days = Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1; // +1 to be inclusive
        const weeks = Math.floor(days / 7);
        const remainingDays = days % 7;
        if (weeks > 0 && remainingDays > 0) return `${weeks} sem. y ${remainingDays} d.`;
        if (weeks > 0) return `${weeks} sem.`;
        return `${days} d.`;
    }

    return (
        <AppLayout>
            <div className="space-y-8">
                 <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                    <DialogContent className="sm:max-w-xl">
                        <DialogHeader>
                            <DialogTitle>Programar Nuevo Curso</DialogTitle>
                            <DialogDescription>
                               Rellena los detalles para programar un nuevo curso en el calendario.
                            </DialogDescription>
                        </DialogHeader>
                        <CourseForm 
                            course={undefined} 
                            allCourses={courses || []}
                            modules={modules || []}
                            groups={groups || []}
                            careers={careers || []}
                            onSuccess={() => setDialogOpen(false)} 
                        />
                    </DialogContent>
                </Dialog>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2">
                        <Card>
                             <CardHeader className="flex flex-row items-center justify-between">
                                <div className="flex items-center gap-2">
                                     <Button onClick={handlePreviousMonth} variant="outline" size="icon" className="h-9 w-9">
                                        <ChevronLeft className="h-5 w-5" />
                                    </Button>
                                    <h2 className="text-lg font-semibold font-headline capitalize text-center w-40">
                                        {format(currentDate, 'MMMM yyyy', { locale: es })}
                                    </h2>
                                    <Button onClick={handleNextMonth} variant="outline" size="icon" className="h-9 w-9">
                                        <ChevronRight className="h-5 w-5" />
                                    </Button>
                                </div>
                                <div className="hidden sm:flex items-center gap-1 bg-muted p-1 rounded-md">
                                    <Button variant="default" size="sm" className="h-8 text-xs px-3">Mes</Button>
                                    <Button variant="ghost" size="sm" className="h-8 text-xs px-3" disabled>Semana</Button>
                                    <Button variant="ghost" size="sm" className="h-8 text-xs px-3" disabled>Día</Button>
                                </div>
                             </CardHeader>
                             <CardContent>
                                {loading ? <div className="flex justify-center items-center h-96"><Loader2 className="w-8 h-8 animate-spin"/></div> :
                                    <MonthlyCalendar 
                                        courses={coursesWithDetails} 
                                        year={currentDate.getFullYear()} 
                                        month={currentDate.getMonth()}
                                        selectedDate={selectedDate}
                                        onDateClick={handleDateClick}
                                    />
                                }
                             </CardContent>
                        </Card>
                    </div>

                    <div className="lg:col-span-1 space-y-6">
                        <Card>
                             <CardHeader>
                                <CardTitle>Agenda del {format(selectedDate, "d 'de' MMMM", { locale: es })}</CardTitle>
                             </CardHeader>
                             <CardContent>
                                <ScrollArea className="h-96">
                                     <div className="space-y-4">
                                        {loading && <div className="flex justify-center items-center h-24"><Loader2 className="w-6 h-6 animate-spin"/></div>}
                                        {!loading && eventsForSelectedDate.length > 0 && eventsForSelectedDate.map(course => (
                                            <div key={course.id} className="border rounded-lg p-3 hover:bg-muted/50 transition-colors">
                                                <h3 className="font-semibold text-foreground text-sm">{course.moduleName}</h3>
                                                <p className="text-xs text-muted-foreground">{course.careerName} / {course.groupInfo}</p>
                                                <div className="flex items-center gap-4 text-xs text-muted-foreground mt-2">
                                                    <span className="flex items-center gap-1"><CalendarIcon className="w-3 h-3" /> {format(new Date(course.startDate), "d MMM", { locale: es })} - {format(new Date(course.endDate), "d MMM", { locale: es })}</span>
                                                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {calculateDuration(course.startDate, course.endDate)}</span>
                                                </div>
                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="text-destructive h-6 w-6 float-right -mt-8"><Trash2 className="w-4 h-4"/></Button>
                                                    </AlertDialogTrigger>
                                                    <AlertDialogContent>
                                                        <AlertDialogHeader>
                                                            <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                                                            <AlertDialogDescription>Esta acción no se puede deshacer. Esto eliminará permanentemente el curso.</AlertDialogDescription>
                                                        </AlertDialogHeader>
                                                        <AlertDialogFooter>
                                                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                            <AlertDialogAction onClick={() => handleDelete(course.id)} className="bg-destructive hover:bg-destructive/90">Eliminar</AlertDialogAction>
                                                        </AlertDialogFooter>
                                                    </AlertDialogContent>
                                                </AlertDialog>
                                            </div>
                                        ))}
                                         {!loading && eventsForSelectedDate.length === 0 && (
                                            <div className="text-center text-muted-foreground py-10">
                                                <p>No hay cursos programados para esta fecha.</p>
                                            </div>
                                         )}
                                    </div>
                                </ScrollArea>
                                 <Button onClick={() => setDialogOpen(true)} className="w-full mt-4">
                                    <PlusCircle className="mr-2 h-4 w-4" />
                                    Programar Nuevo Curso
                                </Button>
                             </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
