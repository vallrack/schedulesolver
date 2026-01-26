import { config } from 'dotenv';
config();

import '@/ai/flows/identify-schedule-conflicts.ts';
import '@/ai/flows/generate-initial-schedule.ts';