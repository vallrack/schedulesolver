'use client';
import React, { useState, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { generateInitialSchedule } from '@/lib/actions';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Sparkles } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ScheduleEvent, Teacher, Module, Classroom, Group, Career, Course } from '@/lib/types';
import { useFirestore } from '@/firebase';
import { useCollection } from '@/firebase/firestore/use-collection';
import { collection, writeBatch, getDocs, doc } from 'firebase/firestore';
import { ScheduleCalendar } from './schedule-calendar';


export default function ScheduleView() {
  const [schedule, setSchedule] = useState<ScheduleEvent[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();

  const firestore = useFirestore();
  const teachersCollection = useMemo(() => (firestore ? collection(firestore, 'teachers') : null), [firestore]);
  const coursesCollection = useMemo(() => (firestore ? collection(firestore, 'courses') : null), [firestore]);
  const modulesCollection = useMemo(() => (firestore ? collection(firestore, 'modules') : null), [firestore]);
  const classroomsCollection = useMemo(() => (firestore ? collection(firestore, 'classrooms') : null), [firestore]);
  const schedulesCollection = useMemo(() => (firestore ? collection(firestore, 'schedules') : null), [firestore]);
  const groupsCollection = useMemo(() => (firestore ? collection(firestore, 'groups') : null), [firestore]);
  const careersCollection = useMemo(() => (firestore ? collection(firestore, 'careers') : null), [firestore]);


  const { data: teachers, loading: loadingTeachers } = useCollection<Teacher>(teachersCollection);
  const { data: courses, loading: loadingCourses } = useCollection<Course>(coursesCollection);
  const { data: modules, loading: loadingModules } = useCollection<Module>(modulesCollection);
  const { data: classrooms, loading: loadingClassrooms } = useCollection<Classroom>(classroomsCollection);
  const { data: scheduleEvents, loading: loadingSchedule, error: errorSchedule } = useCollection<ScheduleEvent>(schedulesCollection);
  const { data: groups, loading: loadingGroups } = useCollection<Group>(groupsCollection);
  const { data: careers, loading: loadingCareers } = useCollection<Career>(careersCollection);
  
  const [selectedTeacher, setSelectedTeacher] = useState<string | undefined>(undefined);
  const [selectedGroup, setSelectedGroup] = useState<string | undefined>(undefined);
  const [selectedClassroom, setSelectedClassroom] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (scheduleEvents) {
      setSchedule(scheduleEvents);
    }
  }, [scheduleEvents]);

  const groupOptions = useMemo(() => {
    if (!groups || !careers) return [];
    const options = groups.map(group => {
        const career = careers.find(c => c.id === group.careerId);
        return {
            id: group.id,
            name: `${career?.name || '...'} - Sem ${group.semester} - G ${group.name}`
        }
    });
    return options.sort((a, b) => a.name.localeCompare(b.name));
  }, [groups, careers]);

  useEffect(() => {
      if (teachers && teachers.length > 0 && !selectedTeacher) {
          const sortedTeachers = [...teachers].sort((a, b) => a.name.localeCompare(b.name));
          setSelectedTeacher(sortedTeachers[0].id);
      }
  }, [teachers, selectedTeacher]);

  useEffect(() => {
      if (groupOptions && groupOptions.length > 0 && !selectedGroup) {
          setSelectedGroup(groupOptions[0].id);
      }
  }, [groupOptions, selectedGroup]);

  useEffect(() => {
      if (classrooms && classrooms.length > 0 && !selectedClassroom) {
          const sortedClassrooms = [...classrooms].sort((a, b) => a.name.localeCompare(b.name));
          setSelectedClassroom(sortedClassrooms[0].id);
      }
  }, [classrooms, selectedClassroom]);


  const handleGenerateSchedule = async () => {
    if (!firestore || !schedulesCollection || !courses) {
        toast({
            variant: 'destructive',
            title: 'Error',
            description: 'Faltan datos para generar el horario. Asegúrate de tener cursos programados.',
        });
        return;
    }

    setIsGenerating(true);
    try {
      const result = await generateInitialSchedule({
        subjects: JSON.stringify(courses), // Passing courses as "subjects" to the AI
        teachers: JSON.stringify(teachers),
        classrooms: JSON.stringify(classrooms),
        groups: JSON.stringify(groups),
        constraints: JSON.stringify([
          'Un profesor no puede estar en dos lugares a la vez.',
          'Un grupo no puede tener dos clases al mismo tiempo.',
          'No exceder la capacidad del aula. Compara la capacidad del aula (`capacity`) con la cantidad de estudiantes del grupo (`studentCount`).',
          'Respetar la duración exacta del curso.',
          'Evitar huecos excesivos para profesores y alumnos.',
          'Preferir turnos de mañana/tarde cuando sea posible.',
        ]),
      });
      
      const newScheduleEvents = result.schedule;

      if (!Array.isArray(newScheduleEvents)) {
          throw new Error("La IA no devolvió un formato de horario válido.");
      }

      const batch = writeBatch(firestore);

      const existingSchedulesSnap = await getDocs(schedulesCollection);
      existingSchedulesSnap.forEach(document => {
          batch.delete(document.ref);
      });

      newScheduleEvents.forEach(event => {
          const newEventRef = doc(schedulesCollection);
          batch.set(newEventRef, event);
      });

      await batch.commit();

      toast({
        title: 'Horario Generado y Guardado',
        description: 'Se ha generado con éxito un nuevo horario y se ha guardado en la base de datos.',
      });
    } catch (error: any) {
      console.error("Error generating schedule:", error);
      toast({
        variant: 'destructive',
        title: 'Error al Generar Horario',
        description: error.message || 'Ocurrió un error inesperado. Por favor, inténtalo de nuevo.',
      });
    } finally {
      setIsGenerating(false);
    }
  };
  
  const loading = loadingTeachers || loadingCourses || loadingModules || loadingClassrooms || loadingSchedule || loadingGroups || loadingCareers;

  const teacherEvents = useMemo(() => {
    if (!selectedTeacher) return [];
    return schedule.filter(e => e.teacherId === selectedTeacher);
  }, [schedule, selectedTeacher]);

  const groupEvents = useMemo(() => {
      if (!selectedGroup || !courses) return [];
      const groupCourses = courses.filter(c => c.groupId === selectedGroup).map(c => c.id);
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
                        {teachers?.sort((a,b) => a.name.localeCompare(b.name)).map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                    </SelectContent>
                 </Select>
               </div>
               {selectedTeacher && <ScheduleCalendar events={teacherEvents} courses={courses || []} modules={modules || []} teachers={teachers || []} classrooms={classrooms || []} groups={groups || []} />}
            </TabsContent>
            <TabsContent value="group" className="mt-4">
               <div className="max-w-sm">
                 <Select onValueChange={setSelectedGroup} value={selectedGroup}>
                    <SelectTrigger>
                        <SelectValue placeholder="Selecciona un grupo..." />
                    </SelectTrigger>
                    <SelectContent>
                        {groupOptions?.map(g => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
                    </SelectContent>
                 </Select>
               </div>
               {selectedGroup && <ScheduleCalendar events={groupEvents} courses={courses || []} modules={modules || []} teachers={teachers || []} classrooms={classrooms || []} groups={groups || []} />}
            </TabsContent>
            <TabsContent value="classroom" className="mt-4">
              <div className="max-w-sm">
                 <Select onValueChange={setSelectedClassroom} value={selectedClassroom}>
                    <SelectTrigger>
                        <SelectValue placeholder="Selecciona un aula..." />
                    </SelectTrigger>
                    <SelectContent>
                        {classrooms?.sort((a, b) => a.name.localeCompare(b.name)).map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                 </Select>
               </div>
               {selectedClassroom && <ScheduleCalendar events={classroomEvents} courses={courses || []} modules={modules || []} teachers={teachers || []} classrooms={classrooms || []} groups={groups || []} />}
            </TabsContent>
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
}
