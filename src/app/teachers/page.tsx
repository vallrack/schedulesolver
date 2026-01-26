'use client';
import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { MoreHorizontal, PlusCircle, Trash2, UserX, UserCheck } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCollection } from "@/firebase/firestore/use-collection";
import { useFirestore } from "@/firebase";
import { collection, doc, updateDoc, deleteDoc } from "firebase/firestore";
import type { Subject, Teacher, ScheduleEvent } from "@/lib/types";
import AppLayout from "@/components/app-layout";
import { TeacherForm } from '@/components/teachers/teacher-form';
import { useToast } from '@/hooks/use-toast';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { Progress } from '@/components/ui/progress';


export default function TeachersPage() {
  const firestore = useFirestore();
  const { toast } = useToast();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<Teacher | undefined>(undefined);

  const teachersCollection = useMemo(() => firestore ? collection(firestore, 'teachers') : null, [firestore]);
  const { data: teachers, loading: loadingTeachers, error: errorTeachers } = useCollection<Teacher>(teachersCollection);

  const subjectsCollection = useMemo(() => firestore ? collection(firestore, 'subjects') : null, [firestore]);
  const { data: subjects, loading: loadingSubjects, error: errorSubjects } = useCollection<Subject>(subjectsCollection);

  const schedulesCollection = useMemo(() => firestore ? collection(firestore, 'schedules') : null, [firestore]);
  const { data: scheduleEvents, loading: loadingSchedules, error: errorSchedules } = useCollection<ScheduleEvent>(schedulesCollection);

  const teacherWithHours = useMemo(() => {
    if (!teachers) return [];
    if (!scheduleEvents) return teachers.map(t => ({...t, assignedHours: 0}));

    const timeToMinutes = (time: string): number => {
        if (!time) return 0;
        const [hours, minutes] = time.split(':').map(Number);
        return (hours || 0) * 60 + (minutes || 0);
    };

    return teachers.map(teacher => {
        const assignedMinutes = scheduleEvents
            .filter(event => event.teacherId === teacher.id)
            .reduce((total, event) => {
                const start = timeToMinutes(event.startTime);
                const end = timeToMinutes(event.endTime);
                if (end > start) {
                  return total + (end - start);
                }
                return total;
            }, 0);
        const assignedHours = assignedMinutes / 60;
        return {
            ...teacher,
            assignedHours: Math.round(assignedHours * 100) / 100,
        };
    });
  }, [teachers, scheduleEvents]);


  const { activeTeachers, inactiveTeachers } = useMemo(() => {
    if (!teacherWithHours) return { activeTeachers: [], inactiveTeachers: [] };
    return {
      activeTeachers: teacherWithHours.filter(t => t.status === 'active'),
      inactiveTeachers: teacherWithHours.filter(t => t.status === 'inactive'),
    };
  }, [teacherWithHours]);

  const loading = loadingTeachers || loadingSubjects || loadingSchedules;
  const error = errorTeachers || errorSubjects || errorSchedules;

  const handleAddNew = () => {
    setEditingTeacher(undefined);
    setDialogOpen(true);
  };

  const handleEdit = (teacher: Teacher) => {
    setEditingTeacher(teacher);
    setDialogOpen(true);
  };
  
  const handleSetStatus = (teacher: Teacher, status: 'active' | 'inactive') => {
    if (!firestore) return;
    const teacherRef = doc(firestore, 'teachers', teacher.id);
    updateDoc(teacherRef, { status }).catch(async (serverError) => {
        const permissionError = new FirestorePermissionError({
            path: teacherRef.path,
            operation: 'update',
            requestResourceData: { status },
        });
        errorEmitter.emit('permission-error', permissionError);
    });
    toast({
      title: `Docente ${status === 'active' ? 'Activado' : 'Inactivado'}`,
      description: `${teacher.name} ha sido marcado como ${status === 'active' ? 'activo' : 'inactivo'}.`,
    });
  };

  const handleDelete = (teacherId: string) => {
    if (!firestore) return;
    const teacherRef = doc(firestore, 'teachers', teacherId);
    deleteDoc(teacherRef).catch(async (serverError) => {
        const permissionError = new FirestorePermissionError({
            path: teacherRef.path,
            operation: 'delete',
        });
        errorEmitter.emit('permission-error', permissionError);
    });
    toast({
      variant: 'destructive',
      title: 'Docente Eliminado',
      description: `El docente ha sido eliminado permanentemente.`,
    });
  };


  type TeacherWithHours = Teacher & { assignedHours?: number };
  const renderTable = (teacherList: TeacherWithHours[]) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nombre</TableHead>
          <TableHead className="hidden lg:table-cell">Email</TableHead>
          <TableHead className="hidden md:table-cell">Tipo de Contrato</TableHead>
          <TableHead>Horas Semanales</TableHead>
          <TableHead>Módulos Asignados</TableHead>
          <TableHead className="hidden sm:table-cell">Estado</TableHead>
          <TableHead><span className="sr-only">Acciones</span></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {loading && <TableRow><TableCell colSpan={7} className="text-center">Cargando...</TableCell></TableRow>}
        {error && <TableRow><TableCell colSpan={7} className="text-center text-destructive">Error: {error?.message}</TableCell></TableRow>}
        {teacherList?.map(teacher => (
          <TableRow key={teacher.id}>
            <TableCell className="font-medium">{teacher.name}</TableCell>
            <TableCell className="hidden lg:table-cell">{teacher.email}</TableCell>
            <TableCell className="hidden md:table-cell">{teacher.contractType}</TableCell>
             <TableCell>
              <div className='w-28'>
                <Progress value={((teacher.assignedHours ?? 0) / teacher.maxWeeklyHours) * 100} className="h-2" />
                <span className="text-xs text-muted-foreground">{teacher.assignedHours ?? 0} / {teacher.maxWeeklyHours}h</span>
              </div>
            </TableCell>
            <TableCell>
              <div className="flex flex-wrap gap-1 max-w-xs">
                {teacher.specialties?.map((specId: string) => {
                  const subject = subjects?.find(s => s.id === specId);
                  return <Badge key={specId} variant="secondary">{subject?.name ?? 'Desconocido'}</Badge>;
                })}
              </div>
            </TableCell>
            <TableCell className="hidden sm:table-cell">
              <Badge variant={teacher.status === 'active' ? 'default' : 'outline'}>
                {teacher.status === 'active' ? 'Activo' : 'Inactivo'}
              </Badge>
            </TableCell>
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
                  <DropdownMenuItem onClick={() => handleEdit(teacher)}>Editar Perfil</DropdownMenuItem>
                  {teacher.status === 'active' ? (
                    <DropdownMenuItem onClick={() => handleSetStatus(teacher, 'inactive')}>
                      <UserX className="mr-2 h-4 w-4" />
                      Inactivar
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem onClick={() => handleSetStatus(teacher, 'active')}>
                      <UserCheck className="mr-2 h-4 w-4" />
                      Activar
                    </DropdownMenuItem>
                  )}
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
                                  Esta acción no se puede deshacer. Esto eliminará permanentemente al docente
                                  y borrará sus datos de nuestros servidores.
                              </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDelete(teacher.id)} className="bg-destructive hover:bg-destructive/90">Eliminar</AlertDialogAction>
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
  );

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold font-headline tracking-tight">Gestión de Docentes</h1>
          <Button onClick={handleAddNew}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Añadir Docente
          </Button>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>{editingTeacher ? 'Editar Docente' : 'Añadir Nuevo Docente'}</DialogTitle>
                    <DialogDescription>
                       {editingTeacher ? 'Actualiza los detalles del docente.' : 'Rellena los detalles para el nuevo docente.'}
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                    <TeacherForm 
                        teacher={editingTeacher} 
                        subjects={subjects || []} 
                        onSuccess={() => setDialogOpen(false)} 
                    />
                </div>
            </DialogContent>
        </Dialog>

        <Card>
          <CardHeader>
            <CardTitle>Listado de Docentes</CardTitle>
            <CardDescription>Gestiona los perfiles, especializaciones y disponibilidad de los docentes.</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="active">
              <TabsList>
                <TabsTrigger value="active">Activos</TabsTrigger>
                <TabsTrigger value="inactive">Historial (Inactivos)</TabsTrigger>
              </TabsList>
              <TabsContent value="active" className="mt-4">
                {renderTable(activeTeachers)}
              </TabsContent>
              <TabsContent value="inactive" className="mt-4">
                {renderTable(inactiveTeachers)}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
