'use client';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { useFirestore } from '@/firebase';
import { doc, setDoc, updateDoc } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { firebaseConfig } from '@/firebase/config';
import type { User } from '@/lib/types';

const userSchema = z.object({
  name: z.string().min(1, 'El nombre es obligatorio.'),
  email: z.string().email('Correo inválido.'),
  role: z.enum(['admin', 'user'], { required_error: 'El rol es obligatorio.' }),
  password: z.string().optional(),
}).refine(data => {
    // En modo creación (cuando el password está presente), debe tener al menos 6 caracteres.
    // En modo edición, el password es `undefined` y esta validación se omite.
    if (data.password !== undefined && data.password.length < 6) return false;
    return true;
}, {
    message: 'La contraseña debe tener al menos 6 caracteres.',
    path: ['password'],
});

type UserFormValues = z.infer<typeof userSchema>;

interface UserFormProps {
  user?: User;
  onSuccess: () => void;
}

export function UserForm({ user, onSuccess }: UserFormProps) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const isEditMode = !!user;

  const form = useForm<UserFormValues>({
    resolver: zodResolver(userSchema),
    defaultValues: isEditMode
      ? { name: user.name, email: user.email, role: user.role === 'super_admin' ? 'admin' : user.role }
      : { name: '', email: '', role: 'user', password: '' },
  });

  const onSubmit = async (data: UserFormValues) => {
    if (!firestore) return;

    if (isEditMode && user) {
        // Modo Edición
        const userRef = doc(firestore, 'users', user.id);
        const updateData = {
            name: data.name,
            role: data.role,
        };
        try {
            await updateDoc(userRef, updateData);
            toast({ title: 'Usuario Actualizado', description: `Se ha actualizado a ${data.name}.` });
            onSuccess();
        } catch (e) {
            const permissionError = new FirestorePermissionError({
                path: userRef.path,
                operation: 'update',
                requestResourceData: updateData,
            });
            errorEmitter.emit('permission-error', permissionError);
        }
    } else {
        // Modo Creación
        if (!data.password) {
            form.setError('password', { message: 'La contraseña es obligatoria.' });
            return;
        }
        
        // Inicializa una app secundaria para no desloguear al admin actual
        let secondaryApp;
        try {
            secondaryApp = getApp("secondary");
        } catch (error) {
            secondaryApp = initializeApp(firebaseConfig, "secondary");
        }
        const secondaryAuth = getAuth(secondaryApp);

        try {
            const userCredential = await createUserWithEmailAndPassword(secondaryAuth, data.email, data.password);
            const newUser = userCredential.user;
            
            const userData = {
                name: data.name,
                email: data.email,
                role: data.role,
            };

            await setDoc(doc(firestore, 'users', newUser.uid), userData);

            toast({ title: 'Usuario Creado', description: `Se ha creado el usuario ${data.name}.` });
            onSuccess();
        } catch (error: any) {
            console.error("Error creating user:", error);
            const description = error.code === 'auth/email-already-in-use' 
                ? 'El correo electrónico ya está en uso.'
                : 'Ocurrió un error al crear el usuario.';
            toast({ variant: 'destructive', title: 'Error al Crear Usuario', description });
        }
    }
  };

  return (
    <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem><FormLabel>Nombre Completo</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
            )}/>
            <FormField control={form.control} name="email" render={({ field }) => (
                <FormItem><FormLabel>Correo Electrónico</FormLabel><FormControl><Input type="email" {...field} disabled={isEditMode} /></FormControl><FormMessage /></FormItem>
            )}/>
            {!isEditMode && (
                <FormField control={form.control} name="password" render={({ field }) => (
                    <FormItem><FormLabel>Contraseña (temporal)</FormLabel><FormControl><Input type="password" {...field} /></FormControl><FormMessage /></FormItem>
                )}/>
            )}
            <FormField control={form.control} name="role" render={({ field }) => (
                <FormItem>
                    <FormLabel>Rol</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value} defaultValue={field.value} disabled={user?.role === 'super_admin'}>
                        <FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl>
                        <SelectContent>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="user">User</SelectItem>
                        </SelectContent>
                    </Select>
                    <FormMessage />
                </FormItem>
            )}/>
            <Button type="submit" disabled={form.formState.isSubmitting} className="w-full">
                {form.formState.isSubmitting ? 'Guardando...' : (isEditMode ? 'Actualizar Usuario' : 'Crear Usuario')}
            </Button>
        </form>
    </Form>
  )
}
