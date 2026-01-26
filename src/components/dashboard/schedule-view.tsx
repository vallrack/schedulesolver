'use client';
import React, { useState, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { generateInitialSchedule } from '@/lib/actions';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Sparkles } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ScheduleEvent, Teacher, Course, Classroom } from '@/lib/types';
import { useFirestore } from '@/firebase';
import { useCollection } from '@/firebase/firestore/use-collection';
import { collection } from 'firebase/firestore';
import { ScheduleCalendar } from './schedule-calendar';

const getResourceName = (resource: Teacher | Course | Classroom, viewMode: 'teacher' | 'group' | 'classroom') => {
    if (viewMode === 'group') {
        const course = resource as Course;
        return `${course.career} S${course.semester} G${course.group}`;
    }
    return (resource as Teacher | Classroom).name;
};

const getResourceId = (resource: Teacher | Course | Classroom, viewMode: 'teacher' | 'group' | 'classroom') => {
    if(viewMode === 'group') {
        const course = resource as Course;
        return `${course.career}-${course.semester}-${course.group}`;
    }
    return resource.id;
}

export default function ScheduleView() {
  const [schedule, setSchedule] = useState<ScheduleEvent[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();

  const firestore = useFirestore();
  const teachersCollection = useMemo(() => (firestore ? collection(firestore, 'teachers') : null), [firestore]);
  const coursesCollection = useMemo(() => (firestore ? collection(firestore, 'courses') : null), [firestore]);
  const classroomsCollection = useMemo(() => (firestore ? collection(firestore, 'classrooms') : null), [firestore]);
  const horariosCollection = useMemo(() => (firestore ? collection(firestore, 'horarios') : null), [firestore]);

  const { data: teachers, loading: loadingTeachers } = useCollection<Teacher>(teachersCollection);
  const { data: courses, loading: loadingCourses } = useCollection<Course>(coursesCollection);
  const { data: classrooms, loading: loadingClassrooms } = useCollection<Classroom>(classroomsCollection);
  const { data: scheduleEvents, loading: loadingSchedule, error: errorSchedule } = useCollection<ScheduleEvent>(horariosCollection);
  
  const [selectedTeacher, setSelectedTeacher] = useState<string | undefined>(undefined);
  const [selectedGroup, setSelectedGroup] = useState<string | undefined>(undefined);
  const [selectedClassroom, setSelectedClassroom] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (scheduleEvents) {
      setSchedule(scheduleEvents);
    }
  }, [scheduleEvents]);

  const uniqueGroups = useMemo(() => {
    if (!courses) return [];
    return [...new Map(courses.map(c => [`${c.career}-${c.semester}-${c.group}`, c])).values()];
  }, [courses]);

  useEffect(() => {
      if (teachers && teachers.length > 0 && !selectedTeacher) {
          setSelectedTeacher(teachers[0].id);
      }
  }, [teachers, selectedTeacher]);

  useEffect(() => {
      if (uniqueGroups && uniqueGroups.length > 0 && !selectedGroup) {
          setSelectedGroup(getResourceId(uniqueGroups[0], 'group'));
      }
  }, [uniqueGroups, selectedGroup]);

  useEffect(() => {
      if (classrooms && classrooms.length > 0 && !selectedClassroom) {
          setSelectedClassroom(classrooms[0].id);
      }
  }, [classrooms, selectedClassroom]);


  const handleGenerateSchedule = async () => {
    setIsGenerating(true);
    try {
      const result = await generateInitialSchedule({
        courses: JSON.stringify(courses),
        teachers: JSON.stringify(teachers),
        classrooms: JSON.stringify(classrooms),
        constraints: JSON.stringify([
          'Un profesor no puede estar en dos lugares a la vez.',
          'Un grupo no puede tener dos clases al mismo tiempo.',
          'No exceder la capacidad del aula.',
          'Respetar la duración exacta de la materia.',
          'Evitar huecos excesivos para profesores y alumnos.',
          'Preferir turnos de mañana/tarde cuando sea posible.',
        ]),
      });
      // This is a placeholder, you should save the generated schedule to Firestore
      // For now, it just updates the local state.
      setSchedule(JSON.parse(result.schedule));
      toast({
        title: 'Horario Generado',
        description: 'Se ha generado con éxito un nuevo horario base.',
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error al Generar Horario',
        description: 'Ocurrió un error inesperado. Por favor, inténtalo de nuevo.',
      });
    } finally {
      setIsGenerating(false);
    }
  };
  
  const loading = loadingTeachers || loadingCourses || loadingClassrooms || loadingSchedule;

  const teacherEvents = useMemo(() => {
    if (!selectedTeacher) return [];
    return schedule.filter(e => e.teacherId === selectedTeacher);
  }, [schedule, selectedTeacher]);

  const groupEvents = useMemo(() => {
      if (!selectedGroup || !courses) return [];
      const groupCourses = courses.filter(c => getResourceId(c, 'group') === selectedGroup).map(c => c.id);
      return schedule.filter(e => groupCourses.includes(e.courseId));
  }, [schedule, selectedGroup, courses]);

  const classroomEvents = useMemo(() => {
    if (!selectedClassroom) return [];
    return schedule.filter(e => e.classroomId === selectedClassroom);
  }, [schedule, selectedClassroom]);


  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <CardTitle className="font-headline">Horario de Clases</CardTitle>
          <Button onClick={handleGenerateSchedule} disabled={isGenerating || loading} size="sm">
            {isGenerating ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="mr-2 h-4 w-4" />
            )}
            Generar con IA
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading && <div className="flex justify-center items-center h-64"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>}
        {errorSchedule && <div className="text-destructive text-center">Error al cargar el horario: {errorSchedule.message}</div>}
        {!loading && !errorSchedule && (
          <Tabs defaultValue="teacher" className="w-full">
            <TabsList>
              <TabsTrigger value="teacher">Por Docente</TabsTrigger>
              <TabsTrigger value="group">Por Grupo</TabsTrigger>
              <TabsTrigger value="classroom">Por Aula</TabsTrigger>
            </TabsList>
            
            <TabsContent value="teacher" className="mt-4">
               <div className="max-w-sm">
                 <Select onValueChange={setSelectedTeacher} value={selectedTeacher}>
                    <SelectTrigger>
                        <SelectValue placeholder="Selecciona un docente..." />
                    </SelectTrigger>
                    <SelectContent>
                        {teachers?.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                    </SelectContent>
                 </Select>
               </div>
               {selectedTeacher && <ScheduleCalendar events={teacherEvents} courses={courses || []} teachers={teachers || []} classrooms={classrooms || []} />}
            </TabsContent>
            <TabsContent value="group" className="mt-4">
               <div className="max-w-sm">
                 <Select onValueChange={setSelectedGroup} value={selectedGroup}>
                    <SelectTrigger>
                        <SelectValue placeholder="Selecciona un grupo..." />
                    </SelectTrigger>
                    <SelectContent>
                        {uniqueGroups?.map(g => <SelectItem key={getResourceId(g, 'group')} value={getResourceId(g, 'group')}>{getResourceName(g, 'group')}</SelectItem>)}
                    </SelectContent>
                 </Select>
               </div>
               {selectedGroup && <ScheduleCalendar events={groupEvents} courses={courses || []} teachers={teachers || []} classrooms={classrooms || []} />}
            </TabsContent>
            <TabsContent value="classroom" className="mt-4">
              <div className="max-w-sm">
                 <Select onValueChange={setSelectedClassroom} value={selectedClassroom}>
                    <SelectTrigger>
                        <SelectValue placeholder="Selecciona un aula..." />
                    </SelectTrigger>
                    <SelectContent>
                        {classrooms?.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                 </Select>
               </div>
               {selectedClassroom && <ScheduleCalendar events={classroomEvents} courses={courses || []} teachers={teachers || []} classrooms={classrooms || []} />}
            </TabsContent>
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
}
