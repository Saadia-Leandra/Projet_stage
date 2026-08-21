export function dedupeStudents(students = []) {
  const unique = new Map();
  for (const student of students) {
    const key = student.studentUserId ?? student.id ?? student.userId ?? student.studentCode ?? student.code_etudiant;
    if (key !== null && key !== undefined && key !== "" && !unique.has(String(key))) {
      unique.set(String(key), student);
    }
  }
  return [...unique.values()];
}
