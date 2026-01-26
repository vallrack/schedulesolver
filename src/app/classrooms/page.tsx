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
import { Badge } from "@/components/ui/badge"
import { useCollection } from "@/firebase/firestore/use-collection"
import { useFirestore } from "@/firebase"
import { useMemo } from "react"
import { collection } from "firebase/firestore"

export default function ClassroomsPage() {
  const firestore = useFirestore();
  const classroomsCollection = useMemo(() => firestore ? collection(firestore, 'classrooms') : null, [firestore]);
  const { data: classrooms, loading, error } = useCollection(classroomsCollection);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold font-headline tracking-tight">Infrastructure Management</h1>
          <Dialog>
              <DialogTrigger asChild>
                  <Button>
                      <PlusCircle className="mr-2 h-4 w-4" />
                      Add Classroom
                  </Button>
              </DialogTrigger>
              <DialogContent>
                  <DialogHeader>
                      <DialogTitle>Add New Classroom</DialogTitle>
                      <DialogDescription>
                          Fill in the details for the new classroom or lab. This form is a placeholder.
                      </DialogDescription>
                  </DialogHeader>
                  <div className="py-8 text-center text-muted-foreground">
                    (Classroom form would be here)
                  </div>
                  <DialogFooter>
                    <Button type="submit">Save Classroom</Button>
                  </DialogFooter>
              </DialogContent>
          </Dialog>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Classrooms & Labs</CardTitle>
          <CardDescription>Manage all available rooms and their capacities.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Capacity</TableHead>
                <TableHead><span className="sr-only">Actions</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && <TableRow><TableCell colSpan={4} className="text-center">Loading...</TableCell></TableRow>}
              {error && <TableRow><TableCell colSpan={4} className="text-center text-destructive">Error: {error.message}</TableCell></TableRow>}
              {classrooms?.map(classroom => (
                <TableRow key={classroom.id}>
                  <TableCell className="font-medium">{classroom.name}</TableCell>
                  <TableCell><Badge variant={classroom.type === 'lab' ? 'default' : 'secondary'}>{classroom.type}</Badge></TableCell>
                  <TableCell>{classroom.capacity}</TableCell>
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
                        <DropdownMenuItem>Edit Classroom</DropdownMenuItem>
                        <DropdownMenuItem>View Occupancy</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive focus:bg-destructive/10 focus:text-destructive">Delete Classroom</DropdownMenuItem>
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
