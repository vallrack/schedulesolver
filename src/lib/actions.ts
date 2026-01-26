'use server';

import { generateInitialSchedule as genSchedule, GenerateInitialScheduleInput, GenerateInitialScheduleOutput } from '@/ai/flows/generate-initial-schedule';
import { identifyScheduleConflicts as identifyConflicts, IdentifyScheduleConflictsInput, IdentifyScheduleConflictsOutput } from '@/ai/flows/identify-schedule-conflicts';
import { mockScheduleEvents } from './mock-data';

// A mock AI response for development, so we don't hit the API every time.
const MOCK_AI = process.env.NODE_ENV === 'development';

export async function generateInitialSchedule(input: GenerateInitialScheduleInput): Promise<GenerateInitialScheduleOutput> {
  if (MOCK_AI) {
    console.log("MOCK AI: Generating initial schedule with input:", input);
    
    return {
      schedule: JSON.stringify(mockScheduleEvents),
      explanation: "This is a mock schedule generated for development purposes. It demonstrates a mix of short and long courses assigned to various teachers and classrooms.",
    };
  }
  return genSchedule(input);
}


export async function identifyScheduleConflicts(input: IdentifyScheduleConflictsInput): Promise<IdentifyScheduleConflictsOutput> {
  if (MOCK_AI) {
    console.log("MOCK AI: Identifying conflicts with input:", input);
    return {
      conflicts: [
        "Teacher 'Dr. Alan Grant' is double-booked on Monday at 10:00 AM.",
        "Classroom 'Lab A' capacity exceeded for 'Advanced Algorithms' on Wednesday.",
      ],
      suggestions: [
        "Move 'Dr. Alan Grant's 'Intro to AI' class on Monday to 1:00 PM to resolve the conflict.",
        "Consider swapping 'Advanced Algorithms' to 'Auditorium B' which has higher capacity.",
        "Teacher 'Dr. Ian Malcolm' has a 4-hour gap on Tuesday. Consider moving a class to fill this gap."
      ],
    };
  }
  return identifyConflicts(input);
}
