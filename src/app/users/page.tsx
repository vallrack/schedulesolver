'use client';

import { useState, useMemo } from "react";
import { useUser } from '@/firebase'; // Auth user
import { useCollection } from "@/firebase/firestore/use-collection";
import { useDoc } from "@/firebase/firestore/use-doc";
import { useFirestore } from "@/firebase";
import { collection, doc, deleteDoc, DocumentReference } from "firebase/firestore";

import AppLayout from "@/components/app-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { MoreHorizontal, PlusCircle, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";

import type { User as AppUser } from '@/lib/types';
import { UserForm } from "@/components/users/user-form";
import { useToast } from "@/hooks/use-toast";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";

export default function UsersPage() {
    const firestore = useFirestore();
    const { toast } = useToast();
    const { user: authUser, loading: authLoading } = useUser();

    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<AppUser | undefined>(undefined);

    // Fetch current user's profile to check role
    const userProfileRef = useMemo(() => authUser ? doc(firestore, "users", authUser.uid) as DocumentReference<AppUser> : null, [authUser, firestore]);
    const { data: userProfile, loading: profileLoading } = useDoc<AppUser>(userProfileRef);

    // Fetch all users
    const usersCollection = useMemo(() => firestore ? collection(firestore, 'users') : null, [firestore]);
    const { data: users, loading: usersLoading } = useCollection<AppUser>(usersCollection);

    const handleAddNew = () => {
        setEditingUser(undefined);
        setDialogOpen(true);
    };

    const handleEdit = (user: AppUser) => {
        setEditingUser(user);
        setDialogOpen(true);
    };
    
    // Deleting users from Auth requires Admin SDK. We'll only delete from Firestore.
    // This revokes their role but doesn't delete their auth account.
    const handleDelete = async (userId: string) => {
        if (!firestore) return;
        const userRef = doc(firestore, 'users', userId);
        try {
            await deleteDoc(userRef);
            toast({
                variant: 'destructive',
                title: 'Usuario Eliminado',
                description: `El usuario ha sido eliminado de la base de datos de roles. Su cuenta de autenticación aún existe.`,
            });
        } catch (e) {
            const permissionError = new FirestorePermissionError({
                path: userRef.path,
                operation: 'delete',
            });
            errorEmitter.emit('permission-error', permissionError);
        }
    };

    const loading = authLoading || profileLoading || usersLoading;

    if (loading) {
        return <AppLayout><div className="flex h-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div></AppLayout>;
    }

    if (userProfile?.role !== 'super_admin') {
        return (
            <AppLayout>
                <Card>
                    <CardHeader>
                        <CardTitle>Acceso Denegado</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p>No tienes permiso para ver esta página.</p>
                    </CardContent>
                </Card>
            </AppLayout>
        );
    }
    
    const getRoleBadgeVariant = (role: AppUser['role']) => {
        switch (role) {
            case 'super_admin': return 'destructive';
            case 'admin': return 'default';
            case 'user':
            default:
                return 'secondary';
        }
    };

    return (
        <AppLayout>
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <h1 className="text-3xl font-bold font-headline tracking-tight">Gestión de Usuarios</h1>
                    <Button onClick={handleAddNew}>
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Añadir Usuario
                    </Button>
                </div>
                
                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                    <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                            <DialogTitle>{editingUser ? 'Editar Usuario' : 'Añadir Nuevo Usuario'}</DialogTitle>
                            <DialogDescription>
                                {editingUser ? 'Actualiza el nombre y rol del usuario.' : 'Crea un nuevo usuario y asígnale un rol.'}
                            </DialogDescription>
                        </DialogHeader>
                        <UserForm
                            user={editingUser} 
                            onSuccess={() => setDialogOpen(false)} 
                        />
                    </DialogContent>
                </Dialog>

                <Card>
                    <CardHeader>
                        <CardTitle>Usuarios del Sistema</CardTitle>
                        <CardDescription>Gestiona los usuarios y sus roles de acceso.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Nombre</TableHead>
                                    <TableHead>Email</TableHead>
                                    <TableHead>Rol</TableHead>
                                    <TableHead className="text-right"><span className="sr-only">Acciones</span></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {users?.sort((a,b) => a.name.localeCompare(b.name)).map(user => (
                                    <TableRow key={user.id}>
                                        <TableCell className="font-medium">{user.name}</TableCell>
                                        <TableCell>{user.email}</TableCell>
                                        <TableCell><Badge variant={getRoleBadgeVariant(user.role)}>{user.role}</Badge></TableCell>
                                        <TableCell className="text-right">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" className="h-8 w-8 p-0" disabled={user.role === 'super_admin'}>
                                                        <span className="sr-only">Abrir menú</span>
                                                        <MoreHorizontal className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                                                    <DropdownMenuItem onClick={() => handleEdit(user)}>Editar</DropdownMenuItem>
                                                    <DropdownMenuSeparator />
                                                    <AlertDialog>
                                                        <AlertDialogTrigger asChild>
                                                            <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive focus:bg-destructive/10 focus:text-destructive">
                                                                <Trash2 className="mr-2 h-4 w-4" />
                                                                Eliminar
                                                            </DropdownMenuItem>
                                                        </AlertDialogTrigger>
                                                        <AlertDialogContent>
                                                            <AlertDialogHeader>
                                                                <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                                                                <AlertDialogDescription>
                                                                    Esta acción eliminará el registro del usuario del sistema de roles, pero no eliminará su cuenta de autenticación. No podrá acceder a datos protegidos por roles.
                                                                </AlertDialogDescription>
                                                            </AlertDialogHeader>
                                                            <AlertDialogFooter>
                                                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                                <AlertDialogAction onClick={() => handleDelete(user.id)} className="bg-destructive hover:bg-destructive/90">Eliminar</AlertDialogAction>
                                                            </AlertDialogFooter>
                                                        </AlertDialogContent>
                                                    </AlertDialog>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>
        </AppLayout>
    )
}
