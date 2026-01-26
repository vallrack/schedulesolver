'use client'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
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

export default function CoursesPage() {
  const firestore = useFirestore();
  const coursesCollection = useMemo(() => firestore ? collection(firestore, 'courses') : null, [firestore]);
  const { data: courses, loading, error } = useCollection(coursesCollection);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold font-headline tracking-tight">Course Catalog</h1>
          <Dialog>
              <DialogTrigger asChild>
                  <Button>
                      <PlusCircle className="mr-2 h-4 w-4" />
                      Add Course
                  </Button>
              </DialogTrigger>
              <DialogContent>
                  <DialogHeader>
                      <DialogTitle>Add New Course</DialogTitle>
                      <DialogDescription>
                          Fill in the details for the new course. This form is a placeholder.
                      </DialogDescription>
                  </DialogHeader>
                  <div className="py-8 text-center text-muted-foreground">
                    (Course form would be here)
                  </div>
                  <DialogFooter>
                    <Button type="submit">Save Course</Button>
                  </DialogFooter>
              </DialogContent>
          </Dialog>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Available Courses</CardTitle>
          <CardDescription>Manage course details, including duration and workload.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Course Name</TableHead>
                <TableHead>Career</TableHead>
                <TableHead className="hidden sm:table-cell">Semester</TableHead>
                <TableHead className="hidden md:table-cell">Duration (Weeks)</TableHead>
                <TableHead className="hidden md:table-cell">Total Hours</TableHead>
                <TableHead><span className="sr-only">Actions</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && <TableRow><TableCell colSpan={6} className="text-center">Loading...</TableCell></TableRow>}
              {error && <TableRow><TableCell colSpan={6} className="text-center text-destructive">Error: {error.message}</TableCell></TableRow>}
              {courses?.map(course => (
                <TableRow key={course.id}>
                  <TableCell className="font-medium">{course.name}</TableCell>
                  <TableCell>{course.career}</TableCell>
                  <TableCell className="hidden sm:table-cell">{course.semester}</TableCell>
                  <TableCell className="hidden md:table-cell">{course.durationWeeks}</TableCell>
                  <TableCell className="hidden md:table-cell">{course.totalHours}</TableCell>
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
                        <DropdownMenuItem>Edit Course</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive focus:bg-destructive/10 focus:text-destructive">Delete Course</DropdownMenuItem>
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
