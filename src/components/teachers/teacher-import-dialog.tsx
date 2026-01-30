
'use client';

import * as React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Download, Upload, FileText } from 'lucide-react';
import * as XLSX from 'xlsx';
import type { Module } from '@/lib/types';
import { useFirestore } from '@/firebase';
import { collection, addDoc } from 'firebase/firestore';

interface TeacherImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  modules: Module[];
}

interface TeacherRow {
  'Nombre': string;
  'Email': string;
  'Tipo de Contrato': 'Tiempo Completo' | 'Medio Tiempo' | 'Por Horas';
  'Horas Semanales Máximas': number;
  'Especialidades (IDs separados por comas)': string;
  [key: string]: any;
}

export function TeacherImportDialog({ open, onOpenChange, onSuccess, modules }: TeacherImportDialogProps) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [file, setFile] = React.useState<File | null>(null);
  const [importing, setImporting] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleDownloadTemplate = () => {
    // Crear hoja con instrucciones
    const instructionsData = [
      ['INSTRUCCIONES PARA IMPORTAR DOCENTES'],
      [''],
      ['1. Complete la información en la hoja "Docentes"'],
      ['2. Para las especialidades, use los IDs de la hoja "Módulos Disponibles"'],
      ['3. Los IDs deben estar separados por comas (ejemplo: mod1,mod2,mod3)'],
      ['4. El tipo de contrato debe ser exactamente: "Tiempo Completo", "Medio Tiempo" o "Por Horas"'],
      ['5. Guarde el archivo y súbalo usando el botón "Seleccionar Archivo"'],
    ];

    // Crear hoja con ejemplo de docentes
    const exampleData: TeacherRow[] = [
      {
        'Nombre': 'Juan Pérez',
        'Email': 'juan.perez@ejemplo.com',
        'Tipo de Contrato': 'Tiempo Completo',
        'Horas Semanales Máximas': 40,
        'Especialidades (IDs separados por comas)': modules.slice(0, 2).map(m => m.id).join(','),
      },
      {
        'Nombre': 'María García',
        'Email': 'maria.garcia@ejemplo.com',
        'Tipo de Contrato': 'Medio Tiempo',
        'Horas Semanales Máximas': 20,
        'Especialidades (IDs separados por comas)': modules.slice(0, 1).map(m => m.id).join(','),
      },
    ];

    // Crear hoja con módulos disponibles
    const modulesData = [
      ['ID del Módulo', 'Nombre del Módulo', 'Descripción'],
      ...modules.map(module => [
        module.id,
        module.name,
        `Use este ID para asignar el módulo "${module.name}" a un docente`,
      ]),
    ];

    // Crear el workbook
    const wb = XLSX.utils.book_new();

    // Agregar hoja de instrucciones
    const wsInstructions = XLSX.utils.aoa_to_sheet(instructionsData);
    XLSX.utils.book_append_sheet(wb, wsInstructions, 'Instrucciones');

    // Agregar hoja de docentes
    const wsTeachers = XLSX.utils.json_to_sheet(exampleData);
    XLSX.utils.book_append_sheet(wb, wsTeachers, 'Docentes');

    // Agregar hoja de módulos disponibles
    const wsModules = XLSX.utils.aoa_to_sheet(modulesData);
    XLSX.utils.book_append_sheet(wb, wsModules, 'Módulos Disponibles');

    // Configurar anchos de columna
    const maxWidths = {
      instructions: [{ wch: 80 }],
      teachers: [
        { wch: 25 }, // Nombre
        { wch: 30 }, // Email
        { wch: 20 }, // Tipo de Contrato
        { wch: 25 }, // Horas Semanales
        { wch: 40 }, // Especialidades
      ],
      modules: [
        { wch: 25 }, // ID
        { wch: 30 }, // Nombre
        { wch: 50 }, // Descripción
      ],
    };

    wsInstructions['!cols'] = maxWidths.instructions;
    wsTeachers['!cols'] = maxWidths.teachers;
    wsModules['!cols'] = maxWidths.modules;

    // Descargar el archivo
    XLSX.writeFile(wb, 'plantilla_docentes.xlsx');
    
    toast({
      title: 'Plantilla Descargada',
      description: 'La plantilla con los módulos del sistema ha sido descargada exitosamente.',
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (!selectedFile.name.endsWith('.xlsx') && !selectedFile.name.endsWith('.xls')) {
        toast({
          variant: 'destructive',
          title: 'Formato Inválido',
          description: 'Por favor selecciona un archivo Excel (.xlsx o .xls)',
        });
        return;
      }
      setFile(selectedFile);
    }
  };

  const validateContractType = (value: string): 'Tiempo Completo' | 'Medio Tiempo' | 'Por Horas' | null => {
    const normalized = value?.trim();
    if (normalized === 'Tiempo Completo') return 'Tiempo Completo';
    if (normalized === 'Medio Tiempo') return 'Medio Tiempo';
    if (normalized === 'Por Horas') return 'Por Horas';
    return null;
  };

  const handleImport = async () => {
    if (!file || !firestore) return;

    setImporting(true);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      
      // Leer la hoja "Docentes"
      const sheetName = workbook.SheetNames.find(name => 
        name.toLowerCase().includes('docente') || name.toLowerCase().includes('teacher')
      ) || workbook.SheetNames[0];
      
      const worksheet = workbook.Sheets[sheetName];
      const jsonData: TeacherRow[] = XLSX.utils.sheet_to_json(worksheet);

      if (jsonData.length === 0) {
        toast({
          variant: 'destructive',
          title: 'Archivo Vacío',
          description: 'No se encontraron docentes en el archivo.',
        });
        setImporting(false);
        return;
      }

      let successCount = 0;
      let errorCount = 0;
      const errors: string[] = [];

      const teachersCollection = collection(firestore, 'teachers');

      for (let i = 0; i < jsonData.length; i++) {
        const row = jsonData[i];
        const rowNum = i + 2; // +2 porque las hojas empiezan en 1 y hay encabezado

        try {
          // Validar campos requeridos
          if (!row.Nombre?.trim()) {
            errors.push(`Fila ${rowNum}: Falta el nombre`);
            errorCount++;
            continue;
          }

          if (!row.Email?.trim()) {
            errors.push(`Fila ${rowNum}: Falta el email`);
            errorCount++;
            continue;
          }

          const contractType = validateContractType(row['Tipo de Contrato']);
          if (!contractType) {
            errors.push(`Fila ${rowNum}: Tipo de contrato inválido. Debe ser "Tiempo Completo", "Medio Tiempo" o "Por Horas"`);
            errorCount++;
            continue;
          }

          const maxHours = Number(row['Horas Semanales Máximas']);
          if (isNaN(maxHours) || maxHours <= 0) {
            errors.push(`Fila ${rowNum}: Horas semanales inválidas`);
            errorCount++;
            continue;
          }

          // Procesar especialidades
          let specialties: string[] = [];
          if (row['Especialidades (IDs separados por comas)']?.trim()) {
            const specialtyIds = String(row['Especialidades (IDs separados por comas)'])
              .split(',')
              .map((id: string) => id.trim())
              .filter((id: string) => id);

            // Validar que los IDs existan en los módulos
            const invalidIds = specialtyIds.filter(
              id => !modules.find(m => m.id === id)
            );

            if (invalidIds.length > 0) {
              errors.push(`Fila ${rowNum}: IDs de módulos inválidos: ${invalidIds.join(', ')}`);
              errorCount++;
              continue;
            }

            specialties = specialtyIds;
          }

          // Crear el docente
          const teacherData = {
            name: row.Nombre.trim(),
            email: row.Email.trim().toLowerCase(),
            contractType,
            maxWeeklyHours: maxHours,
            specialties,
            status: 'active' as const,
            availability: [],
          };

          await addDoc(teachersCollection, teacherData);
          successCount++;
        } catch (e) {
          errors.push(`Fila ${rowNum}: Error al importar - ${e instanceof Error ? e.message : 'Error desconocido'}`);
          errorCount++;
        }
      }

      // Mostrar resultados
      if (successCount > 0) {
        toast({
          title: 'Importación Completada',
          description: `${successCount} docente(s) importado(s) exitosamente${errorCount > 0 ? `. ${errorCount} error(es).` : '.'}`,
        });
      }

      if (errors.length > 0) {
        console.error('Errores de importación:', errors);
        toast({
          variant: 'destructive',
          title: `${errorCount} Error(es) de Importación`,
          description: errors.slice(0, 3).join('; ') + (errors.length > 3 ? '...' : ''),
        });
      }

      if (successCount > 0) {
        setFile(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        onSuccess();
      }
    } catch (e) {
      console.error('Error al procesar archivo:', e);
      toast({
        variant: 'destructive',
        title: 'Error al Importar',
        description: e instanceof Error ? e.message : 'Error al procesar el archivo',
      });
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Importar Docentes desde Excel</DialogTitle>
          <DialogDescription>
            Descarga la plantilla, complétala con los datos de los docentes y súbela para importarlos al sistema.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Paso 1: Descarga la plantilla de Excel
            </p>
            <Button
              onClick={handleDownloadTemplate}
              variant="outline"
              className="w-full"
            >
              <Download className="mr-2 h-4 w-4" />
              Descargar Plantilla con Módulos
            </Button>
          </div>

          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Paso 2: Completa la plantilla y sube el archivo
            </p>
            <Input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileChange}
              disabled={importing}
            />
            {file && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <FileText className="h-4 w-4" />
                <span className="truncate">{file.name}</span>
              </div>
            )}
          </div>

          <Button
            onClick={handleImport}
            disabled={!file || importing}
            className="w-full"
          >
            <Upload className="mr-2 h-4 w-4" />
            {importing ? 'Importando...' : 'Importar Docentes'}
          </Button>

          <div className="text-xs text-muted-foreground space-y-1 border-t pt-2">
            <p className="font-semibold">Notas importantes:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>La plantilla incluye todos los módulos actuales del sistema</li>
              <li>Use los IDs exactos de la hoja "Módulos Disponibles"</li>
              <li>Separe múltiples IDs con comas (sin espacios adicionales)</li>
              <li>El tipo de contrato debe escribirse exactamente como se muestra</li>
            </ul>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
