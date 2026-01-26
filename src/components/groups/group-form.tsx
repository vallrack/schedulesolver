'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import type { Career, Group } from '@/lib/types';
import { useFirestore } from '@/firebase';
import { addDoc, collection, doc, setDoc } from 'firebase/firestore';
import { useEffect } from 'react';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

const groupSchema = z.object({
  name: z.string().min(1, { message: 'El nombre del grupo es obligatorio (ej: A, B, C).' }),
  careerId: z.string().min(1, { message: 'Debes seleccionar una carrera.' }),
  semester: z.coerce.number().min(1, 'El semestre debe ser mayor a 0.'),
  studentCount: z.coerce.number().min(1, 'Debe haber al menos 1 estudiante.'),
});

type GroupFormValues = z.infer<typeof groupSchema>;

interface GroupFormProps {
  group?: Group;
  careers: Career[];
  onSuccess: () => void;
}

export function GroupForm({ group, careers, onSuccess }: GroupFormProps) {
  const firestore = useFirestore();
  const { toast } = useToast();

  const form = useForm<GroupFormValues>({
    resolver: zodResolver(groupSchema),
    defaultValues: group || { name: '', careerId: '', semester: 1, studentCount: 20 },
  });

  useEffect(() => {
    if (group) {
        form.reset(group);
    } else {
        form.reset({ name: '', careerId: '', semester: 1, studentCount: 20 });
    }
  }, [group, form]);

  const onSubmit = async (data: GroupFormValues) => {
    if (!firestore) return;

    try {
        if (group) {
          const groupRef = doc(firestore, 'groups', group.id);
          await setDoc(groupRef, data, { merge: true });
          toast({ title: 'Grupo Actualizado', description: `Se ha actualizado el grupo.` });
        } else {
          const collectionRef = collection(firestore, 'groups');
          await addDoc(collectionRef, data);
          toast({ title: 'Grupo Añadido', description: `Se ha añadido un nuevo grupo.` });
        }
        onSuccess();
    } catch (e) {
        const path = group ? `groups/${group.id}` : 'groups';
        const operation = group ? 'update' : 'create';
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
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
        <FormField
          control={form.control}
          name="careerId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Carrera</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                        <SelectTrigger>
                            <SelectValue placeholder="Selecciona una carrera" />
                        </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                        {careers.map(career => (
                            <SelectItem key={career.id} value={career.id}>{career.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid grid-cols-3 gap-4">
            <FormField
            control={form.control}
            name="semester"
            render={({ field }) => (
                <FormItem className="col-span-1">
                <FormLabel>Semestre</FormLabel>
                <FormControl><Input type="number" {...field} placeholder="Ej: 1" /></FormControl>
                <FormMessage />
                </FormItem>
            )}
            />
            <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
                <FormItem className="col-span-1">
                <FormLabel>Grupo</FormLabel>
                <FormControl><Input {...field} placeholder="Ej: A" /></FormControl>
                <FormMessage />
                </FormItem>
            )}
            />
             <FormField
            control={form.control}
            name="studentCount"
            render={({ field }) => (
                <FormItem className="col-span-1">
                <FormLabel>Estudiantes</FormLabel>
                <FormControl><Input type="number" {...field} placeholder="Ej: 25" /></FormControl>
                <FormMessage />
                </FormItem>
            )}
            />
        </div>

        <Button type="submit" disabled={form.formState.isSubmitting} className="w-full">
          {form.formState.isSubmitting ? 'Guardando...' : 'Guardar Grupo'}
        </Button>
      </form>
    </Form>
  );
}
