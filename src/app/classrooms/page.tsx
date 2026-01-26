'use client'
import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu"
import { MoreHorizontal, PlusCircle, Trash2, ArrowUpDown } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge"
import { useCollection } from "@/firebase/firestore/use-collection"
import { useFirestore } from "@/firebase"
import { collection, deleteDoc, doc } from "firebase/firestore"
import AppLayout from "@/components/app-layout"
import type { Classroom } from "@/lib/types";
import { ClassroomForm } from "@/components/classrooms/classroom-form";
import { useToast } from "@/hooks/use-toast";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";
import { Input } from "@/components/ui/input";

export default function ClassroomsPage() {
  const firestore = useFirestore();
  const { toast } = useToast();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingClassroom, setEditingClassroom] = useState<Classroom | undefined>(undefined);
  const [filterText, setFilterText] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: keyof Classroom; direction: 'ascending' | 'descending' } | null>({ key: 'name', direction: 'ascending' });

  const classroomsCollection = useMemo(() => firestore ? collection(firestore, 'classrooms') : null, [firestore]);
  const { data: classrooms, loading, error } = useCollection<Classroom>(classroomsCollection);

  const filteredClassrooms = useMemo(() => {
    if (!classrooms) return [];
    return classrooms.filter(classroom =>
      classroom.name.toLowerCase().includes(filterText.toLowerCase()) ||
      classroom.type.toLowerCase().includes(filterText.toLowerCase())
    );
  }, [classrooms, filterText]);

  const requestSort = (key: keyof Classroom) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  const sortedClassrooms = useMemo(() => {
    let sortableItems = [...filteredClassrooms];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        const aValue = a[sortConfig.key];
        const bValue = b[sortConfig.key];
        if (aValue < bValue) {
          return sortConfig.direction === 'ascending' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'ascending' ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableItems;
  }, [filteredClassrooms, sortConfig]);

  const handleAddNew = () => {
    setEditingClassroom(undefined);
    setDialogOpen(true);
  };

  const handleEdit = (classroom: Classroom) => {
    setEditingClassroom(classroom);
    setDialogOpen(true);
  };

  const handleDelete = async (classroomId: string) => {
    if (!firestore) return;
    const classroomRef = doc(firestore, 'classrooms', classroomId);
    try {
      await deleteDoc(classroomRef);
      toast({
        variant: 'destructive',
        title: 'Sala Eliminada',
        description: `La sala ha sido eliminada.`,
      });
    } catch (e) {
      const permissionError = new FirestorePermissionError({
        path: classroomRef.path,
        operation: 'delete',
      });
      errorEmitter.emit('permission-error', permissionError);
    }
  };

  const getTypeBadgeVariant = (type: Classroom['type']): 'default' | 'secondary' | 'outline' | 'destructive' | null | undefined => {
    switch (type) {
        case 'sala de sistemas':
            return 'default';
        case 'auditorio':
            return 'outline';
        case 'aula':
        default:
            return 'secondary';
    }
  };


  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold font-headline tracking-tight">Gestión de Infraestructura</h1>
             <Button onClick={handleAddNew}>
                <PlusCircle className="mr-2 h-4 w-4" />
                Añadir Sala
            </Button>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>{editingClassroom ? 'Editar Sala' : 'Añadir Nueva Sala'}</DialogTitle>
                    <DialogDescription>
                       {editingClassroom ? 'Actualiza los detalles de la sala.' : 'Añade una nueva sala, aula o auditorio al sistema.'}
                    </DialogDescription>
                </DialogHeader>
                <ClassroomForm
                    classroom={editingClassroom} 
                    onSuccess={() => setDialogOpen(false)} 
                />
            </DialogContent>
        </Dialog>


        <Card>
          <CardHeader>
            <CardTitle>Aulas, Salas y Auditorios</CardTitle>
            <CardDescription>Gestiona todas las salas disponibles y sus capacidades.</CardDescription>
            <div className="pt-4">
              <Input 
                placeholder="Filtrar por nombre o tipo..."
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                className="max-w-sm"
              />
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <Button variant="ghost" onClick={() => requestSort('name')}>
                        Nombre
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button variant="ghost" onClick={() => requestSort('type')}>
                        Tipo
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button variant="ghost" onClick={() => requestSort('capacity')}>
                        Capacidad
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                  </TableHead>
                  <TableHead className="text-right"><span className="sr-only">Acciones</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && <TableRow><TableCell colSpan={4} className="text-center">Cargando...</TableCell></TableRow>}
                {error && <TableRow><TableCell colSpan={4} className="text-center text-destructive">Error: {error.message}</TableCell></TableRow>}
                {sortedClassrooms?.map(classroom => (
                  <TableRow key={classroom.id}>
                    <TableCell className="font-medium">{classroom.name}</TableCell>
                    <TableCell><Badge variant={getTypeBadgeVariant(classroom.type)}>{classroom.type}</Badge></TableCell>
                    <TableCell>{classroom.capacity}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <span className="sr-only">Abrir menú</span>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                          <DropdownMenuItem onClick={() => handleEdit(classroom)}>Editar Sala</DropdownMenuItem>
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
                                          Esta acción no se puede deshacer. Esto eliminará permanentemente la sala.
                                      </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                      <AlertDialogAction onClick={() => handleDelete(classroom.id)} className="bg-destructive hover:bg-destructive/90">Eliminar</AlertDialogAction>
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
