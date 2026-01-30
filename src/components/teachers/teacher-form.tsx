'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import type { Module, Teacher } from '@/lib/types';
import { useFirestore } from '@/firebase';
import { addDoc, collection, doc, setDoc } from 'firebase/firestore';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ChevronsUpDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { ScrollArea } from '../ui/scroll-area';
import { Checkbox } from '../ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';


const teacherSchema = z.object({
  name: z.string().min(1, { message: 'El nombre es obligatorio.' }),
  email: z.string().email({ message: 'Por favor, introduce un correo válido.' }),
  contractType: z.enum(['Tiempo Completo', 'Medio Tiempo', 'Por Horas'], {
    required_error: 'Debes seleccionar un tipo de contrato.',
  }),
  maxWeeklyHours: z.coerce.number().min(1, { message: 'Debe ser un número positivo.' }),
  specialties: z.array(z.string()).optional(),
});

type TeacherFormValues = z.infer<typeof teacherSchema>;

interface TeacherFormProps {
  teacher?: Teacher;
  modules: Module[];
  onSuccess: () => void;
}

export function TeacherForm({ teacher, modules, onSuccess }: TeacherFormProps) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);

  const form = useForm<TeacherFormValues>({
    resolver: zodResolver(teacherSchema),
    defaultValues: teacher
      ? {
          name: teacher.name,
          email: teacher.email,
          contractType: teacher.contractType,
          maxWeeklyHours: teacher.maxWeeklyHours,
          specialties: teacher.specialties || [],
        }
      : {
          name: '',
          email: '',
          contractType: 'Tiempo Completo', // Valor por defecto
          maxWeeklyHours: 40,
          specialties: [],
        },
  });


  const onSubmit = async (data: TeacherFormValues) => {
    if (!firestore) return;
    const teacherData = { 
        ...data,
        status: teacher?.status || 'active',
        availability: teacher?.availability || [],
    };

    try {
        if (teacher) {
          const teacherRef = doc(firestore, 'teachers', teacher.id);
          await setDoc(teacherRef, teacherData, { merge: true });
          toast({ title: 'Docente Actualizado', description: `Se ha actualizado a ${data.name}.` });
        } else {
          const collectionRef = collection(firestore, 'teachers');
          await addDoc(collectionRef, teacherData);
          toast({ title: 'Docente Añadido', description: `Se ha añadido a ${data.name}.` });
        }
        onSuccess();
    } catch (e) {
        const path = teacher ? `teachers/${teacher.id}` : 'teachers';
        const operation = teacher ? 'update' : 'create';
        const permissionError = new FirestorePermissionError({
            path,
            operation,
            requestResourceData: teacherData,
        });
        errorEmitter.emit('permission-error', permissionError);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4 max-h-[60vh] overflow-y-auto pr-2">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nombre Completo</FormLabel>
              <FormControl><Input {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Correo Electrónico</FormLabel>
              <FormControl><Input type="email" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="contractType"
          render={({ field }) => (
            <FormItem>
                <FormLabel>Tipo de Contrato</FormLabel>
                <Select onValueChange={field.onChange} value={field.value} defaultValue={field.value}>
                    <FormControl>
                        <SelectTrigger>
                            <SelectValue placeholder="Selecciona un tipo" />
                        </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                        <SelectItem value="Tiempo Completo">Tiempo Completo</SelectItem>
                        <SelectItem value="Medio Tiempo">Medio Tiempo</SelectItem>
                        <SelectItem value="Por Horas">Por Horas</SelectItem>
                    </SelectContent>
                </Select>
                <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="maxWeeklyHours"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Horas Semanales Máximas</FormLabel>
              <FormControl><Input type="number" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="specialties"
          render={({ field }) => (
            <FormItem>
                <FormLabel>Especialidades (Módulos)</FormLabel>
                <Popover open={open} onOpenChange={setOpen}>
                    <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-between" type="button">
                            <span className="truncate">
                            {field.value?.length ? `${field.value.length} seleccionado(s)` : "Seleccionar módulos..."}
                            </span>
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                        <ScrollArea className="h-48">
                            <div className="p-4">
                            {[...modules].sort((a, b) => a.name.localeCompare(b.name)).map((module) => (
                                <div key={module.id} className="flex flex-row items-center space-x-3 space-y-0 mb-2">
                                  <Checkbox
                                      checked={field.value?.includes(module.id)}
                                      onCheckedChange={(checked) => {
                                        const currentValue = field.value || [];
                                        if (checked) {
                                          field.onChange([...currentValue, module.id]);
                                        } else {
                                          field.onChange(currentValue.filter(value => value !== module.id));
                                        }
                                      }}
                                  />
                                  <label className="text-sm font-normal cursor-pointer flex-1" onClick={() => {
                                    const currentValue = field.value || [];
                                    const isChecked = currentValue.includes(module.id);
                                    if (isChecked) {
                                      field.onChange(currentValue.filter(value => value !== module.id));
                                    } else {
                                      field.onChange([...currentValue, module.id]);
                                    }
                                  }}>
                                      {module.name}
                                  </label>
                                </div>
                            ))}
                            </div>
                        </ScrollArea>
                    </PopoverContent>
                </Popover>
                <div className="pt-2 flex flex-wrap gap-1">
                    {field.value?.map(id => {
                        const module = modules.find(s => s.id === id);
                        return module ? <Badge key={id} variant="secondary">{module.name}</Badge> : null;
                    })}
                </div>
                <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" disabled={form.formState.isSubmitting} className="w-full">
          {form.formState.isSubmitting ? 'Guardando...' : 'Guardar Docente'}
        </Button>
      </form>
    </Form>
  );
}
