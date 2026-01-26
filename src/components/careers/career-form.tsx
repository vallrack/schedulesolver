'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import type { Career } from '@/lib/types';
import { useFirestore } from '@/firebase';
import { addDoc, collection, doc, setDoc } from 'firebase/firestore';
import { useEffect } from 'react';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

const careerSchema = z.object({
  name: z.string().min(3, { message: 'El nombre debe tener al menos 3 caracteres.' }),
});

type CareerFormValues = z.infer<typeof careerSchema>;

interface CareerFormProps {
  career?: Career;
  onSuccess: () => void;
}

export function CareerForm({ career, onSuccess }: CareerFormProps) {
  const firestore = useFirestore();
  const { toast } = useToast();

  const form = useForm<CareerFormValues>({
    resolver: zodResolver(careerSchema),
    defaultValues: career ? { name: career.name } : { name: '' },
  });

  useEffect(() => {
    if (career) {
        form.reset({ name: career.name });
    } else {
        form.reset({ name: '' });
    }
  }, [career, form]);

  const onSubmit = (data: CareerFormValues) => {
    if (!firestore) return;
    const careerData = { name: data.name };

    if (career) {
      const careerRef = doc(firestore, 'careers', career.id);
      setDoc(careerRef, careerData, { merge: true }).catch(async (serverError) => {
           const permissionError = new FirestorePermissionError({
              path: careerRef.path,
              operation: 'update',
              requestResourceData: careerData,
           });
           errorEmitter.emit('permission-error', permissionError);
      });
      toast({ title: 'Carrera Actualizada', description: `Se ha actualizado la carrera ${data.name}.` });
    } else {
      const collectionRef = collection(firestore, 'careers');
      addDoc(collectionRef, careerData).catch(async (serverError) => {
          const permissionError = new FirestorePermissionError({
              path: collectionRef.path,
              operation: 'create',
              requestResourceData: careerData,
          });
          errorEmitter.emit('permission-error', permissionError);
      });
      toast({ title: 'Carrera Añadida', description: `Se ha añadido la carrera ${data.name}.` });
    }
    onSuccess();
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 pt-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nombre de la Carrera</FormLabel>
              <FormControl><Input {...field} placeholder="Ej: Auxiliar en Análisis y Diseño de Software" /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" disabled={form.formState.isSubmitting} className="w-full">
          {form.formState.isSubmitting ? 'Guardando...' : 'Guardar Carrera'}
        </Button>
      </form>
    </Form>
  );
}
