'use client';

import { useState } from 'react';
import * as XLSX from 'xlsx';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useFirestore } from '@/firebase';
import { writeBatch, collection, doc } from 'firebase/firestore';
import type { Career, Group } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { ScrollArea } from '../ui/scroll-area';
import { AlertCircle, CheckCircle, UploadCloud, Loader2, Download } from 'lucide-react';

type ParsedGroup = Omit<Group, 'id' | 'careerId'> & {
    careerName: string;
    isValid: boolean;
    errors: string[];
};

interface GroupImportDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
    careers: Career[];
}

export function GroupImportDialog({ open, onOpenChange, onSuccess, careers }: GroupImportDialogProps) {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [isProcessing, setIsProcessing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [parsedData, setParsedData] = useState<ParsedGroup[]>([]);
    const [fileName, setFileName] = useState('');

    const resetState = () => {
        setParsedData([]);
        setFileName('');
        setIsProcessing(false);
        setIsSaving(false);
    }
    
    const handleDownloadTemplate = () => {
        const headers = [['careerName', 'semester', 'name', 'studentCount']];
        const exampleData = [
            ['Análisis y Diseño de Software', 1, 'A', 25],
            ['Análisis y Diseño de Software', 1, 'B', 28],
            ['Marketing Digital', 3, 'A', 30],
        ];
        const ws = XLSX.utils.aoa_to_sheet([...headers, ...exampleData]);
        
        ws['!cols'] = [ { wch: 40 }, { wch: 10 }, { wch: 10 }, { wch: 15 } ];

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Plantilla');
        XLSX.writeFile(wb, 'plantilla_grupos.xlsx');
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

            const careerNameMap = new Map(careers.map(c => [c.name.toLowerCase(), c.id]));

            const processedData = json.map(row => {
                const lowerCaseRow = Object.keys(row).reduce((acc, key) => {
                    acc[key.toLowerCase().trim()] = row[key];
                    return acc;
                }, {} as {[key: string]: any});

                const careerName = String(lowerCaseRow['careername'] || '').trim();
                const semester = parseInt(String(lowerCaseRow['semester'] || 0), 10);
                const name = String(lowerCaseRow['name'] || '').trim();
                const studentCount = parseInt(String(lowerCaseRow['studentcount'] || 0), 10);

                const group: ParsedGroup = {
                    careerName,
                    semester,
                    name,
                    studentCount,
                    isValid: true,
                    errors: [],
                };
                
                if (!careerName) {
                    group.isValid = false;
                    group.errors.push('La columna "careerName" no puede estar vacía.');
                } else if (!careerNameMap.has(careerName.toLowerCase())) {
                    group.isValid = false;
                    group.errors.push(`La carrera "${careerName}" no fue encontrada.`);
                }

                if (isNaN(semester) || semester <= 0) {
                    group.isValid = false;
                    group.errors.push('La columna "semester" debe ser un número positivo.');
                }
                
                if (!name) {
                    group.isValid = false;
                    group.errors.push('La columna "name" del grupo (A, B) no puede estar vacía.');
                }

                if (isNaN(studentCount) || studentCount <= 0) {
                    group.isValid = false;
                    group.errors.push('La columna "studentCount" debe ser un número positivo.');
                }

                return group;
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
            const groupsCol = collection(firestore, 'groups');
            const careerNameMap = new Map(careers.map(c => [c.name.toLowerCase(), c.id]));
            
            validData.forEach(group => {
                const newDocRef = doc(groupsCol);
                const careerId = careerNameMap.get(group.careerName.toLowerCase());
                if (careerId) {
                    const groupData: Omit<Group, 'id'> = {
                        name: group.name,
                        careerId: careerId,
                        semester: group.semester,
                        studentCount: group.studentCount,
                    };
                    batch.set(newDocRef, groupData);
                }
            });
            
            await batch.commit();

            toast({
                title: '¡Importación Exitosa!',
                description: `Se han guardado ${validData.length} nuevos grupos.`,
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
                    <DialogTitle>Importar Grupos desde Archivo</DialogTitle>
                    <DialogDescription>
                        Sube un archivo Excel (.xlsx, .xls) o CSV con las columnas: <strong>careerName</strong>, <strong>semester</strong>, <strong>name</strong>, y <strong>studentCount</strong>.
                        El campo 'careerName' debe coincidir exactamente con una carrera existente en el sistema.
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
                            <label htmlFor="dropzone-file-group" className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-lg cursor-pointer bg-muted hover:bg-background/80">
                                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                    <UploadCloud className="w-8 h-8 mb-4 text-muted-foreground" />
                                    <p className="mb-2 text-sm text-muted-foreground"><span className="font-semibold">Haz clic para subir</span> o arrastra y suelta</p>
                                    <p className="text-xs text-muted-foreground">XLSX, XLS o CSV</p>
                                    {fileName && <p className="mt-4 text-xs font-semibold text-primary">{fileName}</p>}
                                </div>
                                <Input id="dropzone-file-group" type="file" className="hidden" onChange={handleFileChange} accept=".xlsx, .xls, .csv" />
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
                                                <TableHead>careerName</TableHead>
                                                <TableHead>semester</TableHead>
                                                <TableHead>name</TableHead>
                                                <TableHead>studentCount</TableHead>
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
                                                    <TableCell>{row.careerName}</TableCell>
                                                    <TableCell>{row.semester}</TableCell>
                                                    <TableCell>{row.name}</TableCell>
                                                    <TableCell>{row.studentCount}</TableCell>
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
                        Guardar {parsedData.filter(r => r.isValid).length} Grupos
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
