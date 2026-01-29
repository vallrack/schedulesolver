'use client';

import { useState } from 'react';
import * as XLSX from 'xlsx';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useFirestore } from '@/firebase';
import { writeBatch, collection, doc } from 'firebase/firestore';
import type { Teacher, Module } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { ScrollArea } from '../ui/scroll-area';
import { AlertCircle, CheckCircle, UploadCloud, Loader2, Download } from 'lucide-react';
import { Badge } from '../ui/badge';

type ParsedTeacher = Omit<Teacher, 'id' | 'specialties' | 'status' | 'availability'> & {
    specialties: string; // Comma-separated names
    isValid: boolean;
    errors: string[];
};

interface TeacherImportDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
    modules: Module[];
}

export function TeacherImportDialog({ open, onOpenChange, onSuccess, modules }: TeacherImportDialogProps) {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [isProcessing, setIsProcessing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [parsedData, setParsedData] = useState<ParsedTeacher[]>([]);
    const [fileName, setFileName] = useState('');

    const resetState = () => {
        setParsedData([]);
        setFileName('');
        setIsProcessing(false);
        setIsSaving(false);
    }
    
    const allowedContractTypes: Teacher['contractType'][] = ['Tiempo Completo', 'Medio Tiempo', 'Por Horas'];

    const handleDownloadTemplate = () => {
        const headers = [['name', 'email', 'contractType', 'maxWeeklyHours', 'specialties']];
        const exampleData = [
            ['Juan Pérez', 'juan.perez@example.com', 'Tiempo Completo', 40, 'Fundamentos de Programación, Bases de Datos'],
            ['Maria Rodriguez', 'maria.r@example.com', 'Por Horas', 10, 'Diseño Web'],
        ];
        const ws = XLSX.utils.aoa_to_sheet([...headers, ...exampleData]);
        
        ws['!cols'] = [ { wch: 25 }, { wch: 30 }, { wch: 20 }, { wch: 15 }, { wch: 50 } ];

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Plantilla');
        XLSX.writeFile(wb, 'plantilla_docentes.xlsx');
    };

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        resetState();
        setIsProcessing(true);
        setFileName(file.name);

        try {
            const data = await file.arrayBuffer();
            const workbook = XLSX.read(data, { type: 'buffer' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const json = XLSX.utils.sheet_to_json<any>(worksheet);

            const moduleNameMap = new Map(modules.map(m => [m.name.toLowerCase(), m.id]));

            const processedData = json.map(row => {
                const lowerCaseRow = Object.keys(row).reduce((acc, key) => {
                    acc[key.toLowerCase().trim()] = row[key];
                    return acc;
                }, {} as {[key: string]: any});

                const name = String(lowerCaseRow['name'] || '').trim();
                const email = String(lowerCaseRow['email'] || '').trim();
                const contractType = String(lowerCaseRow['contracttype'] || '').trim();
                const maxWeeklyHours = parseInt(String(lowerCaseRow['maxweeklyhours'] || 0), 10);
                const specialties = String(lowerCaseRow['specialties'] || '').trim();
                
                const teacher: ParsedTeacher = {
                    name,
                    email,
                    contractType: 'Por Horas', // default
                    maxWeeklyHours,
                    specialties,
                    isValid: true,
                    errors: [],
                };
                
                if (!name) {
                    teacher.isValid = false;
                    teacher.errors.push('La columna "name" no puede estar vacía.');
                }
                if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
                    teacher.isValid = false;
                    teacher.errors.push('El "email" no es válido.');
                }
                if (!allowedContractTypes.find(c => c.toLowerCase() === contractType.toLowerCase())) {
                    teacher.isValid = false;
                    teacher.errors.push('El "contractType" no es válido.');
                } else {
                    // Find the correct case version of the contract type
                    teacher.contractType = allowedContractTypes.find(c => c.toLowerCase() === contractType.toLowerCase())!;
                }

                if (isNaN(maxWeeklyHours) || maxWeeklyHours <= 0) {
                    teacher.isValid = false;
                    teacher.errors.push('Las "maxWeeklyHours" deben ser un número positivo.');
                }
                
                const specialtyNames = specialties.split(',').map(s => s.trim()).filter(Boolean);
                specialtyNames.forEach(specName => {
                    if (!moduleNameMap.has(specName.toLowerCase())) {
                        teacher.isValid = false;
                        teacher.errors.push(`Especialidad "${specName}" no encontrada.`);
                    }
                });


                return teacher;
            });
            
            setParsedData(processedData);

        } catch (error) {
            console.error(error);
            toast({
                variant: 'destructive',
                title: 'Error al procesar el archivo',
                description: 'Asegúrate de que es un archivo .xlsx, .xls o .csv válido y que sigue el formato correcto.',
            });
        } finally {
            setIsProcessing(false);
        }
    };
    
    const handleSave = async () => {
        if (!firestore) return;
        const validData = parsedData.filter(d => d.isValid);
        if (validData.length === 0) {
             toast({
                variant: 'destructive',
                title: 'No hay datos válidos para guardar',
                description: 'Revisa la vista previa y corrige los errores en tu archivo.',
            });
            return;
        }

        setIsSaving(true);
        try {
            const batch = writeBatch(firestore);
            const teachersCol = collection(firestore, 'teachers');
            const moduleNameMap = new Map(modules.map(m => [m.name.toLowerCase(), m.id]));
            
            validData.forEach(teacher => {
                const newDocRef = doc(teachersCol);
                const specialtyIds = teacher.specialties
                    .split(',')
                    .map(s => s.trim())
                    .filter(Boolean)
                    .map(specName => moduleNameMap.get(specName.toLowerCase()))
                    .filter((id): id is string => !!id);

                const teacherData: Omit<Teacher, 'id'> = {
                    name: teacher.name,
                    email: teacher.email,
                    contractType: teacher.contractType,
                    maxWeeklyHours: teacher.maxWeeklyHours,
                    specialties: specialtyIds,
                    availability: [],
                    status: 'active'
                };
                batch.set(newDocRef, teacherData);
            });
            
            await batch.commit();

            toast({
                title: '¡Importación Exitosa!',
                description: `Se han guardado ${validData.length} nuevos docentes.`,
            });
            onSuccess();
        } catch (error) {
             console.error(error);
             toast({
                variant: 'destructive',
                title: 'Error al guardar los datos',
                description: 'Ocurrió un error al intentar guardar en la base de datos.',
            });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={(isOpen) => {
            if (!isOpen) {
                resetState();
            }
            onOpenChange(isOpen);
        }}>
            <DialogContent className="max-w-4xl flex flex-col max-h-[80vh]">
                <DialogHeader>
                    <DialogTitle>Importar Docentes desde Archivo</DialogTitle>
                    <DialogDescription>
                        Sube un archivo Excel (.xlsx, .xls) o CSV con las columnas: <strong>name</strong>, <strong>email</strong>, <strong>contractType</strong>, <strong>maxWeeklyHours</strong>, y <strong>specialties</strong> (opcional).
                        Las especialidades deben ser nombres de módulos separados por comas.
                    </DialogDescription>
                    <div className="pt-2">
                        <Button variant="outline" size="sm" onClick={handleDownloadTemplate}>
                            <Download className="mr-2 h-4 w-4" />
                            Descargar Plantilla
                        </Button>
                    </div>
                </DialogHeader>
                
                <div className="flex-1 overflow-y-auto -mx-6 px-6">
                    <div className="py-4 space-y-6">
                        <div className="flex items-center justify-center w-full px-6">
                            <label htmlFor="dropzone-file-teacher" className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-lg cursor-pointer bg-muted hover:bg-background/80">
                                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                    <UploadCloud className="w-8 h-8 mb-4 text-muted-foreground" />
                                    <p className="mb-2 text-sm text-muted-foreground"><span className="font-semibold">Haz clic para subir</span> o arrastra y suelta</p>
                                    <p className="text-xs text-muted-foreground">XLSX, XLS o CSV</p>
                                    {fileName && <p className="mt-4 text-xs font-semibold text-primary">{fileName}</p>}
                                </div>
                                <Input id="dropzone-file-teacher" type="file" className="hidden" onChange={handleFileChange} accept=".xlsx, .xls, .csv" />
                            </label>
                        </div>

                        {isProcessing && <div className="flex items-center justify-center"><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Procesando archivo...</div>}
                        
                        {parsedData.length > 0 && (
                            <div className="px-6">
                                <h3 className="mb-2 font-semibold">Vista Previa de la Importación</h3>
                                <ScrollArea className="h-64 border rounded-md">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead className="w-12">Estado</TableHead>
                                                <TableHead>name</TableHead>
                                                <TableHead>email</TableHead>
                                                <TableHead>contractType</TableHead>
                                                <TableHead>Horas</TableHead>
                                                <TableHead>Especialidades</TableHead>
                                                <TableHead>Errores</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {parsedData.map((row, index) => (
                                                <TableRow key={index} className={!row.isValid ? 'bg-destructive/10' : ''}>
                                                    <TableCell className="text-center">
                                                        {row.isValid ? 
                                                            <CheckCircle className="h-5 w-5 text-green-500" /> : 
                                                            <AlertCircle className="h-5 w-5 text-destructive" />
                                                        }
                                                    </TableCell>
                                                    <TableCell>{row.name}</TableCell>
                                                    <TableCell>{row.email}</TableCell>
                                                    <TableCell><Badge variant="secondary">{row.contractType}</Badge></TableCell>
                                                    <TableCell>{row.maxWeeklyHours}</TableCell>
                                                    <TableCell className="max-w-[200px] truncate">{row.specialties}</TableCell>
                                                    <TableCell className="text-destructive text-xs">{row.errors.join(', ')}</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </ScrollArea>
                                <p className="text-sm mt-2 text-muted-foreground">
                                    Se importarán <span className="font-bold text-foreground">{parsedData.filter(r => r.isValid).length}</span> de <span className="font-bold text-foreground">{parsedData.length}</span> registros. Las filas con errores serán ignoradas.
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                <DialogFooter className="pt-6">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                    <Button onClick={handleSave} disabled={isSaving || isProcessing || parsedData.filter(r => r.isValid).length === 0}>
                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Guardar {parsedData.filter(r => r.isValid).length} Docentes
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
