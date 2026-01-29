'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { useFirestore } from '@/firebase';
import { addDoc, collection } from 'firebase/firestore';
import { useEffect, useMemo } from 'react';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import type { Career, Course, Group, Module, Teacher, Classroom, ScheduleEvent } from '@/lib/types';
import { ScrollArea } from '../ui/scroll-area';

const manualScheduleSchema = z.object({
  courseId: z.string().min(1, 'Debes seleccionar un curso.'),
  teacherId: z.string().min(1, 'Debes seleccionar un docente.'),
  classroomId: z.string().min(1, 'Debes seleccionar un aula.'),
  day: z.enum(['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']),
  startTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Formato HH:MM requerido."),
  endTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Formato HH:MM requerido."),
  startWeek: z.coerce.number().min(1, 'La semana de inicio es requerida.'),
  endWeek: z.coerce.number().min(1, 'La semana de fin es requerida.'),
}).refine(data => {
    const start = parseInt(data.startTime.replace(':', ''), 10);
    const end = parseInt(data.endTime.replace(':', ''), 10);
    return end > start;
}, {
    message: 'La hora de fin debe ser posterior a la de inicio.',
    path: ['endTime'],
}).refine(data => data.endWeek >= data.startWeek, {
    message: 'La semana de fin debe ser igual o posterior a la de inicio.',
    path: ['endWeek'],
});

type FormValues = z.infer<typeof manualScheduleSchema>;

interface ManualScheduleFormProps {
  courses: Course[];
  modules: Module[];
  groups: Group[];
  careers: Career[];
  teachers: Teacher[];
  classrooms: Classroom[];
  scheduleEvents: ScheduleEvent[];
  onSuccess: () => void;
}

const timeToMinutes = (time: string): number => {
  if (!time) return 0;
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
};

