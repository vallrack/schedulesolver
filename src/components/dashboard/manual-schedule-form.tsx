'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { useFirestore } from '@/firebase';
import { addDoc, collection, doc, writeBatch, updateDoc } from 'firebase/firestore';
import { useEffect, useMemo } from 'react';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import type { Career, Course, Group, Module, Teacher, Classroom, ScheduleEvent } from '@/lib/types';
import { ScrollArea } from '../ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { ChevronsUpDown, CalendarIcon } from 'lucide-react';
import { Checkbox } from '../ui/checkbox';
import { cn } from '@/lib/utils';
import { format, addWeeks, differenceInCalendarWeeks, startOfWeek as getStartOfWeek, endOfWeek } from 'date-fns';
import { es } from 'date-fns/locale';
import { Calendar } from '../ui/calendar';

const scheduleEventSchema = z.object({
  courseId: z.string().min(1, 'Debes seleccionar un curso.'),
  teacherId: z.string().min(1, 'Debes seleccionar un docente.'),
  classroomId: z.string().min(1, 'Debes seleccionar un aula.'),
  days: z.array(z.string()).nonempty({ message: 'Debes seleccionar al menos un día.' }),
  startTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Formato HH:MM requerido."),
  endTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Formato HH:MM requerido."),
  startDate: z.date({ required_error: 'La fecha de inicio es obligatoria.' }),
  endDate: z.date({ required_error: 'La fecha de fin es obligatoria.' }),
}).refine(data => {
    const start = parseInt(data.startTime.replace(':', ''), 10);
    const end = parseInt(data.endTime.replace(':', ''), 10);
    return end > start;
}, {
    message: 'La hora de fin debe ser posterior a la de inicio.',
    path: ['endTime'],
}).refine(data => data.endDate >= data.startDate, {
    message: 'La fecha de fin debe ser igual o posterior a la de inicio.',
    path: ['endDate'],
});

type FormValues = z.infer<typeof scheduleEventSchema>;

interface ManualScheduleFormProps {
  courses: Course[];
  modules: Module[];
  groups: Group[];
  careers: Career[];
  teachers: Teacher[];
  classrooms: Classroom[];
  scheduleEvents: ScheduleEvent[];
  eventToEditInfo?: { event: ScheduleEvent, ids: string[] };
  courseToSchedule?: Course;
  onSuccess: () => void;
}

const safeParseDate = (dateString?: string): Date | undefined => {
  if (!dateString) return undefined;
  try {
    // Handles both ISO strings and yyyy-MM-dd.
    // The key is to extract the UTC date parts to avoid timezone shifts.
    const date = new Date(dateString);
    return new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  } catch (e) {
    return undefined;
  }
};

const timeToMinutes = (time: string): number => {
  if (!time) return 0;
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
};

// Función helper para calcular fechas absolutas desde semanas relativas
const calculateAbsoluteDates = (course: Course, startWeek: number, endWeek: number) => {
  const courseStartDate = safeParseDate(course.startDate);
  if (!courseStartDate) return { startDate: undefined, endDate: undefined };
  
  // El curso empieza en una fecha específica. Necesitamos encontrar el inicio de esa semana (lunes)
  const courseWeekStart = getStartOfWeek(courseStartDate, { weekStartsOn: 1 });
  
  // Ahora calculamos cuándo empiezan y terminan las clases
  // startWeek=1 significa la primera semana del curso, que empieza en courseWeekStart
  // startWeek=2 significa la segunda semana, que empieza courseWeekStart + 1 semana
  const eventWeekStart = addWeeks(courseWeekStart, startWeek - 1);
  const eventWeekEnd = addWeeks(courseWeekStart, endWeek - 1);
  
  // Devolvemos el inicio de la semana de inicio y el fin de la semana de fin
  return {
    startDate: eventWeekStart,
    endDate: endOfWeek(eventWeekEnd, { weekStartsOn: 1 })
  };
};

