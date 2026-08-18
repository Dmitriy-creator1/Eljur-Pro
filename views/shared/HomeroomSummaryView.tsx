import React, { useState, useMemo } from 'react';
import { AppState, User, Grade, FinalGradeEntry } from '../../types';
import * as H from '../../utils/helpers';
import { Button, Card, Modal } from '../../components/ui';
import { 
  Printer, 
  Users, 
  Award, 
  TrendingUp, 
  Search, 
  BookOpen, 
  CheckCircle2, 
  ChevronRight, 
  GraduationCap, 
  UserCheck, 
  Layers, 
  AlertCircle,
  FileSpreadsheet
} from 'lucide-react';

interface Props {
  state: AppState;
  user: User;
  onUpdate?: (s: AppState) => void;
}

export const HomeroomSummaryView: React.FC<Props> = ({ state, user, onUpdate }) => {
  const lang = state.settings.language || 'ru';
  const t = (k: string) => H.t(k, lang);

  const schoolClasses = H.getSchoolClasses(state, user.schoolId);
  const leadingClasses = H.getUserLeadingClasses(state, user.schoolId, user.id);

  // If user is director or creator, allow viewing all classes or filter to leading
  const isDirector = user.role === 'director' || (user.role as string) === 'creator';
  const availableClasses = isDirector && leadingClasses.length === 0 ? schoolClasses : (leadingClasses.length > 0 ? leadingClasses : schoolClasses);

  const [selectedClassKey, setSelectedClassKey] = useState<string>(() => {
    if (leadingClasses.length > 0) {
      return `${leadingClasses[0].class}_${leadingClasses[0].letter}`;
    }
    if (schoolClasses.length > 0) {
      return `${schoolClasses[0].class}_${schoolClasses[0].letter}`;
    }
    return '';
  });

  const [selectedQuarter, setSelectedQuarter] = useState<'all' | 'Q1' | 'Q2' | 'Q3' | 'Q4'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);

  // Parse selected class
  const [selectedClassNum, selectedClassLetter] = selectedClassKey ? selectedClassKey.split('_') : ['', ''];
  const currentClassObj = schoolClasses.find(c => c.class === selectedClassNum && c.letter === selectedClassLetter);
  const classHeadmaster = H.getClassHeadmaster(state, user.schoolId, selectedClassNum, selectedClassLetter);

  const gradingSystem = H.getSchoolGradingSystem(state, user.schoolId);
  const minGrade = gradingSystem?.minGrade ?? 2;
  const maxGrade = gradingSystem?.maxGrade ?? 5;
  const useWeights = gradingSystem?.useWeights ?? true;
  const gradeTypes = H.getSchoolGradeTypes(state, user.schoolId);
  const scheduleSettings = H.getSchoolScheduleSettings(state, user.schoolId);
  const subjects = H.getSchoolSubjects(state, user.schoolId);

  const classGrades = H.getSchoolClassGrades(state, user.schoolId, selectedClassKey);
  const classFinalGrades = H.getSchoolClassFinalGrades(state, user.schoolId, selectedClassKey);

  // Helper for dynamic weights
  const getEffectiveWeight = (g: Grade) => {
    if (!useWeights) return 1;
    const typeDef = gradeTypes.find(t => t.key === g.type);
    if (!typeDef) return 1;
    if (typeDef.isNoWeight) return 0;
    if (typeDef.isDynamicWeight) return g.weight || 1;
    return typeDef.weight;
  };

  // Helper to compute quarter average for a student and subject
  const computeQuarterAvg = (studentId: string, subject: string, quarterKey: string): { avg: string; avgNum: number; count: number } => {
    const grades = classGrades[subject] || [];
    const def = scheduleSettings.quarterDefinitions?.[quarterKey];
    const qStart = def?.start || '0000-00-00';
    const qEnd = def?.end || '9999-99-99';

    const qGrades = grades.filter(g => {
      if (g.studentId !== studentId) return false;
      if (def?.start && def?.end) {
        return g.date >= qStart && g.date <= qEnd;
      }
      return H.getQuarterFromDate(g.date) === quarterKey;
    });

    let wSum = 0;
    let wCount = 0;
    qGrades.forEach(g => {
      const val = parseFloat(String(g.value));
      if (!isNaN(val)) {
        const weight = getEffectiveWeight(g);
        wSum += val * weight;
        wCount += weight;
      }
    });

    if (wCount === 0) return { avg: '-', avgNum: 0, count: 0 };
    const num = wSum / wCount;
    return { avg: num.toFixed(2), avgNum: num, count: qGrades.length };
  };

  // Helper to compute overall average across all quarters for a student and subject
  const computeSubjectYearAvg = (studentId: string, subject: string): { avg: string; avgNum: number } => {
    const grades = classGrades[subject] || [];
    const studentGrades = grades.filter(g => g.studentId === studentId);
    let wSum = 0;
    let wCount = 0;
    studentGrades.forEach(g => {
      const val = parseFloat(String(g.value));
      if (!isNaN(val)) {
        const weight = getEffectiveWeight(g);
        wSum += val * weight;
        wCount += weight;
      }
    });
    if (wCount === 0) return { avg: '-', avgNum: 0 };
    const num = wSum / wCount;
    return { avg: num.toFixed(2), avgNum: num };
  };

  // Students of the class
  const classStudents = useMemo(() => {
    if (!selectedClassNum || !selectedClassLetter) return [];
    return state.users
      .filter(u => u.role === 'student' && u.schoolId === user.schoolId && u.class === selectedClassNum && u.letter === selectedClassLetter)
      .sort((a, b) => a.fio.localeCompare(b.fio));
  }, [state.users, user.schoolId, selectedClassNum, selectedClassLetter]);

  // Filtered students by search
  const filteredStudents = useMemo(() => {
    if (!searchQuery.trim()) return classStudents;
    const q = searchQuery.toLowerCase();
    return classStudents.filter(s => s.fio.toLowerCase().includes(q) || s.login.toLowerCase().includes(q));
  }, [classStudents, searchQuery]);

  // Overall student summaries (Quarter grades, subject averages, student GPA)
  const studentSummaries = useMemo(() => {
    return classStudents.map(student => {
      let totalSubjectAverages = 0;
      let subjectCountWithGrades = 0;

      const subjectData: Record<string, {
        q1Avg: string; q1Grade?: string;
        q2Avg: string; q2Grade?: string;
        q3Avg: string; q3Grade?: string;
        q4Avg: string; q4Grade?: string;
        yearAvg: string; yearGrade?: string;
      }> = {};

      subjects.forEach(subj => {
        const finalEntry = (classFinalGrades[subj] || []).find(e => e.studentId === student.id) || {} as FinalGradeEntry;

        const q1 = computeQuarterAvg(student.id, subj, 'Q1');
        const q2 = computeQuarterAvg(student.id, subj, 'Q2');
        const q3 = computeQuarterAvg(student.id, subj, 'Q3');
        const q4 = computeQuarterAvg(student.id, subj, 'Q4');
        const year = computeSubjectYearAvg(student.id, subj);

        if (year.avgNum > 0) {
          totalSubjectAverages += year.avgNum;
          subjectCountWithGrades++;
        }

        subjectData[subj] = {
          q1Avg: q1.avg,
          q1Grade: finalEntry.q1,
          q2Avg: q2.avg,
          q2Grade: finalEntry.q2,
          q3Avg: q3.avg,
          q3Grade: finalEntry.q3,
          q4Avg: q4.avg,
          q4Grade: finalEntry.q4,
          yearAvg: year.avg,
          yearGrade: finalEntry.year
        };
      });

      const studentOverallGpa = subjectCountWithGrades > 0 ? (totalSubjectAverages / subjectCountWithGrades) : 0;

      return {
        student,
        overallGpa: studentOverallGpa > 0 ? studentOverallGpa.toFixed(2) : '-',
        overallGpaNum: studentOverallGpa,
        subjects: subjectData
      };
    });
  }, [classStudents, subjects, classGrades, classFinalGrades, scheduleSettings]);

  // Class statistics
  const classStats = useMemo(() => {
    const validGpas = studentSummaries.filter(s => s.overallGpaNum > 0);
    const avgGpa = validGpas.length > 0
      ? (validGpas.reduce((acc, curr) => acc + curr.overallGpaNum, 0) / validGpas.length).toFixed(2)
      : '-';

    let excellentCount = 0; // >= 4.5
    let goodCount = 0; // 3.5 - 4.49
    let satisfactoryCount = 0; // 2.5 - 3.49
    let lowCount = 0; // < 2.5

    validGpas.forEach(s => {
      if (s.overallGpaNum >= 4.5) excellentCount++;
      else if (s.overallGpaNum >= 3.5) goodCount++;
      else if (s.overallGpaNum >= 2.5) satisfactoryCount++;
      else lowCount++;
    });

    return {
      total: classStudents.length,
      avgGpa,
      excellentCount,
      goodCount,
      satisfactoryCount,
      lowCount
    };
  }, [studentSummaries, classStudents]);

  // Selected student for detailed report card
  const activeStudentSummary = studentSummaries.find(s => s.student.id === selectedStudentId);
  const currentSchool = H.getSchool(state, user.schoolId);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Printable Document Header (visible ONLY during print) */}
      <div className="hidden print:block mb-4 text-center border-b border-slate-300 pb-3">
        <h1 className="text-base font-bold uppercase tracking-wide text-slate-900">
          {currentSchool?.name || 'Электронный Журнал'}
        </h1>
        <h2 className="text-lg font-extrabold text-slate-900 mt-0.5">
          {lang === 'ru' ? `Сводная ведомость успеваемости класса ${selectedClassNum}${selectedClassLetter}` : `Class ${selectedClassNum}${selectedClassLetter} Academic Summary`}
        </h2>
        <div className="flex justify-center items-center gap-4 text-xs text-slate-600 mt-1">
          <span>{lang === 'ru' ? 'Период' : 'Period'}: {selectedQuarter === 'all' ? (lang === 'ru' ? 'Все четверти (1-4)' : 'All Quarters') : `${selectedQuarter.replace('Q','')} ${t('quarter')}`}</span>
          <span>•</span>
          <span>{lang === 'ru' ? 'Учеников' : 'Students'}: {classStats.total}</span>
          <span>•</span>
          <span>{lang === 'ru' ? 'Ср. балл' : 'Avg GPA'}: {classStats.avgGpa}</span>
          <span>•</span>
          <span>{lang === 'ru' ? 'Дата' : 'Date'}: {H.formatDateDDMMYYYY(new Date().toISOString().split('T')[0])}</span>
        </div>
      </div>

      {/* Header card with leading class switchers & summary */}
      <Card className="p-6 md:p-7 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-soft border border-slate-200 dark:border-slate-800 rounded-2xl relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2.5">
              <span className="px-3 py-1 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 rounded-lg text-xs font-bold uppercase tracking-wider border border-blue-200/80 dark:border-blue-800/50 flex items-center gap-1.5">
                <GraduationCap size={14} className="text-blue-600 dark:text-blue-400" />
                <span>{lang === 'ru' ? 'Классное руководство' : 'Class Leadership'}</span>
              </span>
              {leadingClasses.some(c => `${c.class}_${c.letter}` === selectedClassKey) && (
                <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 rounded-lg text-xs font-bold border border-emerald-200/80 dark:border-emerald-800/50 flex items-center gap-1">
                  <UserCheck size={13} className="text-emerald-600 dark:text-emerald-400" />
                  <span>{lang === 'ru' ? 'Ваш класс' : 'Your Class'}</span>
                </span>
              )}
            </div>

            <h2 className="text-xl md:text-2xl font-bold tracking-tight text-slate-900 dark:text-white font-heading">
              {lang === 'ru' ? `Успеваемость класса ${selectedClassNum}${selectedClassLetter}` : `Class ${selectedClassNum}${selectedClassLetter} Performance`}
            </h2>
          </div>

          {/* Class Switcher Buttons & Print */}
          <div className="flex flex-wrap items-center gap-2 no-print">
            {availableClasses.map(c => {
              const key = `${c.class}_${c.letter}`;
              const isSelected = key === selectedClassKey;
              const isMyClass = leadingClasses.some(lc => `${lc.class}_${lc.letter}` === key);
              return (
                <button
                  key={key}
                  onClick={() => setSelectedClassKey(key)}
                  className={`px-4 py-2 rounded-xl font-bold text-sm transition-all duration-200 flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-blue-600 text-white shadow-sm border border-blue-600'
                      : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                  }`}
                >
                  <span>{c.class}{c.letter}</span>
                  {isMyClass && <UserCheck size={13} className={isSelected ? 'text-blue-100' : 'text-slate-400'} />}
                </button>
              );
            })}
            <Button
              variant="secondary"
              size="sm"
              onClick={() => window.print()}
              className="ml-1"
            >
              <Printer size={15} className="mr-1.5 text-slate-500" />
              <span>{t('print')}</span>
            </Button>
          </div>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 mt-6 pt-5 border-t border-slate-100 dark:border-slate-800">
          <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3.5 border border-slate-200/70 dark:border-slate-700/60">
            <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 font-medium">
              <Users size={14} className="text-blue-600 dark:text-blue-400" />
              <span>{lang === 'ru' ? 'Учеников' : 'Students'}</span>
            </div>
            <div className="text-2xl font-bold mt-1 text-slate-900 dark:text-white">{classStats.total}</div>
          </div>

          <div className="bg-amber-50/50 dark:bg-amber-950/20 rounded-xl p-3.5 border border-amber-200/70 dark:border-amber-900/40">
            <div className="text-xs text-amber-700 dark:text-amber-400 flex items-center gap-1.5 font-medium">
              <TrendingUp size={14} className="text-amber-600 dark:text-amber-400" />
              <span>{lang === 'ru' ? 'Средний балл' : 'Average GPA'}</span>
            </div>
            <div className="text-2xl font-bold mt-1 text-amber-700 dark:text-amber-300">{classStats.avgGpa}</div>
          </div>

          <div className="bg-emerald-50/50 dark:bg-emerald-950/20 rounded-xl p-3.5 border border-emerald-200/70 dark:border-emerald-900/40">
            <div className="text-xs text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5 font-medium">
              <Award size={14} className="text-emerald-600 dark:text-emerald-400" />
              <span>{lang === 'ru' ? 'Отличники (5)' : 'Honors (5)'}</span>
            </div>
            <div className="text-2xl font-bold mt-1 text-emerald-700 dark:text-emerald-300">{classStats.excellentCount}</div>
          </div>

          <div className="bg-blue-50/50 dark:bg-blue-950/20 rounded-xl p-3.5 border border-blue-200/70 dark:border-blue-900/40">
            <div className="text-xs text-blue-700 dark:text-blue-400 flex items-center gap-1.5 font-medium">
              <CheckCircle2 size={14} className="text-blue-600 dark:text-blue-400" />
              <span>{lang === 'ru' ? 'Хорошисты (4-5)' : 'Good (4-5)'}</span>
            </div>
            <div className="text-2xl font-bold mt-1 text-blue-700 dark:text-blue-300">{classStats.goodCount}</div>
          </div>

          <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3.5 border border-slate-200/70 dark:border-slate-700/60 col-span-2 sm:col-span-1">
            <div className="text-xs text-slate-600 dark:text-slate-400 flex items-center gap-1.5 font-medium">
              <Layers size={14} className="text-orange-600 dark:text-orange-400" />
              <span>{lang === 'ru' ? 'С тройками (3)' : 'With 3s'}</span>
            </div>
            <div className="text-2xl font-bold mt-1 text-orange-700 dark:text-orange-300">{classStats.satisfactoryCount}</div>
          </div>
        </div>
      </Card>

      {/* Control Bar: Quarter Filter, Search */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-soft no-print">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mr-1">
            {lang === 'ru' ? 'Период:' : 'Period:'}
          </span>
          {[
            { id: 'all', label: lang === 'ru' ? 'Все четверти (1-4)' : 'All Quarters' },
            { id: 'Q1', label: `1 ${t('quarter')}` },
            { id: 'Q2', label: `2 ${t('quarter')}` },
            { id: 'Q3', label: `3 ${t('quarter')}` },
            { id: 'Q4', label: `4 ${t('quarter')}` }
          ].map(q => (
            <button
              key={q.id}
              onClick={() => setSelectedQuarter(q.id as any)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                selectedQuarter === q.id
                  ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/30'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {q.label}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-72">
          <Search size={14} className="absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder={lang === 'ru' ? 'Поиск ученика по ФИО...' : 'Search student...'}
            className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          />
        </div>
      </div>

      {/* Main Quarter Performance Matrix Table */}
      <Card className="p-0 border border-slate-200 dark:border-slate-800 shadow-soft overflow-hidden">
        <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center no-print">
          <h3 className="font-bold text-slate-800 dark:text-white text-sm sm:text-base flex items-center gap-2">
            <BookOpen size={18} className="text-blue-600 dark:text-blue-400" />
            <span>
              {selectedQuarter === 'all'
                ? (lang === 'ru' ? 'Сводная ведомость четвертных оценок и средних баллов' : 'Quarter Grades and Average Scores Summary')
                : (lang === 'ru' ? `Оценки и средний балл за ${selectedQuarter.replace('Q','')} четверть` : `Grades and Average for Quarter ${selectedQuarter.replace('Q','')}`)}
            </span>
          </h3>
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            {lang === 'ru' ? `Предметов: ${subjects.length}` : `Subjects: ${subjects.length}`}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs print:text-[9pt] border-collapse">
            <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="p-3 text-center w-10 sticky left-0 bg-slate-100 dark:bg-slate-800 z-10 print:static print:w-6">№</th>
                <th className="p-3 text-left min-w-[180px] print:min-w-0 sticky left-10 bg-slate-100 dark:bg-slate-800 z-10 border-r border-slate-200 dark:border-slate-700 print:static">
                  {t('fio')}
                </th>
                <th className="p-3 text-center bg-blue-50 text-blue-900 dark:bg-blue-900/40 dark:text-blue-300 min-w-[80px] print:min-w-0 border-r border-slate-200 dark:border-slate-700 font-extrabold">
                  {lang === 'ru' ? 'Общий балл' : 'GPA'}
                </th>
                {subjects.map(s => (
                  <th key={s} className="p-2.5 text-center min-w-[90px] print:min-w-0 border-r border-slate-200 dark:border-slate-700">
                    <span className="truncate block mx-auto font-bold print:whitespace-normal" title={s}>{s}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={subjects.length + 3} className="p-12 text-center text-slate-400 italic text-sm">
                    {lang === 'ru' ? 'В этом классе пока нет учеников или ничего не найдено' : 'No students found in this class'}
                  </td>
                </tr>
              ) : (
                filteredStudents.map((student, idx) => {
                  const summary = studentSummaries.find(s => s.student.id === student.id);
                  const gpaNum = summary?.overallGpaNum || 0;
                  let gpaBadgeColor = 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
                  if (gpaNum >= 4.5) gpaBadgeColor = 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800';
                  else if (gpaNum >= 3.5) gpaBadgeColor = 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800';
                  else if (gpaNum >= 2.5) gpaBadgeColor = 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800';
                  else if (gpaNum > 0) gpaBadgeColor = 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300 border border-red-200 dark:border-red-800';

                  return (
                    <tr
                      key={student.id}
                      onClick={() => setSelectedStudentId(student.id)}
                      className="hover:bg-blue-50/50 dark:hover:bg-slate-800/60 cursor-pointer transition-colors group"
                    >
                      <td className="p-2.5 text-center text-slate-400 font-mono sticky left-0 bg-white dark:bg-slate-900 group-hover:bg-blue-50/50 dark:group-hover:bg-slate-800/60 print:static">
                        {idx + 1}
                      </td>
                      <td className="p-2.5 text-left font-semibold text-slate-800 dark:text-slate-200 sticky left-10 bg-white dark:bg-slate-900 group-hover:bg-blue-50/50 dark:group-hover:bg-slate-800/60 border-r border-slate-100 dark:border-slate-800 print:static">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate">{student.fio}</span>
                          <ChevronRight size={14} className="text-slate-300 group-hover:text-blue-500 transition-colors shrink-0 no-print" />
                        </div>
                      </td>
                      <td className="p-2.5 text-center border-r border-slate-100 dark:border-slate-800 bg-blue-50/20 dark:bg-blue-950/20">
                        <span className={`px-2 py-0.5 rounded-lg font-bold text-xs inline-block ${gpaBadgeColor}`}>
                          {summary?.overallGpa || '-'}
                        </span>
                      </td>

                      {subjects.map(subj => {
                        const sData = summary?.subjects[subj];
                        if (!sData) {
                          return <td key={subj} className="p-2.5 text-center text-slate-300 border-r border-slate-100 dark:border-slate-800">-</td>;
                        }

                        if (selectedQuarter === 'all') {
                          return (
                            <td key={subj} className="p-2 text-center border-r border-slate-100 dark:border-slate-800">
                              <div className="flex flex-col items-center justify-center gap-1">
                                {/* Row of 4 quarters */}
                                <div className="grid grid-cols-4 gap-1 w-full max-w-[96px] print:max-w-none print:flex print:justify-center">
                                  {(['q1', 'q2', 'q3', 'q4'] as const).map(qKey => {
                                    const gradeVal = sData[`${qKey}Grade` as keyof typeof sData];
                                    const avgVal = sData[`${qKey}Avg` as keyof typeof sData];
                                    const qNum = qKey.replace('q', '');
                                    return (
                                      <div
                                        key={qKey}
                                        title={`${qNum} четв: ${gradeVal ? `Итог: ${gradeVal}` : ''} ${avgVal && avgVal !== '-' ? `(ср. ${avgVal})` : ''}`}
                                        className={`text-[10px] p-0.5 rounded font-bold text-center ${
                                          gradeVal
                                            ? H.getGradeColorClass(gradeVal, minGrade, maxGrade)
                                            : (avgVal && avgVal !== '-' ? 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300' : 'text-slate-300 dark:text-slate-600')
                                        }`}
                                      >
                                        {gradeVal || (avgVal && avgVal !== '-' ? Math.round(parseFloat(avgVal)) : '-')}
                                      </div>
                                    );
                                  })}
                                </div>
                                {/* Year Avg */}
                                {sData.yearAvg && sData.yearAvg !== '-' && (
                                  <span className="text-[10px] font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/30 px-1.5 py-0.2 rounded print:text-[8pt]">
                                    {sData.yearAvg}
                                  </span>
                                )}
                              </div>
                            </td>
                          );
                        } else {
                          // Single quarter view (e.g. Q4)
                          const qKey = selectedQuarter.toLowerCase() as 'q1'|'q2'|'q3'|'q4';
                          const gradeVal = sData[`${qKey}Grade` as keyof typeof sData];
                          const avgVal = sData[`${qKey}Avg` as keyof typeof sData];

                          return (
                            <td key={subj} className="p-2.5 text-center border-r border-slate-100 dark:border-slate-800">
                              <div className="flex flex-col items-center justify-center gap-0.5">
                                {gradeVal ? (
                                  <span className={`px-2 py-0.5 rounded-lg font-bold text-xs ${H.getGradeColorClass(gradeVal, minGrade, maxGrade)}`}>
                                    {gradeVal}
                                  </span>
                                ) : (
                                  <span className="text-slate-300">—</span>
                                )}
                                {avgVal && avgVal !== '-' && (
                                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                                    {lang === 'ru' ? 'ср. ' : 'avg '}{avgVal}
                                  </span>
                                )}
                              </div>
                            </td>
                          );
                        }
                      })}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Individual Student Report Card Modal */}
      {selectedStudentId && activeStudentSummary && (
        <Modal
          isOpen={!!selectedStudentId}
          onClose={() => setSelectedStudentId(null)}
          title={`${lang === 'ru' ? 'Карточка успеваемости ученика' : 'Student Report Card'}: ${activeStudentSummary.student.fio}`}
          maxWidth="max-w-4xl"
        >
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700">
              <div>
                <div className="text-xs text-slate-400 font-bold uppercase tracking-wider">{t('student')}</div>
                <div className="text-lg font-bold text-slate-800 dark:text-white">{activeStudentSummary.student.fio}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {lang === 'ru' ? `Класс: ${selectedClassNum}${selectedClassLetter}` : `Class: ${selectedClassNum}${selectedClassLetter}`} • {lang === 'ru' ? 'Логин:' : 'Login:'} {activeStudentSummary.student.login}
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-slate-400 font-bold uppercase tracking-wider">{lang === 'ru' ? 'Средний балл по всем предметам' : 'Overall GPA'}</div>
                <div className="text-2xl font-black text-blue-600 dark:text-blue-400">{activeStudentSummary.overallGpa}</div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-center min-w-[650px] border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="p-3 text-left">{t('subject')}</th>
                    <th className="p-3">1 {t('quarter')}</th>
                    <th className="p-3">2 {t('quarter')}</th>
                    <th className="p-3">3 {t('quarter')}</th>
                    <th className="p-3">4 {t('quarter')}</th>
                    <th className="p-3 bg-blue-50 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300">{lang === 'ru' ? 'Ср. балл' : 'Avg'}</th>
                    <th className="p-3 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300">{t('year')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                  {subjects.map(subj => {
                    const sData = activeStudentSummary.subjects[subj];
                    return (
                      <tr key={subj} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td className="p-3 text-left font-semibold text-slate-800 dark:text-slate-200 border-r border-slate-100 dark:border-slate-800">
                          {subj}
                        </td>
                        {(['q1', 'q2', 'q3', 'q4'] as const).map(qKey => {
                          const gradeVal = sData?.[`${qKey}Grade` as keyof typeof sData];
                          const avgVal = sData?.[`${qKey}Avg` as keyof typeof sData];
                          return (
                            <td key={qKey} className="p-3 border-r border-slate-100 dark:border-slate-800">
                              <div className="flex flex-col items-center justify-center gap-0.5">
                                {gradeVal ? (
                                  <span className={`px-2.5 py-0.5 rounded-lg font-bold ${H.getGradeColorClass(gradeVal, minGrade, maxGrade)}`}>
                                    {gradeVal}
                                  </span>
                                ) : (
                                  <span className="text-slate-300">—</span>
                                )}
                                {avgVal && avgVal !== '-' && (
                                  <span className="text-[10px] text-slate-500 dark:text-slate-400">
                                    {avgVal}
                                  </span>
                                )}
                              </div>
                            </td>
                          );
                        })}
                        <td className="p-3 font-bold text-blue-600 dark:text-blue-400 bg-blue-50/40 dark:bg-blue-950/20 border-r border-slate-100 dark:border-slate-800">
                          {sData?.yearAvg || '-'}
                        </td>
                        <td className="p-3 font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50/40 dark:bg-emerald-950/20">
                          {sData?.yearGrade || '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
              <Button variant="secondary" onClick={() => setSelectedStudentId(null)}>
                {t('cancel')}
              </Button>
              <Button variant="primary" onClick={() => window.print()}>
                <Printer size={15} className="mr-1.5" />
                {t('print')}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
