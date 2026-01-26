'use client'
import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu"
import { MoreHorizontal, PlusCircle, Trash2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useCollection } from "@/firebase/firestore/use-collection"
import { useFirestore } from "@/firebase"
import { collection, deleteDoc, doc } from "firebase/firestore"
import AppLayout from "@/components/app-layout"
import type { Career, Subject, Group } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { CourseForm } from "@/components/courses/course-form";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";


export default function CoursesPage() {
  const firestore = useFirestore();
  const { toast } = useToast();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState<Subject | undefined>(undefined);

  const subjectsCollection = useMemo(() => firestore ? collection(firestore, 'subjects') : null, [firestore]);
  const { data: subjects, loading: loadingSubjects, error: errorSubjects } = useCollection<Subject>(subjectsCollection);

  const careersCollection = useMemo(() => firestore ? collection(firestore, 'careers') : null, [firestore]);
  const { data: careers, loading: loadingCareers, error: errorCareers } = useCollection<Career>(careersCollection);

  const groupsCollection = useMemo(() => firestore ? collection(firestore, 'groups') : null, [firestore]);
  const { data: groups, loading: loadingGroups, error: errorGroups } = useCollection<Group>(groupsCollection);

  const loading = loadingSubjects || loadingCareers || loadingGroups;
  const error = errorSubjects || errorCareers || errorGroups;

  const subjectsWithGroupInfo = useMemo(() => {
    if (!subjects || !groups || !careers) return [];
    return subjects.map(subject => {
        const group = groups.find(g => g.id === subject.groupId);
        if (!group) return { ...subject, groupInfo: 'Grupo no encontrado' };

        const career = careers.find(c => c.id === group.careerId);
        return {
            ...subject,
            groupInfo: `${career?.name || 'Carrera desconocida'} - Sem ${group.semester} - G ${group.name}`,
        }
    })
  }, [subjects, groups, careers]);


  const handleAddNew = () => {
    setEditingSubject(undefined);
    setDialogOpen(true);
  };

  const handleEdit = (subject: Subject) => {
    setEditingSubject(subject);
    setDialogOpen(true);
  };

  const handleDelete = async (subjectId: string) => {
    if (!firestore) return;
    const subjectRef = doc(firestore, 'subjects', subjectId);
    try {
        await deleteDoc(subjectRef);
        toast({
          variant: 'destructive',
          title: 'Módulo Eliminado',
          description: `El módulo ha sido eliminado.`,
        });
    } catch(e) {
        const permissionError = new FirestorePermissionError({
            path: subjectRef.path,
            operation: 'delete',
        });
        errorEmitter.emit('permission-error', permissionError);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold font-headline tracking-tight">Catálogo de Módulos</h1>
            <Button onClick={handleAddNew}>
                <PlusCircle className="mr-2 h-4 w-4" />
                Añadir Módulo
            </Button>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogContent className="sm:max-w-xl">
                <DialogHeader>
                    <DialogTitle>{editingSubject ? 'Editar Módulo' : 'Añadir Nuevo Módulo'}</DialogTitle>
                    <DialogDescription>
                       {editingSubject ? 'Actualiza los detalles del módulo.' : 'Rellena los detalles para el nuevo módulo.'}
                    </DialogDescription>
                </DialogHeader>
                <CourseForm 
                    subject={editingSubject} 
                    groups={groups || []}
                    careers={careers || []}
                    onSuccess={() => setDialogOpen(false)} 
                />
            </DialogContent>
        </Dialog>


        <Card>
          <CardHeader>
            <CardTitle>Módulos Disponibles</CardTitle>
            <CardDescription>Gestiona los detalles de los módulos, incluyendo duración, fechas y carga horaria.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead className="hidden lg:table-cell">Descripción</TableHead>
                  <TableHead className="hidden sm:table-cell">Grupo</TableHead>
                  <TableHead>Semanas</TableHead>
                  <TableHead className="hidden md:table-cell">Fecha Inicio</TableHead>
                  <TableHead className="hidden md:table-cell">Fecha Fin</TableHead>
                  <TableHead><span className="sr-only">Acciones</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && <TableRow><TableCell colSpan={7} className="text-center">Cargando...</TableCell></TableRow>}
                {error && <TableRow><TableCell colSpan={7} className="text-center text-destructive">Error: {error.message}</TableCell></TableRow>}
                {subjectsWithGroupInfo?.map(subject => (
                  <TableRow key={subject.id}>
                    <TableCell className="font-medium">{subject.name}</TableCell>
                    <TableCell className="hidden lg:table-cell max-w-xs truncate">{subject.description}</TableCell>
                    <TableCell className="hidden sm:table-cell">{subject.groupInfo}</TableCell>
                    <TableCell>{subject.durationWeeks}</TableCell>
                    <TableCell className="hidden md:table-cell">{format(new Date(subject.startDate), "d MMM, yyyy", { locale: es })}</TableCell>
                    <TableCell className="hidden md:table-cell">{format(new Date(subject.endDate), "d MMM, yyyy", { locale: es })}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <span className="sr-only">Abrir menú</span>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                          <DropdownMenuItem onClick={() => handleEdit(subject)}>Editar Módulo</DropdownMenuItem>
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
                                      <AlertDialogTitle>¿Estás absolutamente seguro?</AlertDialogTitle>
                                      <AlertDialogDescription>
                                          Esta acción no se puede deshacer. Esto eliminará permanentemente el módulo.
                                      </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                      <AlertDialogAction onClick={() => handleDelete(subject.id)} className="bg-destructive hover:bg-destructive/90">Eliminar</AlertDialogAction>
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
