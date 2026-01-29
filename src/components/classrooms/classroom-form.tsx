'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import type { Classroom } from '@/lib/types';
import { useFirestore } from '@/firebase';
import { addDoc, collection, doc, setDoc } from 'firebase/firestore';
import { useEffect } from 'react';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { Textarea } from '../ui/textarea';

const classroomSchema = z.object({
  name: z.string().min(1, { message: 'El nombre es obligatorio.' }),
  capacity: z.coerce.number().min(1, 'La capacidad debe ser mayor a 0.'),
  type: z.enum(['aula', 'sala de sistemas', 'auditorio', 'biblioteca', 'sala reuniones', 'oficina', 'laboratorio/taller'], {
    required_error: 'Debes seleccionar un tipo de sala.',
  }),
  description: z.string().optional(),
});

type ClassroomFormValues = z.infer<typeof classroomSchema>;

interface ClassroomFormProps {
  classroom?: Classroom;
  onSuccess: () => void;
}

export function ClassroomForm({ classroom, onSuccess }: ClassroomFormProps) {
  const firestore = useFirestore();
  const { toast } = useToast();

  const form = useForm<ClassroomFormValues>({
    resolver: zodResolver(classroomSchema),
    defaultValues: classroom || { name: '', capacity: 1, type: 'aula', description: '' },
  });

  useEffect(() => {
    if (classroom) {
        form.reset(classroom);
    } else {
        form.reset({ name: '', capacity: 20, type: 'aula', description: '' });
    }
  }, [classroom, form]);

  const onSubmit = async (data: ClassroomFormValues) => {
    if (!firestore) return;

    try {
        if (classroom) {
          const classroomRef = doc(firestore, 'classrooms', classroom.id);
          await setDoc(classroomRef, data, { merge: true });
          toast({ title: 'Sala Actualizada', description: `Se ha actualizado la sala ${data.name}.` });
        } else {
          const collectionRef = collection(firestore, 'classrooms');
          await addDoc(collectionRef, data);
          toast({ title: 'Sala Añadida', description: `Se ha añadido la sala ${data.name}.` });
        }
        onSuccess();
    } catch (e) {
        const path = classroom ? `classrooms/${classroom.id}` : 'classrooms';
        const operation = classroom ? 'update' : 'create';
        const permissionError = new FirestorePermissionError({
            path: path,
            operation,
            requestResourceData: data,
        });
        errorEmitter.emit('permission-error', permissionError);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 pt-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nombre de la Sala</FormLabel>
              <FormControl><Input {...field} placeholder="Ej: Aula 101, Sala de Sistemas 1" /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="capacity"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Capacidad</FormLabel>
              <FormControl><Input type="number" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="type"
          render={({ field }) => (
            <FormItem className="space-y-3">
              <FormLabel>Tipo de Sala</FormLabel>
              <FormControl>
                <RadioGroup
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                  className="grid grid-cols-2 gap-x-4 gap-y-2"
                >
                  <FormItem className="flex items-center space-x-2">
                    <FormControl>
                      <RadioGroupItem value="aula" />
                    </FormControl>
                    <FormLabel className="font-normal">Aula</FormLabel>
                  </FormItem>
                  <FormItem className="flex items-center space-x-2">
                    <FormControl>
                      <RadioGroupItem value="sala de sistemas" />
                    </FormControl>
                    <FormLabel className="font-normal">Sala de Sistemas</FormLabel>
                  </FormItem>
                   <FormItem className="flex items-center space-x-2">
                    <FormControl>
                      <RadioGroupItem value="auditorio" />
                    </FormControl>
                    <FormLabel className="font-normal">Auditorio</FormLabel>
                  </FormItem>
                  <FormItem className="flex items-center space-x-2">
                    <FormControl><RadioGroupItem value="biblioteca" /></FormControl>
                    <FormLabel className="font-normal">Biblioteca</FormLabel>
                  </FormItem>
                  <FormItem className="flex items-center space-x-2">
                    <FormControl><RadioGroupItem value="sala reuniones" /></FormControl>
                    <FormLabel className="font-normal">Sala Reuniones</FormLabel>
                  </FormItem>
                  <FormItem className="flex items-center space-x-2">
                    <FormControl><RadioGroupItem value="oficina" /></FormControl>
                    <FormLabel className="font-normal">Oficina</FormLabel>
                  </FormItem>
                  <FormItem className="flex items-center space-x-2">
                    <FormControl><RadioGroupItem value="laboratorio/taller" /></FormControl>
                    <FormLabel className="font-normal">Laboratorio/Taller</FormLabel>
                  </FormItem>
                </RadioGroup>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
         <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Observaciones / Características (Opcional)</FormLabel>
              <FormControl>
                <Textarea {...field} placeholder="Ej: Portátil HP 14, Intel Core i5, 8 GB RAM, 512 GB SSD..." />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" disabled={form.formState.isSubmitting} className="w-full">
          {form.formState.isSubmitting ? 'Guardando...' : 'Guardar Sala'}
        </Button>
      </form>
    </Form>
  );
}
