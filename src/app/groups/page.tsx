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
import { useCollection } from "@/firebase/firestore/use-collection"
import { useFirestore } from "@/firebase"
import { collection, deleteDoc, doc } from "firebase/firestore"
import AppLayout from "@/components/app-layout"
import type { Career, Group } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { GroupForm } from "@/components/groups/group-form";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";
import { Input } from "@/components/ui/input";


type GroupWithCareer = Group & { careerName: string; };
type SortableGroupKeys = keyof GroupWithCareer;


export default function GroupsPage() {
  const firestore = useFirestore();
  const { toast } = useToast();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<Group | undefined>(undefined);
  const [filterText, setFilterText] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: SortableGroupKeys; direction: 'ascending' | 'descending' } | null>({ key: 'careerName', direction: 'ascending' });

  const groupsCollection = useMemo(() => firestore ? collection(firestore, 'groups') : null, [firestore]);
  const { data: groups, loading: loadingGroups, error: errorGroups } = useCollection<Group>(groupsCollection);
  
  const careersCollection = useMemo(() => firestore ? collection(firestore, 'careers') : null, [firestore]);
  const { data: careers, loading: loadingCareers, error: errorCareers } = useCollection<Career>(careersCollection);

  const loading = loadingGroups || loadingCareers;
  const error = errorGroups || errorCareers;

  const groupsWithCareer: GroupWithCareer[] = useMemo(() => {
    if (!groups || !careers) return [];
    return groups.map(group => {
      const career = careers.find(c => c.id === group.careerId);
      return {
        ...group,
        careerName: career?.name || 'Desconocida'
      }
    })
  }, [groups, careers]);

  const filteredGroups = useMemo(() => {
    if (!groupsWithCareer) return [];
    return groupsWithCareer.filter(group =>
      group.careerName.toLowerCase().includes(filterText.toLowerCase()) ||
      group.name.toLowerCase().includes(filterText.toLowerCase()) ||
      String(group.semester).includes(filterText)
    );
  }, [groupsWithCareer, filterText]);

  const requestSort = (key: SortableGroupKeys) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  const sortedGroups = useMemo(() => {
    let sortableItems: GroupWithCareer[] = [...filteredGroups];
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
  }, [filteredGroups, sortConfig]);


  const handleAddNew = () => {
    setEditingGroup(undefined);
    setDialogOpen(true);
  };

  const handleEdit = (group: Group) => {
    setEditingGroup(group);
    setDialogOpen(true);
  };

  const handleDelete = async (groupId: string) => {
    if (!firestore) return;
    const groupRef = doc(firestore, 'groups', groupId);
    try {
        await deleteDoc(groupRef);
        toast({
          variant: 'destructive',
          title: 'Grupo Eliminado',
          description: `El grupo ha sido eliminado.`,
        });
    } catch (e) {
        const permissionError = new FirestorePermissionError({
            path: groupRef.path,
            operation: 'delete',
        });
        errorEmitter.emit('permission-error', permissionError);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold font-headline tracking-tight">Gestión de Grupos</h1>
            <Button onClick={handleAddNew}>
                <PlusCircle className="mr-2 h-4 w-4" />
                Añadir Grupo
            </Button>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>{editingGroup ? 'Editar Grupo' : 'Añadir Nuevo Grupo'}</DialogTitle>
                    <DialogDescription>
                       {editingGroup ? 'Actualiza los detalles del grupo.' : 'Añade un nuevo grupo al sistema.'}
                    </DialogDescription>
                </DialogHeader>
                <GroupForm
                    group={editingGroup} 
                    careers={careers || []}
                    onSuccess={() => setDialogOpen(false)} 
                />
            </DialogContent>
        </Dialog>


        <Card>
          <CardHeader>
            <CardTitle>Grupos de Estudiantes</CardTitle>
            <CardDescription>Gestiona los grupos de estudiantes por carrera y semestre.</CardDescription>
            <div className="pt-4">
              <Input 
                placeholder="Filtrar por carrera, semestre o grupo..."
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
                  <TableHead><Button variant="ghost" onClick={() => requestSort('careerName')}>Carrera <ArrowUpDown className="ml-2 h-4 w-4" /></Button></TableHead>
                  <TableHead><Button variant="ghost" onClick={() => requestSort('semester')}>Semestre <ArrowUpDown className="ml-2 h-4 w-4" /></Button></TableHead>
                  <TableHead><Button variant="ghost" onClick={() => requestSort('name')}>Grupo <ArrowUpDown className="ml-2 h-4 w-4" /></Button></TableHead>
                  <TableHead><Button variant="ghost" onClick={() => requestSort('studentCount')}>Estudiantes <ArrowUpDown className="ml-2 h-4 w-4" /></Button></TableHead>
                  <TableHead className="text-right"><span className="sr-only">Acciones</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && <TableRow><TableCell colSpan={5} className="text-center">Cargando...</TableCell></TableRow>}
                {error && <TableRow><TableCell colSpan={5} className="text-center text-destructive">Error: {error.message}</TableCell></TableRow>}
                {sortedGroups?.map(group => (
                  <TableRow key={group.id}>
                    <TableCell className="font-medium">{group.careerName}</TableCell>
                    <TableCell>{group.semester}</TableCell>
                    <TableCell>{group.name}</TableCell>
                    <TableCell>{group.studentCount}</TableCell>
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
                          <DropdownMenuItem onClick={() => handleEdit(group)}>Editar Grupo</DropdownMenuItem>
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
                                          Esta acción no se puede deshacer. Esto eliminará permanentemente el grupo.
                                      </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                      <AlertDialogAction onClick={() => handleDelete(group.id)} className="bg-destructive hover:bg-destructive/90">Eliminar</AlertDialogAction>
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
