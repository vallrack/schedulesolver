'use client';

import { useState } from 'react';
import * as XLSX from 'xlsx';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useFirestore } from '@/firebase';
import { writeBatch, collection, doc } from 'firebase/firestore';
import type { Classroom } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Badge } from '../ui/badge';
import { ScrollArea } from '../ui/scroll-area';
import { AlertCircle, CheckCircle, UploadCloud, Loader2, Download } from 'lucide-react';

type ParsedClassroom = Omit<Classroom, 'id'> & { isValid: boolean; errors: string[] };

interface ClassroomImportDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
}

export function ClassroomImportDialog({ open, onOpenChange, onSuccess }: ClassroomImportDialogProps) {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [isProcessing, setIsProcessing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [parsedData, setParsedData] = useState<ParsedClassroom[]>([]);
    const [fileName, setFileName] = useState('');

    const resetState = () => {
        setParsedData([]);
        setFileName('');
        setIsProcessing(false);
        setIsSaving(false);
    }
    
    const allowedTypes: Classroom['type'][] = ['aula', 'sala de sistemas', 'auditorio', 'biblioteca', 'sala reuniones', 'oficina', 'laboratorio/taller'];

    const handleDownloadTemplate = () => {
        const headers = [['name', 'capacity', 'type', 'description']];
        const exampleData = [
            ['Aula 101', 30, 'aula', 'Pizarra digital, proyector.'],
            ['Sala de Sistemas 1', 25, 'sala de sistemas', '25 equipos Core i5, 8GB RAM.'],
            ['Auditorio Principal', 150, 'auditorio', 'Sistema de sonido, pantalla gigante.'],
            ['Biblioteca Central', 50, 'biblioteca', 'Estanterías con libros.'],
            ['Sala de Juntas', 12, 'sala reuniones', 'Mesa grande, sillas, proyector.'],
            ['Oficina de Coordinación', 4, 'oficina', 'Escritorios y archivadores.'],
            ['Taller de Mecánica', 20, 'laboratorio/taller', 'Herramientas y bancos de trabajo.'],
        ];
        const ws = XLSX.utils.aoa_to_sheet([...headers, ...exampleData]);
        
        ws['!cols'] = [ { wch: 25 }, { wch: 10 }, { wch: 20 }, { wch: 50 } ];

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Plantilla');
        XLSX.writeFile(wb, 'plantilla_aulas.xlsx');
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

            const jsonFiltered = json.filter(row => {
                const nameKey = Object.keys(row).find(key => key.toLowerCase().trim() === 'name');
                const nameValue = nameKey ? String(row[nameKey] || '').trim() : '';
                return !nameValue.toLowerCase().startsWith('total');
            });

            const processedData = jsonFiltered.map(row => {
                const lowerCaseRow = Object.keys(row).reduce((acc, key) => {
                    acc[key.toLowerCase().trim()] = row[key];
                    return acc;
                }, {} as {[key: string]: any});

                const name = String(lowerCaseRow['name'] || '').trim();
                const capacity = parseInt(String(lowerCaseRow['capacity'] || 0), 10);
                const type = String(lowerCaseRow['type'] || '').trim().toLowerCase();
                const description = String(lowerCaseRow['description'] || '').trim();

                const classroom: ParsedClassroom = {
                    name,
                    capacity,
                    type: 'aula', // Default, will be validated
                    description,
                    isValid: true,
                    errors: [],
                };
                
                if (!name) {
                    classroom.isValid = false;
                    classroom.errors.push('La columna "name" no puede estar vacía.');
                }
                if (isNaN(capacity) || capacity <= 0) {
                    classroom.isValid = false;
                    classroom.errors.push('La columna "capacity" debe ser un número positivo.');
                }

                if (!type || !allowedTypes.includes(type as any)) {
                    classroom.isValid = false;
                    classroom.errors.push(`El tipo debe ser uno de los permitidos.`);
                } else {
                    classroom.type = type as Classroom['type'];
                }

                return classroom;
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
            const classroomsCol = collection(firestore, 'classrooms');
            
            validData.forEach(classroom => {
                const { isValid, errors, ...classroomData } = classroom;
                const newDocRef = doc(classroomsCol);
                batch.set(newDocRef, classroomData);
            });
            
            await batch.commit();

            toast({
                title: '¡Importación Exitosa!',
                description: `Se han guardado ${validData.length} nuevas salas.`,
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
            <DialogContent className="max-w-4xl flex flex-col max-h-[90vh]">
                <DialogHeader>
                    <DialogTitle>Importar Aulas desde Archivo</DialogTitle>
                    <DialogDescription>
                        Sube un archivo Excel (.xlsx, .xls) o CSV con las columnas: <strong>name</strong>, <strong>capacity</strong>, <strong>type</strong>, y <strong>description</strong> (opcional).
                        El campo 'type' debe ser uno de los siguientes: {allowedTypes.join(', ')}.
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
                            <label htmlFor="dropzone-file" className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-lg cursor-pointer bg-muted hover:bg-background/80">
                                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                    <UploadCloud className="w-8 h-8 mb-4 text-muted-foreground" />
                                    <p className="mb-2 text-sm text-muted-foreground"><span className="font-semibold">Haz clic para subir</span> o arrastra y suelta</p>
                                    <p className="text-xs text-muted-foreground">XLSX, XLS o CSV</p>
                                    {fileName && <p className="mt-4 text-xs font-semibold text-primary">{fileName}</p>}
                                </div>
                                <Input id="dropzone-file" type="file" className="hidden" onChange={handleFileChange} accept=".xlsx, .xls, .csv" />
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
                                                <TableHead>capacity</TableHead>
                                                <TableHead>type</TableHead>
                                                <TableHead>description</TableHead>
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
                                                    <TableCell>{row.capacity}</TableCell>
                                                    <TableCell><Badge variant="outline">{row.type}</Badge></TableCell>
                                                    <TableCell className="max-w-[200px] truncate">{row.description}</TableCell>
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
                        Guardar {parsedData.filter(r => r.isValid).length} Salas
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
