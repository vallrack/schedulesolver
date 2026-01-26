'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import type { Subject, Teacher } from '@/lib/types';
import { useFirestore } from '@/firebase';
import { addDoc, collection, doc, setDoc } from 'firebase/firestore';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { useState, useEffect } from 'react';
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
});

type TeacherFormValues = z.infer<typeof teacherSchema>;

interface TeacherFormProps {
  teacher?: Teacher;
  subjects: Subject[];
  onSuccess: () => void;
}

export function TeacherForm({ teacher, subjects, onSuccess }: TeacherFormProps) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [selectedSpecialties, setSelectedSpecialties] = useState<string[]>([]);

  useEffect(() => {
    setSelectedSpecialties(teacher?.specialties || []);
  }, [teacher]);


  const form = useForm<TeacherFormValues>({
    resolver: zodResolver(teacherSchema),
    defaultValues: {
      name: '',
      email: '',
      contractType: undefined,
      maxWeeklyHours: 0,
    },
  });

  useEffect(() => {
    if (teacher) {
        form.reset({
            name: teacher.name,
            email: teacher.email,
            contractType: teacher.contractType,
            maxWeeklyHours: teacher.maxWeeklyHours,
        });
    } else {
        form.reset({
            name: '',
            email: '',
            contractType: undefined,
            maxWeeklyHours: 40,
        });
    }
  }, [teacher, form]);

  const onSubmit = (data: TeacherFormValues) => {
    if (!firestore) return;
    const teacherData = { 
        ...data,
        specialties: selectedSpecialties,
        status: teacher?.status || 'active' 
    };

    if (teacher) {
      // Update existing teacher
      const teacherRef = doc(firestore, 'teachers', teacher.id);
      setDoc(teacherRef, teacherData, { merge: true }).catch(async (serverError) => {
           const permissionError = new FirestorePermissionError({
              path: teacherRef.path,
              operation: 'update',
              requestResourceData: teacherData,
           });
           errorEmitter.emit('permission-error', permissionError);
      });
      toast({ title: 'Docente Actualizado', description: `Se ha actualizado a ${data.name}.` });
    } else {
      // Create new teacher
      const collectionRef = collection(firestore, 'teachers');
      addDoc(collectionRef, teacherData).catch(async (serverError) => {
          const permissionError = new FirestorePermissionError({
              path: collectionRef.path,
              operation: 'create',
              requestResourceData: teacherData,
          });
          errorEmitter.emit('permission-error', permissionError);
      });
      toast({ title: 'Docente Añadido', description: `Se ha añadido a ${data.name}.` });
    }
    onSuccess();
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
                <Select onValueChange={field.onChange} defaultValue={field.value}>
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

        <FormItem>
            <FormLabel>Módulos Asignados</FormLabel>
            <Popover>
                <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-between">
                        <span className="truncate">
                        {selectedSpecialties.length > 0 ? `${selectedSpecialties.length} seleccionado(s)` : "Seleccionar módulos..."}
                        </span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0">
                    <ScrollArea className="h-48">
                        <div className="p-4">
                        {subjects.map((subject) => (
                            <div key={subject.id} className="flex items-center space-x-2 mb-2">
                                <Checkbox
                                    id={`specialty-${subject.id}`}
                                    checked={selectedSpecialties.includes(subject.id)}
                                    onCheckedChange={(checked) => {
                                        return checked
                                            ? setSelectedSpecialties([...selectedSpecialties, subject.id])
                                            : setSelectedSpecialties(selectedSpecialties.filter(id => id !== subject.id));
                                    }}
                                />
                                <label
                                    htmlFor={`specialty-${subject.id}`}
                                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                >
                                    {subject.name}
                                </label>
                            </div>
                        ))}
                        </div>
                    </ScrollArea>
                </PopoverContent>
            </Popover>
            <div className="pt-2 flex flex-wrap gap-1">
                {selectedSpecialties.map(id => {
                    const subject = subjects.find(s => s.id === id);
                    return subject ? <Badge key={id} variant="secondary">{subject.name}</Badge> : null;
                })}
            </div>
        </FormItem>

        <Button type="submit" disabled={form.formState.isSubmitting} className="w-full">
          {form.formState.isSubmitting ? 'Guardando...' : 'Guardar Docente'}
        </Button>
      </form>
    </Form>
  );
}
