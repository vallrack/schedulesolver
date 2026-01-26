'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import type { Module } from '@/lib/types';
import { useFirestore } from '@/firebase';
import { addDoc, collection, doc, setDoc } from 'firebase/firestore';
import { Textarea } from '@/components/ui/textarea';
import { useEffect } from 'react';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

const moduleSchema = z.object({
  name: z.string().min(1, { message: 'El nombre es obligatorio.' }),
  description: z.string().optional(),
  totalHours: z.coerce.number().min(1, 'Las horas deben ser mayor a 0.'),
});

type ModuleFormValues = z.infer<typeof moduleSchema>;

interface ModuleFormProps {
  module?: Module;
  onSuccess: () => void;
}

export function ModuleForm({ module, onSuccess }: ModuleFormProps) {
  const firestore = useFirestore();
  const { toast } = useToast();

  const form = useForm<ModuleFormValues>({
    resolver: zodResolver(moduleSchema),
    defaultValues: {
      name: '',
      description: '',
      totalHours: 40,
    },
  });
  
  const { reset } = form;

  useEffect(() => {
    if (module) {
        reset({
            name: module.name || '',
            description: module.description || '',
            totalHours: module.totalHours || 40,
        });
    } else {
        reset({
            name: '',
            description: '',
            totalHours: 40
        });
    }
  }, [module, reset]);

  const onSubmit = async (data: ModuleFormValues) => {
    if (!firestore) return;
    const moduleData = { 
        name: data.name,
        description: data.description,
        totalHours: data.totalHours,
    };

    try {
        if (module) {
          const moduleRef = doc(firestore, 'modules', module.id);
          await setDoc(moduleRef, moduleData, { merge: true });
          toast({ title: 'Módulo Actualizado', description: `Se ha actualizado el módulo ${data.name}.` });
        } else {
          const collectionRef = collection(firestore, 'modules');
          await addDoc(collectionRef, moduleData);
          toast({ title: 'Módulo Añadido', description: `Se ha añadido el módulo ${data.name}.` });
        }
        onSuccess();
    } catch(e) {
        const path = module ? `modules/${module.id}` : 'modules';
        const operation = module ? 'update' : 'create';
        const permissionError = new FirestorePermissionError({
            path,
            operation,
            requestResourceData: moduleData,
        });
        errorEmitter.emit('permission-error', permissionError);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 max-h-[70vh] overflow-y-auto p-1">
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem className="sm:col-span-3">
                <FormLabel>Nombre de la Materia o Módulo</FormLabel>
                <FormControl><Input {...field} placeholder="Ej: Programación Orientada a Objetos" /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="totalHours"
            render={({ field }) => (
              <FormItem className="sm:col-span-2">
                <FormLabel>Horas Totales</FormLabel>
                <FormControl><Input type="number" {...field} placeholder="Ej: 40" /></FormControl>
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
              <FormLabel>Descripción (Opcional)</FormLabel>
              <FormControl><Textarea {...field} placeholder="Describe brevemente el contenido del módulo..."/></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" disabled={form.formState.isSubmitting} className="w-full">
          {form.formState.isSubmitting ? 'Guardando...' : 'Guardar Módulo'}
        </Button>
      </form>
    </Form>
  );
}
