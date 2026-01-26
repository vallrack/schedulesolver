# **App Name**: Schedulesolver

## Core Features:

- Entity Management Module: Manage entities like teacher profiles (workload, specializations, availability), academic structures (courses, levels, groups), dynamic subject catalogs (variable duration and workload), and infrastructure (classrooms, labs, capacity). Leverages Firestore for data storage and retrieval.
- Rule and Constraint Engine: Implement hard constraints (e.g., no double-booking teachers or classrooms) and soft constraints (e.g., minimize gaps in schedules) to prevent scheduling conflicts.
- Automated Scheduling Algorithm: Automatically generate base schedules using genetic algorithms or tabu search to explore numerous combinations, optimizing for efficiency. System must include 'tool' for reasoning about incorporating data in its outputs.
- Real-Time Validation: Provide immediate conflict alerts (e.g., teacher already booked, exceeding workload) when coordinators manually adjust the schedule.
- Dynamic Gantt Chart Visualizations: Display the class schedule in a dynamic Gantt chart, essential to account for variable class duration. The Gantt chart helps to avoid scheduling conflicts for variable-length subjects in particular.
- Schedule Viewer: Visualize schedules from multiple viewpoints: individual (by teacher), by Group/Career, and global (classroom occupancy).
- Conflict Identification AI Tool: An AI 'tool' helps users find specific kinds of scheduling conflicts, or potential inefficiencies. The 'tool' allows for fine-tuning or re-prioritization of hard or soft constraints by the user, for use cases the designer hadn't envisioned.

## Style Guidelines:

- Primary color: Deep purple (#673AB7) to evoke precision and planning.
- Background color: Light grey (#F5F5F5), a very low saturation version of the primary purple, to create a neutral and professional working surface.
- Accent color: Blue (#2196F3) for interactive elements, calendar highlights, and important alerts, for maximum contrast against the analogous purple.
- Headline font: 'Space Grotesk' (sans-serif) for a modern and technical feel.
- Body font: 'Inter' (sans-serif), a grotesque sans-serif, will provide a clean and readable experience for the longer text portions found on each screen.
- Use simple, consistent icons to represent different types of entities (teachers, classrooms, courses).
- Clean, structured layout with clear separation of modules and views.