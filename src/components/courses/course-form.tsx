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
import { CalendarIcon, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Calendar } from '@/components/ui/calendar';
import { useEffect, useMemo, useState } from 'react';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { ScrollArea } from '@/components/ui/scroll-area';

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
  
  const [moduleSearch, setModuleSearch] = useState('');
  const [groupSearch, setGroupSearch] = useState('');
  const [modulePopoverOpen, setModulePopoverOpen] = useState(false);
  const [groupPopoverOpen, setGroupPopoverOpen] = useState(false);

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
    return groups.map(group => {
        const career = careers.find(c => c.id === group.careerId);
        return {
            value: group.id,
            label: `${career?.name || '...'} - Sem ${group.semester} - G ${group.name}`
        }
    })
  }, [groups, careers]);

  const filteredModules = useMemo(() => {
    if (!modules) return [];
    return modules.filter(m => m.name.toLowerCase().includes(moduleSearch.toLowerCase()));
  }, [modules, moduleSearch]);

  const filteredGroupOptions = useMemo(() => {
    if (!groupOptions) return [];
    return groupOptions.filter(g => g.label.toLowerCase().includes(groupSearch.toLowerCase()));
  }, [groupOptions, groupSearch]);


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
                <FormItem className="flex flex-col">
                  <FormLabel>Módulo</FormLabel>
                  <Popover open={modulePopoverOpen} onOpenChange={setModulePopoverOpen} modal={true}>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          role="combobox"
                          className={cn(
                            "w-full justify-between",
                            !field.value && "text-muted-foreground"
                          )}
                        >
                          <span className="truncate">
                          {field.value
                            ? modules.find(
                                (module) => module.id === field.value
                              )?.name
                            : "Selecciona un módulo"}
                          </span>
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0" >
                      <Input 
                        placeholder="Buscar módulo..."
                        className="h-9 rounded-b-none"
                        value={moduleSearch}
                        onChange={(e) => setModuleSearch(e.target.value)}
                        autoFocus
                      />
                      <ScrollArea className="h-48">
                        <div className='p-1'>
                        {filteredModules.length === 0 && <p className="p-4 text-center text-sm text-muted-foreground">No se encontró el módulo.</p>}
                        {filteredModules.map((module) => (
                          <Button
                            variant="ghost"
                            key={module.id}
                            onClick={() => {
                              field.onChange(module.id);
                              const selectedModule = modules.find(m => m.id === module.id);
                              if (selectedModule) {
                                  form.setValue('totalHours', selectedModule.totalHours, { shouldValidate: true });
                              }
                              setModulePopoverOpen(false);
                            }}
                            className={cn(
                              "w-full text-left justify-start h-auto py-2",
                              field.value === module.id && "bg-accent text-accent-foreground"
                            )}
                          >
                            <span className="whitespace-normal">{module.name}</span>
                          </Button>
                        ))}
                        </div>
                      </ScrollArea>
                    </PopoverContent>
                  </Popover>
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
                  <Popover open={groupPopoverOpen} onOpenChange={setGroupPopoverOpen} modal={true}>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          role="combobox"
                          className={cn(
                            "w-full justify-between",
                            !field.value && "text-muted-foreground"
                          )}
                        >
                          <span className="truncate">
                          {field.value
                            ? groupOptions.find(
                                (group) => group.value === field.value
                              )?.label
                            : "Selecciona un grupo"}
                          </span>
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                        <Input 
                            placeholder="Buscar grupo..."
                            className="h-9 rounded-b-none"
                            value={groupSearch}
                            onChange={(e) => setGroupSearch(e.target.value)}
                            autoFocus
                        />
                        <ScrollArea className="h-48">
                          <div className='p-1'>
                          {filteredGroupOptions.length === 0 && <p className="p-4 text-center text-sm text-muted-foreground">No se encontró el grupo.</p>}
                          {filteredGroupOptions.map((group) => (
                            <Button
                              variant="ghost"
                              key={group.value}
                              onClick={() => {
                                field.onChange(group.value);
                                setGroupPopoverOpen(false);
                              }}
                              className={cn(
                                "w-full text-left justify-start h-auto py-2",
                                field.value === group.value && "bg-accent text-accent-foreground"
                              )}
                            >
                             <span className="whitespace-normal">{group.label}</span>
                            </Button>
                          ))}
                          </div>
                      </ScrollArea>
                    </PopoverContent>
                  </Popover>
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
                  <PopoverContent className="w-auto p-0 z-[100]" align="start">
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
                  <PopoverContent className="w-auto p-0 z-[100]" align="start">
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
