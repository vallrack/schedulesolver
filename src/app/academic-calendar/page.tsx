'use client';
import { useState, useMemo } from 'react';
import { addMonths, subMonths, format } from 'date-fns';
import { es } from 'date-fns/locale';
import AppLayout from '@/components/app-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PlusCircle, ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, Trash2 } from 'lucide-react';
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
import { Loader2 } from 'lucide-react';

type CourseWithDetails = Course & {
    moduleName: string;
    groupInfo: string;
    careerName: string;
};

export default function AcademicCalendarPage() {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [dialogOpen, setDialogOpen] = useState(false);

    const firestore = useFirestore();
    const { toast } = useToast();

    // Data fetching
    const coursesCollection = useMemo(() => firestore ? collection(firestore, 'courses') : null, [firestore]);
    const { data: courses, loading: loadingCourses } = useCollection<Course>(coursesCollection);
    const modulesCollection = useMemo(() => firestore ? collection(firestore, 'modules') : null, [firestore]);
    const { data: modules, loading: loadingModules } = useCollection<Module>(modulesCollection);
    const groupsCollection = useMemo(() => firestore ? collection(firestore, 'groups') : null, [firestore]);
    const { data: groups, loading: loadingGroups } = useCollection<Group>(groupsCollection);
    const careersCollection = useMemo(() => firestore ? collection(firestore, 'careers') : null, [firestore]);
    const { data: careers, loading: loadingCareers } = useCollection<Career>(careersCollection);

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
        }).filter((c): c is CourseWithDetails => c !== null)
          .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
    }, [courses, modules, groups, careers]);

    const handlePreviousMonth = () => {
        setCurrentDate(current => subMonths(current, 1));
    };

    const handleNextMonth = () => {
        setCurrentDate(current => addMonths(current, 1));
    };

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
            const permissionError = new FirestorePermissionError({
                path: courseRef.path,
                operation: 'delete',
            });
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
        if (weeks > 0 && remainingDays > 0) {
            return `${weeks} sem. y ${remainingDays} d.`;
        } else if (weeks > 0) {
            return `${weeks} sem.`;
        } else {
            return `${days} d.`;
        }
    }

    return (
        <AppLayout>
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <h1 className="text-3xl font-bold font-headline tracking-tight">Calendario Académico</h1>
                    <Button onClick={() => setDialogOpen(true)}>
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Programar Curso
                    </Button>
                </div>

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

                <Card>
                    <CardHeader>
                        <CardTitle>Cursos Programados</CardTitle>
                        <CardDescription>Lista de todos los módulos y materias programados.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {loading ? <div className="flex justify-center items-center h-24"><Loader2 className="w-6 h-6 animate-spin"/></div> : (
                            <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                                {coursesWithDetails.map(course => (
                                    <div key={course.id} className="border rounded-lg p-4 flex items-center justify-between hover:bg-muted/50 transition-colors">
                                        <div>
                                            <h3 className="font-semibold text-foreground">{course.moduleName}</h3>
                                            <p className="text-sm text-muted-foreground">{course.careerName} / {course.groupInfo}</p>
                                            <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                                                <span className="flex items-center gap-1.5"><CalendarIcon className="w-4 h-4" /> {format(new Date(course.startDate), "d MMM yyyy", { locale: es })} - {format(new Date(course.endDate), "d MMM yyyy", { locale: es })}</span>
                                                <span className="flex items-center gap-1.5"><Clock className="w-4 h-4" /> {calculateDuration(course.startDate, course.endDate)}</span>
                                            </div>
                                        </div>
                                         <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button variant="ghost" size="icon" className="text-destructive h-8 w-8"><Trash2 className="w-4 h-4"/></Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>¿Estás absolutamente seguro?</AlertDialogTitle>
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
                                {coursesWithDetails.length === 0 && <p className="text-muted-foreground text-center py-8">No hay cursos programados.</p>}
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <CardTitle className="capitalize">{format(currentDate, 'MMMM yyyy', { locale: es })}</CardTitle>
                            <div className="flex items-center gap-2">
                                <Button variant="outline" size="icon" onClick={handlePreviousMonth}><ChevronLeft className="h-4 w-4" /></Button>
                                <Button variant="outline" size="icon" onClick={handleNextMonth}><ChevronRight className="h-4 w-4" /></Button>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                         {loading ? <div className="flex justify-center items-center h-96"><Loader2 className="w-8 h-8 animate-spin"/></div> :
                            <MonthlyCalendar 
                                courses={coursesWithDetails} 
                                modules={modules || []}
                                year={currentDate.getFullYear()} 
                                month={currentDate.getMonth()}
                            />
                        }
                    </CardContent>
                </Card>

            </div>
        </AppLayout>
    );
}
