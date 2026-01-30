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
import { ChevronsUpDown, Check } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { ScrollArea } from '../ui/scroll-area';
import { Checkbox } from '../ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';


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
  const [specialtiesOpen, setSpecialtiesOpen] = React.useState(false);

  const form = useForm<TeacherFormValues>({
    resolver: zodResolver(teacherSchema),
    defaultValues: {
      name: teacher?.name || '',
      email: teacher?.email || '',
      contractType: teacher?.contractType || 'Tiempo Completo',
      maxWeeklyHours: teacher?.maxWeeklyHours || 40,
      specialties: teacher?.specialties || [],
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
        form.reset();
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

  // Ordenar módulos alfabéticamente
  const sortedModules = React.useMemo(() => 
    [...modules].sort((a, b) => a.name.localeCompare(b.name)),
    [modules]
  );

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4 max-h-[60vh] overflow-y-auto pr-2">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nombre Completo</FormLabel>
              <FormControl>
                <Input {...field} placeholder="Ej: Juan Pérez" />
              </FormControl>
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
              <FormControl>
                <Input type="email" {...field} placeholder="Ej: juan.perez@ejemplo.com" />
              </FormControl>
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
              <Select 
                onValueChange={field.onChange} 
                defaultValue={field.value}
                value={field.value}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona un tipo de contrato" />
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
              <FormControl>
                <Input 
                  type="number" 
                  {...field} 
                  placeholder="Ej: 40"
                  min="1"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="specialties"
          render={({ field }) => (
            <FormItem className="flex flex-col">
              <FormLabel>Especialidades (Módulos)</FormLabel>
              <Popover open={specialtiesOpen} onOpenChange={setSpecialtiesOpen}>
                <PopoverTrigger asChild>
                  <FormControl>
                    <Button
                      variant="outline"
                      role="combobox"
                      type="button"
                      className={cn(
                        "w-full justify-between",
                        !field.value?.length && "text-muted-foreground"
                      )}
                    >
                      {field.value?.length
                        ? `${field.value.length} módulo${field.value.length > 1 ? 's' : ''} seleccionado${field.value.length > 1 ? 's' : ''}`
                        : "Seleccionar módulos..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </FormControl>
                </PopoverTrigger>
                <PopoverContent 
                    className="w-[400px] p-0" 
                    align="start"
                    onPointerDownOutside={(e) => e.preventDefault()}
                >
                  <div className="p-2">
                    <div className="text-sm font-medium text-muted-foreground px-2 pb-2">
                      Selecciona los módulos que el docente puede impartir
                    </div>
                    <ScrollArea className="h-[240px]">
                      <div className="space-y-1 p-2">
                        {sortedModules.length === 0 ? (
                          <div className="text-sm text-muted-foreground text-center py-4">
                            No hay módulos disponibles
                          </div>
                        ) : (
                          sortedModules.map((module) => {
                            const isSelected = field.value?.includes(module.id) || false;
                            return (
                              <div
                                key={module.id}
                                className="flex items-center space-x-3 rounded-md p-2 hover:bg-accent cursor-pointer"
                                onClick={() => {
                                  const currentValue = field.value || [];
                                  if (isSelected) {
                                    field.onChange(currentValue.filter(id => id !== module.id));
                                  } else {
                                    field.onChange([...currentValue, module.id]);
                                  }
                                }}
                              >
                                <Checkbox
                                  checked={isSelected}
                                  onCheckedChange={(checked) => {
                                    const currentValue = field.value || [];
                                    if (checked) {
                                      field.onChange([...currentValue, module.id]);
                                    } else {
                                      field.onChange(currentValue.filter(id => id !== module.id));
                                    }
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                />
                                <div className="flex-1">
                                  <div className="text-sm font-medium leading-none">
                                    {module.name}
                                  </div>
                                  {module.code && (
                                    <div className="text-xs text-muted-foreground mt-1">
                                      {module.code}
                                    </div>
                                  )}
                                </div>
                                {isSelected && (
                                  <Check className="h-4 w-4 text-primary" />
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>
                    </ScrollArea>
                  </div>
                </PopoverContent>
              </Popover>
              
              {field.value && field.value.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {field.value.map(id => {
                    const module = modules.find(m => m.id === id);
                    return module ? (
                      <Badge 
                        key={id} 
                        variant="secondary"
                        className="cursor-pointer hover:bg-secondary/80"
                        onClick={() => {
                          field.onChange(field.value?.filter(selectedId => selectedId !== id));
                        }}
                      >
                        {module.name}
                        <span className="ml-1 text-xs">×</span>
                      </Badge>
                    ) : null;
                  })}
                </div>
              )}
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex gap-2 pt-4">
          <Button 
            type="button" 
            variant="outline" 
            onClick={() => {
              form.reset();
              onSuccess();
            }}
            className="flex-1"
          >
            Cancelar
          </Button>
          <Button 
            type="submit" 
            disabled={form.formState.isSubmitting}
            className="flex-1"
          >
            {form.formState.isSubmitting ? 'Guardando...' : (teacher ? 'Actualizar' : 'Guardar')}
          </Button>
        </div>
      </form>
    </Form>
  );
}
