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

const classroomSchema = z.object({
  name: z.string().min(1, { message: 'El nombre es obligatorio.' }),
  capacity: z.coerce.number().min(1, 'La capacidad debe ser mayor a 0.'),
  type: z.enum(['classroom', 'lab'], {
    required_error: 'Debes seleccionar un tipo de aula.',
  }),
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
    defaultValues: classroom || { name: '', capacity: 1, type: 'classroom' },
  });

  useEffect(() => {
    if (classroom) {
        form.reset(classroom);
    } else {
        form.reset({ name: '', capacity: 20, type: 'classroom' });
    }
  }, [classroom, form]);

  const onSubmit = async (data: ClassroomFormValues) => {
    if (!firestore) return;

    try {
        if (classroom) {
          const classroomRef = doc(firestore, 'classrooms', classroom.id);
          await setDoc(classroomRef, data, { merge: true });
          toast({ title: 'Aula Actualizada', description: `Se ha actualizado el aula ${data.name}.` });
        } else {
          const collectionRef = collection(firestore, 'classrooms');
          await addDoc(collectionRef, data);
          toast({ title: 'Aula Añadida', description: `Se ha añadido el aula ${data.name}.` });
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
              <FormLabel>Nombre del Aula/Laboratorio</FormLabel>
              <FormControl><Input {...field} placeholder="Ej: Aula 101, Lab de Sistemas" /></FormControl>
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
                  className="flex space-x-4"
                >
                  <FormItem className="flex items-center space-x-2">
                    <FormControl>
                      <RadioGroupItem value="classroom" />
                    </FormControl>
                    <FormLabel className="font-normal">Aula</FormLabel>
                  </FormItem>
                  <FormItem className="flex items-center space-x-2">
                    <FormControl>
                      <RadioGroupItem value="lab" />
                    </FormControl>
                    <FormLabel className="font-normal">Laboratorio</FormLabel>
                  </FormItem>
                </RadioGroup>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" disabled={form.formState.isSubmitting} className="w-full">
          {form.formState.isSubmitting ? 'Guardando...' : 'Guardar Aula'}
        </Button>
      </form>
    </Form>
  );
}