export function ManualScheduleForm({ courses, modules, groups, careers, teachers, classrooms, scheduleEvents, onSuccess }: ManualScheduleFormProps) {
  const firestore = useFirestore();
  const { toast } = useToast();

  const form = useForm<FormValues>({
    resolver: zodResolver(manualScheduleSchema),
    defaultValues: {
        courseId: '',
        teacherId: '',
        classroomId: '',
        day: 'Lunes',
        startTime: '07:00',
        endTime: '09:00',
        startWeek: 1,
        endWeek: 16,
    },
  });
  
  const selectedTeacherId = form.watch('teacherId');

  const teacherOptions = useMemo(() => teachers.sort((a,b) => a.name.localeCompare(b.name)), [teachers]);
  const classroomOptions = useMemo(() => classrooms.sort((a,b) => a.name.localeCompare(b.name)), [classrooms]);

  const filteredCourseOptions = useMemo(() => {
    if (!selectedTeacherId) {
        return [];
    }
    const selectedTeacher = teachers.find(t => t.id === selectedTeacherId);
    if (!selectedTeacher || !selectedTeacher.specialties) {
        return [];
    }

    const teacherSpecialtyModuleIds = selectedTeacher.specialties;

    const filteredCourses = courses.filter(course => teacherSpecialtyModuleIds.includes(course.moduleId));
    
    return filteredCourses.map(course => {
        const module = modules.find(m => m.id === course.moduleId);
        const group = groups.find(g => g.id === course.groupId);
        const career = careers.find(c => c.id === group?.careerId);
        return {
            value: course.id,
            label: `${module?.name || '...'} | ${group ? `${career?.name || '...'} - Sem ${group.semester} - G ${group.name}` : '...'}`,
        }
    }).sort((a,b) => a.label.localeCompare(b.label));
  }, [selectedTeacherId, teachers, courses, modules, groups, careers]);
  
  useEffect(() => {
    const currentCourseId = form.getValues('courseId');
    if (currentCourseId) {
        const isCourseStillValid = filteredCourseOptions.some(opt => opt.value === currentCourseId);
        if (!isCourseStillValid) {
            form.setValue('courseId', '', { shouldValidate: true });
        }
    }
  }, [selectedTeacherId, filteredCourseOptions, form]);


  const onSubmit = async (data: FormValues) => {
    if (!firestore) return;

    // --- VALIDATION LOGIC ---
    const startMinutes = timeToMinutes(data.startTime);
    const endMinutes = timeToMinutes(data.endTime);

    // 1. Classroom capacity
    const selectedCourse = courses.find(c => c.id === data.courseId);
    const groupForCourse = groups.find(g => g.id === selectedCourse?.groupId);
    const selectedClassroom = classrooms.find(c => c.id === data.classroomId);

    if (groupForCourse && selectedClassroom && groupForCourse.studentCount > selectedClassroom.capacity) {
        toast({ variant: "destructive", title: "Conflicto de Capacidad", description: `El aula ${selectedClassroom.name} (${selectedClassroom.capacity}) no tiene capacidad para el grupo (${groupForCourse.studentCount} estudiantes).` });
        return;
    }
    
    // 2. Overlap checks
    for (const event of scheduleEvents) {
        if (event.day !== data.day) continue;

        const eventStartMinutes = timeToMinutes(event.startTime);
        const eventEndMinutes = timeToMinutes(event.endTime);

        const timeOverlap = startMinutes < eventEndMinutes && endMinutes > eventStartMinutes;
        if (!timeOverlap) continue;

        // Teacher clash
        if (event.teacherId === data.teacherId) {
            toast({ variant: "destructive", title: "Conflicto de Docente", description: `El docente ya tiene una clase programada en ese horario.` });
            return;
        }

        // Classroom clash
        if (event.classroomId === data.classroomId) {
            toast({ variant: "destructive", title: "Conflicto de Aula", description: `El aula ya está ocupada en ese horario.` });
            return;
        }
        
        // Group clash
        const eventCourse = courses.find(c => c.id === event.courseId);
        if (eventCourse?.groupId === selectedCourse?.groupId) {
             toast({ variant: "destructive", title: "Conflicto de Grupo", description: `El grupo ya tiene una clase programada en ese horario.` });
             return;
        }
    }
    
    // 3. Teacher hours (This is a soft validation, just a warning)
    const selectedTeacher = teachers.find(t => t.id === data.teacherId);
    if(selectedTeacher) {
        const duration = (endMinutes - startMinutes) / 60;
        const currentHours = scheduleEvents.filter(e => e.teacherId === data.teacherId).reduce((acc, e) => acc + ((timeToMinutes(e.endTime) - timeToMinutes(e.startTime))/60) , 0);
        const newTotalHours = currentHours + duration;
        if (newTotalHours > selectedTeacher.maxWeeklyHours) {
            toast({ variant: "default", title: "Advertencia de Horas", description: `Con esta clase, el docente superará sus horas semanales máximas (${newTotalHours.toFixed(2)} / ${selectedTeacher.maxWeeklyHours}).` });
        }
    }

    try {
        const collectionRef = collection(firestore, 'schedules');
        await addDoc(collectionRef, data);
        toast({ title: 'Horario Creado', description: 'Se ha añadido la nueva clase al horario.' });
        onSuccess();
    } catch (e) {
        const permissionError = new FirestorePermissionError({
            path: 'schedules',
            operation: 'create',
            requestResourceData: data,
        });
        errorEmitter.emit('permission-error', permissionError);
    }
  };

  return (
     <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 max-h-[70vh] overflow-y-auto p-1">
        <FormField
          control={form.control}
          name="teacherId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Docente</FormLabel>
               <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl><SelectTrigger><SelectValue placeholder="Selecciona un docente..." /></SelectTrigger></FormControl>
                  <SelectContent>
                    <ScrollArea className="h-48">
                      {teacherOptions.map(option => <SelectItem key={option.id} value={option.id}>{option.name}</SelectItem>)}
                    </ScrollArea>
                  </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="courseId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Curso (Módulos Asignados al Docente)</FormLabel>
              <Select onValueChange={field.onChange} value={field.value} disabled={!selectedTeacherId}>
                  <FormControl><SelectTrigger><SelectValue placeholder={selectedTeacherId ? "Selecciona un curso..." : "Selecciona un docente primero"} /></SelectTrigger></FormControl>
                  <SelectContent>
                    <ScrollArea className="h-48">
                      {filteredCourseOptions.map(option => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
                    </ScrollArea>
                  </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="classroomId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Aula</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl><SelectTrigger><SelectValue placeholder="Selecciona un aula..." /></SelectTrigger></FormControl>
                  <SelectContent>
                    <ScrollArea className="h-48">
                      {classroomOptions.map(option => <SelectItem key={option.id} value={option.id}>{option.name} (Cap: {option.capacity})</SelectItem>)}
                    </ScrollArea>
                  </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="day"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Día</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl><SelectTrigger><SelectValue placeholder="Selecciona un día" /></SelectTrigger></FormControl>
                <SelectContent>
                  {['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'].map(day => <SelectItem key={day} value={day}>{day}</SelectItem>)}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid grid-cols-2 gap-4">
            <FormField
                control={form.control}
                name="startTime"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Hora Inicio</FormLabel>
                    <FormControl><Input type="time" {...field} /></FormControl>
                    <FormMessage />
                    </FormItem>
                )}
            />
            <FormField
                control={form.control}
                name="endTime"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Hora Fin</FormLabel>
                    <FormControl><Input type="time" {...field} /></FormControl>
                    <FormMessage />
                    </FormItem>
                )}
            />
        </div>
        <div className="grid grid-cols-2 gap-4">
            <FormField
                control={form.control}
                name="startWeek"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Semana Inicio</FormLabel>
                    <FormControl><Input type="number" {...field} /></FormControl>
                    <FormMessage />
                    </FormItem>
                )}
            />
            <FormField
                control={form.control}
                name="endWeek"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Semana Fin</FormLabel>
                    <FormControl><Input type="number" {...field} /></FormControl>
                    <FormMessage />
                    </FormItem>
                )}
            />
        </div>

        <Button type="submit" disabled={form.formState.isSubmitting} className="w-full">
          {form.formState.isSubmitting ? 'Guardando...' : 'Guardar Clase'}
        </Button>
      </form>
    </Form>
  );
}
