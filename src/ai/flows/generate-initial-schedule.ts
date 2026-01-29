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

const GeneratedScheduleEventSchema = z.object({
  courseId: z.string().describe("The ID of the course from the input 'subjects' list."),
  teacherId: z.string(),
  classroomId: z.string(),
  day: z.string().describe("Day of the week, e.g., 'Lunes'."),
  startTime: z.string().describe("Start time in 'HH:MM' format."),
  endTime: z.string().describe("End time in 'HH:MM' format."),
  startWeek: z.number(),
  endWeek: z.number(),
});

const GenerateInitialScheduleOutputSchema = z.object({
  schedule: z.array(GeneratedScheduleEventSchema).describe('The generated schedule as an array of event objects.'),
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
  prompt: `You are an expert university scheduler AI. Your task is to generate a weekly class schedule based on the provided data and constraints.

You will receive JSON strings for the following:
- **Subjects**: A list of courses that need to be scheduled. Each course has an ID, name, total hours required for the semester, and the group of students taking it.
- **Teachers**: A list of available teachers, their specializations (by module ID), and their availability.
- **Classrooms**: A list of available classrooms with their capacity.
- **Groups**: A list of student groups with their student count.
- **Constraints**: A list of rules you must follow.

**Input Data:**
- Subjects: {{{subjects}}}
- Teachers: {{{teachers}}}
- Classrooms: {{{classrooms}}}
- Groups: {{{groups}}}

**Your Goal:**
Create an array of schedule events. Each event represents a single class session.

**Output Format:**
Your output **MUST** be a JSON object with two properties: 'schedule' and 'explanation'.
The 'schedule' property must be an array of event objects. Each event object **MUST** have the following properties:
- \`courseId\`: (string) The ID of the course from the input 'subjects' list.
- \`teacherId\`: (string) The ID of the assigned teacher.
- \`classroomId\`: (string) The ID of the assigned classroom.
- \`day\`: (string) Day of the week (e.g., 'Lunes', 'Martes', etc.).
- \`startTime\`: (string) Start time in 'HH:MM' format.
- \`endTime\`: (string) End time in 'HH:MM' format.
- \`startWeek\`: (number) The week number the course starts.
- \`endWeek\`: (number) The week number the course ends.

**Crucial Constraints to Follow:**
{{#each constraints}}
  - {{{this}}}
{{/each}}

Please generate the schedule now. Provide the schedule array and a brief explanation of your process.
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
    if (!output) {
      throw new Error('La IA no devolvió una respuesta válida. Por favor, inténtalo de nuevo.');
    }
    return output;
  }
);
