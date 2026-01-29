'use client'
import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu"
import { MoreHorizontal, PlusCircle, Trash2, ArrowUpDown, Upload } from "lucide-react"
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
import type { Career } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { CareerForm } from "@/components/careers/career-form";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";
import { Input } from "@/components/ui/input";
import { CareerImportDialog } from "@/components/careers/career-import-dialog";


export default function CareersPage() {
  const firestore = useFirestore();
  const { toast } = useToast();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [editingCareer, setEditingCareer] = useState<Career | undefined>(undefined);
  const [filterText, setFilterText] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: keyof Career; direction: 'ascending' | 'descending' } | null>({ key: 'name', direction: 'ascending' });


  const careersCollection = useMemo(() => firestore ? collection(firestore, 'careers') : null, [firestore]);
  const { data: careers, loading, error } = useCollection<Career>(careersCollection);

  const filteredCareers = useMemo(() => {
    if (!careers) return [];
    return careers.filter(career =>
      career.name.toLowerCase().includes(filterText.toLowerCase())
    );
  }, [careers, filterText]);

  const requestSort = (key: keyof Career) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  const sortedCareers = useMemo(() => {
    let sortableItems = [...filteredCareers];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        if (a[sortConfig.key] < b[sortConfig.key]) {
          return sortConfig.direction === 'ascending' ? -1 : 1;
        }
        if (a[sortConfig.key] > b[sortConfig.key]) {
          return sortConfig.direction === 'ascending' ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableItems;
  }, [filteredCareers, sortConfig]);


  const handleAddNew = () => {
    setEditingCareer(undefined);
    setDialogOpen(true);
  };

  const handleEdit = (career: Career) => {
    setEditingCareer(career);
    setDialogOpen(true);
  };

  const handleDelete = async (careerId: string) => {
    if (!firestore) return;
    const careerRef = doc(firestore, 'careers', careerId);
    try {
        await deleteDoc(careerRef);
        toast({
          variant: 'destructive',
          title: 'Carrera Eliminada',
          description: `La carrera ha sido eliminada.`,
        });
    } catch (e) {
        const permissionError = new FirestorePermissionError({
            path: careerRef.path,
            operation: 'delete',
        });
        errorEmitter.emit('permission-error', permissionError);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold font-headline tracking-tight">Gestión de Carreras</h1>
            <div className="flex gap-2">
                <Button variant="outline" onClick={() => setImportDialogOpen(true)}>
                    <Upload className="mr-2 h-4 w-4" />
                    Importar desde Archivo
                </Button>
                <Button onClick={handleAddNew}>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Añadir Carrera
                </Button>
            </div>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>{editingCareer ? 'Editar Carrera' : 'Añadir Nueva Carrera'}</DialogTitle>
                    <DialogDescription>
                       {editingCareer ? 'Actualiza el nombre de la carrera.' : 'Añade una nueva carrera al sistema.'}
                    </DialogDescription>
                </DialogHeader>
                <CareerForm
                    career={editingCareer} 
                    onSuccess={() => setDialogOpen(false)} 
                />
            </DialogContent>
        </Dialog>
        
        <CareerImportDialog 
            open={importDialogOpen}
            onOpenChange={setImportDialogOpen}
            onSuccess={() => {
                setImportDialogOpen(false);
            }}
        />


        <Card>
          <CardHeader>
            <CardTitle>Carreras Ofrecidas</CardTitle>
            <CardDescription>Gestiona las carreras disponibles en la institución.</CardDescription>
            <div className="pt-4">
              <Input 
                placeholder="Filtrar carreras..."
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
                        Nombre de la Carrera
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                  </TableHead>
                  <TableHead className="text-right"><span className="sr-only">Acciones</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && <TableRow><TableCell colSpan={2} className="text-center">Cargando...</TableCell></TableRow>}
                {error && <TableRow><TableCell colSpan={2} className="text-center text-destructive">Error: {error.message}</TableCell></TableRow>}
                {sortedCareers?.map(career => (
                  <TableRow key={career.id}>
                    <TableCell className="font-medium">{career.name}</TableCell>
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
                          <DropdownMenuItem onClick={() => handleEdit(career)}>Editar Carrera</DropdownMenuItem>
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
                                          Esta acción no se puede deshacer. Esto eliminará permanentemente la carrera.
                                      </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                      <AlertDialogAction onClick={() => handleDelete(career.id)} className="bg-destructive hover:bg-destructive/90">Eliminar</AlertDialogAction>
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
