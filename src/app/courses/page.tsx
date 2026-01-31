'use client'
import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { PlusCircle, ChevronLeft, ChevronRight } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useCollection } from "@/firebase/firestore/use-collection"
import { useFirestore } from "@/firebase"
import { collection } from "firebase/firestore"
import AppLayout from "@/components/app-layout"
import type { Career, Course, Group, Module, ScheduleEvent, Teacher, Classroom } from "@/lib/types";
import { CourseForm } from "@/components/courses/course-form";
import { cn, getColorForCourse } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

type CourseWithDetails = Course & {
    moduleName: string;
    groupInfo: string;
    careerId: string;
    careerName: string;
};

export default function CoursesPage() {
  const firestore = useFirestore();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | undefined>(undefined);
  
  // Defer date initialization to client-side to prevent hydration errors
  const [currentDate, setCurrentDate] = useState<Date | undefined>(undefined);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    // This effect runs only on the client, after the component has mounted.
    setIsClient(true);
    setCurrentDate(new Date());
  }, []);

  const [dayWithCourses, setDayWithCourses] = useState<{ date: Date; courses: CourseWithDetails[] } | null>(null);


  const coursesCollection = useMemo(() => firestore ? collection(firestore, 'courses') : null, [firestore]);
  const { data: courses, loading: loadingCourses } = useCollection<Course>(coursesCollection);

  const modulesCollection = useMemo(() => firestore ? collection(firestore, 'modules') : null, [firestore]);
  const { data: modules, loading: loadingModules } = useCollection<Module>(modulesCollection);

  const careersCollection = useMemo(() => firestore ? collection(firestore, 'careers') : null, [firestore]);
  const { data: careers, loading: loadingCareers } = useCollection<Career>(careersCollection);

  const groupsCollection = useMemo(() => firestore ? collection(firestore, 'groups') : null, [firestore]);
  const { data: groups, loading: loadingGroups } = useCollection<Group>(groupsCollection);

  const schedulesCollection = useMemo(() => firestore ? collection(firestore, 'schedules') : null, [firestore]);
  const { data: scheduleEvents, loading: loadingSchedules } = useCollection<ScheduleEvent>(schedulesCollection);

  const teachersCollection = useMemo(() => firestore ? collection(firestore, 'teachers') : null, [firestore]);
  const { data: teachers, loading: loadingTeachers } = useCollection<Teacher>(teachersCollection);
  
  const classroomsCollection = useMemo(() => firestore ? collection(firestore, 'classrooms') : null, [firestore]);
  const { data: classrooms, loading: loadingClassrooms } = useCollection<Classroom>(classroomsCollection);


  const allDataLoaded = !loadingCourses && !loadingModules && !loadingCareers && !loadingGroups && !loadingSchedules && !loadingTeachers && !loadingClassrooms;

  const coursesWithDetails: CourseWithDetails[] = useMemo(() => {
    if (!allDataLoaded || !courses || !groups || !careers || !modules) return [];
    return courses.map(course => {
        const module = modules.find(m => m.id === course.moduleId);
        const group = groups.find(g => g.id === course.groupId);
        if (!group || !module) return null;

        const career = careers.find(c => c.id === group.careerId);
        return {
            ...course,
            moduleName: module.name,
            groupInfo: `${career?.name || '...'} - Sem ${group.semester} - G ${group.name}`,
            careerId: career?.id || 'unknown',
            careerName: career?.name || 'Carrera Desconocida',
        }
    }).filter((c): c is CourseWithDetails => c !== null);
  }, [allDataLoaded, courses, modules, groups, careers]);


  const handleAddNew = () => {
    setEditingCourse(undefined);
    setDialogOpen(true);
  };
  
  const navigateMonth = (direction: number) => {
    setCurrentDate(current => {
        if (!current) return new Date();
        const newDate = new Date(current);
        newDate.setDate(1); 
        newDate.setMonth(newDate.getMonth() + direction);
        return newDate;
    });
  };
  
  const handleCloseModal = () => setDayWithCourses(null);
  
  const MonthViewSkeleton = () => (
    <div className="border rounded-lg bg-card">
      <div className="grid grid-cols-7 bg-card">
        {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map(day => (
          <div key={day} className="py-2 text-center font-semibold text-sm text-muted-foreground border-b border-l h-10"></div>
        ))}
      </div>
      <div className="grid grid-cols-7 grid-rows-6">
        {Array.from({ length: 42 }).map((_, idx) => (
          <div key={idx} className="p-2 border-t border-l min-h-[6rem] bg-card">
            <Skeleton className="h-4 w-6 ml-auto" />
            <Skeleton className="h-5 w-full mt-2" />
            <Skeleton className="h-5 w-full mt-1" />
          </div>
        ))}
      </div>
    </div>
  );

  const MonthView = () => {
    if (!currentDate) {
        return <MonthViewSkeleton />;
    }
    
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDayOfMonth = new Date(year, month, 1);
    const startDate = new Date(firstDayOfMonth);
    const startDayOfWeek = startDate.getDay();
    startDate.setDate(startDate.getDate() - startDayOfWeek);

    const days = Array.from({ length: 42 }, (_, i) => {
        const date = new Date(startDate);
        date.setDate(startDate.getDate() + i);
        return date;
    });

    const dayOfWeekMap = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    // Use a timezone-safe method to get YYYY-MM-DD
    const toYyyyMmDd = (date: Date) => {
        return date.toLocaleDateString('sv'); // Swedish locale format is YYYY-MM-DD
    };
    
    const COURSES_LIMIT_PER_DAY = 2;

    return (
        <div className="border rounded-lg overflow-hidden bg-background">
            <div className="grid grid-cols-7 bg-card">
                {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map(day => (
                    <div key={day} className="py-2 text-center font-semibold text-sm text-muted-foreground border-b border-l">{day}</div>
                ))}
            </div>
            <div className="grid grid-cols-7 grid-rows-6">
                {days.map((date, idx) => {
                    const isOtherMonth = date.getMonth() !== month;
                    const dayOfWeek = dayOfWeekMap[date.getDay()];
                    
                    const scheduledCoursesForDay = coursesWithDetails
                        .map(course => {
                            const dateStr = toYyyyMmDd(date);
                            const courseStartDate = course.startDate.split('T')[0];
                            const courseEndDate = course.endDate.split('T')[0];

                            if (dateStr < courseStartDate || dateStr > courseEndDate) {
                                return null;
                            }

                            const hasEventOnDay = scheduleEvents?.some(e => e.courseId === course.id && e.day === dayOfWeek);
                            if (!hasEventOnDay) return null;
                            
                            return course;
                        })
                        .filter((c): c is CourseWithDetails => c !== null);

                    const uniqueScheduledCourses = Array.from(new Map(scheduledCoursesForDay.map(c => [c.id, c])).values())
                        .sort((a,b) => a.moduleName.localeCompare(b.moduleName));
                    
                    const visibleCourses = uniqueScheduledCourses.slice(0, COURSES_LIMIT_PER_DAY);
                    const hiddenCoursesCount = uniqueScheduledCourses.length - visibleCourses.length;

                    return (
                        <div
                            key={idx}
                            className={cn(`relative p-2 border-t border-l min-h-[6rem]`,
                                isOtherMonth ? 'bg-muted/30' : 'bg-card'
                            )}
                        >
                            <div className={cn('text-right text-xs font-semibold', isOtherMonth ? 'text-muted-foreground opacity-50' : 'text-foreground')}>{date.getDate()}</div>
                            <div className="space-y-1 mt-1">
                                {visibleCourses.map(course => (
                                    <div
                                        key={course.id}
                                        className="text-xs text-white px-1.5 py-1 rounded truncate font-medium"
                                        style={{ backgroundColor: getColorForCourse(course.moduleId) }}
                                        title={`${course.moduleName} | ${course.groupInfo}`}
                                    >
                                        {course.moduleName}
                                    </div>
                                ))}
                                {hiddenCoursesCount > 0 && (
                                    <button 
                                        className="text-xs text-primary font-semibold hover:underline mt-1 w-full text-left px-1"
                                        onClick={() => setDayWithCourses({ date, courses: uniqueScheduledCourses })}
                                    >
                                        + {hiddenCoursesCount} más
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
  };


  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold font-headline tracking-tight">Calendario de Cursos</h1>
            <Button onClick={handleAddNew}>
                <PlusCircle className="mr-2 h-4 w-4" />
                Añadir Curso
            </Button>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogContent className="sm:max-w-xl">
                <DialogHeader>
                    <DialogTitle>{editingCourse ? 'Editar Curso' : 'Añadir Nuevo Curso Programado'}</DialogTitle>
                    <DialogDescription>
                       {editingCourse ? 'Actualiza los detalles del curso.' : 'Rellena los detalles para programar un nuevo curso.'}
                    </DialogDescription>
                </DialogHeader>
                <CourseForm 
                    course={editingCourse} 
                    allCourses={courses || []}
                    modules={modules || []}
                    groups={groups || []}
                    careers={careers || []}
                    teachers={teachers || []}
                    scheduleEvents={scheduleEvents || []}
                    classrooms={classrooms || []}
                    onSuccess={() => setDialogOpen(false)} 
                />
            </DialogContent>
        </Dialog>

        <Dialog open={!!dayWithCourses} onOpenChange={(isOpen) => !isOpen && handleCloseModal()}>
            <DialogContent>
                {dayWithCourses && (
                    <>
                        <DialogHeader>
                            <DialogTitle>Cursos del {dayWithCourses.date.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}</DialogTitle>
                            <DialogDescription>
                                Lista completa de cursos programados para este día.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="max-h-[60vh] overflow-y-auto -mx-6 px-6">
                            <div className="space-y-3 py-4">
                                {dayWithCourses.courses.map(course => (
                                    <div 
                                        key={course.id} 
                                        className="text-sm p-3 rounded-md border flex items-center gap-3"
                                        style={{ borderLeftColor: getColorForCourse(course.moduleId), borderLeftWidth: '4px' }}
                                    >
                                        <div>
                                            <p className="font-semibold">{course.moduleName} ({course.totalHours}h)</p>
                                            <p className="text-muted-foreground">{course.groupInfo}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </>
                )}
            </DialogContent>
        </Dialog>


        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
                 <div className="flex-1">
                    <h2 className="text-lg font-semibold capitalize">
                      {currentDate ? currentDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }) : <Skeleton className="h-6 w-40" />}
                    </h2>
                </div>
                <div className="flex items-center gap-2">
                    <Button onClick={() => navigateMonth(-1)} variant="outline" size="icon" className="h-8 w-8" disabled={!currentDate}>
                        <ChevronLeft className="w-4 h-4" />
                    </Button>
                     <Button onClick={() => navigateMonth(1)} variant="outline" size="icon" className="h-8 w-8" disabled={!currentDate}>
                        <ChevronRight className="w-4 h-4" />
                    </Button>
                </div>
            </div>
          </CardHeader>
          <CardContent>
            {(!isClient || !allDataLoaded) ? <MonthViewSkeleton /> : <MonthView />}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  )
}
