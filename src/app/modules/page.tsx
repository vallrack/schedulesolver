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
import type { Module } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { ModuleForm } from "@/components/modules/module-form";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";
import { Input } from "@/components/ui/input";
import { ModuleImportDialog } from "@/components/modules/module-import-dialog";


type SortableModuleKeys = keyof Module;

export default function ModulesPage() {
  const firestore = useFirestore();
  const { toast } = useToast();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [editingModule, setEditingModule] = useState<Module | undefined>(undefined);
  const [filterText, setFilterText] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: SortableModuleKeys; direction: 'ascending' | 'descending' } | null>({ key: 'name', direction: 'ascending' });

  const modulesCollection = useMemo(() => firestore ? collection(firestore, 'modules') : null, [firestore]);
  const { data: modules, loading, error } = useCollection<Module>(modulesCollection);

  const filteredModules = useMemo(() => {
    if (!modules) return [];
    return modules.filter(module =>
      module.name.toLowerCase().includes(filterText.toLowerCase()) ||
      (module.description && module.description.toLowerCase().includes(filterText.toLowerCase()))
    );
  }, [modules, filterText]);

  const requestSort = (key: SortableModuleKeys) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  const sortedModules = useMemo(() => {
    let sortableItems: Module[] = [...filteredModules];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        const aValue = a[sortConfig.key] ?? '';
        const bValue = b[sortConfig.key] ?? '';
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
  }, [filteredModules, sortConfig]);


  const handleAddNew = () => {
    setEditingModule(undefined);
    setDialogOpen(true);
  };

  const handleEdit = (module: Module) => {
    setEditingModule(module);
    setDialogOpen(true);
  };

  const handleDelete = async (moduleId: string) => {
    if (!firestore) return;
    const moduleRef = doc(firestore, 'modules', moduleId);
    try {
        await deleteDoc(moduleRef);
        toast({
          variant: 'destructive',
          title: 'Módulo Eliminado',
          description: `El módulo ha sido eliminado.`,
        });
    } catch(e) {
        const permissionError = new FirestorePermissionError({
            path: moduleRef.path,
            operation: 'delete',
        });
        errorEmitter.emit('permission-error', permissionError);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-2">
            <h1 className="text-3xl font-bold font-headline tracking-tight">Catálogo de Módulos</h1>
            <div className="flex gap-2">
                <Button variant="outline" onClick={() => setImportDialogOpen(true)}>
                    <Upload className="mr-2 h-4 w-4" />
                    Importar desde Archivo
                </Button>
                <Button onClick={handleAddNew}>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Añadir Módulo
                </Button>
            </div>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogContent className="sm:max-w-xl">
                <DialogHeader>
                    <DialogTitle>{editingModule ? 'Editar Módulo' : 'Añadir Nuevo Módulo'}</DialogTitle>
                    <DialogDescription>
                       {editingModule ? 'Actualiza los detalles del módulo.' : 'Añade un nuevo módulo genérico al catálogo del sistema.'}
                    </DialogDescription>
                </DialogHeader>
                <ModuleForm
                    module={editingModule} 
                    onSuccess={() => setDialogOpen(false)} 
                />
            </DialogContent>
        </Dialog>

        <ModuleImportDialog
            open={importDialogOpen}
            onOpenChange={setImportDialogOpen}
            onSuccess={() => setImportDialogOpen(false)}
        />


        <Card>
          <CardHeader>
            <CardTitle>Módulos Disponibles</CardTitle>
            <CardDescription>Gestiona las plantillas de las materias o módulos que se pueden impartir.</CardDescription>
            <div className="pt-4">
              <Input 
                placeholder="Filtrar por nombre o descripción..."
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
                  <TableHead><Button variant="ghost" onClick={() => requestSort('name')}>Nombre <ArrowUpDown className="ml-2 h-4 w-4" /></Button></TableHead>
                  <TableHead className="hidden sm:table-cell"><Button variant="ghost" onClick={() => requestSort('totalHours')}>Horas <ArrowUpDown className="ml-2 h-4 w-4" /></Button></TableHead>
                  <TableHead className="hidden lg:table-cell"><Button variant="ghost" onClick={() => requestSort('description')}>Descripción <ArrowUpDown className="ml-2 h-4 w-4" /></Button></TableHead>
                  <TableHead className="text-right"><span className="sr-only">Acciones</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && <TableRow><TableCell colSpan={4} className="text-center">Cargando...</TableCell></TableRow>}
                {error && <TableRow><TableCell colSpan={4} className="text-center text-destructive">Error: {error.message}</TableCell></TableRow>}
                {sortedModules?.map(module => (
                  <TableRow key={module.id}>
                    <TableCell className="font-medium">{module.name}</TableCell>
                    <TableCell className="hidden sm:table-cell">{module.totalHours}</TableCell>
                    <TableCell className="hidden lg:table-cell max-w-xs truncate">{module.description}</TableCell>
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
                          <DropdownMenuItem onClick={() => handleEdit(module)}>Editar Módulo</DropdownMenuItem>
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
                                      <AlertDialogAction onClick={() => handleDelete(module.id)} className="bg-destructive hover:bg-destructive/90">Eliminar</AlertDialogAction>
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
