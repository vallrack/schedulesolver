'use client';

import * as React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useFirestore } from '@/firebase';
import { addDoc, collection } from 'firebase/firestore';
import * as XLSX from 'xlsx';
import { Upload, Download, AlertCircle, CheckCircle2, XCircle, FileText } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import type { Module } from '@/lib/types';
import { Input } from '../ui/input';

interface TeacherImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  modules: Module[];
}

interface ImportTeacher {
  name: string;
  email: string;
  contractType: 'Tiempo Completo' | 'Medio Tiempo' | 'Por Horas';
  maxWeeklyHours: number;
  specialties: string[];
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  teacher: ImportTeacher;
  row: number;
}

export function TeacherImportDialog({ open, onOpenChange, onSuccess, modules }: TeacherImportDialogProps) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [validationResults, setValidationResults] = React.useState<ValidationResult[]>([]);
  const [showResults, setShowResults] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const downloadTemplate = () => {
    // Crear plantilla con los módulos del sistema
    const moduleNames = modules.map(m => m.name).join(', ');
    
    const template = [
      ['Plantilla de Importación de Docentes'],
      [''],
      ['Instrucciones:'],
      ['1. Complete todos los campos obligatorios'],
      ['2. El tipo de contrato debe ser: "Tiempo Completo", "Medio Tiempo", o "Por Horas"'],
      ['3. Las especialidades deben separarse por coma y coincidir exactamente con los módulos del sistema'],
      [`4. Módulos disponibles: ${moduleNames}`],
      [''],
      ['Nombre *', 'Email *', 'Tipo de Contrato *', 'Horas Semanales Máximas *', 'Especialidades (separadas por coma)'],
      ['Juan Pérez', 'juan.perez@ejemplo.com', 'Tiempo Completo', '40', 'Matemáticas, Física'],
      ['María García', 'maria.garcia@ejemplo.com', 'Medio Tiempo', '20', 'Química'],
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(template);

    // Ajustar anchos de columna
    ws['!cols'] = [
      { wch: 20 },
      { wch: 30 },
      { wch: 20 },
      { wch: 30 },
      { wch: 50 }
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'Docentes');
    XLSX.writeFile(wb, 'plantilla_docentes.xlsx');

    toast({
      title: 'Plantilla Descargada',
      description: 'La plantilla ha sido descargada con los módulos del sistema.',
    });
  };

  const validateTeacher = (teacher: any, row: number): ValidationResult => {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validar nombre
    if (!teacher.name || teacher.name.trim() === '') {
      errors.push('El nombre es obligatorio');
    }

    // Validar email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!teacher.email || !emailRegex.test(teacher.email)) {
      errors.push('Email inválido o faltante');
    }

    // Validar tipo de contrato
    const validContractTypes = ['Tiempo Completo', 'Medio Tiempo', 'Por Horas'];
    if (!teacher.contractType || !validContractTypes.includes(teacher.contractType)) {
      errors.push(`Tipo de contrato inválido. Debe ser: ${validContractTypes.join(', ')}`);
    }

    // Validar horas semanales
    const hours = Number(teacher.maxWeeklyHours);
    if (isNaN(hours) || hours <= 0) {
      errors.push('Las horas semanales deben ser un número positivo');
    }

    // Validar especialidades
    const specialtyIds: string[] = [];
    if (teacher.specialties && teacher.specialties.trim() !== '') {
      const specialtyNames = teacher.specialties
        .split(',')
        .map((s: string) => s.trim())
        .filter((s: string) => s !== '');

      for (const name of specialtyNames) {
        const module = modules.find(m => m.name.toLowerCase() === name.toLowerCase());
        if (module) {
          specialtyIds.push(module.id);
        } else {
          errors.push(`Módulo "${name}" no encontrado en el sistema`);
        }
      }

      if (specialtyNames.length > 0 && specialtyIds.length === 0) {
        warnings.push('No se encontraron módulos válidos');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      teacher: {
        name: teacher.name?.trim() || '',
        email: teacher.email?.trim().toLowerCase() || '',
        contractType: teacher.contractType,
        maxWeeklyHours: hours,
        specialties: specialtyIds,
      },
      row,
    };
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setShowResults(false);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      // Buscar la fila de encabezados (después de las instrucciones)
      const headerRowIndex = jsonData.findIndex((row: any) => {
        return row['Nombre *'] !== undefined || row['Nombre'] !== undefined;
      });

      if (headerRowIndex === -1) {
        throw new Error('No se encontró la fila de encabezados en el archivo');
      }

      // Procesar datos desde la fila de encabezados
      const dataRows = jsonData.slice(headerRowIndex);
      
      const results: ValidationResult[] = dataRows.map((row: any, index) => {
        const teacher = {
          name: row['Nombre *'] || row['Nombre'] || '',
          email: row['Email *'] || row['Email'] || '',
          contractType: row['Tipo de Contrato *'] || row['Tipo de Contrato'] || '',
          maxWeeklyHours: row['Horas Semanales Máximas *'] || row['Horas Semanales Máximas'] || 0,
          specialties: row['Especialidades (separadas por coma)'] || row['Especialidades'] || '',
        };

        return validateTeacher(teacher, headerRowIndex + index + 2); // +2 para la fila real en Excel
      }).filter(result => result.teacher.name !== ''); // Filtrar filas vacías

      setValidationResults(results);
      setShowResults(true);

    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error al procesar archivo',
        description: error instanceof Error ? error.message : 'Error desconocido',
      });
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleImport = async () => {
    if (!firestore) return;

    const validTeachers = validationResults.filter(r => r.valid);
    if (validTeachers.length === 0) {
      toast({
        variant: 'destructive',
        title: 'No hay docentes válidos',
        description: 'Corrija los errores antes de importar.',
      });
      return;
    }

    setIsProcessing(true);

    try {
      const teachersCollection = collection(firestore, 'teachers');
      let imported = 0;

      for (const result of validTeachers) {
        const teacherData = {
          ...result.teacher,
          status: 'active' as const,
          availability: [],
        };

        await addDoc(teachersCollection, teacherData);
        imported++;
      }

      toast({
        title: 'Importación Exitosa',
        description: `Se importaron ${imported} docente(s) correctamente.`,
      });

      onSuccess();
      onOpenChange(false);
      setValidationResults([]);
      setShowResults(false);

    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error al importar',
        description: error instanceof Error ? error.message : 'Error desconocido',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const validCount = validationResults.filter(r => r.valid).length;
  const invalidCount = validationResults.filter(r => !r.valid).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Importar Docentes desde Excel</DialogTitle>
          <DialogDescription>
            Descarga la plantilla, complétala con los datos y súbela para importar múltiples docentes.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!showResults ? (
            <>
              <div className="flex gap-2">
                <Button onClick={downloadTemplate} variant="outline" className="flex-1">
                  <Download className="mr-2 h-4 w-4" />
                  Descargar Plantilla
                </Button>
              </div>

              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  La plantilla incluye los módulos disponibles en tu sistema. Las especialidades deben coincidir exactamente con estos módulos.
                </AlertDescription>
              </Alert>

              <div className="border-2 border-dashed rounded-lg p-8 text-center">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="file-upload"
                />
                <label htmlFor="file-upload" className="cursor-pointer">
                  <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-sm text-muted-foreground mb-2">
                    Haz clic para seleccionar o arrastra el archivo aquí
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Formatos soportados: .xlsx, .xls
                  </p>
                </label>
              </div>
            </>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-green-50 dark:bg-green-950 p-4 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                    <span className="font-semibold">Válidos</span>
                  </div>
                  <p className="text-2xl font-bold">{validCount}</p>
                </div>
                <div className="bg-red-50 dark:bg-red-950 p-4 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                    <span className="font-semibold">Con Errores</span>
                  </div>
                  <p className="text-2xl font-bold">{invalidCount}</p>
                </div>
              </div>

              <ScrollArea className="h-[300px] rounded-md border p-4">
                <div className="space-y-3">
                  {validationResults.map((result, index) => (
                    <div key={index} className={`p-3 rounded-lg border ${result.valid ? 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800' : 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800'}`}>
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {result.valid ? (
                            <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 flex-shrink-0" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-600 dark:text-red-400 flex-shrink-0" />
                          )}
                          <span className="font-medium">{result.teacher.name || 'Sin nombre'}</span>
                        </div>
                        <Badge variant="outline" className="text-xs">Fila {result.row}</Badge>
                      </div>
                      
                      {result.errors.length > 0 && (
                        <ul className="text-sm text-red-600 dark:text-red-400 space-y-1 ml-6">
                          {result.errors.map((error, i) => (
                            <li key={i}>• {error}</li>
                          ))}
                        </ul>
                      )}
                      
                      {result.warnings.length > 0 && (
                        <ul className="text-sm text-yellow-600 dark:text-yellow-400 space-y-1 ml-6">
                          {result.warnings.map((warning, i) => (
                            <li key={i}>⚠ {warning}</li>
                          ))}
                        </ul>
                      )}
                      
                      {result.valid && (
                        <div className="text-sm text-muted-foreground ml-6 mt-2">
                          <p>{result.teacher.email}</p>
                          <p>{result.teacher.contractType} - {result.teacher.maxWeeklyHours}h/semana</p>
                          {result.teacher.specialties.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {result.teacher.specialties.map(id => {
                                const module = modules.find(m => m.id === id);
                                return module ? (
                                  <Badge key={id} variant="secondary" className="text-xs">
                                    {module.name}
                                  </Badge>
                                ) : null;
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>

              <div className="flex gap-2">
                <Button 
                  onClick={() => {
                    setShowResults(false);
                    setValidationResults([]);
                  }} 
                  variant="outline" 
                  className="flex-1"
                >
                  Cargar Otro Archivo
                </Button>
                <Button 
                  onClick={handleImport} 
                  disabled={validCount === 0 || isProcessing}
                  className="flex-1"
                >
                  {isProcessing ? 'Importando...' : `Importar ${validCount} Docente(s)`}
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
