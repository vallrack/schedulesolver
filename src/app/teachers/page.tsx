'use client'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu"
import { MoreHorizontal, PlusCircle } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog"
import { useCollection } from "@/firebase/firestore/use-collection"
import { useFirestore } from "@/firebase"
import { useMemo } from "react"
import { collection } from "firebase/firestore"
import type { Course } from "@/lib/types"

export default function TeachersPage() {
  const firestore = useFirestore();
  
  const teachersCollection = useMemo(() => firestore ? collection(firestore, 'teachers') : null, [firestore]);
  const { data: teachers, loading: loadingTeachers, error: errorTeachers } = useCollection(teachersCollection);

  const coursesCollection = useMemo(() => firestore ? collection(firestore, 'courses') : null, [firestore]);
  const { data: courses, loading: loadingCourses, error: errorCourses } = useCollection<Course>(coursesCollection);

  const loading = loadingTeachers || loadingCourses;
  const error = errorTeachers || errorCourses;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold font-headline tracking-tight">Teacher Management</h1>
          <Dialog>
              <DialogTrigger asChild>
                  <Button>
                      <PlusCircle className="mr-2 h-4 w-4" />
                      Add Teacher
                  </Button>
              </DialogTrigger>
              <DialogContent>
                  <DialogHeader>
                      <DialogTitle>Add New Teacher</DialogTitle>
                      <DialogDescription>
                          Fill in the details for the new teacher. This form is a placeholder.
                      </DialogDescription>
                  </DialogHeader>
                  <div className="py-8 text-center text-muted-foreground">
                    (Teacher form would be here)
                  </div>
                  <DialogFooter>
                    <Button type="submit">Save Teacher</Button>
                  </DialogFooter>
              </DialogContent>
          </Dialog>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Teacher Roster</CardTitle>
          <CardDescription>Manage teacher profiles, specializations, and availability.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead className="hidden md:table-cell">Email</TableHead>
                <TableHead className="hidden sm:table-cell">Max Hours/Week</TableHead>
                <TableHead>Specialties</TableHead>
                <TableHead><span className="sr-only">Actions</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && <TableRow><TableCell colSpan={5} className="text-center">Loading...</TableCell></TableRow>}
              {error && <TableRow><TableCell colSpan={5} className="text-center text-destructive">Error: {error.message}</TableCell></TableRow>}
              {teachers?.map(teacher => (
                <TableRow key={teacher.id}>
                  <TableCell className="font-medium">{teacher.name}</TableCell>
                  <TableCell className="hidden md:table-cell">{teacher.email}</TableCell>
                  <TableCell className="hidden sm:table-cell">{teacher.maxWeeklyHours}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {teacher.specialties?.map((specId: string) => {
                        const course = courses?.find(c => c.id === specId);
                        return <Badge key={specId} variant="secondary">{course?.name ?? 'Unknown'}</Badge>;
                      })}
                    </div>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <span className="sr-only">Open menu</span>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuItem>Edit Profile</DropdownMenuItem>
                        <DropdownMenuItem>View Schedule</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive focus:bg-destructive/10 focus:text-destructive">Delete Teacher</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
