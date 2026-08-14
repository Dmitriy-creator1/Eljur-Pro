
import React, { useState } from 'react';
import { AppState, User } from '../types';
import * as H from '../utils/helpers';
import { Messaging } from './SharedComponents';
import { UserManagement } from './admin/UserManagement';
import { TeacherLoadManager } from './admin/TeacherLoadManager';
import { GroupManager } from './admin/GroupManager';
import { ScheduleEditor } from './admin/ScheduleEditor';
import { StudentRating } from './shared/StudentRating';
import { GradingSetup } from './admin/GradingSetup';

interface Props {
  state: AppState;
  onUpdate: (s: AppState) => void;
  user: User;
}

export default function DirectorDashboard({ state, onUpdate, user }: Props) {
  const [view, setView] = useState<'users' | 'schedule' | 'rating' | 'messages' | 'announcements' | 'load' | 'groups' | 'grading'>(() => {
    return (localStorage.getItem(`eljur_tab_${user.id}`) as any) || 'users';
  });

  React.useEffect(() => {
    localStorage.setItem(`eljur_tab_${user.id}`, view);
  }, [view, user.id]);
  const lang = state.settings.language || 'ru';
  const t = (k: string) => H.t(k, lang);

  return (
    <div className="space-y-8">
      <div className="bg-white p-1.5 rounded-xl sm:rounded-2xl shadow-sm border border-slate-200 flex overflow-x-auto hide-scrollbar gap-1 no-print w-full dark:bg-slate-900 dark:border-slate-800 pb-2 sm:pb-1.5">
        <TabButton active={view === 'users'} onClick={() => setView('users')} label={t('users')} />
        <TabButton active={view === 'load'} onClick={() => setView('load')} label={t('teacher_load')} />
        <TabButton active={view === 'groups'} onClick={() => setView('groups')} label={t('groups')} />
        <TabButton active={view === 'schedule'} onClick={() => setView('schedule')} label={t('schedule')} />
        <TabButton active={view === 'rating'} onClick={() => setView('rating')} label={t('rating')} />
        <TabButton active={view === 'grading'} onClick={() => setView('grading')} label={t('grading_setup')} />
        <TabButton active={view === 'messages'} onClick={() => setView('messages')} label={t('messages')} />
        <TabButton active={view === 'announcements'} onClick={() => setView('announcements')} label={t('announcements')} />
      </div>

      <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
        {view === 'users' && <UserManagement state={state} onUpdate={onUpdate} currentUser={user} />}
        {view === 'load' && <TeacherLoadManager state={state} onUpdate={onUpdate} />}
        {view === 'groups' && <GroupManager state={state} onUpdate={onUpdate} />}
        {view === 'schedule' && <ScheduleEditor state={state} onUpdate={onUpdate} />}
        {view === 'rating' && <StudentRating state={state} schoolId={user.schoolId} />}
        {view === 'grading' && <GradingSetup state={state} onUpdate={onUpdate} />}
        {view === 'messages' && <Messaging state={state} onUpdate={onUpdate} currentUser={user} type="messages" />}
        {view === 'announcements' && <Messaging state={state} onUpdate={onUpdate} currentUser={user} type="announcements" />}
      </div>
    </div>
  );
}

const TabButton = ({ active, onClick, label }: any) => (
  <button
    onClick={onClick}
    className={`flex-none px-4 sm:px-6 py-2 sm:py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 whitespace-nowrap ${
      active 
        ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25 dark:bg-blue-600' 
        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200'
    }`}
  >
    {label}
  </button>
);
