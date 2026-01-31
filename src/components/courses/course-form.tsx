'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import type { Career, Course, Group, Module, Teacher, ScheduleEvent, Classroom } from '@/lib/types';
import { useFirestore } from '@/firebase';
import { addDoc, collection, doc, setDoc, writeBatch, updateDoc } from 'firebase/firestore';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, differenceInCalendarWeeks, startOfWeek as getStartOfWeek } from 'date-fns';
import { es } from 'date-fns/locale';
import { Calendar } from '@/components/ui/calendar';
import { useEffect, useMemo } from 'react';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Separator } from '../ui/separator';
import { Checkbox } from '../ui/checkbox';


const courseAndScheduleSchema = z.object({
  // course fields
  moduleId: z.string().min(1, { message: 'El módulo es obligatorio.' }),
  groupId: z.string().min(1, { message: 'El grupo es obligatorio.' }),
  durationWeeks: z.coerce.number(), // Ya no requiere validación de usuario
  totalHours: z.coerce.number().min(1, 'Las horas deben ser mayor a 0.'),
  startDate: z.date({ required_error: 'La fecha de inicio es obligatoria.' }),
  endDate: z.date({ required_error: 'La fecha de fin es obligatoria.' }),
  // optional schedule fields
  teacherId: z.string().optional(),
  classroomId: z.string().optional(),
  days: z.array(z.string()).optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
}).refine(data => data.endDate > data.startDate, {
    message: 'La fecha de fin debe ser posterior a la fecha de inicio.',
    path: ['endDate'],
}).superRefine((data, ctx) => {
    // If any optional schedule field is filled, all must be filled
    const scheduleFields = [data.teacherId, data.classroomId, data.days, data.startTime, data.endTime];
    const partialSchedule = scheduleFields.some(f => f !== undefined && f !== '' && (!Array.isArray(f) || f.length > 0));
    const allScheduleFieldsPresent = scheduleFields.every(f => f !== undefined && f !== '' && (!Array.isArray(f) || f.length > 0));

    if (partialSchedule && !allScheduleFieldsPresent) {
        if (!data.teacherId) ctx.addIssue({ path: ['teacherId'], message: 'Requerido' });
        if (!data.classroomId) ctx.addIssue({ path: ['classroomId'], message: 'Requerido' });
        if (!data.days || data.days.length === 0) ctx.addIssue({ path: ['days'], message: 'Requerido' });
        if (!data.startTime) ctx.addIssue({ path: ['startTime'], message: 'Requerido' });
        if (!data.endTime) ctx.addIssue({ path: ['endTime'], message: 'Requerido' });
    }

    if (data.startTime && !/^(?:2[0-3]|[01]?[0-9]):[0-5][0-9]$/.test(data.startTime)) {
        ctx.addIssue({ path: ['startTime'], message: 'Formato HH:MM requerido.' });
    }
     if (data.endTime && !/^(?:2[0-3]|[01]?[0-9]):[0-5][0-9]$/.test(data.endTime)) {
        ctx.addIssue({ path: ['endTime'], message: 'Formato HH:MM requerido.' });
    }

    if (data.startTime && data.endTime && /^(?:2[0-3]|[01]?[0-9]):[0-5][0-9]$/.test(data.startTime) && /^(?:2[0-3]|[01]?[0-9]):[0-5][0-9]$/.test(data.endTime)) {
        const start = parseInt(data.startTime.replace(':', ''), 10);
        const end = parseInt(data.endTime.replace(':', ''), 10);
        if (end <= start) {
            ctx.addIssue({
                path: ['endTime'],
                message: 'La hora de fin debe ser posterior a la de inicio.',
            });
        }
    }
});


type CourseFormValues = z.infer<typeof courseAndScheduleSchema>;

interface CourseFormProps {
  course?: Course;
  allCourses: Course[];
  modules: Module[];
  groups: Group[];
  careers: Career[];
  onSuccess: () => void;
  teachers: Teacher[];
  scheduleEvents: ScheduleEvent[];
  classrooms: Classroom[];
}

// Función mejorada para parsear fechas que maneja múltiples formatos
const safeParseDate = (dateString?: string): Date | undefined => {
  if (!dateString) return undefined;
  
  try {
    // Si es formato ISO completo (con T y hora)
    if (dateString.includes('T')) {
      const [datePart] = dateString.split('T');
      const [year, month, day] = datePart.split('-').map(Number);
      return new Date(year, month - 1, day);
    }
    
    // Si es formato simple YYYY-MM-DD
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(year, month - 1, day);
  } catch (error) {
    console.error('Error parsing date:', dateString, error);
    return undefined;
  }
};

