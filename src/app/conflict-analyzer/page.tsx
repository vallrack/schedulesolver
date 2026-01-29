'use client';
import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from '@/components/ui/label';
import { identifyScheduleConflicts } from '@/lib/actions';
import { useToast } from '@/hooks/use-toast';
import { Loader2, AlertTriangle, CheckCircle, Lightbulb, Puzzle } from 'lucide-react';
import AppLayout from '@/components/app-layout';

export default function ConflictAnalyzerPage() {
    const [scheduleData, setScheduleData] = useState("");
    const [constraints, setConstraints] = useState(JSON.stringify({
        "teacherClash": "high",
        "classroomClash": "high",
        "groupClash": "high",
        "teacherGaps": "medium",
        "studentGaps": "medium",
    }, null, 2));
    const [isLoading, setIsLoading] = useState(false);
    const [result, setResult] = useState<{ conflicts: string[], suggestions: string[] } | null>(null);
    const { toast } = useToast();

    const handleAnalyze = async () => {
        setIsLoading(true);
        setResult(null);
        try {
            const res = await identifyScheduleConflicts({
                scheduleData: scheduleData,
                constraintPriorities: constraints
            });
            setResult(res);
            toast({ title: "Análisis Completo", description: `Se encontraron ${res.conflicts.length} conflictos.` });
        } catch (error: any) {
            toast({ variant: 'destructive', title: "Falló el Análisis", description: error.message || "Ocurrió un error al analizar el horario." });
        } finally {
            setIsLoading(false);
        }
    }

    return (
        <AppLayout>
            <div className="grid gap-8 lg:grid-cols-2">
                <div className="space-y-6">
                    <h1 className="text-3xl font-bold font-headline tracking-tight">Analizador de Conflictos con IA</h1>
                    <Card>
                        <CardHeader>
                            <CardTitle>Analizar Horario</CardTitle>
                            <CardDescription>Proporciona un horario y las prioridades de las restricciones para encontrar conflictos y obtener sugerencias.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="schedule-data">Datos del Horario (JSON)</Label>
                                <Textarea id="schedule-data" value={scheduleData} onChange={e => setScheduleData(e.target.value)} rows={15} className="font-code text-xs" placeholder="Pega el JSON del horario aquí..."/>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="constraints-data">Prioridades de Restricciones (JSON)</Label>
                                <Textarea id="constraints-data" value={constraints} onChange={e => setConstraints(e.target.value)} rows={5} className="font-code text-xs" />
                            </div>
                        </CardContent>
                        <CardFooter>
                            <Button onClick={handleAnalyze} disabled={isLoading || !scheduleData}>
                                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Puzzle className="mr-2 h-4 w-4" />}
                                Analizar Conflictos
                            </Button>
                        </CardFooter>
                    </Card>
                </div>

                <div className="space-y-6">
                    <h2 className="text-3xl font-bold font-headline tracking-tight invisible">Resultados</h2>
                    <Card className="flex flex-col min-h-[500px]">
                        <CardHeader>
                            <CardTitle>Resultados del Análisis</CardTitle>
                            <CardDescription>Los conflictos y sugerencias aparecerán aquí.</CardDescription>
                        </CardHeader>
                        <CardContent className="flex-1">
                            {isLoading && (
                                <div className="flex items-center justify-center h-full">
                                    <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                                </div>
                            )}
                            {!isLoading && !result && (
                                <div className="flex items-center justify-center h-full text-center text-muted-foreground">
                                    <p>Ejecuta el análisis para ver los resultados.</p>
                                </div>
                            )}
                            {result && (
                                <div className="space-y-6">
                                    <div>
                                        <h3 className="flex items-center gap-2 mb-3 font-semibold text-lg">
                                            <AlertTriangle className="w-5 h-5 text-destructive" />
                                            Conflictos Identificados ({result.conflicts.length})
                                        </h3>
                                        {result.conflicts.length > 0 ? (
                                            <ul className="pl-5 space-y-2 list-disc text-sm">
                                                {result.conflicts.map((conflict, i) => <li key={i}>{conflict}</li>)}
                                            </ul>
                                        ) : (
                                            <p className="flex items-center gap-2 text-sm text-green-600">
                                                <CheckCircle className="w-4 h-4" /> No se encontraron conflictos duros.
                                            </p>
                                        )}
                                    </div>
                                    <div className="mt-6">
                                        <h3 className="flex items-center gap-2 mb-3 font-semibold text-lg">
                                            <Lightbulb className="w-5 h-5 text-accent" />
                                            Sugerencias ({result.suggestions.length})
                                        </h3>
                                        {result.suggestions.length > 0 ? (
                                            <ul className="pl-5 space-y-2 list-disc text-sm">
                                                {result.suggestions.map((suggestion, i) => <li key={i}>{suggestion}</li>)}
                                            </ul>
                                        ) : (
                                            <p className="text-sm text-muted-foreground">No hay sugerencias específicas en este momento.</p>
                                        )}
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </AppLayout>
    );
}
