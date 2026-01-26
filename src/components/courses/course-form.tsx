'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import type { Career, Course, Group, Module } from '@/lib/types';
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
  modules: Module[];
  groups: Group[];
  careers: Career[];
  onSuccess: () => void;
}

export function CourseForm({ course, modules, groups, careers, onSuccess }: CourseFormProps) {
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


  const onSubmit = async (data: CourseFormValues) => {
    if (!firestore) return;
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
                <FormItem>
                  <FormLabel>Módulo</FormLabel>
                  <Select 
                    onValueChange={(value) => {
                      field.onChange(value);
                      const selectedModule = modules.find(m => m.id === value);
                      if (selectedModule) {
                          form.setValue('totalHours', selectedModule.totalHours, { shouldValidate: true });
                      }
                    }} 
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona un módulo" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                        {(modules || [])
                            .slice()
                            .sort((a, b) => a.name.localeCompare(b.name))
                            .map(module => (
                            <SelectItem key={module.id} value={module.id}>{module.name}</SelectItem>
                        ))}
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
                 <FormItem>
                  <FormLabel>Grupo</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona un grupo" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {groupOptions.map(group => (
                        <SelectItem key={group.value} value={group.value}>
                            {group.label}
                        </SelectItem>
                      ))}
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
                <Popover>
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
                <Popover>
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
