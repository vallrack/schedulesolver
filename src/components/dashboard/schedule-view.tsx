'use client';
import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { GanttChart } from '@/components/gantt-chart';
import { generateInitialSchedule } from '@/lib/actions';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Sparkles } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { ScheduleEvent, Teacher, Course, Classroom } from '@/lib/types';
import { useFirestore } from '@/firebase';
import { useCollection } from '@/firebase/firestore/use-collection';
import { collection } from 'firebase/firestore';

type ViewMode = 'teacher' | 'group' | 'classroom';

export default function ScheduleView() {
  const [schedule, setSchedule] = useState<ScheduleEvent[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();

  const firestore = useFirestore();
  const teachersCollection = useMemo(() => (firestore ? collection(firestore, 'teachers') : null), [firestore]);
  const coursesCollection = useMemo(() => (firestore ? collection(firestore, 'courses') : null), [firestore]);
  const classroomsCollection = useMemo(() => (firestore ? collection(firestore, 'classrooms') : null), [firestore]);
  const horariosCollection = useMemo(() => (firestore ? collection(firestore, 'horarios') : null), [firestore]);

  const { data: teachers, loading: loadingTeachers } = useCollection<Teacher>(teachersCollection);
  const { data: courses, loading: loadingCourses } = useCollection<Course>(coursesCollection);
  const { data: classrooms, loading: loadingClassrooms } = useCollection<Classroom>(classroomsCollection);
  const { data: scheduleEvents, loading: loadingSchedule, error: errorSchedule } = useCollection<ScheduleEvent>(horariosCollection);

  React.useEffect(() => {
    if (scheduleEvents) {
      setSchedule(scheduleEvents);
    }
  }, [scheduleEvents]);

  const handleGenerateSchedule = async () => {
    setIsGenerating(true);
    try {
      const result = await generateInitialSchedule({
        courses: JSON.stringify(courses),
        teachers: JSON.stringify(teachers),
        classrooms: JSON.stringify(classrooms),
        constraints: JSON.stringify([
          'A teacher cannot be in two places at once.',
          'A group cannot have two classes at the same time.',
          'Do not exceed classroom capacity.',
          'Respect the exact duration of the course.',
          'Avoid excessive gaps for teachers and students.',
          'Prefer morning/afternoon shifts where possible.',
        ]),
      });
      setSchedule(JSON.parse(result.schedule));
      toast({
        title: 'Schedule Generated',
        description: 'A new base schedule has been successfully generated.',
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error Generating Schedule',
        description: 'An unexpected error occurred. Please try again.',
      });
    } finally {
      setIsGenerating(false);
    }
  };
  
  const uniqueGroups = useMemo(() => {
    if (!courses) return [];
    return [...new Map(courses.map(c => [`${c.career}-${c.semester}-${c.group}`, c])).values()];
  }, [courses]);
  
  const loading = loadingTeachers || loadingCourses || loadingClassrooms || loadingSchedule;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <CardTitle className="font-headline">Class Schedule</CardTitle>
          <Button onClick={handleGenerateSchedule} disabled={isGenerating || loading} size="sm">
            {isGenerating ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="mr-2 h-4 w-4" />
            )}
            Generate with AI
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading && <div className="flex justify-center items-center h-64"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>}
        {errorSchedule && <div className="text-destructive text-center">Error loading schedule: {errorSchedule.message}</div>}
        {!loading && !errorSchedule && (
          <Tabs defaultValue="teacher" className="w-full">
            <TabsList>
              <TabsTrigger value="teacher">By Teacher</TabsTrigger>
              <TabsTrigger value="group">By Group</TabsTrigger>
              <TabsTrigger value="classroom">By Classroom</TabsTrigger>
            </TabsList>
            
            <TabsContent value="teacher">
               <GanttChart 
                  scheduleEvents={schedule} 
                  viewMode="teacher"
                  resources={teachers || []}
                  courses={courses || []}
                  teachers={teachers || []}
                  classrooms={classrooms || []}
               />
            </TabsContent>
            <TabsContent value="group">
               <GanttChart 
                  scheduleEvents={schedule} 
                  viewMode="group"
                  resources={uniqueGroups}
                  courses={courses || []}
                  teachers={teachers || []}
                  classrooms={classrooms || []}
               />
            </TabsContent>
            <TabsContent value="classroom">
              <GanttChart 
                  scheduleEvents={schedule} 
                  viewMode="classroom"
                  resources={classrooms || []}
                  courses={courses || []}
                  teachers={teachers || []}
                  classrooms={classrooms || []}
               />
            </TabsContent>
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
}
