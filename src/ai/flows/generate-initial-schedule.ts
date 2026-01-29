'use server';

/**
 * @fileOverview Flow for generating an initial schedule based on defined constraints.
 *
 * - generateInitialSchedule - A function that generates an initial schedule.
 * - GenerateInitialScheduleInput - The input type for the generateInitialSchedule function.
 * - GenerateInitialScheduleOutput - The return type for the generateInitialSchedule function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateInitialScheduleInputSchema = z.object({
  subjects: z.string().describe('A list of scheduled courses to be placed in the schedule. The AI will refer to these as "subjects", but they represent specific course offerings for groups.'),
  teachers: z.string().describe('A list of teachers and their availability.'),
  classrooms: z.string().describe('A list of classrooms and their capacity.'),
  groups: z.string().describe('A list of groups and their student count.'),
  constraints: z.string().describe('A list of hard and soft constraints to consider.'),
});

export type GenerateInitialScheduleInput = z.infer<
  typeof GenerateInitialScheduleInputSchema
>;

const GenerateInitialScheduleOutputSchema = z.object({
  schedule: z.string().describe('The generated schedule in JSON format.'),
  explanation: z.string().describe('An explanation of how the schedule was generated.'),
});

export type GenerateInitialScheduleOutput = z.infer<
  typeof GenerateInitialScheduleOutputSchema
>;

export async function generateInitialSchedule(
  input: GenerateInitialScheduleInput
): Promise<GenerateInitialScheduleOutput> {
  return generateInitialScheduleFlow(input);
}

const generateInitialSchedulePrompt = ai.definePrompt({
  name: 'generateInitialSchedulePrompt',
  input: {schema: GenerateInitialScheduleInputSchema},
  output: {schema: GenerateInitialScheduleOutputSchema},
  prompt: `You are a schedule generator. You will be given a list of subjects (which are actually scheduled courses), teachers, classrooms, student groups, and constraints. You will generate a schedule that satisfies the constraints.

Subjects: {{{subjects}}}
Teachers: {{{teachers}}}
Classrooms: {{{classrooms}}}
Groups: {{{groups}}}
Constraints: {{{constraints}}}

Generate the schedule in JSON format and provide an explanation of how you generated the schedule.
The 'schedule' property in your output JSON must be a JSON string representing an array of event objects. Each event object must have the following properties: subjectId (string, THIS MUST BE THE ID OF THE COURSE OFFERING from the input 'subjects' list), teacherId (string), classroomId (string), day (string, e.g., 'Lunes'), startTime (string, 'HH:MM'), endTime (string, 'HH:MM'), startWeek (number), and endWeek (number).

The most important constraint is to never assign a group to a classroom where the number of students in the group ('studentCount') exceeds the classroom's 'capacity'.

{{# each constraints }}
  - {{{this}}}
{{/each}}
`,
});

const generateInitialScheduleFlow = ai.defineFlow(
  {
    name: 'generateInitialScheduleFlow',
    inputSchema: GenerateInitialScheduleInputSchema,
    outputSchema: GenerateInitialScheduleOutputSchema,
  },
  async input => {
    const {output} = await generateInitialSchedulePrompt(input);
    return output!;
  }
);
