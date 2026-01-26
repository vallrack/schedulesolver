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
import type { Career, Course, Group, Module } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { CourseForm } from "@/components/courses/course-form";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";
import { Input } from "@/components/ui/input";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

type CourseWithDetails = Course & {
    moduleName: string;
    groupInfo: string;
    careerId: string;
    careerName: string;
};

type SortableCourseKeys = keyof CourseWithDetails;

export default function CoursesPage() {
  const firestore = useFirestore();
  const { toast } = useToast();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | undefined>(undefined);
  const [filterText, setFilterText] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: SortableCourseKeys; direction: 'ascending' | 'descending' } | null>({ key: 'moduleName', direction: 'ascending' });

  const coursesCollection = useMemo(() => firestore ? collection(firestore, 'courses') : null, [firestore]);
  const { data: courses, loading: loadingCourses, error: errorCourses } = useCollection<Course>(coursesCollection);

  const modulesCollection = useMemo(() => firestore ? collection(firestore, 'modules') : null, [firestore]);
  const { data: modules, loading: loadingModules, error: errorModules } = useCollection<Module>(modulesCollection);

  const careersCollection = useMemo(() => firestore ? collection(firestore, 'careers') : null, [firestore]);
  const { data: careers, loading: loadingCareers, error: errorCareers } = useCollection<Career>(careersCollection);

  const groupsCollection = useMemo(() => firestore ? collection(firestore, 'groups') : null, [firestore]);
  const { data: groups, loading: loadingGroups, error: errorGroups } = useCollection<Group>(groupsCollection);

  const loading = loadingCourses || loadingModules || loadingCareers || loadingGroups;
  const error = errorCourses || errorModules || errorCareers || errorGroups;

  const coursesWithDetails: CourseWithDetails[] = useMemo(() => {
    if (!courses || !groups || !careers || !modules) return [];
    return courses.map(course => {
        const module = modules.find(m => m.id === course.moduleId);
        const group = groups.find(g => g.id === course.groupId);
        if (!group || !module) return null;

        const career = careers.find(c => c.id === group.careerId);
        return {
            ...course,
            moduleName: module.name,
            groupInfo: `${career?.name || '...'} - Sem ${group.semester} - G ${group.name}`,
            careerId: career?.id || 'unknown',
            careerName: career?.name || 'Carrera Desconocida',
        }
    }).filter((c): c is CourseWithDetails => c !== null);
  }, [courses, modules, groups, careers]);

  const filteredCourses = useMemo(() => {
    if (!coursesWithDetails) return [];
    return coursesWithDetails.filter(course =>
      (course.moduleName && course.moduleName.toLowerCase().includes(filterText.toLowerCase())) ||
      (course.groupInfo && course.groupInfo.toLowerCase().includes(filterText.toLowerCase()))
    );
  }, [coursesWithDetails, filterText]);
  
  const requestSort = (key: SortableCourseKeys) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  const sortedCourses = useMemo(() => {
    let sortableItems: CourseWithDetails[] = [...filteredCourses];
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
  }, [filteredCourses, sortConfig]);

  const coursesByCareer = useMemo(() => {
    return sortedCourses.reduce((acc, course) => {
        const { careerName } = course;
        if (!acc[careerName]) {
            acc[careerName] = [];
        }
        acc[careerName].push(course);
        return acc;
    }, {} as Record<string, CourseWithDetails[]>);
  }, [sortedCourses]);


  const handleAddNew = () => {
    setEditingCourse(undefined);
    setDialogOpen(true);
  };

  const handleEdit = (course: Course) => {
    setEditingCourse(course);
    setDialogOpen(true);
  };

  const handleDelete = async (courseId: string) => {
    if (!firestore) return;
    const courseRef = doc(firestore, 'courses', courseId);
    try {
        await deleteDoc(courseRef);
        toast({
          variant: 'destructive',
          title: 'Curso Eliminado',
          description: `El curso programado ha sido eliminado.`,
        });
    } catch(e) {
        const permissionError = new FirestorePermissionError({
            path: courseRef.path,
            operation: 'delete',
        });
        errorEmitter.emit('permission-error', permissionError);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold font-headline tracking-tight">Cursos Programados</h1>
            <Button onClick={handleAddNew}>
                <PlusCircle className="mr-2 h-4 w-4" />
                Añadir Curso
            </Button>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogContent className="sm:max-w-xl">
                <DialogHeader>
                    <DialogTitle>{editingCourse ? 'Editar Curso' : 'Añadir Nuevo Curso Programado'}</DialogTitle>
                    <DialogDescription>
                       {editingCourse ? 'Actualiza los detalles del curso.' : 'Rellena los detalles para programar un nuevo curso.'}
                    </DialogDescription>
                </DialogHeader>
                <CourseForm 
                    course={editingCourse} 
                    allCourses={courses || []}
                    modules={modules || []}
                    groups={groups || []}
                    careers={careers || []}
                    onSuccess={() => setDialogOpen(false)} 
                />
            </DialogContent>
        </Dialog>


        <Card>
          <CardHeader>
            <CardTitle>Cursos por Carrera</CardTitle>
            <CardDescription>Gestiona los cursos programados para cada grupo, organizados por carrera.</CardDescription>
            <div className="pt-4">
              <Input 
                placeholder="Filtrar por módulo o grupo..."
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                className="max-w-sm"
              />
            </div>
          </CardHeader>
          <CardContent>
            {loading && <div className="text-center py-10">Cargando...</div>}
            {error && <div className="text-center py-10 text-destructive">Error: {error.message}</div>}
            {!loading && !error && (
                 <Accordion type="multiple" className="w-full space-y-2">
                    {Object.keys(coursesByCareer).sort().map((careerName) => (
                        <AccordionItem value={careerName} key={careerName} className="border rounded-lg px-4 bg-background">
                            <AccordionTrigger className="hover:no-underline">
                                <h3 className="text-lg font-semibold">{careerName} <span className="text-sm font-normal text-muted-foreground">({coursesByCareer[careerName].length} cursos)</span></h3>
                            </AccordionTrigger>
                            <AccordionContent>
                                <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                        <TableHead><Button variant="ghost" onClick={() => requestSort('moduleName')}>Módulo <ArrowUpDown className="ml-2 h-4 w-4" /></Button></TableHead>
                                        <TableHead><Button variant="ghost" onClick={() => requestSort('groupInfo')}>Grupo <ArrowUpDown className="ml-2 h-4 w-4" /></Button></TableHead>
                                        <TableHead><Button variant="ghost" onClick={() => requestSort('durationWeeks')}>Semanas <ArrowUpDown className="ml-2 h-4 w-4" /></Button></TableHead>
                                        <TableHead><Button variant="ghost" onClick={() => requestSort('totalHours')}>Horas <ArrowUpDown className="ml-2 h-4 w-4" /></Button></TableHead>
                                        <TableHead><Button variant="ghost" onClick={() => requestSort('startDate')}>Fecha Inicio <ArrowUpDown className="ml-2 h-4 w-4" /></Button></TableHead>
                                        <TableHead><Button variant="ghost" onClick={() => requestSort('endDate')}>Fecha Fin <ArrowUpDown className="ml-2 h-4 w-4" /></Button></TableHead>
                                        <TableHead className="text-right"><span className="sr-only">Acciones</span></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                    {coursesByCareer[careerName].map(course => (
                                    <TableRow key={course.id}>
                                        <TableCell className="font-medium">{course.moduleName}</TableCell>
                                        <TableCell>{course.groupInfo}</TableCell>
                                        <TableCell>{course.durationWeeks}</TableCell>
                                        <TableCell>{course.totalHours}</TableCell>
                                        <TableCell>{format(new Date(course.startDate), "d MMM, yyyy", { locale: es })}</TableCell>
                                        <TableCell>{format(new Date(course.endDate), "d MMM, yyyy", { locale: es })}</TableCell>
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
                                            <DropdownMenuItem onClick={() => handleEdit(course)}>Editar Curso</DropdownMenuItem>
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
                                                            Esta acción no se puede deshacer. Esto eliminará permanentemente el curso programado.
                                                        </AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                        <AlertDialogAction onClick={() => handleDelete(course.id)} className="bg-destructive hover:bg-destructive/90">Eliminar</AlertDialogAction>
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
                                </div>
                            </AccordionContent>
                        </AccordionItem>
                    ))}
                    {Object.keys(coursesByCareer).length === 0 && (
                        <div className="text-center py-10 text-muted-foreground">
                            <p>No se encontraron cursos que coincidan con el filtro.</p>
                        </div>
                    )}
                 </Accordion>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  )
}
