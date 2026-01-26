'use server';

/**
 * @fileOverview An AI tool to identify potential scheduling conflicts and inefficiencies based on different constraint priorities.
 *
 * - identifyScheduleConflicts - A function that handles the identification of scheduling conflicts.
 * - IdentifyScheduleConflictsInput - The input type for the identifyScheduleConflicts function.
 * - IdentifyScheduleConflictsOutput - The return type for the identifyScheduleConflicts function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const IdentifyScheduleConflictsInputSchema = z.object({
  scheduleData: z.string().describe('The schedule data in JSON format, including teachers, courses, classrooms, and timings.'),
  constraintPriorities: z.string().describe('A JSON string specifying the priorities of different constraints (hard and soft).'),
});
export type IdentifyScheduleConflictsInput = z.infer<typeof IdentifyScheduleConflictsInputSchema>;

const IdentifyScheduleConflictsOutputSchema = z.object({
  conflicts: z.array(z.string()).describe('A list of identified scheduling conflicts and inefficiencies.'),
  suggestions: z.array(z.string()).describe('Suggestions for resolving the identified conflicts and improving the schedule.'),
});
export type IdentifyScheduleConflictsOutput = z.infer<typeof IdentifyScheduleConflictsOutputSchema>;

export async function identifyScheduleConflicts(input: IdentifyScheduleConflictsInput): Promise<IdentifyScheduleConflictsOutput> {
  return identifyScheduleConflictsFlow(input);
}

const identifyScheduleConflictsPrompt = ai.definePrompt({
  name: 'identifyScheduleConflictsPrompt',
  input: {schema: IdentifyScheduleConflictsInputSchema},
  output: {schema: IdentifyScheduleConflictsOutputSchema},
  prompt: `You are an AI scheduling assistant tasked with identifying scheduling conflicts and inefficiencies in a provided schedule, given a set of constraint priorities.

  Analyze the schedule data and identify any violations of hard constraints (e.g., double-booked teachers, overlapping classes in the same classroom, exceeding classroom capacity) and inefficiencies related to soft constraints (e.g., excessive gaps in schedules, suboptimal teacher preferences).

  Schedule Data: {{{scheduleData}}}
  Constraint Priorities: {{{constraintPriorities}}}

  Based on your analysis, provide a list of specific conflicts and inefficiencies, along with actionable suggestions for resolving them. Ensure that the conflicts and suggestions are clear and concise.

  Output the conflicts and suggestions as a JSON object with 'conflicts' and 'suggestions' fields.
  `, // Ensure that the LLM outputs a valid JSON object.
});

const identifyScheduleConflictsFlow = ai.defineFlow(
  {
    name: 'identifyScheduleConflictsFlow',
    inputSchema: IdentifyScheduleConflictsInputSchema,
    outputSchema: IdentifyScheduleConflictsOutputSchema,
  },
  async input => {
    try {
      const {output} = await identifyScheduleConflictsPrompt(input);
      return output!;
    } catch (error) {
      console.error('Error in identifyScheduleConflictsFlow:', error);
      throw error;
    }
  }
);
