'use client';
import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { GanttChart } from '@/components/gantt-chart';
import { mockScheduleEvents, mockTeachers, mockCourses, mockClassrooms } from '@/lib/mock-data';
import { generateInitialSchedule } from '@/lib/actions';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Sparkles } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { ScheduleEvent, Teacher, Course, Classroom } from '@/lib/types';

type ViewMode = 'teacher' | 'group' | 'classroom';

export default function ScheduleView() {
  const [schedule, setSchedule] = useState<ScheduleEvent[]>(mockScheduleEvents);
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();

  const handleGenerateSchedule = async () => {
    setIsGenerating(true);
    try {
      const result = await generateInitialSchedule({
        courses: JSON.stringify(mockCourses),
        teachers: JSON.stringify(mockTeachers),
        classrooms: JSON.stringify(mockClassrooms),
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
    return [...new Map(mockCourses.map(c => [`${c.career}-${c.semester}-${c.group}`, c])).values()];
  }, []);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <CardTitle className="font-headline">Class Schedule</CardTitle>
          <Button onClick={handleGenerateSchedule} disabled={isGenerating} size="sm">
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
                resources={mockTeachers}
                courses={mockCourses}
             />
          </TabsContent>
          <TabsContent value="group">
             <GanttChart 
                scheduleEvents={schedule} 
                viewMode="group"
                resources={uniqueGroups}
                courses={mockCourses}
             />
          </TabsContent>
          <TabsContent value="classroom">
            <GanttChart 
                scheduleEvents={schedule} 
                viewMode="classroom"
                resources={mockClassrooms}
                courses={mockCourses}
             />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
