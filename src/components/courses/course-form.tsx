'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import type { Career, Course, Group, Module, Teacher, ScheduleEvent } from '@/lib/types';
import { useFirestore } from '@/firebase';
import { addDoc, collection, doc, setDoc } from 'firebase/firestore';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Calendar } from '@/components/ui/calendar';
import { useEffect, useMemo } from 'react';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

const courseSchema = z.object({
  moduleId: z.string().min(1, { message: 'El módulo es obligatorio.' }),
  groupId: z.string().min(1, { message: 'El grupo es obligatorio.' }),
  durationWeeks: z.coerce.number().min(1, 'La duración debe ser al menos 1 semana.'),
  totalHours: z.coerce.number().min(1, 'Las horas deben ser mayor a 0.'),
  startDate: z.date({ required_error: 'La fecha de inicio es obligatoria.' }),
  endDate: z.date({ required_error: 'La fecha de fin es obligatoria.' }),
}).refine(data => data.endDate > data.startDate, {
    message: 'La fecha de fin debe ser posterior a la fecha de inicio.',
    path: ['endDate'],
});

type CourseFormValues = z.infer<typeof courseSchema>;

interface CourseFormProps {
  course?: Course;
  allCourses: Course[];
  modules: Module[];
  groups: Group[];
  careers: Career[];
  onSuccess: () => void;
  teachers?: Teacher[];
  scheduleEvents?: ScheduleEvent[];
}

export function CourseForm({ course, allCourses, modules, groups, careers, onSuccess, teachers, scheduleEvents }: CourseFormProps) {
  const firestore = useFirestore();
  const { toast } = useToast();

  const defaultValues = useMemo(() => {
    return course ? {
      ...course,
      startDate: new Date(course.startDate),
      endDate: new Date(course.endDate),
    } : {
      moduleId: '',
      groupId: '',
      durationWeeks: 1,
      totalHours: 1,
      startDate: undefined,
      endDate: undefined,
    }
  }, [course]);

  const form = useForm<CourseFormValues>({
    resolver: zodResolver(courseSchema),
    defaultValues,
  });

  useEffect(() => {
    form.reset(defaultValues);
  }, [course, defaultValues, form]);
  
  const assignedTeacher = useMemo(() => {
    if (!course || !scheduleEvents || !teachers) return null;
    const eventForCourse = scheduleEvents.find(e => e.courseId === course.id);
    if (!eventForCourse) return null;
    return teachers.find(t => t.id === eventForCourse.teacherId);
}, [course, scheduleEvents, teachers]);


  const groupOptions = useMemo(() => {
    if (!groups || !careers) return [];
    const options = groups.map(group => {
        const career = careers.find(c => c.id === group.careerId);
        return {
            value: group.id,
            label: `${career?.name || '...'} - Sem ${group.semester} - G ${group.name}`
        }
    });
    // Sort alphabetically by label
    return options.sort((a, b) => a.label.localeCompare(b.label));
  }, [groups, careers]);

  const sortedModules = useMemo(() => {
    if (!modules) return [];
    // Sort alphabetically by name
    return [...modules].sort((a, b) => a.name.localeCompare(b.name));
  }, [modules]);


  const onSubmit = async (data: CourseFormValues) => {
    if (!firestore) return;

    // --- VALIDATION LOGIC ---
    const newCourseStartDate = data.startDate;
    const newCourseEndDate = data.endDate;
    const newCourseGroupId = data.groupId;

    const overlappingCourse = allCourses.find(existingCourse => {
        // Don't check against the course we are currently editing
        if (course && existingCourse.id === course.id) {
            return false;
        }

        if (existingCourse.groupId === newCourseGroupId) {
            const existingStartDate = new Date(existingCourse.startDate);
            const existingEndDate = new Date(existingCourse.endDate);

            // Check for overlap: (StartA <= EndB) and (StartB <= EndA)
            if (newCourseStartDate <= existingEndDate && existingStartDate <= newCourseEndDate) {
                return true; // Found an overlap
            }
        }
        return false;
    });

    if (overlappingCourse) {
        const module = modules.find(m => m.id === overlappingCourse.moduleId);
        toast({
            variant: "destructive",
            title: "Conflicto de Horario Detectado",
            description: `El grupo ya tiene el curso "${module?.name || 'Desconocido'}" programado durante ese período de tiempo.`,
        });
        return; // Stop submission
    }
    // --- END VALIDATION LOGIC ---

    const courseData = { 
        ...data,
        startDate: data.startDate.toISOString(),
        endDate: data.endDate.toISOString(),
    };

    try {
        if (course) {
          const courseRef = doc(firestore, 'courses', course.id);
          await setDoc(courseRef, courseData, { merge: true });
          toast({ title: 'Curso Actualizado', description: `Se ha actualizado el curso programado.` });
        } else {
          const collectionRef = collection(firestore, 'courses');
          await addDoc(collectionRef, courseData);
          toast({ title: 'Curso Añadido', description: `Se ha programado un nuevo curso.` });
        }
        onSuccess();
    } catch(e) {
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

        {assignedTeacher && (
          <FormItem>
            <FormLabel>Docente Asignado</FormLabel>
            <FormControl>
              <Input value={assignedTeacher.name} disabled />
            </FormControl>
            <FormDescription>
              Para cambiar el docente, edita las clases asociadas a este curso desde la vista semanal.
            </FormDescription>
          </FormItem>
        )}
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField
            control={form.control}
            name="durationWeeks"
            render={({ field }) => (
                <FormItem>
                <FormLabel>Duración (Semanas)</FormLabel>
                <FormControl><Input type="number" {...field} /></FormControl>
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
          {form.formState.isSubmitting ? 'Guardando...' : 'Guardar Curso'}
        </Button>
      </form>
    </Form>
  );
}