// Función para convertir Date a formato YYYY-MM-DD (sin zona horaria)
const formatDateToString = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export function CourseForm({ course, allCourses, modules, groups, careers, onSuccess, teachers, scheduleEvents, classrooms }: CourseFormProps) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const isEditMode = !!course;

  const defaultValues = useMemo(() => {
    const courseValues = course ? {
      ...course,
      startDate: safeParseDate(course.startDate),
      endDate: safeParseDate(course.endDate),
    } : {
      moduleId: '',
      groupId: '',
      durationWeeks: 1,
      totalHours: 1,
      startDate: undefined,
      endDate: undefined,
    };
    
    let scheduleValues: Partial<CourseFormValues> = {
        teacherId: '',
        classroomId: '',
        days: [],
        startTime: '',
        endTime: '',
    };
    
    if (course && scheduleEvents && scheduleEvents.length > 0) {
        const eventsForCourse = scheduleEvents.filter(e => e.courseId === course.id);
        if (eventsForCourse.length > 0) {
            const firstEvent = eventsForCourse[0];
            const uniqueDays = [...new Set(eventsForCourse.map(e => e.day))];
            scheduleValues = {
                teacherId: firstEvent.teacherId,
                classroomId: firstEvent.classroomId,
                days: uniqueDays,
                startTime: firstEvent.startTime,
                endTime: firstEvent.endTime,
            };
        }
    }
    
    return { ...courseValues, ...scheduleValues } as CourseFormValues;
  }, [course, scheduleEvents]);

  const form = useForm<CourseFormValues>({
    resolver: zodResolver(courseAndScheduleSchema),
    defaultValues,
  });

  const startDate = form.watch('startDate');
  const endDate = form.watch('endDate');

  useEffect(() => {
    if (startDate && endDate && endDate > startDate) {
      const weeks = differenceInCalendarWeeks(endDate, startDate, { weekStartsOn: 1 }) + 1;
      form.setValue('durationWeeks', weeks, { shouldValidate: true });
    } else {
      form.setValue('durationWeeks', 0);
    }
  }, [startDate, endDate, form]);


  useEffect(() => {
    form.reset(defaultValues);
  }, [course, defaultValues, form]);
  
  const groupOptions = useMemo(() => {
    if (!groups || !careers) return [];
    const options = groups.map(group => {
        const career = careers.find(c => c.id === group.careerId);
        return {
            value: group.id,
            label: `${career?.name || '...'} - Sem ${group.semester} - G ${group.name}`
        }
    });
    return options.sort((a, b) => a.label.localeCompare(b.label));
  }, [groups, careers]);

  const sortedModules = useMemo(() => {
    if (!modules) return [];
    return [...modules].sort((a, b) => a.name.localeCompare(b.name));
  }, [modules]);
  
  const classroomOptions = useMemo(() => classrooms.sort((a,b) => a.name.localeCompare(b.name)), [classrooms]);

  const selectedModuleId = form.watch('moduleId');
  const teacherOptions = useMemo(() => {
      if (!selectedModuleId || !teachers) return [];
      const availableTeachers = teachers.filter(t => t.specialties?.includes(selectedModuleId));
      return availableTeachers.sort((a, b) => a.name.localeCompare(b.name));
  }, [selectedModuleId, teachers]);
  
   useEffect(() => {
      const currentTeacherId = form.getValues('teacherId');
      if (currentTeacherId) {
          const isTeacherStillValid = teacherOptions.some(opt => opt.id === currentTeacherId);
          if (!isTeacherStillValid) {
              form.setValue('teacherId', '', { shouldValidate: true });
          }
      }
  }, [selectedModuleId, teacherOptions, form]);


  const onSubmit = async (data: CourseFormValues) => {
    if (!firestore) return;

    // --- VALIDATION LOGIC ---
    const newCourseStartDate = data.startDate;
    const newCourseEndDate = data.endDate;
    const newCourseGroupId = data.groupId;

    const overlappingCourse = allCourses.find(existingCourse => {
        if (course && existingCourse.id === course.id) return false;
        if (existingCourse.groupId !== newCourseGroupId) return false;

        const existingStartDate = safeParseDate(existingCourse.startDate);
        const existingEndDate = safeParseDate(existingCourse.endDate);
        
        if (!existingStartDate || !existingEndDate) return false;
        
        return newCourseStartDate <= existingEndDate && existingStartDate <= newCourseEndDate;
    });

    if (overlappingCourse) {
        const module = modules.find(m => m.id === overlappingCourse.moduleId);
        toast({
            variant: "destructive",
            title: "Conflicto de Horario Detectado",
            description: `El grupo ya tiene el curso "${module?.name || 'Desconocido'}" programado durante ese período de tiempo.`,
        });
        return;
    }

    if (data.durationWeeks < 1) {
        toast({
            variant: "destructive",
            title: "Error de Fechas",
            description: "La duración debe ser de al menos 1 semana. Revisa las fechas de inicio y fin.",
        });
        return;
    }


    const { teacherId, classroomId, days, startTime, endTime } = data;
    
    // Explicitly build the data object for Firestore to ensure consistency
    const courseData = { 
        moduleId: data.moduleId,
        groupId: data.groupId,
        totalHours: data.totalHours,
        durationWeeks: data.durationWeeks,
        startDate: formatDateToString(data.startDate),
        endDate: formatDateToString(data.endDate),
    };

    try {
        let courseId = course?.id;
        // 1. Create or update course
        if (isEditMode && courseId) {
          const courseRef = doc(firestore, 'courses', courseId);
          await updateDoc(courseRef, courseData);
          toast({ title: 'Curso Actualizado', description: `Se ha actualizado el curso programado.` });
        } else {
          const collectionRef = collection(firestore, 'courses');
          const courseDocRef = await addDoc(collectionRef, courseData);
          courseId = courseDocRef.id;
          toast({ title: 'Curso Añadido', description: `Se ha programado un nuevo curso.` });
        }

        // 2. Handle schedule events
        const scheduleFieldsArePresent = teacherId && classroomId && days && startTime && endTime;

        const existingEvents = scheduleEvents.filter(e => e.courseId === courseId);
        
        // If editing and there are schedule fields, or if creating and there are schedule fields
        if (scheduleFieldsArePresent && courseId) {
            const batch = writeBatch(firestore);

            // Delete old events if they exist
            if (existingEvents.length > 0) {
                existingEvents.forEach(e => batch.delete(doc(firestore, 'schedules', e.id)));
            }

            const startWeek = 1;
            const endWeek = data.durationWeeks;
            
            const schedulesCol = collection(firestore, 'schedules');
            days.forEach(day => {
                const newEventRef = doc(schedulesCol);
                const eventData: Omit<ScheduleEvent, 'id'> = {
                    courseId: courseId!,
                    teacherId: teacherId,
                    classroomId: classroomId,
                    day: day,
                    startTime: startTime,
                    endTime: endTime,
                    startWeek: startWeek,
                    endWeek: endWeek
                };
                batch.set(newEventRef, eventData);
            });
            await batch.commit();
            toast({ title: 'Clases Programadas', description: `Se han creado/actualizado ${days.length} clase(s) recurrente(s).` });
        } else if (isEditMode && existingEvents.length > 0) {
            // If editing and schedule fields are removed, delete existing events
            const deleteBatch = writeBatch(firestore);
            existingEvents.forEach(e => deleteBatch.delete(doc(firestore, 'schedules', e.id)));
            await deleteBatch.commit();
            toast({ title: 'Clases Desasignadas', description: 'Se han eliminado las clases asociadas a este curso.' });
        }

        onSuccess();
    } catch(e) {
        console.error('Error saving course:', e);
        const path = course ? `courses/${course.id}` : 'courses';
        const operation = course ? 'update' : 'create';
        const permissionError = new FirestorePermissionError({
            path,
            operation,
            requestResourceData: courseData,
        });
        errorEmitter.emit('permission-error', permissionError);
    }
  };
  
  const availableDays = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];


  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 max-h-[70vh] overflow-y-auto p-1">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
             <FormField
              control={form.control}
              name="moduleId"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Módulo</FormLabel>
                  <Select onValueChange={(value) => {
                      field.onChange(value);
                      const selectedModule = modules.find(m => m.id === value);
                      if (selectedModule) {
                          form.setValue('totalHours', selectedModule.totalHours, { shouldValidate: true });
                      }
                  }} value={field.value}>
                    <FormControl>
                        <SelectTrigger>
                            <SelectValue placeholder="Selecciona un módulo" />
                        </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <ScrollArea className="h-48">
                          {sortedModules.map((module) => (
                              <SelectItem key={module.id} value={module.id}>
                                  <span className="whitespace-normal">{module.name}</span>
                              </SelectItem>
                          ))}
                      </ScrollArea>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="groupId"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Grupo</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                          <SelectTrigger>
                              <SelectValue placeholder="Selecciona un grupo" />
                          </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <ScrollArea className="h-48">
                          {groupOptions.map((group) => (
                              <SelectItem key={group.value} value={group.value}>
                                <span className="whitespace-normal">{group.label}</span>
                              </SelectItem>
                          ))}
                        </ScrollArea>
                      </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField
            control={form.control}
            name="durationWeeks"
            render={({ field }) => (
                <FormItem>
                <FormLabel>Duración (Semanas)</FormLabel>
                <FormControl><Input type="number" {...field} disabled /></FormControl>
                <FormMessage />
                </FormItem>
            )}
            />
            <FormField
            control={form.control}
            name="totalHours"
            render={({ field }) => (
                <FormItem>
                <FormLabel>Horas Totales</FormLabel>
                <FormControl><Input type="number" {...field} /></FormControl>
                <FormMessage />
                </FormItem>
            )}
            />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="startDate"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>Fecha de Inicio del Curso</FormLabel>
                <Popover modal={true}>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button
                        variant={"outline"}
                        className={cn(
                          "w-full pl-3 text-left font-normal",
                          !field.value && "text-muted-foreground"
                        )}
                      >
                        {field.value ? (
                          format(field.value, "PPP", { locale: es })
                        ) : (
                          <span>Selecciona una fecha</span>
                        )}
                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={field.value}
                      onSelect={field.onChange}
                      disabled={(date) => date < new Date("1900-01-01")}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="endDate"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>Fecha de Fin del Curso</FormLabel>
                <Popover modal={true}>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button
                        variant={"outline"}
                        className={cn(
                          "w-full pl-3 text-left font-normal",
                          !field.value && "text-muted-foreground"
                        )}
                      >
                        {field.value ? (
                          format(field.value, "PPP", { locale: es })
                        ) : (
                          <span>Selecciona una fecha</span>
                        )}
                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={field.value}
                      onSelect={field.onChange}
                      disabled={(date) => date < (form.getValues("startDate") || new Date("1900-01-01"))}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <Separator className="my-6" />

        <div className="space-y-4">
            <h3 className="text-md font-medium">Asignar Clase Recurrente (Opcional)</h3>
            <FormField
            control={form.control}
            name="teacherId"
            render={({ field }) => (
                <FormItem>
                <FormLabel>Docente</FormLabel>
                <Select onValueChange={field.onChange} value={field.value} disabled={!selectedModuleId}>
                    <FormControl><SelectTrigger><SelectValue placeholder={selectedModuleId ? "Selecciona un docente..." : "Selecciona un módulo primero"} /></SelectTrigger></FormControl>
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
                name="days"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Días</FormLabel>
                    <Popover modal={true}>
                        <PopoverTrigger asChild>
                        <FormControl>
                            <Button variant="outline" className={cn("w-full justify-between", !field.value?.length && "text-muted-foreground")}>
                            {field.value?.length ? `${field.value.length} día(s) seleccionado(s)`: "Selecciona uno o más días"}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                        </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                            <div className="p-4 space-y-2">
                                {availableDays.map((day) => (
                                    <FormItem key={day} className="flex flex-row items-start space-x-3 space-y-0">
                                        <FormControl>
                                            <Checkbox
                                                checked={field.value?.includes(day)}
                                                onCheckedChange={(checked) => {
                                                return checked
                                                    ? field.onChange([...(field.value || []), day])
                                                    : field.onChange((field.value || []).filter((value) => value !== day))
                                                }}
                                            />
                                        </FormControl>
                                        <FormLabel className="font-normal">{day}</FormLabel>
                                    </FormItem>
                                ))}
                            </div>
                        </PopoverContent>
                    </Popover>
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
                        <FormControl><Input type="time" {...field} value={field.value || ''} /></FormControl>
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
                        <FormControl><Input type="time" {...field} value={field.value || ''} /></FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                />
            </div>
        </div>


        <Button type="submit" disabled={form.formState.isSubmitting} className="w-full">
          {form.formState.isSubmitting ? 'Guardando...' : 'Guardar Curso'}
        </Button>
      </form>
    </Form>
  );
}

    