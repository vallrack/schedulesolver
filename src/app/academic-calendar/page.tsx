'use client';
import { useState, useMemo, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Plus, Edit, Trash2 } from 'lucide-react';
import AppLayout from '@/components/app-layout';
import { useFirestore } from '@/firebase';
import { useCollection } from '@/firebase/firestore/use-collection';
import { collection, deleteDoc, doc } from 'firebase/firestore';
import type { Career, Course, Group, Module } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { CourseForm } from '@/components/courses/course-form';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

type CourseWithDetails = Course & {
    moduleName: string;
    groupInfo: string;
    careerName: string;
};

export default function AcademicCalendarPage() {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [currentView, setCurrentView] = useState('month');
    const [showModal, setShowModal] = useState(false);
    const [editingCourse, setEditingCourse] = useState<Course | null>(null);
    const { toast } = useToast();
    const firestore = useFirestore();

    // Data fetching
    const { data: courses, loading: loadingCourses } = useCollection<Course>(useMemo(() => firestore ? collection(firestore, 'courses') : null, [firestore]));
    const { data: modules, loading: loadingModules } = useCollection<Module>(useMemo(() => firestore ? collection(firestore, 'modules') : null, [firestore]));
    const { data: groups, loading: loadingGroups } = useCollection<Group>(useMemo(() => firestore ? collection(firestore, 'groups') : null, [firestore]));
    const { data: careers, loading: loadingCareers } = useCollection<Career>(useMemo(() => firestore ? collection(firestore, 'careers') : null, [firestore]));

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

    const navigateMonth = (direction: number) => {
        setCurrentDate(current => {
            const newDate = new Date(current);
            newDate.setMonth(newDate.getMonth() + direction);
            return newDate;
        });
    };
    
    const isToday = (date: Date) => new Date().toDateString() === date.toDateString();
    const isSelected = (date: Date) => selectedDate.toDateString() === date.toDateString();

    const getCoursesForDate = (date: Date) => {
        const checkDate = new Date(date);
        checkDate.setHours(0, 0, 0, 0);
        return coursesWithDetails.filter(course => {
            const startDate = new Date(course.startDate);
            startDate.setHours(0, 0, 0, 0);
            const endDate = new Date(course.endDate);
            endDate.setHours(0, 0, 0, 0);
            return checkDate >= startDate && checkDate <= endDate;
        });
    };

    const openModal = (course: Course | null = null) => {
        setEditingCourse(course);
        setShowModal(true);
    };

    const closeModal = () => {
        setShowModal(false);
        setEditingCourse(null);
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
            closeModal();
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
            <div>
                <div className="grid grid-cols-7 text-center font-semibold text-sm text-gray-600">
                    {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map(day => (
                        <div key={day} className="py-2">{day}</div>
                    ))}
                </div>
                <div className="grid grid-cols-7 border rounded-lg overflow-hidden">
                    {days.map((date, idx) => {
                        const dayCourses = getCoursesForDate(date);
                        const isOtherMonth = date.getMonth() !== month;
                        
                        return (
                            <div
                                key={idx}
                                onClick={() => setSelectedDate(date)}
                                className={`min-h-[120px] p-2 cursor-pointer transition-colors duration-150 border-t border-l ${
                                    isOtherMonth ? 'bg-gray-50 text-gray-400' :
                                    isToday(date) ? 'border-2 border-primary' : ''
                                } ${
                                    isSelected(date) ? 'bg-accent/20' : 'bg-white hover:bg-gray-50'
                                }`}
                            >
                                <div className={`font-semibold text-right ${isToday(date) ? 'text-primary' : ''}`}>{date.getDate()}</div>
                                <div className="space-y-1 mt-1">
                                    {dayCourses.slice(0, 3).map(course => (
                                        <div
                                            key={course.id}
                                            className="text-xs px-1.5 py-0.5 rounded truncate text-white font-medium cursor-pointer bg-primary/80 hover:bg-primary"
                                            title={course.moduleName}
                                            onClick={(e) => { e.stopPropagation(); openModal(course); }}
                                        >
                                            {course.moduleName}
                                        </div>
                                    ))}
                                    {dayCourses.length > 3 && (
                                        <div className="text-xs text-gray-500">+{dayCourses.length - 3} más</div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    const ViewPlaceholder = ({ viewName }: { viewName: string }) => (
        <div className="flex items-center justify-center h-96 bg-gray-100 rounded-lg">
            <p className="text-gray-500">La vista de '{viewName}' aún no está implementada.</p>
        </div>
    );
    
    const selectedDayEvents = getCoursesForDate(selectedDate);

    return (
        <AppLayout>
            <Card className="shadow-2xl">
              <CardContent className="p-6">
                <div className="flex justify-between items-center mb-6 pb-4 border-b">
                    <div className="flex items-center gap-2">
                        <Button onClick={() => navigateMonth(-1)} variant="outline" size="icon" className="h-9 w-9">
                            <ChevronLeft className="w-5 h-5" />
                        </Button>
                        <h1 className="text-xl font-bold text-gray-800 w-40 text-center capitalize">
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
                    {currentView === 'week' && <ViewPlaceholder viewName="Semana" />}
                    {currentView === 'day' && <ViewPlaceholder viewName="Día" />}
                </div>

                <div className="bg-white rounded-lg">
                    <div className="flex justify-between items-center mb-4 pb-4 border-b">
                        <h3 className="text-lg font-semibold text-gray-800">
                            Cursos para el {selectedDate.toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })}
                        </h3>
                        <Button onClick={() => openModal()} size="sm">
                            <Plus className="w-4 h-4 mr-2" />
                            Programar Curso
                        </Button>
                    </div>

                    <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
                        {selectedDayEvents.length > 0 ? selectedDayEvents.map(course => (
                            <div key={course.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-all">
                                <div className="w-2 h-8 rounded-full flex-shrink-0 bg-primary" />
                                <div className="flex-1">
                                    <div className="font-semibold text-gray-800">{course.moduleName}</div>
                                    <div className="text-sm text-gray-600">{course.careerName} / {course.groupInfo}</div>
                                </div>
                                <div className="flex gap-2">
                                    <Button onClick={() => openModal(course)} variant="ghost" size="icon" className="w-8 h-8 text-blue-600 hover:text-blue-700">
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
                                                <AlertDialogAction onClick={() => handleDelete(course.id)} className="bg-destructive hover:bg-destructive/90">Eliminar</AlertDialogAction>
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

                <Dialog open={showModal} onOpenChange={closeModal}>
                    <DialogContent className="sm:max-w-xl">
                        <DialogHeader>
                            <DialogTitle>{editingCourse ? 'Editar Curso' : 'Programar Nuevo Curso'}</DialogTitle>
                            <DialogDescription>
                                {editingCourse ? 'Actualiza los detalles del curso.' : `Programa un nuevo curso. Fecha seleccionada: ${selectedDate.toLocaleDateString('es-ES')}`}
                            </DialogDescription>
                        </DialogHeader>
                        <CourseForm 
                            course={editingCourse || undefined}
                            allCourses={courses || []}
                            modules={modules || []}
                            groups={groups || []}
                            careers={careers || []}
                            onSuccess={closeModal} 
                        />
                    </DialogContent>
                </Dialog>
              </CardContent>
            </Card>
        </AppLayout>
    );
}
