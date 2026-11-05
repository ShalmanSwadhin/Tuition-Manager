import { useEffect, useState } from "react";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";
import DiaryList from "../components/DiaryList";
import type { Student } from "../types";

export default function Diary() {
  const { user } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [filterStudent, setFilterStudent] = useState("");
  const isStudent = user?.role === "student";

  useEffect(() => {
    if (!isStudent) api.get<Student[]>("/students", { params: { status: "active" } }).then((res) => setStudents(res.data));
  }, [isStudent]);

  if (!user) return null;

  if (isStudent) {
    return (
      <div className="space-y-4">
        <h1 className="page-title">My diary</h1>
        <DiaryList studentId={user.studentId} studentName={user.name} title="Entries" />
      </div>
    );
  }

  const picked = students.find((s) => s._id === filterStudent);
  return (
    <div className="space-y-4">
      <h1 className="page-title">Diary</h1>
      <select value={filterStudent} onChange={(e) => setFilterStudent(e.target.value)} className="input">
        <option value="">All students</option>
        {students.map((s) => (
          <option key={s._id} value={s._id}>
            {s.fullName}
          </option>
        ))}
      </select>
      <DiaryList
        key={filterStudent}
        studentId={filterStudent || undefined}
        studentName={picked?.fullName}
        students={students}
        title="Entries"
      />
    </div>
  );
}
