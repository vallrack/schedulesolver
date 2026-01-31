import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getColorForCourse(id: string | undefined): string {
    if (!id) return 'hsl(220, 13%, 69%)'; // A neutral default color
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
        hash = id.charCodeAt(i) + ((hash << 5) - hash);
        hash = hash & hash;
    }
    // Using a fixed saturation and lightness for better consistency and readability
    return `hsl(${hash % 360}, 70%, 55%)`; 
}
