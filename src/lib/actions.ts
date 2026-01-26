'use server';

import { generateInitialSchedule as genSchedule, GenerateInitialScheduleInput, GenerateInitialScheduleOutput } from '@/ai/flows/generate-initial-schedule';
import { identifyScheduleConflicts as identifyConflicts, IdentifyScheduleConflictsInput, IdentifyScheduleConflictsOutput } from '@/ai/flows/identify-schedule-conflicts';

export async function generateInitialSchedule(input: GenerateInitialScheduleInput): Promise<GenerateInitialScheduleOutput> {
  return genSchedule(input);
}


export async function identifyScheduleConflicts(input: IdentifyScheduleConflictsInput): Promise<IdentifyScheduleConflictsOutput> {
  return identifyConflicts(input);
}
