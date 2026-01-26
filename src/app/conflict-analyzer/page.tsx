'use client';
import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from '@/components/ui/label';
import { identifyScheduleConflicts } from '@/lib/actions';
import { useToast } from '@/hooks/use-toast';
import { Loader2, AlertTriangle, CheckCircle, Lightbulb, Puzzle } from 'lucide-react';
import { mockScheduleEvents } from '@/lib/mock-data';

export default function ConflictAnalyzerPage() {
    const [scheduleData, setScheduleData] = useState(JSON.stringify(mockScheduleEvents, null, 2));
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
            toast({ title: "Analysis Complete", description: `Found ${res.conflicts.length} conflicts.` });
        } catch (error) {
            toast({ variant: 'destructive', title: "Analysis Failed", description: "An error occurred while analyzing the schedule." });
        } finally {
            setIsLoading(false);
        }
    }

    return (
        <div className="grid gap-8 lg:grid-cols-2">
            <div className="space-y-6">
                <h1 className="text-3xl font-bold font-headline tracking-tight">AI Conflict Analyzer</h1>
                <Card>
                    <CardHeader>
                        <CardTitle>Analyze Schedule</CardTitle>
                        <CardDescription>Provide a schedule and constraint priorities to find conflicts and get suggestions.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="schedule-data">Schedule Data (JSON)</Label>
                            <Textarea id="schedule-data" value={scheduleData} onChange={e => setScheduleData(e.target.value)} rows={15} className="font-code text-xs" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="constraints-data">Constraint Priorities (JSON)</Label>
                            <Textarea id="constraints-data" value={constraints} onChange={e => setConstraints(e.target.value)} rows={5} className="font-code text-xs" />
                        </div>
                    </CardContent>
                    <CardFooter>
                        <Button onClick={handleAnalyze} disabled={isLoading}>
                            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Puzzle className="mr-2 h-4 w-4" />}
                            Analyze for Conflicts
                        </Button>
                    </CardFooter>
                </Card>
            </div>

            <div className="space-y-6">
                 <h2 className="text-3xl font-bold font-headline tracking-tight invisible">Results</h2>
                <Card className="flex flex-col min-h-[500px]">
                    <CardHeader>
                        <CardTitle>Analysis Results</CardTitle>
                        <CardDescription>Conflicts and suggestions will appear here.</CardDescription>
                    </CardHeader>
                    <CardContent className="flex-1">
                        {isLoading && (
                            <div className="flex items-center justify-center h-full">
                                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                            </div>
                        )}
                        {!isLoading && !result && (
                            <div className="flex items-center justify-center h-full text-center text-muted-foreground">
                                <p>Run analysis to see results.</p>
                            </div>
                        )}
                        {result && (
                            <div className="space-y-6">
                                <div>
                                    <h3 className="flex items-center gap-2 mb-3 font-semibold text-lg">
                                        <AlertTriangle className="w-5 h-5 text-destructive" />
                                        Identified Conflicts ({result.conflicts.length})
                                    </h3>
                                    {result.conflicts.length > 0 ? (
                                        <ul className="pl-5 space-y-2 list-disc text-sm">
                                            {result.conflicts.map((conflict, i) => <li key={i}>{conflict}</li>)}
                                        </ul>
                                    ) : (
                                        <p className="flex items-center gap-2 text-sm text-green-600">
                                            <CheckCircle className="w-4 h-4" /> No hard conflicts found.
                                        </p>
                                    )}
                                </div>
                                <div className="mt-6">
                                    <h3 className="flex items-center gap-2 mb-3 font-semibold text-lg">
                                        <Lightbulb className="w-5 h-5 text-accent" />
                                        Suggestions ({result.suggestions.length})
                                    </h3>
                                    {result.suggestions.length > 0 ? (
                                        <ul className="pl-5 space-y-2 list-disc text-sm">
                                            {result.suggestions.map((suggestion, i) => <li key={i}>{suggestion}</li>)}
                                        </ul>
                                    ) : (
                                        <p className="text-sm text-muted-foreground">No specific suggestions at this time.</p>
                                    )}
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