export function ManualScheduleForm({ courses, modules, groups, careers, teachers, classrooms, scheduleEvents, eventToEditInfo, courseToSchedule, onSuccess }: ManualScheduleFormProps) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const isEditMode = !!eventToEditInfo;

  const initialValues = useMemo(() => {
    if (isEditMode && eventToEditInfo && courses.length > 0) {
        const { event, ids } = eventToEditInfo;
        const course = courses.find(c => c.id === event.courseId);
        if (course) {
            const allEventsForGroup = scheduleEvents.filter(e => ids.includes(e.id));
            const days = [...new Set(allEventsForGroup.map(e => e.day))];

            // Calcular las fechas absolutas desde las semanas almacenadas
            const { startDate, endDate } = calculateAbsoluteDates(course, event.startWeek, event.endWeek);
            
            if (!startDate || !endDate) {
                console.error('No se pudieron calcular las fechas para el evento');
                return undefined;
            }
            
            return {
                courseId: event.courseId,
                teacherId: event.teacherId,
                classroomId: event.classroomId,
                days: days,
                startTime: event.startTime,
                endTime: event.endTime,
                startDate: startDate,
                endDate: endDate,
            };
        }
    }
    if (!isEditMode && courseToSchedule && courses.length > 0) {
         const course = courses.find(c => c.id === courseToSchedule.id);
         return {
            courseId: courseToSchedule.id,
            teacherId: '',
            classroomId: '',
            days: [],
            startTime: '07:00',
            endTime: '09:00',
            startDate: course ? safeParseDate(course.startDate) : undefined,
            endDate: course ? safeParseDate(course.endDate) : undefined,
        };
    }
    
    return {
        courseId: '',
        teacherId: '',
        classroomId: '',
        days: [],
        startTime: "07:00",
        endTime: "09:00",
        startDate: undefined,
        endDate: undefined,
    };
  }, [eventToEditInfo, isEditMode, courses, scheduleEvents, courseToSchedule]);


  const form = useForm<FormValues>({
    resolver: zodResolver(scheduleEventSchema),
    defaultValues: initialValues,
  });

  useEffect(() => {
    form.reset(initialValues);
  }, [initialValues, form]);
  
  const selectedCourseId = form.watch('courseId');

  const courseOptions = useMemo(() => {
    return courses.map(course => {
        const module = modules.find(m => m.id === course.moduleId);
        const group = groups.find(g => g.id === course.groupId);
        const career = careers.find(c => c.id === group?.careerId);
        return {
            value: course.id,
            label: `${module?.name || '...'} | ${group ? `${career?.name || '...'} - Sem ${group.semester} - G ${group.name}` : '...'}`,
        }
    }).sort((a,b) => a.label.localeCompare(b.label));
  }, [courses, modules, groups, careers]);

  const teacherOptions = useMemo(() => {
    if (!selectedCourseId && !courseToSchedule) return [];

    const course = courses.find(c => c.id === (selectedCourseId || courseToSchedule?.id));
    if (!course) return [];

    const availableTeachers = teachers.filter(t => t.specialties?.includes(course.moduleId));
    
    return availableTeachers.sort((a,b) => a.name.localeCompare(b.name))
  }, [selectedCourseId, courseToSchedule, teachers, courses]);
  
  const classroomOptions = useMemo(() => classrooms.sort((a,b) => a.name.localeCompare(b.name)), [classrooms]);
  
  useEffect(() => {
      const currentTeacherId = form.getValues('teacherId');
      if (currentTeacherId) {
          const isTeacherStillValid = teacherOptions.some(opt => opt.id === currentTeacherId);
          if (!isTeacherStillValid) {
              form.setValue('teacherId', '', { shouldValidate: true });
          }
      }
  }, [selectedCourseId, teacherOptions, form]);


  const onSubmit = async (data: FormValues) => {
    if (!firestore) return;

    // --- VALIDATION LOGIC ---
    const selectedCourse = courses.find(c => c.id === data.courseId);
    if (!selectedCourse) {
        toast({ variant: "destructive", title: "Error de Validación", description: `El curso seleccionado no es válido.` });
        return;
    }
    const groupForCourse = groups.find(g => g.id === selectedCourse?.groupId);
    const selectedClassroom = classrooms.find(c => c.id === data.classroomId);

    if (groupForCourse && selectedClassroom && groupForCourse.studentCount > selectedClassroom.capacity) {
        toast({ variant: "destructive", title: "Conflicto de Capacidad", description: `El aula ${selectedClassroom.name} (${selectedClassroom.capacity}) no tiene capacidad para el grupo (${groupForCourse.studentCount} estudiantes).` });
        return;
    }

    const newEventAbsoluteStartDate = data.startDate;
    const newEventAbsoluteEndDate = data.endDate;

    for (const day of data.days) {
        for (const existingEvent of scheduleEvents) {
            if (isEditMode && eventToEditInfo!.ids.includes(existingEvent.id)) continue;
            if (existingEvent.day !== day) continue;

            const timeOverlap = timeToMinutes(data.startTime) < timeToMinutes(existingEvent.endTime) && timeToMinutes(data.endTime) > timeToMinutes(existingEvent.startTime);
            if (!timeOverlap) continue;

            const existingEventCourse = courses.find(c => c.id === existingEvent.courseId);
            if (!existingEventCourse) continue;
            
            // Calcular las fechas absolutas del evento existente
            const { startDate: existingEventAbsoluteStartDate, endDate: existingEventAbsoluteEndDate } = 
                calculateAbsoluteDates(existingEventCourse, existingEvent.startWeek, existingEvent.endWeek);
            
            if (!existingEventAbsoluteStartDate || !existingEventAbsoluteEndDate) continue;
            
            const dateOverlap = newEventAbsoluteStartDate <= existingEventAbsoluteEndDate && 
                               existingEventAbsoluteStartDate <= newEventAbsoluteEndDate;

            if (dateOverlap) {
                if (existingEvent.teacherId === data.teacherId) {
                    toast({ variant: "destructive", title: "Conflicto de Docente", description: `El docente ya tiene una clase programada el ${day} en ese horario durante un período que se cruza.` });
                    return;
                }
                if (existingEvent.classroomId === data.classroomId) {
                    toast({ variant: "destructive", title: "Conflicto de Aula", description: `El aula ya está ocupada el ${day} en ese horario durante un período que se cruza.` });
                    return;
                }
                if (existingEventCourse.groupId === selectedCourse.groupId) {
                    toast({ variant: "destructive", title: "Conflicto de Grupo", description: `El grupo ya tiene una clase programada el ${day} en ese horario durante un período que se cruza.` });
                    return;
                }
            }
        }
    }
    
    const selectedTeacher = teachers.find(t => t.id === data.teacherId);
    if(selectedTeacher) {
        const startMinutes = timeToMinutes(data.startTime);
        const endMinutes = timeToMinutes(data.endTime);
        const durationPerClass = (endMinutes - startMinutes) / 60;
        const hoursForNewClasses = durationPerClass * data.days.length;
        const currentHours = scheduleEvents.filter(e => e.teacherId === data.teacherId).reduce((acc, e) => acc + ((timeToMinutes(e.endTime) - timeToMinutes(e.startTime))/60) , 0);
        const newTotalHours = currentHours + hoursForNewClasses;
        if (newTotalHours > selectedTeacher.maxWeeklyHours) {
            toast({ title: "Advertencia de Horas", description: `Con esta(s) clase(s), el docente superará sus horas semanales máximas (${newTotalHours.toFixed(2)} / ${selectedTeacher.maxWeeklyHours}).`, duration: 5000 });
        }
    }
    
    const courseStartDate = safeParseDate(selectedCourse.startDate);
    if (!courseStartDate) {
        toast({ variant: "destructive", title: "Error de Curso", description: "El curso seleccionado no tiene una fecha de inicio válida." });
        return;
    }

    // Calcular startWeek y endWeek desde las fechas absolutas
    const courseWeekStartDate = getStartOfWeek(courseStartDate, { weekStartsOn: 1 });
    const eventStartWeekDate = getStartOfWeek(data.startDate, { weekStartsOn: 1 });
    const eventEndWeekDate = getStartOfWeek(data.endDate, { weekStartsOn: 1 });
    
    const startWeek = differenceInCalendarWeeks(eventStartWeekDate, courseWeekStartDate, { weekStartsOn: 1 }) + 1;
    const endWeek = differenceInCalendarWeeks(eventEndWeekDate, courseWeekStartDate, { weekStartsOn: 1 }) + 1;
    
    if (startWeek < 1 || endWeek < 1) {
        toast({ variant: "destructive", title: "Error de Fechas", description: "Las fechas de la clase deben ser posteriores o iguales a la fecha de inicio del curso." });
        return;
    }


    try {
        const batch = writeBatch(firestore);

        if (isEditMode && eventToEditInfo) {
            eventToEditInfo.ids.forEach(id => {
                batch.delete(doc(firestore, 'schedules', id));
            });
        }
        
        const schedulesCol = collection(firestore, 'schedules');
        const { days, startDate, endDate, ...restOfData } = data;

        days.forEach(day => {
            const newEventRef = doc(schedulesCol);
            const eventData = { ...restOfData, day, startWeek, endWeek };
            batch.set(newEventRef, eventData);
        });

        await batch.commit();

        if (isEditMode) {
             toast({ title: 'Clase Actualizada', description: 'Las clases recurrentes han sido actualizadas.' });
        } else {
            toast({ title: 'Horario Creado', description: `Se ha(n) añadido ${days.length} nueva(s) clase(s) al horario.` });
        }
        onSuccess();
    } catch (e) {
        const { startDate, endDate, ...requestData} = data;
        const permissionError = new FirestorePermissionError({
            path: 'schedules',
            operation: isEditMode ? 'update' : 'create',
            requestResourceData: { ...requestData, startWeek, endWeek },
        });
        errorEmitter.emit('permission-error', permissionError);
    }
  };

  const availableDays = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

  return (
     <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 max-h-[70vh] overflow-y-auto p-1">
        <FormField
          control={form.control}
          name="courseId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Curso</FormLabel>
              <Select onValueChange={field.onChange} value={field.value} disabled={!!courseToSchedule || isEditMode}>
                  <FormControl><SelectTrigger><SelectValue placeholder="Selecciona un curso..." /></SelectTrigger></FormControl>
                  <SelectContent>
                    <ScrollArea className="h-48">
                      {courseOptions.map(option => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
                    </ScrollArea>
                  </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="teacherId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Docente</FormLabel>
               <Select onValueChange={field.onChange} value={field.value} disabled={!selectedCourseId && !courseToSchedule}>
                  <FormControl><SelectTrigger><SelectValue placeholder={selectedCourseId || courseToSchedule ? "Selecciona un docente..." : "Selecciona un curso primero"} /></SelectTrigger></FormControl>
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
                        <Button
                        variant="outline"
                        className={cn(
                            "w-full justify-between",
                            !field.value?.length && "text-muted-foreground"
                        )}
                        >
                        {field.value?.length
                            ? `${field.value.length} día(s) seleccionado(s)`
                            : "Selecciona uno o más días"}
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
                                        : field.onChange(
                                            (field.value || []).filter(
                                            (value) => value !== day
                                            )
                                        )
                                    }}
                                />
                                </FormControl>
                                <FormLabel className="font-normal">
                                {day}
                                </FormLabel>
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
        <div className="grid grid-cols-2 gap-4">
            <FormField
                control={form.control}
                name="startDate"
                render={({ field }) => (
                <FormItem className="flex flex-col">
                    <FormLabel>Fecha de Inicio</FormLabel>
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
                    <FormLabel>Fecha de Fin</FormLabel>
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

        <Button type="submit" disabled={form.formState.isSubmitting} className="w-full">
          {form.formState.isSubmitting ? 'Guardando...' : (isEditMode ? 'Guardar Cambios' : 'Guardar Clase(s)')}
        </Button>
      </form>
    </Form>
  );
}

    