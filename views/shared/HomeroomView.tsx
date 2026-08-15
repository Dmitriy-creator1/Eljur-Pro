import React, { useState } from 'react';
import { AppState, User } from '../../types';
import * as H from '../../utils/helpers';
import { Card } from '../../components/ui';

export function HomeroomView({ state, user }: { state: AppState, user: User }) {
    const homeroomClasses = state.classes.filter(c => c.homeroomTeacherId === user.id);
    const [selectedClass, setSelectedClass] = useState<string>(homeroomClasses[0] ? `${homeroomClasses[0].class}_${homeroomClasses[0].letter}` : '');

    const lang = state.settings.language || 'ru';
    const t = (k: string) => H.t(k, lang);

    if (homeroomClasses.length === 0) return null;

    const classInfo = state.classes.find(c => `${c.class}_${c.letter}` === selectedClass);
    const students = state.users.filter(u => u.role === 'student' && `${u.class}_${u.letter}` === selectedClass).sort((a,b) => a.fio.localeCompare(b.fio));

    const subjects = state.subjects;
    
    const [selectedStudent, setSelectedStudent] = useState<string | null>(null);

    return (
        <div className="space-y-6">
            <Card className="p-6">
                 <div className="flex justify-between items-center mb-6">
                     <h2 className="text-xl font-bold dark:text-white">Классный руководитель</h2>
                     <select className="border border-slate-300 rounded px-3 py-2 text-sm dark:bg-slate-800 dark:border-slate-700 dark:text-white outline-none" value={selectedClass} onChange={e => { setSelectedClass(e.target.value); setSelectedStudent(null); }}>
                        {homeroomClasses.map(c => <option key={`${c.class}_${c.letter}`} value={`${c.class}_${c.letter}`}>{c.class}{c.letter}</option>)}
                     </select>
                 </div>

                 {!selectedStudent ? (
                     <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {students.map(s => (
                            <div key={s.id} onClick={() => setSelectedStudent(s.id)} className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 cursor-pointer hover:border-blue-400 transition-colors">
                                <h3 className="font-bold text-slate-800 dark:text-white">{s.fio}</h3>
                                <p className="text-xs text-slate-500 mt-1">Нажмите для просмотра успеваемости</p>
                            </div>
                        ))}
                        {students.length === 0 && (
                            <div className="col-span-1 md:col-span-3 py-8 text-center text-slate-400">В этом классе пока нет учеников</div>
                        )}
                     </div>
                 ) : (
                     <div className="animate-in fade-in">
                        <div className="flex gap-4 items-center mb-6">
                           <button onClick={() => setSelectedStudent(null)} className="text-sm font-semibold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 px-3 py-1.5 rounded-lg transition-colors">← Назад к списку</button>
                           <h3 className="text-lg font-bold dark:text-white">{students.find(s => s.id === selectedStudent)?.fio} - Успеваемость</h3>
                        </div>

                        <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
                           <table className="w-full text-sm text-left">
                               <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                                   <tr>
                                       <th className="px-4 py-3 font-medium">Предмет</th>
                                       <th className="px-4 py-3 font-medium text-center">I</th>
                                       <th className="px-4 py-3 font-medium text-center">II</th>
                                       <th className="px-4 py-3 font-medium text-center">III</th>
                                       <th className="px-4 py-3 font-medium text-center">IV</th>
                                       <th className="px-4 py-3 font-medium text-center">Годовая</th>
                                       <th className="px-4 py-3 font-medium text-center">Ср. балл (текущий)</th>
                                   </tr>
                               </thead>
                               <tbody>
                                   {subjects.map(subj => {
                                        const finalGrades = state.finalGrades?.[selectedClass]?.[subj] || [];
                                        const getFinal = (q: string) => finalGrades.find((fg: any) => fg.studentId === selectedStudent && fg.quarter === q)?.grade || '-';
                                        
                                        const gradesObj = state.grades?.[selectedClass]?.[subj] || [];
                                        let totalWeight = 0;
                                        let totalScore = 0;
                                        gradesObj.forEach((g: any) => {
                                            if (g.studentId === selectedStudent && g.grade && g.grade !== 'Н') {
                                                const numeric = parseFloat(g.grade);
                                                if (!isNaN(numeric)) {
                                                    const gt = state.gradeTypes?.find((t: any) => t.id === g.typeId);
                                                    const w = gt && gt.weight !== undefined ? gt.weight : 1;
                                                    totalScore += numeric * w;
                                                    totalWeight += w;
                                                }
                                            }
                                        });
                                        const avg = totalWeight > 0 ? (totalScore / totalWeight).toFixed(2) : '-';

                                        return (
                                           <tr key={subj} className="border-b border-slate-100 dark:border-slate-800/50 last:border-0 hover:bg-slate-50/50 dark:hover:bg-slate-800/20">
                                               <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-200">{subj.replace(/^[a-zA-Z0-9_-]+__/, '')}</td>
                                               <td className="px-4 py-3 text-center font-semibold text-slate-700 dark:text-slate-300">{getFinal('Q1')}</td>
                                               <td className="px-4 py-3 text-center font-semibold text-slate-700 dark:text-slate-300">{getFinal('Q2')}</td>
                                               <td className="px-4 py-3 text-center font-semibold text-slate-700 dark:text-slate-300">{getFinal('Q3')}</td>
                                               <td className="px-4 py-3 text-center font-semibold text-slate-700 dark:text-slate-300">{getFinal('Q4')}</td>
                                               <td className="px-4 py-3 text-center font-bold text-blue-600 dark:text-blue-400">{getFinal('YEAR')}</td>
                                               <td className="px-4 py-3 text-center font-semibold text-amber-600 dark:text-amber-400 bg-amber-50/30 dark:bg-amber-900/10">{avg}</td>
                                           </tr>
                                        );
                                   })}
                               </tbody>
                           </table>
                        </div>
                     </div>
                 )}
            </Card>
        </div>
    )
}
