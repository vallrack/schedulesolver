'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import type { Subject } from '@/lib/types';
import { useFirestore } from '@/firebase';
import { addDoc, collection, doc, setDoc } from 'firebase/firestore';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Calendar } from '@/components/ui/calendar';
import { Textarea } from '@/components/ui/textarea';
import { useEffect } from 'react';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

const courseSchema = z.object({
  name: z.string().min(1, { message: 'El nombre es obligatorio.' }),
  description: z.string().min(1, { message: 'La descripción es obligatoria.' }),
  career: z.string().min(1, { message: 'La carrera es obligatoria.' }),
  semester: z.coerce.number().min(1, 'El semestre debe ser mayor a 0.'),
  group: z.string().min(1, { message: 'El grupo es obligatorio.' }),
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
  subject?: Subject;
  onSuccess: () => void;
}

export function CourseForm({ subject, onSuccess }: CourseFormProps) {
  const firestore = useFirestore();
  const { toast } = useToast();

  const form = useForm<CourseFormValues>({
    resolver: zodResolver(courseSchema),
    defaultValues: subject ? {
      ...subject,
      startDate: new Date(subject.startDate),
      endDate: new Date(subject.endDate),
    } : {
      name: '',
      description: '',
      career: '',
      semester: 1,
      group: '',
      durationWeeks: 1,
      totalHours: 1,
    },
  });

  useEffect(() => {
    if (subject) {
        form.reset({
            ...subject,
            startDate: new Date(subject.startDate),
            endDate: new Date(subject.endDate),
        });
    } else {
        form.reset({
            name: '',
            description: '',
            career: '',
            semester: 1,
            group: '',
            durationWeeks: 1,
            totalHours: 40,
            startDate: undefined,
            endDate: undefined,
        });
    }
  }, [subject, form]);

  const onSubmit = (data: CourseFormValues) => {
    if (!firestore) return;
    const subjectData = { 
        ...data,
        startDate: data.startDate.toISOString(),
        endDate: data.endDate.toISOString(),
    };

    if (subject) {
      const subjectRef = doc(firestore, 'subjects', subject.id);
      setDoc(subjectRef, subjectData, { merge: true }).catch(async (serverError) => {
           const permissionError = new FirestorePermissionError({
              path: subjectRef.path,
              operation: 'update',
              requestResourceData: subjectData,
           });
           errorEmitter.emit('permission-error', permissionError);
      });
      toast({ title: 'Módulo Actualizado', description: `Se ha actualizado el módulo ${data.name}.` });
    } else {
      const collectionRef = collection(firestore, 'subjects');
      addDoc(collectionRef, subjectData).catch(async (serverError) => {
          const permissionError = new FirestorePermissionError({
              path: collectionRef.path,
              operation: 'create',
              requestResourceData: subjectData,
          });
          errorEmitter.emit('permission-error', permissionError);
      });
      toast({ title: 'Módulo Añadido', description: `Se ha añadido el módulo ${data.name}.` });
    }
    onSuccess();
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 max-h-[70vh] overflow-y-auto p-1">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre del Módulo (ej. ADS1)</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="career"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Carrera</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
        </div>

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Descripción</FormLabel>
              <FormControl><Textarea {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField
            control={form.control}
            name="semester"
            render={({ field }) => (
                <FormItem>
                <FormLabel>Semestre</FormLabel>
                <FormControl><Input type="number" {...field} /></FormControl>
                <FormMessage />
                </FormItem>
            )}
            />
            <FormField
            control={form.control}
            name="group"
            render={({ field }) => (
                <FormItem>
                <FormLabel>Grupo</FormLabel>
                <FormControl><Input {...field} /></FormControl>
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
          {form.formState.isSubmitting ? 'Guardando...' : 'Guardar Módulo'}
        </Button>
      </form>
    </Form>
  );
}
